// Free Agent Session Hook - Manages local state and execution
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  FreeAgentSession,
  BlackboardEntry,
  BlackboardCategory,
  ToolCall,
  FreeAgentArtifact,
  SessionFile,
  AssistanceRequest,
  FreeAgentMessage,
  AgentResponse,
  FinalReport,
  RawIterationData,
  ToolResult,
  ArtifactType,
  ToolResultAttribute,
  AdvancedFeatures,
  ChildSession,
  OrchestrationState,
} from "@/types/freeAgent";
import { executeFrontendTool, ToolExecutionContext, SpawnRequest } from "@/lib/freeAgentToolExecutor";
import { resolveReferences, getResolvedReferenceSummary, type ResolverContext } from "@/lib/referenceResolver";
import type { PromptDataPayload } from "@/lib/systemPromptBuilder";
import type { PromptCustomization } from "@/types/systemPrompt";
import { isBinaryTool, detectBinaryContent, sanitizeBinaryResultForContext } from "@/lib/binaryToolUtils";

interface UseFreeAgentSessionOptions {
  maxIterations?: number;
}

// One-time cleanup of legacy session storage (remove on next load)
try {
  localStorage.removeItem("free_agent_sessions");
} catch {
  // Ignore cleanup errors
}

// Cache-enabled tools (expensive operations) - only cache exact duplicate requests
const CACHEABLE_TOOLS = ['read_github_repo', 'read_github_file', 'web_scrape'];
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Tools that support saveAs parameter for auto-saving results to attributes
// All tools that return data can use saveAs to store results as named attributes
const AUTO_SAVE_TOOLS = [
  // Web tools
  'brave_search', 
  'google_search', 
  'web_scrape',
  // Code tools
  'read_github_repo', 
  'read_github_file',
  // API tools
  'get_call_api', 
  'post_call_api',
  // Utility tools
  'get_time',
  'get_weather',
  // Document tools
  'pdf_info',
  'pdf_extract_text',
  'ocr_image',
  // File tools
  'read_zip_contents',
  'read_zip_file',
  'extract_zip_files',
  // Database tools
  'execute_sql',
  'read_database_schemas',
  // Generation tools
  'image_generation',
  'elevenlabs_tts',
  // Communication tools
  'send_email',
];

// Helper to generate cache key from tool + params
function getToolCacheKey(tool: string, params: Record<string, unknown>): string {
  return `${tool}:${JSON.stringify(params, Object.keys(params).sort())}`;
}

interface CacheEntry {
  result: unknown;
  timestamp: number;
  params: Record<string, unknown>;
}

const MAX_RETRY_ATTEMPTS = 3;

export function useFreeAgentSession(options: UseFreeAgentSessionOptions = {}) {
  const { maxIterations: defaultMaxIterations = 50 } = options;

  const [session, setSession] = useState<FreeAgentSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeToolIds, setActiveToolIds] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const iterationRef = useRef(0);
  const shouldStopRef = useRef(false); // Flag to stop execution loop
  
  // Refs for synchronous tracking between iterations (bypass async React state)
  const blackboardRef = useRef<BlackboardEntry[]>([]);
  const scratchpadRef = useRef<string>("");
  const toolResultAttributesRef = useRef<Record<string, ToolResultAttribute>>({});
  const artifactsRef = useRef<FreeAgentArtifact[]>([]);
  
  // Tool cache for expensive operations - caches EXACT duplicate requests only
  const toolCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  
  // Retry and iteration tracking refs for synchronous access during iteration loop
  const retryCountRef = useRef(0);
  const lastErrorIterationRef = useRef(0);
  const maxIterationsRef = useRef(defaultMaxIterations);
  
  // Interject handling refs
  const pendingInterjectRef = useRef<string | null>(null);
  const interjectResolverRef = useRef<(() => void) | null>(null);
  
  // Child session management for spawn feature
  const childSessionsRef = useRef<Map<string, ChildSession>>(new Map());
  const runningChildrenRef = useRef<Set<string>>(new Set());
  const orchestrationResolverRef = useRef<(() => void) | null>(null);
  const spawnRequestRef = useRef<SpawnRequest | null>(null);
  
  // Prompt customization ref for self-author tools
  const promptCustomizationRef = useRef<PromptCustomization | null>(null);
  
  // Callback to notify UI when prompt customization changes (for write_self)
  const promptCustomizationChangeCallbackRef = useRef<(() => void) | null>(null);
  
  // Update session (in-memory only - no localStorage persistence)
  const updateSession = useCallback((updater: (prev: FreeAgentSession | null) => FreeAgentSession | null) => {
    setSession((prev) => updater(prev));
  }, []);

  // Handle artifact creation - update ref immediately for sync access
  const handleArtifactCreated = useCallback((artifact: FreeAgentArtifact) => {
    // Update ref IMMEDIATELY (synchronous) for next iteration
    artifactsRef.current = [...artifactsRef.current, artifact];
    
    // Also update React state (async, for UI)
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            artifacts: [...prev.artifacts, artifact],
          }
        : null
    );
  }, [updateSession]);

  // Handle blackboard update - update ref immediately for sync access
  const handleBlackboardUpdate = useCallback((entry: BlackboardEntry) => {
    // Update ref IMMEDIATELY (synchronous) for next iteration
    blackboardRef.current = [...blackboardRef.current, entry];
    
    // Also update React state (async, for UI)
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            blackboard: [...prev.blackboard, entry],
          }
        : null
    );
  }, [updateSession]);

  // Handle scratchpad update - update ref immediately for sync access
  const handleScratchpadUpdate = useCallback((content: string) => {
    // Update ref IMMEDIATELY (synchronous) for next iteration
    scratchpadRef.current = content;
    
    // Also update React state (async, for UI)
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            scratchpad: content,
          }
        : null
    );
  }, [updateSession]);

  // Handle tool result attribute creation - update ref immediately for sync access
  const handleAttributeCreated = useCallback((attribute: ToolResultAttribute) => {
    // Update ref IMMEDIATELY (synchronous) for next iteration
    toolResultAttributesRef.current = {
      ...toolResultAttributesRef.current,
      [attribute.name]: attribute,
    };
    
    // Also update React state (async, for UI)
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            toolResultAttributes: {
              ...prev.toolResultAttributes,
              [attribute.name]: attribute,
            },
          }
        : null
    );
    
    console.log(`[Attribute Created] ${attribute.name} (${attribute.size} chars) from ${attribute.tool}`);
  }, [updateSession]);

  // Handle assistance request
  const handleAssistanceNeeded = useCallback((request: AssistanceRequest) => {
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            status: "needs_assistance",
            assistanceRequest: request,
          }
        : null
    );
    setIsRunning(false);
  }, [updateSession]);

  // Execute a single iteration - now accepts previousIterationResults directly
  // Returns: continue (keep iterating), toolResults, and error/spawn info for loop logic
  const executeIteration = useCallback(
    async (
      currentSession: FreeAgentSession,
      previousIterationResults: ToolResult[]
    ): Promise<{ continue: boolean; toolResults: ToolResult[]; hadError?: boolean; errorMessage?: string; spawnRequested?: boolean }> => {
      const maxIter = maxIterationsRef.current;
      if (iterationRef.current >= maxIter) {
        toast.warning("Max iterations reached");
        return { continue: false, toolResults: [] };
      }

      iterationRef.current++;

      try {
        // Get assistance response if we're resuming after user input
        const assistanceResponse = currentSession.assistanceRequest?.respondedAt
          ? {
              response: currentSession.assistanceRequest.response,
              fileId: currentSession.assistanceRequest.fileId,
              selectedChoice: currentSession.assistanceRequest.selectedChoice,
            }
          : undefined;

        console.log(`[Iteration ${iterationRef.current}] Passing ${previousIterationResults.length} previous tool results`);
        if (previousIterationResults.length > 0) {
          console.log(`[Iteration ${iterationRef.current}] Previous tools: ${previousIterationResults.map(t => t.tool).join(', ')}`);
          // Validate serialization and log sizes
          try {
            const serialized = JSON.stringify(previousIterationResults);
            console.log(`[Iteration ${iterationRef.current}] Serialized size: ${serialized.length} chars`);
            // Log each tool result size
            previousIterationResults.forEach((t, idx) => {
              const resultSize = t.result ? JSON.stringify(t.result).length : 0;
              console.log(`[Iteration ${iterationRef.current}]   [${idx}] ${t.tool}: ${resultSize} chars, success=${t.success}, hasError=${!!t.error}`);
            });
          } catch (e) {
            console.error(`[Iteration ${iterationRef.current}] Failed to serialize previousIterationResults:`, e);
          }
        }

        // Use refs for blackboard/scratchpad to ensure latest data (bypass async state)
        const currentBlackboard = blackboardRef.current.length > 0 ? blackboardRef.current : currentSession.blackboard;
        const currentScratchpad = scratchpadRef.current || currentSession.scratchpad || "";

        // Call edge function with current state - pass tool results directly
        // Include toolResultAttributes and artifacts for edge function reference resolution (backup)
        const currentAttributes = toolResultAttributesRef.current;
        const currentArtifacts = currentSession.artifacts || [];
        
        const { data, error } = await supabase.functions.invoke("free-agent", {
          body: {
            prompt: currentSession.prompt,
            model: currentSession.model,
            blackboard: currentBlackboard.map((b) => ({
              category: b.category,
              content: b.content,
              data: b.data,
              iteration: b.iteration,
              tools: b.tools, // Include tools called this iteration
            })),
            sessionFiles: currentSession.sessionFiles.map((f) => ({
              id: f.id,
              filename: f.filename,
              mimeType: f.mimeType,
              size: f.size,
              content: f.content,
            })),
            // Pass PREVIOUS iteration's results directly (not from session state)
            previousToolResults: previousIterationResults,
            iteration: iterationRef.current,
            // Pass scratchpad as persistent memory
            scratchpad: currentScratchpad,
            assistanceResponse,
            // Secrets will be injected by the caller via session options
            secretOverrides: currentSession.secretOverrides,
            configuredParams: currentSession.configuredParams,
            // Pass attributes and artifacts for edge function reference resolution
            toolResultAttributes: Object.fromEntries(
              Object.entries(currentAttributes).map(([name, attr]) => [
                name,
                { result: attr.result, size: attr.size }
              ])
            ),
            artifacts: currentArtifacts.map(a => ({
              id: a.id,
              type: a.type,
              title: a.title,
              content: a.content,
              description: a.description,
            })),
            // Pass dynamic prompt data from frontend
            promptData: currentSession.promptData,
            // Pass advanced features flags
            advancedFeatures: currentSession.advancedFeatures,
            // Pass tool instances for per-instance configuration
            toolInstances: currentSession.toolInstances,
          },
        });

        if (error) throw error;

        // Handle parsing/processing errors returned by edge function
        if (!data.success) {
          // Still record this in rawData for debugging!
          const errorRawData: RawIterationData = {
            iteration: iterationRef.current,
            timestamp: new Date().toISOString(),
            input: {
              systemPrompt: data.debug?.systemPrompt || "",
              userPrompt: data.debug?.userPrompt || currentSession.prompt,
              fullPromptSent: data.debug?.fullPromptSent || "",
              model: currentSession.model,
              scratchpadLength: data.debug?.scratchpadLength || 0,
              blackboardEntries: data.debug?.blackboardEntries || 0,
              previousResultsCount: data.debug?.previousResultsCount || 0,
            },
            output: {
              rawLLMResponse: data.debug?.rawLLMResponse || data.parseError?.rawResponse || "",
              parsedResponse: null,
              parseError: data.parseError || null,
              errorMessage: data.error,
            },
            toolResults: [],
          };

          updateSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: "error",
                  error: data.error,
                  rawData: [...(prev.rawData || []), errorRawData],
                  lastErrorIteration: iterationRef.current,
                }
              : null
          );

          // Return error info for retry logic - don't show toast here, let loop handle it
          return { continue: false, toolResults: [], hadError: true, errorMessage: data.error };
        }

        const response = data.response as AgentResponse;

        // Build resolver context for reference resolution
        const resolverContext: ResolverContext = {
          scratchpad: scratchpadRef.current || currentSession.scratchpad || "",
          blackboard: blackboardRef.current.length > 0 ? blackboardRef.current : currentSession.blackboard,
          attributes: toolResultAttributesRef.current,
          artifacts: currentSession.artifacts || [],
        };

        // Record tool calls with resolved params
        const newToolCalls: ToolCall[] = [];
        
        // Set tools as active for animation and resolve references in params
        for (const tc of response.tool_calls || []) {
          setActiveToolIds((prev) => new Set([...prev, tc.tool]));
          
          // Resolve references like {{scratchpad}}, {{attribute:name}}, etc.
          const originalParams = tc.params;
          const resolvedParams = resolveReferences(originalParams, resolverContext) as Record<string, unknown>;
          
          // Log what was resolved for debugging
          const resolutionSummary = getResolvedReferenceSummary(originalParams, resolvedParams);
          if (resolutionSummary.length > 0) {
            console.log(`[Reference Resolution] ${tc.tool}:`, resolutionSummary);
          }
          
          newToolCalls.push({
            id: crypto.randomUUID(),
            tool: tc.tool,
            params: resolvedParams, // Use resolved params
            status: "executing",
            startTime: new Date().toISOString(),
            iteration: iterationRef.current,
          });
        }

        // Collect tool results for this iteration
        const iterationToolResults: ToolResult[] = [];

        // Process edge function results and cache successful expensive tool calls
        for (const result of data.toolResults || []) {
          const toolCall = newToolCalls.find((t) => t.tool === result.tool && t.status === "executing");
          if (toolCall) {
            toolCall.status = result.success ? "completed" : "error";
            toolCall.result = result.result;
            toolCall.error = result.error;
            toolCall.endTime = new Date().toISOString();
            
            // Cache successful results for expensive tools (exact params match only)
            if (result.success && CACHEABLE_TOOLS.includes(result.tool)) {
              const cacheKey = getToolCacheKey(result.tool, toolCall.params || {});
              console.log(`[Cache SET] ${result.tool}`, cacheKey);
              toolCacheRef.current.set(cacheKey, {
                result: result.result,
                timestamp: Date.now(),
                params: toolCall.params || {},
              });
            }
            
            // Check for saveAs parameter and create attribute if present
            const saveAsName = toolCall.params?.saveAs as string | undefined;
            if (result.success && saveAsName) {
              // Detect binary content for image_generation and elevenlabs_tts
              const isBinaryTool = result.tool === 'image_generation' || result.tool === 'elevenlabs_tts';
              const imgResult = result.result as { imageUrl?: string; mimeType?: string } | undefined;
              const ttsResult = result.result as { audioContent?: string; mimeType?: string } | undefined;
              
              const isBinary = isBinaryTool && !!(imgResult?.imageUrl || ttsResult?.audioContent);
              const binaryMimeType = imgResult?.mimeType || ttsResult?.mimeType || 
                (result.tool === 'image_generation' ? 'image/png' : 'audio/mpeg');
              
              const resultString = isBinary 
                ? `[Binary ${binaryMimeType} - ${Math.round((imgResult?.imageUrl?.length || ttsResult?.audioContent?.length || 0) / 1024)}KB]`
                : JSON.stringify(result.result, null, 2);
              
              const attribute: ToolResultAttribute = {
                id: crypto.randomUUID(),
                name: saveAsName,
                tool: result.tool,
                params: toolCall.params || {},
                result: result.result,
                resultString,
                size: isBinary ? (imgResult?.imageUrl?.length || ttsResult?.audioContent?.length || 0) : resultString.length,
                createdAt: new Date().toISOString(),
                iteration: iterationRef.current,
                isBinary: isBinary || undefined,
                mimeType: isBinary ? binaryMimeType : undefined,
              };
              handleAttributeCreated(attribute);
              
              // AUTO-ADD to scratchpad with guidance on how to access
              const scratchpadEntry = isBinary
                ? `\n\n## ${saveAsName} (${binaryMimeType} from ${result.tool})\n[Binary content stored - ${Math.round(attribute.size / 1024)}KB]\nUse in pronghorn_post or other export tools.\n`
                : `\n\n## ${saveAsName} (from ${result.tool})\nData stored in attribute (${resultString.length} chars).\nAccess via: read_attribute({ names: ['${saveAsName}'] })\nPlaceholder: {{${saveAsName}}}\n\n**TODO: After reading, summarize key findings here.**`;
              const newScratchpad = (scratchpadRef.current || "") + scratchpadEntry;
              handleScratchpadUpdate(newScratchpad);
              
              // Replace the full result with a summary message guiding the agent
              const summaryResult = isBinary
                ? {
                    _savedAsAttribute: saveAsName,
                    _type: 'binary',
                    _message: `Binary ${binaryMimeType} saved to attribute '${saveAsName}' (${Math.round(attribute.size / 1024)}KB). Available for use in pronghorn_post or export tools. Do NOT attempt to read binary data.`,
                    mimeType: binaryMimeType,
                  }
                : {
                    _savedAsAttribute: saveAsName,
                    _message: `Result saved to attribute '${saveAsName}' (${resultString.length} chars). NEXT STEP: Call read_attribute({ names: ['${saveAsName}'] }) ONCE, extract key data, then write YOUR SUMMARY to scratchpad. Don't re-read raw data!`,
                  };
              
              // Add to iteration results with summary instead of full result
              iterationToolResults.push({
                tool: result.tool,
                success: result.success,
                result: summaryResult,
                error: result.error,
              });
              continue; // Skip normal push below
            }
          }
          // Add to iteration results (normal case without saveAs)
          iterationToolResults.push({
            tool: result.tool,
            success: result.success,
            result: result.result,
            error: result.error,
          });
        }

        // Handle frontend tools
        for (const handler of data.frontendHandlers || []) {
          const toolCall = newToolCalls.find((t) => t.tool === handler.tool && t.status === "executing");
          
          // Use synchronous refs to avoid race conditions - scratchpadRef/blackboardRef are updated immediately
          // while currentSession state is async and may be stale within the same iteration
          const context: ToolExecutionContext = {
            sessionId: currentSession.id,
            prompt: currentSession.prompt,
            scratchpad: scratchpadRef.current || currentSession.scratchpad || "",
            blackboard: blackboardRef.current.length > 0 ? blackboardRef.current : currentSession.blackboard,
            sessionFiles: currentSession.sessionFiles,
            toolResultAttributes: toolResultAttributesRef.current,
            artifacts: artifactsRef.current.length > 0 ? artifactsRef.current : currentSession.artifacts,
            onArtifactCreated: handleArtifactCreated,
            onBlackboardUpdate: handleBlackboardUpdate,
            onScratchpadUpdate: handleScratchpadUpdate,
            onAssistanceNeeded: handleAssistanceNeeded,
            // Advanced features
            advancedFeatures: currentSession.advancedFeatures,
            // Prompt customization for self-author tools
            promptCustomization: promptCustomizationRef.current || undefined,
            // Callback to update in-memory ref immediately so read_self gets fresh data
            onPromptCustomizationUpdate: (newCustomization) => {
              promptCustomizationRef.current = newCustomization;
              console.log('[write_self] Updated promptCustomizationRef for immediate read_self access');
            },
            // Callback to notify UI when prompt is modified via write_self
            onPromptCustomizationChange: () => {
              if (promptCustomizationChangeCallbackRef.current) {
                promptCustomizationChangeCallbackRef.current();
              }
            },
            // Spawn callback
            onSpawnChildren: (request) => {
              spawnRequestRef.current = request;
              console.log(`[Spawn] Request received for ${request.children.length} children:`, request.children.map(c => c.name));
            },
          };
          
          // Resolve references in frontend tool params as well
          const resolvedFrontendParams = resolveReferences(handler.params, resolverContext) as Record<string, unknown>;
          const result = await executeFrontendTool(handler.tool, resolvedFrontendParams, context);

          if (toolCall) {
            toolCall.status = result.success ? "completed" : "error";
            toolCall.result = result.result;
            toolCall.error = result.error;
            toolCall.endTime = new Date().toISOString();
          }

          // Add frontend tool results
          iterationToolResults.push({
            tool: handler.tool,
            success: result.success,
            result: result.result,
            error: result.error,
          });
          
          // Auto-create artifacts for image_generation results
          if (result.success && handler.tool === 'image_generation' && result.result) {
            const imgResult = result.result as { imageUrl?: string; model?: string; mimeType?: string };
            if (imgResult.imageUrl) {
              const imageArtifact: FreeAgentArtifact = {
                id: crypto.randomUUID(),
                type: 'image',
                title: `Generated Image (Iteration ${iterationRef.current})`,
                content: imgResult.imageUrl, // Already has data:image/... prefix
                description: `Generated with ${imgResult.model || 'Gemini'}`,
                mimeType: imgResult.mimeType || 'image/png',
                createdAt: new Date().toISOString(),
                iteration: iterationRef.current,
              };
              handleArtifactCreated(imageArtifact);
              console.log(`[Auto-Artifact] Created image artifact from image_generation`);
            }
          }
          
          // Auto-create artifacts for elevenlabs_tts results
          if (result.success && handler.tool === 'elevenlabs_tts' && result.result) {
            const ttsResult = result.result as { audioContent?: string; mimeType?: string };
            if (ttsResult.audioContent) {
              const mimeType = ttsResult.mimeType || 'audio/mpeg';
              const audioUrl = ttsResult.audioContent.startsWith('data:') 
                ? ttsResult.audioContent 
                : `data:${mimeType};base64,${ttsResult.audioContent}`;
              const audioArtifact: FreeAgentArtifact = {
                id: crypto.randomUUID(),
                type: 'audio',
                title: `Generated Audio (Iteration ${iterationRef.current})`,
                content: audioUrl,
                description: 'Text-to-speech audio generated with ElevenLabs',
                mimeType,
                createdAt: new Date().toISOString(),
                iteration: iterationRef.current,
              };
              handleArtifactCreated(audioArtifact);
              console.log(`[Auto-Artifact] Created audio artifact from elevenlabs_tts`);
            }
          }

          // If assistance needed, stop here
          if (handler.tool === "request_assistance") {
            return { continue: false, toolResults: iterationToolResults };
          }
          
          // If spawn was requested, save rawData and blackboard before stopping
          if (handler.tool === "spawn" && spawnRequestRef.current) {
            // Store raw debug data for the Raw viewer
            const spawnRawData: RawIterationData = {
              iteration: iterationRef.current,
              timestamp: new Date().toISOString(),
              input: {
                systemPrompt: data.debug?.systemPrompt || "",
                userPrompt: data.debug?.userPrompt || currentSession.prompt,
                fullPromptSent: data.debug?.fullPromptSent || "",
                model: currentSession.model,
                scratchpadLength: data.debug?.scratchpadLength || 0,
                blackboardEntries: data.debug?.blackboardEntries || 0,
                previousResultsCount: data.debug?.previousResultsCount || 0,
              },
              output: {
                rawLLMResponse: data.debug?.rawLLMResponse || "",
                parsedResponse: data.response,
              },
              toolResults: iterationToolResults,
              toolCalls: response.tool_calls || [],  // Tool calls requested by LLM this iteration
            };
            
            // Add blackboard entry - use same logic as main flow (auto-generate if missing)
            const spawnBlackboardEntry: BlackboardEntry = response.blackboard_entry 
              ? {
                  id: crypto.randomUUID(),
                  timestamp: new Date().toISOString(),
                  category: response.blackboard_entry.category,
                  content: `[#${iterationRef.current} ${response.blackboard_entry.category}] ${response.blackboard_entry.content}`,
                  data: response.blackboard_entry.data,
                  iteration: iterationRef.current,
                }
              : {
                  id: `auto_${iterationRef.current}_${Date.now()}`,
                  category: 'decision' as BlackboardCategory,
                  content: `[AUTO-LOGGED #${iterationRef.current}] Spawn requested. Tools: ${newToolCalls.map(t => t.tool).join(', ')}`,
                  timestamp: new Date().toISOString(),
                  iteration: iterationRef.current,
                };
            handleBlackboardUpdate(spawnBlackboardEntry);
            
            // Update session with rawData
            updateSession((prev) =>
              prev
                ? {
                    ...prev,
                    currentIteration: iterationRef.current,
                    toolCalls: [...prev.toolCalls, ...newToolCalls],
                    rawData: [...(prev.rawData || []), spawnRawData],
                    lastActivityTime: new Date().toISOString(),
                  }
                : null
            );
            
            return { continue: false, toolResults: iterationToolResults, spawnRequested: true };
          }
        }

        // Clear active tools after brief delay
        setTimeout(() => {
          setActiveToolIds(new Set());
        }, 1000);

        // Store raw debug data for the Raw viewer (including tool results)
        const rawIterationData: RawIterationData = {
          iteration: iterationRef.current,
          timestamp: new Date().toISOString(),
          input: {
            systemPrompt: data.debug?.systemPrompt || "",
            userPrompt: data.debug?.userPrompt || currentSession.prompt,
            fullPromptSent: data.debug?.fullPromptSent || "",
            model: currentSession.model,
            scratchpadLength: data.debug?.scratchpadLength || 0,
            blackboardEntries: data.debug?.blackboardEntries || 0,
            previousResultsCount: data.debug?.previousResultsCount || 0,
          },
          output: {
            rawLLMResponse: data.debug?.rawLLMResponse || "",
            parsedResponse: data.response,
          },
          toolResults: iterationToolResults,
          toolCalls: response.tool_calls || [],  // Tool calls requested by LLM this iteration
        };

        // Determine if we need to auto-generate a blackboard entry
        const shouldAutoGenerateBlackboard = (): boolean => {
          const entry = response.blackboard_entry;
          // No entry provided
          if (!entry || !entry.content) return true;
          // Too short to be meaningful
          if (entry.content.trim().length < 20) return true;
          // Check if it's a duplicate of the last entry
          if (blackboardRef.current.length > 0) {
            const lastEntry = blackboardRef.current[blackboardRef.current.length - 1];
            const normalize = (s: string) => s.toLowerCase().replace(/\[#\d+\s*\w*\]/g, '').replace(/iteration\s*\d+/gi, '').trim();
            if (normalize(entry.content) === normalize(lastEntry.content)) {
              return true; // Duplicate detected
            }
          }
          return false;
        };

        // Generate auto blackboard entry when agent omits proper update
        const generateAutoBlackboardEntry = (): BlackboardEntry => {
          const artifactCount = newArtifacts.length;
          const artifactNames = newArtifacts.map(a => a.title).slice(0, 3).join(', ');
          const toolCount = newToolCalls.length;
          const toolNames = newToolCalls.map(t => t.tool).slice(0, 5).join(', ');
          
          const parts: string[] = [];
          
          if (artifactCount > 0) {
            parts.push(`Created ${artifactCount} artifact(s): ${artifactNames}${artifactCount > 3 ? '...' : ''}`);
          }
          
          if (toolCount > 0) {
            parts.push(`Executed ${toolCount} tool(s): ${toolNames}${toolCount > 5 ? '...' : ''}`);
          }
          
          // Check if scratchpad was updated
          const scratchpadLen = scratchpadRef.current.length;
          if (scratchpadLen > 0) {
            parts.push(`Scratchpad: ${scratchpadLen} chars`);
          }
          
          if (parts.length === 0) {
            parts.push('No artifacts, tools, or scratchpad updates this iteration');
          }
          
          const content = `[AUTO-LOGGED #${iterationRef.current}] ${parts.join('. ')}.`;
          
          // Determine category based on what happened
          let category: BlackboardCategory = 'observation';
          if (artifactCount > 0) category = 'artifact';
          else if (toolCount > 0) category = 'decision';
          
          return {
            id: `auto_${iterationRef.current}_${Date.now()}`,
            category,
            content,
            timestamp: new Date().toISOString(),
            iteration: iterationRef.current,
          };
        };

        // Get tool names for this iteration (for blackboard context)
        const iterationToolNames = newToolCalls.map(t => t.tool);
        
        // Add blackboard entry from response OR auto-generate if missing/poor
        let blackboardEntry: BlackboardEntry;
        if (shouldAutoGenerateBlackboard()) {
          console.log(`[FreeAgent] Auto-generating blackboard entry for iteration ${iterationRef.current}`);
          blackboardEntry = generateAutoBlackboardEntry();
          blackboardEntry.tools = iterationToolNames; // Inject tools
        } else {
          blackboardEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            category: response.blackboard_entry!.category,
            content: `[#${iterationRef.current} ${response.blackboard_entry!.category}] ${response.blackboard_entry!.content}`,
            data: response.blackboard_entry!.data,
            iteration: iterationRef.current,
            tools: iterationToolNames, // Inject tools
          };
        }
        handleBlackboardUpdate(blackboardEntry);

        // Add assistant message
        const assistantMessage: FreeAgentMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reasoning || response.message_to_user || "",
          timestamp: new Date().toISOString(),
          iteration: iterationRef.current,
        };

        // Add artifacts from response - filter out duplicates from frontend tools (export_word, export_pdf)
        // Also resolve {{attribute:name}} references in content to actual data
        const existingArtifactTitles = new Set(artifactsRef.current.map(a => a.title));
        const resolverCtx: ResolverContext = {
          scratchpad: scratchpadRef.current,
          blackboard: blackboardRef.current,
          attributes: toolResultAttributesRef.current,
          artifacts: artifactsRef.current,
        };
        const newArtifacts: FreeAgentArtifact[] = (response.artifacts || [])
          .filter(a => !existingArtifactTitles.has(a.title)) // Skip duplicates
          .map((a) => {
            // Resolve references like {{attribute:dog_image_3}} to actual image data
            const resolvedContent = resolveReferences(a.content, resolverCtx) as string;
            return {
              id: crypto.randomUUID(),
              type: a.type,
              title: a.title,
              content: resolvedContent,
              description: a.description,
              createdAt: new Date().toISOString(),
              iteration: iterationRef.current,
            };
          });
        
        // Update artifacts ref immediately for sync access in next iteration
        if (newArtifacts.length > 0) {
          artifactsRef.current = [...artifactsRef.current, ...newArtifacts];
        }

        // AUTO-CREATE ARTIFACT if completed with no artifacts but has summary content
        if (response.status === "completed" && newArtifacts.length === 0) {
          const summaryParts: string[] = [];
          
          if (response.final_report?.summary) {
            summaryParts.push(`## Summary\n\n${response.final_report.summary}`);
          }
          
          if (response.final_report?.key_findings?.length) {
            summaryParts.push(`\n\n## Key Findings\n\n${response.final_report.key_findings.map((f: string) => `- ${f}`).join('\n')}`);
          }
          
          if (response.message_to_user) {
            summaryParts.push(`\n\n## Agent Response\n\n${response.message_to_user}`);
          }
          
          const autoContent = summaryParts.join('') || response.reasoning || "Task completed successfully.";
          
          if (autoContent.length > 20) {
            newArtifacts.push({
              id: crypto.randomUUID(),
              type: "text" as ArtifactType,
              title: "Task Summary",
              content: autoContent,
              description: "Auto-generated summary from agent completion",
              createdAt: new Date().toISOString(),
              iteration: iterationRef.current,
            });
            console.log("Auto-created summary artifact from final report");
          }
        }

        // Update session - clear assistance request after it's been processed
        updateSession((prev) =>
          prev
            ? {
                ...prev,
                currentIteration: iterationRef.current,
                toolCalls: [...prev.toolCalls, ...newToolCalls],
                messages: [...prev.messages, assistantMessage],
                artifacts: [...prev.artifacts, ...newArtifacts],
                lastActivityTime: new Date().toISOString(),
                // Clear the assistance request once the response has been used
                assistanceRequest: assistanceResponse ? undefined : prev.assistanceRequest,
                // Store raw data for debugging
                rawData: [...(prev.rawData || []), rawIterationData],
              }
            : null
        );

        // Check status
        if (response.status === "completed") {
          const finalReport: FinalReport = {
            summary: response.final_report?.summary || "Task completed",
            toolsUsed: response.final_report?.tools_used || [],
            artifactsCreated: (response.final_report?.artifacts_created || []).map((a) => ({
              title: typeof a === 'string' ? a : (a.title || 'Unnamed'),
              description: typeof a === 'string' ? '' : (a.description || ''),
              artifactId: "",
            })),
            keyFindings: response.final_report?.key_findings || [],
            totalIterations: iterationRef.current,
            totalTime: Date.now() - new Date(currentSession.startTime).getTime(),
          };

          updateSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: "completed",
                  finalReport,
                  endTime: new Date().toISOString(),
                }
              : null
          );
          
          toast.success("Free Agent completed the task!");
          return { continue: false, toolResults: iterationToolResults };
        } else if (response.status === "needs_assistance") {
          return { continue: false, toolResults: iterationToolResults };
        } else if (response.status === "error") {
          updateSession((prev) =>
            prev
              ? {
                  ...prev,
                  status: "error",
                  error: response.reasoning,
                }
              : null
          );
          toast.error("Free Agent encountered an error");
          return { continue: false, toolResults: iterationToolResults };
        }

        return { continue: true, toolResults: iterationToolResults }; // Continue running
      } catch (error) {
        console.error("Iteration failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        updateSession((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                error: errorMessage,
                lastErrorIteration: iterationRef.current,
              }
            : null
        );
        // Return error info for retry logic - don't show toast here, let loop handle it
        return { continue: false, toolResults: [], hadError: true, errorMessage };
      }
    },
    [handleArtifactCreated, handleBlackboardUpdate, handleScratchpadUpdate, handleAssistanceNeeded, handleAttributeCreated, updateSession]
  );

  // Run a child session - calls edge function iteratively
  const runChildSession = useCallback(
    async (
      child: ChildSession,
      parentSession: FreeAgentSession,
      parentPromptData: FreeAgentSession['promptData'],
      onUpdate: (child: ChildSession) => void,
      onToolActive?: (toolId: string, active: boolean) => void
    ) => {
      let childIteration = 0;
      let lastToolResults: ToolResult[] = [];
      let childScratchpad = child.scratchpad;
      let childBlackboard = [...child.blackboard];
      let childToolCalls = [...child.toolCalls];
      let childArtifacts = [...child.artifacts];
      let childAttributes: Record<string, ToolResultAttribute> = { ...child.toolResultAttributes };
      let childRawData: RawIterationData[] = [...(child.rawData || [])];
      
      console.log(`[Child:${child.name}] Starting execution with max ${child.maxIterations} iterations`);
      
      // Build child's promptData by substituting the user_task section with child-specific task and rules
      // This keeps the identity section clean and uses the proper task section
      const childPromptData: FreeAgentSession['promptData'] = parentPromptData ? {
        toolOverrides: parentPromptData.toolOverrides,
        disabledTools: parentPromptData.disabledTools,
        toolDefinitions: parentPromptData.toolDefinitions, // Inherit tool definitions from parent
        sections: parentPromptData.sections.map(section => {
          if (section.id === 'user_task') {
            // Substitute the entire user_task section with child-specific content
            return {
              ...section,
              content: `<prompt-section id="user_task" type="task">
## CHILD AGENT TASK: ${child.name}

${child.task}

### ⚠️ CHILD AGENT CRITICAL RULES:

**1. PROGRESS TRACKING (MANDATORY):**
- Write "✅ COMPLETED: [item]" in blackboard for EACH item you finish
- Check PREVIOUS ITERATION RESULTS - if tool SUCCEEDED, the data is SAVED
- If you see "saveAs" confirmation, DON'T re-fetch - MOVE ON to next item

**2. LOOP PREVENTION:**
- Before calling a tool, check: "Did I already call this with these params?"
- If your last 2 blackboard entries are nearly identical, YOU ARE LOOPING
- If looping: Check your scratchpad/attributes - data may already be there

**3. COMPLETION CRITERIA:**
- When ALL items in your task are done, set status to "completed"
- Include final_report with summary of what you collected
- Write consolidated findings to scratchpad with [${child.name}] prefix

**4. EFFICIENCY:**
- You have MAX ${child.maxIterations} iterations - work quickly
- Each successful tool call auto-saves results as an attribute
- Use read_attribute to verify data was saved before re-fetching
</prompt-section>`,
            };
          }
          return section;
        }),
      } : undefined;
      
      while (childIteration < child.maxIterations && !shouldStopRef.current) {
        childIteration++;
        
        // Update child state
        const updatedChild: ChildSession = {
          ...child,
          currentIteration: childIteration,
          blackboard: childBlackboard,
          scratchpad: childScratchpad,
          toolCalls: childToolCalls,
          artifacts: childArtifacts,
          toolResultAttributes: childAttributes,
          rawData: childRawData,
        };
        onUpdate(updatedChild);
        
        try {
          console.log(`[Child:${child.name}] Iteration ${childIteration}/${child.maxIterations}`);
          
          // Call edge function for this child
          const { data, error } = await supabase.functions.invoke("free-agent", {
            body: {
              prompt: child.task,
              model: parentSession.model,
              blackboard: childBlackboard.map(b => ({
                category: b.category,
                content: b.content,
                data: b.data,
                iteration: b.iteration,
                tools: b.tools,
              })),
              sessionFiles: parentSession.sessionFiles.map(f => ({
                id: f.id,
                filename: f.filename,
                mimeType: f.mimeType,
                size: f.size,
                content: f.content,
              })),
              previousToolResults: lastToolResults,
              iteration: childIteration,
              scratchpad: childScratchpad,
              secretOverrides: parentSession.secretOverrides,
              configuredParams: parentSession.configuredParams,
              // Pass child's own attributes for reference resolution
              toolResultAttributes: Object.fromEntries(
                Object.entries(childAttributes).map(([name, attr]) => [
                  name,
                  { result: attr.result, size: attr.size }
                ])
              ),
              artifacts: childArtifacts.map(a => ({
                id: a.id,
                type: a.type,
                title: a.title,
                content: a.content,
                description: a.description,
              })),
              promptData: childPromptData,
              advancedFeatures: undefined, // Children don't get advanced features
            },
          });
          
          if (error) throw error;
          
          if (!data.success) {
            console.error(`[Child:${child.name}] LLM error:`, data.error);
            // Add error to blackboard and continue
            childBlackboard.push({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              category: 'error',
              content: `Error at iteration ${childIteration}: ${data.error}`,
              iteration: childIteration,
            });
            continue;
          }
          
          const response = data.response as AgentResponse;
          
          // Capture raw iteration data for debugging
          childRawData.push({
            iteration: childIteration,
            timestamp: new Date().toISOString(),
            input: {
              model: parentSession.model || 'unknown',
              userPrompt: child.task,
              systemPrompt: data.debug?.fullPromptSent || data.debug?.systemPrompt || '',
              fullPromptSent: data.debug?.fullPromptSent || '',
              scratchpadLength: childScratchpad.length,
              blackboardEntries: childBlackboard.length,
              previousResultsCount: lastToolResults.length,
            },
            output: {
              rawLLMResponse: data.debug?.rawLLMResponse || JSON.stringify(data.parsed || response),
              parsedResponse: data.parsed || response,
              parseError: data.parseError,
              errorMessage: data.error,
            },
            toolResults: (data.toolResults || []).map((tr: ToolResult) => ({
              tool: tr.tool,
              success: tr.success,
              result: tr.result,
              error: tr.error,
            })),
            toolCalls: response.tool_calls || [],  // Tool calls requested by LLM this iteration
          });
          
          // Process tool calls first to get tool names for blackboard
          const iterationToolResults: ToolResult[] = [];
          const iterationToolNames: string[] = [];
          
          for (const result of data.toolResults || []) {
            iterationToolNames.push(result.tool);
            const toolCall: ToolCall = {
              id: crypto.randomUUID(),
              tool: result.tool,
              params: result.params || {},
              status: result.success ? 'completed' : 'error',
              result: result.result,
              error: result.error,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              iteration: childIteration,
            };
            childToolCalls.push(toolCall);
            
            // Highlight tool usage on canvas - don't deactivate to prevent flickering
            if (onToolActive) {
              onToolActive(result.tool, true);
            }
            
            // Auto-save ALL successful tool results from AUTO_SAVE_TOOLS for children
            const baseTool = result.tool.includes(':') ? result.tool.split(':')[0] : result.tool;
            if (result.success && AUTO_SAVE_TOOLS.includes(baseTool)) {
              const explicitSaveAs = toolCall.params?.saveAs as string | undefined;
              let autoName = explicitSaveAs;
              
              if (!autoName) {
                const keyParam = toolCall.params?.location || toolCall.params?.query || toolCall.params?.url || toolCall.params?.path || '';
                const paramSlug = String(keyParam).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
                autoName = paramSlug ? `${result.tool}_${paramSlug}` : `${result.tool}_${childIteration}_${childToolCalls.length}`;
              }
              
              // Detect binary content for image_generation and elevenlabs_tts
              const binaryInfo = detectBinaryContent(result.tool, result.result);
              const resultString = binaryInfo.isBinary 
                ? binaryInfo.summary
                : JSON.stringify(result.result, null, 2);
              
              const attribute: ToolResultAttribute = {
                id: crypto.randomUUID(),
                name: autoName,
                tool: result.tool,
                params: toolCall.params || {},
                result: result.result, // Keep full result for artifact display
                resultString,
                size: binaryInfo.isBinary ? binaryInfo.size : resultString.length,
                createdAt: new Date().toISOString(),
                iteration: childIteration,
                isBinary: binaryInfo.isBinary || undefined,
                mimeType: binaryInfo.mimeType,
              };
              childAttributes[autoName] = attribute;
              console.log(`[Child:${child.name}] Attribute auto-saved: ${autoName} (${binaryInfo.isBinary ? 'binary ' + binaryInfo.mimeType : resultString.length + ' chars'})`);
              
              // Enhanced scratchpad entry with explicit completion marker and key params
              const keyParamValue = toolCall.params?.location || toolCall.params?.query || toolCall.params?.url || '';
              const keyParamDisplay = keyParamValue ? ` for "${keyParamValue}"` : '';
              const sizeDisplay = binaryInfo.isBinary ? binaryInfo.summary : `${resultString.length} chars`;
              const scratchpadEntry = `\n\n## ✅ COMPLETED: ${autoName}${keyParamDisplay}\n**Tool:** ${result.tool}\n**Size:** ${sizeDisplay}\n**Status:** Data saved to attribute. Access via: read_attribute({ names: ['${autoName}'] })\n`;
              childScratchpad = childScratchpad + scratchpadEntry;
            }
            
            // CRITICAL: Add ALL tool results (success or failure) to iteration results
            // For binary tools, sanitize the result to prevent context bloat in LLM
            const sanitizedResult = isBinaryTool(result.tool) 
              ? sanitizeBinaryResultForContext(result.tool, result.result)
              : result.result;
            
            iterationToolResults.push({
              tool: result.tool,
              success: result.success,
              result: sanitizedResult,
              error: result.error,
            });
          }
          
          // Process blackboard entry (with tool names from this iteration)
          if (response.blackboard_entry) {
            childBlackboard.push({
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              category: response.blackboard_entry.category as BlackboardCategory,
              content: response.blackboard_entry.content,
              data: response.blackboard_entry.data,
              iteration: childIteration,
              tools: iterationToolNames,
            });
          }
          
          // Process artifacts from response
          if (response.artifacts && response.artifacts.length > 0) {
            const newChildArtifacts: FreeAgentArtifact[] = response.artifacts.map((a) => ({
              id: crypto.randomUUID(),
              type: a.type as ArtifactType,
              title: a.title,
              content: a.content,
              description: a.description || `Created by ${child.name}`,
              createdAt: new Date().toISOString(),
              iteration: childIteration,
            }));
            childArtifacts.push(...newChildArtifacts);
            console.log(`[Child:${child.name}] Created ${newChildArtifacts.length} artifacts`);
          }
          
          // CRITICAL: Also process frontendHandlers array (separate from toolResults)
          // This is where write_scratchpad, write_blackboard, etc. are returned by the edge function
          for (const handler of data.frontendHandlers || []) {
            const toolCall: ToolCall = {
              id: crypto.randomUUID(),
              tool: handler.tool,
              params: handler.params || {},
              status: 'completed',
              result: undefined,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              iteration: childIteration,
            };
            childToolCalls.push(toolCall);
            
            // Highlight tool usage on canvas
            if (onToolActive) {
              onToolActive(handler.tool, true);
              setTimeout(() => onToolActive(handler.tool, false), 1000);
            }
            
            // Handle each frontend tool locally for child
            if (handler.tool === 'write_scratchpad') {
              const content = handler.params.content as string;
              const mode = (handler.params.mode as string) || "append";
              const newContent = mode === "append" 
                ? childScratchpad + (childScratchpad ? "\n\n" : "") + content 
                : content;
              childScratchpad = newContent;
              console.log(`[Child:${child.name}] Scratchpad updated via frontendHandler (${newContent.length} chars)`);
              
              iterationToolResults.push({
                tool: handler.tool,
                success: true,
                result: { success: true, length: newContent.length },
              });
            } else if (handler.tool === 'write_blackboard') {
              const entry: BlackboardEntry = {
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                category: (handler.params.category as BlackboardCategory) || 'observation',
                content: handler.params.content as string,
                data: handler.params.data as Record<string, unknown> | undefined,
                iteration: childIteration,
                tools: iterationToolNames,
              };
              childBlackboard.push(entry);
              
              iterationToolResults.push({
                tool: handler.tool,
                success: true,
                result: { id: entry.id, success: true },
              });
            } else if (handler.tool === 'read_scratchpad') {
              iterationToolResults.push({
                tool: handler.tool,
                success: true,
                result: { content: childScratchpad },
              });
            } else if (handler.tool === 'read_attribute') {
              const names = handler.params.names as string[] || [];
              const requestedAttrs: Record<string, unknown> = {};
              const notFound: string[] = [];
              for (const name of names) {
                if (childAttributes[name]) {
                  requestedAttrs[name] = childAttributes[name].result;
                } else {
                  notFound.push(name);
                }
              }
              iterationToolResults.push({
                tool: handler.tool,
                success: true,
                result: {
                  ...requestedAttrs,
                  ...(notFound.length > 0 && {
                    _notFound: notFound,
                    _hint: `Attributes not found: [${notFound.join(', ')}]. Available: [${Object.keys(childAttributes).join(', ') || 'none'}]`,
                  }),
                },
              });
            } else if (handler.tool === 'read_blackboard') {
              iterationToolResults.push({
                tool: handler.tool,
                success: true,
                result: { entries: childBlackboard },
              });
            } else {
              // Other frontend tools - just log and pass through
              console.log(`[Child:${child.name}] Unhandled frontend tool: ${handler.tool}`);
              iterationToolResults.push({
                tool: handler.tool,
                success: true,
                result: { handled: false },
              });
            }
          }
          
          // CHILD LOOP DETECTION: Check for repetitive blackboard patterns
          // If last 2+ entries are nearly identical, inject a warning into tool results
          if (childBlackboard.length >= 2) {
            const recentEntries = childBlackboard.slice(-3);
            const normalizedContents = recentEntries.map(e => 
              e.content.toLowerCase().replace(/step\s*\d+:?/gi, '').replace(/\s+/g, ' ').trim()
            );
            
            // Check if the last 2 entries are nearly identical
            const lastTwo = normalizedContents.slice(-2);
            const isDuplicate = lastTwo.length === 2 && lastTwo[0] === lastTwo[1];
            
            // Also check for repeated "NEXT:" patterns with same target
            const nextMatches = recentEntries.map(e => {
              const match = e.content.match(/NEXT:\s*([^.]+)/i);
              return match ? match[1].toLowerCase().trim() : '';
            }).filter(n => n);
            const hasRepeatedNext = nextMatches.length >= 2 && 
              nextMatches[nextMatches.length - 1] === nextMatches[nextMatches.length - 2];
            
            if (isDuplicate || hasRepeatedNext) {
              console.warn(`[Child:${child.name}] LOOP DETECTED at iteration ${childIteration}! Injecting warning.`);
              
              // List what attributes are already saved
              const savedAttributesList = Object.keys(childAttributes).join(', ') || 'none';
              
              iterationToolResults.unshift({
                tool: '_system_loop_warning',
                success: true,
                result: {
                  warning: '⚠️ LOOP DETECTED - YOU ARE REPEATING THE SAME ACTION!',
                  message: 'Your last blackboard entries are nearly identical. CHECK YOUR PROGRESS:',
                  savedAttributes: savedAttributesList,
                  scratchpadMarkers: childScratchpad.match(/## ✅ COMPLETED:/g)?.length || 0,
                  action: 'If the data you need is already in savedAttributes above, MOVE ON to the next item or set status to "completed" if done.',
                },
              });
            }
          }
          
          lastToolResults = iterationToolResults;
          
          // Check for completion
          if (response.status === 'completed') {
            console.log(`[Child:${child.name}] Completed at iteration ${childIteration}`);
            const finalChild: ChildSession = {
              ...child,
              status: 'completed',
              currentIteration: childIteration,
              endTime: new Date().toISOString(),
              blackboard: childBlackboard,
              scratchpad: childScratchpad,
              toolCalls: childToolCalls,
              artifacts: childArtifacts,
              toolResultAttributes: childAttributes,
              rawData: childRawData,
            };
            onUpdate(finalChild);
            return;
          }
          
          // Check for error status
          if (response.status === 'error') {
            console.error(`[Child:${child.name}] Error status at iteration ${childIteration}`);
            const errorChild: ChildSession = {
              ...child,
              status: 'error',
              currentIteration: childIteration,
              endTime: new Date().toISOString(),
              blackboard: childBlackboard,
              scratchpad: childScratchpad,
              toolCalls: childToolCalls,
              artifacts: childArtifacts,
              toolResultAttributes: childAttributes,
              rawData: childRawData,
              error: response.message_to_user || 'Child agent encountered an error',
            };
            onUpdate(errorChild);
            return;
          }
          
          // Small delay between iterations - minimal for responsiveness
          await new Promise(resolve => setTimeout(resolve, 50));
          
        } catch (err) {
          console.error(`[Child:${child.name}] Exception at iteration ${childIteration}:`, err);
          childBlackboard.push({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            category: 'error',
            content: `Exception at iteration ${childIteration}: ${String(err)}`,
            iteration: childIteration,
          });
        }
      }
      
      // Max iterations reached
      console.log(`[Child:${child.name}] Max iterations reached (${child.maxIterations})`);
      const finalChild: ChildSession = {
        ...child,
        status: 'completed',
        currentIteration: childIteration,
        endTime: new Date().toISOString(),
        blackboard: childBlackboard,
        scratchpad: childScratchpad,
        toolCalls: childToolCalls,
        artifacts: childArtifacts,
        toolResultAttributes: childAttributes,
        rawData: childRawData,
      };
      onUpdate(finalChild);
    },
    []
  );

  // Run the iteration loop with retry logic
  const runIterationLoop = useCallback(
    async (sessionId: string, initialSession: FreeAgentSession, initialToolResults: ToolResult[] = []) => {
      let shouldContinue = true;
      let lastToolResults = initialToolResults;
      const maxIter = maxIterationsRef.current;
      
      while (shouldContinue && !shouldStopRef.current && iterationRef.current < maxIter) {
        // Check for pending interject - if so, wait for user input
        if (pendingInterjectRef.current !== null) {
          console.log("[Interject] Waiting for user input...");
          // Wait for interject to be processed
          await new Promise<void>((resolve) => {
            interjectResolverRef.current = resolve;
          });
          interjectResolverRef.current = null;
          console.log("[Interject] Resuming after user input");
        }
        // Check stop flag at start of each iteration
        if (shouldStopRef.current) {
          console.log("Stop requested, breaking loop");
          break;
        }
        
        // Use initialSession directly - refs track latest memory state
        const result = await executeIteration(initialSession, lastToolResults);
        
        // Handle error with auto-retry logic
        if (result.hadError) {
          retryCountRef.current++;
          lastErrorIterationRef.current = iterationRef.current;
          
          console.log(`[Retry ${retryCountRef.current}/${MAX_RETRY_ATTEMPTS}] Error at iteration ${iterationRef.current}: ${result.errorMessage}`);
          
          if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
            // Auto-retry: rollback iteration counter and try again
            iterationRef.current--;
            toast.warning(`Retrying iteration (attempt ${retryCountRef.current + 1}/${MAX_RETRY_ATTEMPTS})...`);
            
            // Update session to show retry status
            updateSession((prev) =>
              prev
                ? {
                    ...prev,
                    status: "running",
                    retryCount: retryCountRef.current,
                    lastErrorIteration: lastErrorIterationRef.current,
                  }
                : null
            );
            
            // Brief delay before retry
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue; // Retry the iteration
          } else {
            // Max retries reached - pause for manual intervention
            toast.error(`Failed after ${MAX_RETRY_ATTEMPTS} attempts. Click Retry to try again.`);
            updateSession((prev) =>
              prev
                ? {
                    ...prev,
                    status: "paused",
                    error: result.errorMessage,
                    retryCount: retryCountRef.current,
                    lastErrorIteration: lastErrorIterationRef.current,
                  }
                : null
            );
            shouldContinue = false;
            break;
          }
        } else {
          // Success - reset retry counter
          retryCountRef.current = 0;
        }
        
        // Handle spawn request - execute child sessions in parallel
        if (result.spawnRequested && spawnRequestRef.current) {
          const spawnRequest = spawnRequestRef.current;
          spawnRequestRef.current = null;
          
          console.log(`[Spawn] Orchestrator entering waiting mode for ${spawnRequest.children.length} children`);
          
          // Use initialSession - promptData doesn't change during execution
          const parentPromptData = initialSession.promptData;
          
          // Create child session objects
          const childSessions: ChildSession[] = spawnRequest.children.map(child => ({
            id: crypto.randomUUID(),
            name: child.name,
            task: child.task,
            status: 'running' as const,
            promptModifications: [
              // Add task as identity override
              { type: 'set_task' as const, content: child.task },
              ...(child.sectionOverrides ? 
                Object.entries(child.sectionOverrides).map(([sectionId, content]) => ({
                  type: 'override_section' as const,
                  sectionId,
                  content,
                })) : []),
            ],
            maxIterations: child.maxIterations || initialSession.advancedFeatures?.childMaxIterations || 20,
            currentIteration: 0,
            startTime: new Date().toISOString(),
            blackboard: [],
            scratchpad: spawnRequest.parentScratchpad,
            toolCalls: [],
            artifacts: [],
            toolResultAttributes: { ...spawnRequest.parentAttributes }, // Inherit parent's attributes
            rawData: [],
          }));
          
          // Keep spawn tool active while children are running
          setActiveToolIds((prev) => new Set([...prev, 'spawn']));
          
          // Set orchestrator to 'waiting' status
          updateSession((prev) => prev ? {
            ...prev,
            status: 'waiting',
            orchestration: {
              role: 'orchestrator',
              children: childSessions,
              awaitingChildren: true,
              completionThreshold: spawnRequest.completionThreshold,
            },
          } : null);
          
          // Store child sessions in ref for tracking
          for (const child of childSessions) {
            childSessionsRef.current.set(child.name, child);
            runningChildrenRef.current.add(child.name);
          }
          
          toast.info(`Spawning ${childSessions.length} child agents...`);
          
          // Execute children in parallel with real edge function calls
          const childPromises = childSessions.map(async (child) => {
            try {
              await runChildSession(
                child, 
                initialSession, 
                parentPromptData,
                (updatedChild) => {
                  // Update child in ref
                  childSessionsRef.current.set(child.name, updatedChild);
                  // Update UI - preserve waiting status!
                  updateSession((prev) => {
                    if (!prev?.orchestration?.children) return prev;
                    return {
                      ...prev,
                      // Explicitly preserve waiting status during child execution
                      status: 'waiting' as const,
                      orchestration: {
                        ...prev.orchestration,
                        awaitingChildren: true,
                        children: prev.orchestration.children.map(c => 
                          c.name === child.name ? updatedChild : c
                        ),
                      },
                    };
                  });
                },
                // Pass tool activation callback for child tool highlighting
                (toolId, active) => {
                  if (active) {
                    setActiveToolIds((prev) => new Set([...prev, toolId]));
                  } else {
                    setActiveToolIds((prev) => {
                      const next = new Set(prev);
                      next.delete(toolId);
                      return next;
                    });
                  }
                }
              );
              return { name: child.name, success: true };
            } catch (error) {
              console.error(`[Child:${child.name}] Error:`, error);
              return { name: child.name, success: false, error: String(error) };
            }
          });
          
          // Wait for all children to complete
          const results = await Promise.all(childPromises);
          const completedChildren = results.filter(r => r.success).map(r => r.name);
          const failedChildren = results.filter(r => !r.success);
          
          console.log(`[Spawn] ${completedChildren.length}/${childSessions.length} children completed`);
          
          // Get final child states and merge to parent blackboard, scratchpad, and attributes
          for (const child of childSessions) {
            runningChildrenRef.current.delete(child.name);
            const finalChild = childSessionsRef.current.get(child.name);
            if (finalChild) {
              // Add child's blackboard entries to parent with prefix
              for (const entry of finalChild.blackboard) {
                const prefixedEntry: BlackboardEntry = {
                  ...entry,
                  id: crypto.randomUUID(),
                  content: `[CHILD:${child.name}] ${entry.content}`,
                };
                handleBlackboardUpdate(prefixedEntry);
              }
              
              // If child has scratchpad content, add summary
              if (finalChild.scratchpad && finalChild.scratchpad.length > spawnRequest.parentScratchpad.length) {
                const childAdditions = finalChild.scratchpad.slice(spawnRequest.parentScratchpad.length);
                if (childAdditions.trim()) {
                  handleScratchpadUpdate(scratchpadRef.current + `\n\n## [${child.name}] Results\n${childAdditions}`);
                }
              }
              
              // Merge child's named attributes to parent with name prefix
              if (finalChild.toolResultAttributes && Object.keys(finalChild.toolResultAttributes).length > 0) {
                for (const [name, attr] of Object.entries(finalChild.toolResultAttributes)) {
                  const prefixedName = `${child.name}_${name}`;
                  const prefixedAttr: ToolResultAttribute = {
                    ...attr,
                    id: crypto.randomUUID(),
                    name: prefixedName,
                  };
                  handleAttributeCreated(prefixedAttr);
                  console.log(`[Spawn] Merged child attribute: ${prefixedName} (${attr.size} chars)`);
                }
              }
              
              // Merge child's artifacts to parent with name prefix
              if (finalChild.artifacts && finalChild.artifacts.length > 0) {
                for (const artifact of finalChild.artifacts) {
                  const prefixedArtifact: FreeAgentArtifact = {
                    ...artifact,
                    id: crypto.randomUUID(),
                    title: `[${child.name}] ${artifact.title}`,
                    description: `${artifact.description || ''} (from child: ${child.name})`.trim(),
                  };
                  // Update artifacts ref IMMEDIATELY for sync access by parent
                  artifactsRef.current = [...artifactsRef.current, prefixedArtifact];
                  
                  // Also update session state (async, for UI)
                  updateSession((prev) => prev ? {
                    ...prev,
                    artifacts: [...prev.artifacts, prefixedArtifact],
                  } : null);
                  console.log(`[Spawn] Merged child artifact: ${prefixedArtifact.title}`);
                }
              }
            }
          }
          
          // Resume orchestrator - use session's children array as source of truth, not accumulated ref
          updateSession((prev) => {
            if (!prev) return null;
            // Get the current cycle's children from the session state
            const currentChildren = prev.orchestration?.children || [];
            // Update each with final state from ref
            const updatedChildren = currentChildren.map(child => {
              const finalState = childSessionsRef.current.get(child.name);
              return finalState || child;
            });
            return {
              ...prev,
              status: 'running',
              orchestration: {
                ...prev.orchestration!,
                awaitingChildren: false,
                children: updatedChildren,
              },
            };
          });
          
          console.log('[Spawn] All children completed. Resuming orchestrator.');
          
          // Clear spawn from active tools now that children are done
          setActiveToolIds((prev) => {
            const next = new Set(prev);
            next.delete('spawn');
            return next;
          });
          
          shouldContinue = true;
          lastToolResults = [{
            tool: 'spawn',
            success: true,
            result: {
              message: `${completedChildren.length}/${childSessions.length} children completed.`,
              completedChildren,
              failedChildren: failedChildren.map(f => ({ name: f.name, error: f.error })),
            },
          }];
          
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        shouldContinue = result.continue;
        lastToolResults = result.toolResults;
        
        // Small delay between iterations - reduced for faster execution
        if (shouldContinue && !shouldStopRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    },
    [executeIteration, updateSession, handleBlackboardUpdate, handleScratchpadUpdate]
  );

  // Start a new session (or resume with preserved memory if existingSession provided)
  const startSession = useCallback(
    async (
      prompt: string, 
      files: SessionFile[] = [], 
      model: string = "gemini-2.5-flash", 
      maxIterations: number = defaultMaxIterations, 
      existingSession?: FreeAgentSession | null,
      secretOverrides?: FreeAgentSession['secretOverrides'],
      configuredParams?: FreeAgentSession['configuredParams'],
      promptData?: PromptDataPayload,
      advancedFeatures?: AdvancedFeatures,
      promptCustomization?: PromptCustomization | null,
      onPromptCustomizationChange?: () => void,
      toolInstances?: FreeAgentSession['toolInstances']
    ) => {
      try {
        setIsRunning(true);
        iterationRef.current = 0;
        retryCountRef.current = 0;
        lastErrorIterationRef.current = 0;
        maxIterationsRef.current = maxIterations;
        pendingInterjectRef.current = null;
        
        // Store prompt customization for self-author tools
        promptCustomizationRef.current = promptCustomization || null;
        // Store callback for write_self to notify UI
        promptCustomizationChangeCallbackRef.current = onPromptCustomizationChange || null;

        // If continuing from an existing session, preserve memory (blackboard, scratchpad, artifacts)
        // Also preserve secrets from existing session if not provided
        const newSession: FreeAgentSession = {
          id: existingSession?.id || crypto.randomUUID(),
          status: "running",
          prompt,
          model,
          maxIterations,
          currentIteration: 0,
          // Preserve memory from existing session if continuing
          blackboard: existingSession?.blackboard || [],
          scratchpad: existingSession?.scratchpad || "",
          artifacts: existingSession?.artifacts || [],
          toolCalls: [],
          messages: [
            {
              id: crypto.randomUUID(),
              role: "user",
              content: prompt,
              timestamp: new Date().toISOString(),
            },
          ],
          // Preserve tool result attributes from existing session
          toolResultAttributes: existingSession?.toolResultAttributes || {},
          sessionFiles: files,
          startTime: new Date().toISOString(),
          lastActivityTime: new Date().toISOString(),
          rawData: existingSession?.rawData || [],
          retryCount: 0,
          // Include secrets for tool parameter injection
          secretOverrides: secretOverrides || existingSession?.secretOverrides,
          configuredParams: configuredParams || existingSession?.configuredParams,
          // Include dynamic prompt data
          promptData: promptData || existingSession?.promptData,
          // Include advanced features
          advancedFeatures: advancedFeatures || existingSession?.advancedFeatures,
          // Include tool instances
          toolInstances: toolInstances || existingSession?.toolInstances,
        };

        // Initialize refs with session memory
        blackboardRef.current = newSession.blackboard;
        scratchpadRef.current = newSession.scratchpad;
        toolResultAttributesRef.current = newSession.toolResultAttributes;
        artifactsRef.current = newSession.artifacts;
        
        // Clear tool cache only for fresh sessions (not continuations)
        if (!existingSession) {
          toolCacheRef.current.clear();
        }

        setSession(newSession);

        // Run iterations with retry logic
        shouldStopRef.current = false;
        await runIterationLoop(newSession.id, newSession);

        setIsRunning(false);
        return newSession.id;
      } catch (error) {
        console.error("Failed to start session:", error);
        toast.error("Failed to start Free Agent session");
        setIsRunning(false);
        throw error;
      }
    },
    [defaultMaxIterations, runIterationLoop]
  );

  // Respond to assistance request
  const respondToAssistance = useCallback(
    async (response: { response?: string; fileId?: string; selectedChoice?: string }) => {
      if (!session) return;

      try {
        setIsRunning(true);
        retryCountRef.current = 0; // Reset retry count

        // Add user response as message
        const userMessage: FreeAgentMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: response.response || response.selectedChoice || "[File provided]",
          timestamp: new Date().toISOString(),
          iteration: iterationRef.current,
        };

        // Build updated session SYNCHRONOUSLY with the assistance response
        const updatedSession: FreeAgentSession = {
          ...session,
          status: "running",
          messages: [...session.messages, userMessage],
          assistanceRequest: session.assistanceRequest
            ? {
                ...session.assistanceRequest,
                response: response.response,
                fileId: response.fileId,
                selectedChoice: response.selectedChoice,
                respondedAt: new Date().toISOString(),
              }
            : undefined,
          retryCount: 0,
        };

        // Update React state
        setSession(updatedSession);
        console.log("Assistance response set:", {
          response: response.response,
          selectedChoice: response.selectedChoice,
          respondedAt: updatedSession.assistanceRequest?.respondedAt,
        });

        // Continue iterations with retry logic
        shouldStopRef.current = false;
        await runIterationLoop(session.id, updatedSession);

        setIsRunning(false);
      } catch (error) {
        console.error("Failed to respond to assistance:", error);
        toast.error("Failed to continue after assistance");
        setIsRunning(false);
      }
    },
    [session, runIterationLoop]
  );

  // Retry from failed iteration (when paused after max retries)
  const retrySession = useCallback(async () => {
    if (!session) return;

    try {
      setIsRunning(true);
      retryCountRef.current = 0; // Reset retry count for fresh attempt
      
      // Rollback iteration to retry the failed one
      if (session.lastErrorIteration && session.lastErrorIteration > 0) {
        iterationRef.current = session.lastErrorIteration - 1;
      }

      const updatedSession: FreeAgentSession = {
        ...session,
        status: "running",
        error: undefined,
        retryCount: 0,
      };

      setSession(updatedSession);

      console.log(`[Retry] Resuming from iteration ${iterationRef.current + 1}`);
      toast.info("Retrying from last failed iteration...");

      // Continue iterations with retry logic
      shouldStopRef.current = false;
      await runIterationLoop(session.id, updatedSession);

      setIsRunning(false);
    } catch (error) {
      console.error("Failed to retry session:", error);
      toast.error("Failed to retry session");
      setIsRunning(false);
    }
  }, [session, runIterationLoop]);

  // Stop the current session
  const stopSession = useCallback(() => {
    console.log("Stop session requested");
    shouldStopRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            status: "idle",
          }
        : null
    );
  }, [updateSession]);

  // Reset session completely
  const resetSession = useCallback(() => {
    shouldStopRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setSession(null);
    setIsRunning(false);
    setActiveToolIds(new Set());
    iterationRef.current = 0;
    blackboardRef.current = [];
    scratchpadRef.current = "";
    toolResultAttributesRef.current = {};
    artifactsRef.current = [];
    retryCountRef.current = 0;
    lastErrorIterationRef.current = 0;
    toolCacheRef.current.clear();
  }, []);

  // Continue with new prompt while preserving memory
  const continueSession = useCallback(() => {
    if (!session) return;
    
    // Reset to idle so user can enter new prompt, but memory is preserved
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            status: "idle",
            // Keep blackboard, scratchpad, artifacts, rawData
            toolCalls: [], // Clear tool calls for new task
            messages: [], // Clear messages for new task
          }
        : null
    );
    
    iterationRef.current = 0;
  }, [session, updateSession]);

  // Update scratchpad from UI
  const updateScratchpad = useCallback((content: string) => {
    handleScratchpadUpdate(content);
  }, [handleScratchpadUpdate]);

  // Get cache size
  const getCacheSize = useCallback(() => {
    return toolCacheRef.current.size;
  }, []);

  // Interject - add user message to blackboard and re-run current iteration
  const interjectSession = useCallback((message: string) => {
    if (!session || !isRunning) return;
    
    console.log("[Interject] User interjecting with:", message);
    
    // Add user interjection to blackboard
    const entry: BlackboardEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category: "user_interjection",
      content: `[USER INTERJECTION] ${message}`,
      iteration: iterationRef.current,
    };
    
    handleBlackboardUpdate(entry);
    
    // Rollback iteration counter so current iteration is re-executed with new info
    if (iterationRef.current > 0) {
      iterationRef.current--;
    }
    
    toast.success("Interjection added. Agent will re-run current iteration with your input.");
    
    // Clear the pending interject and resolve the waiting promise
    pendingInterjectRef.current = null;
    if (interjectResolverRef.current) {
      interjectResolverRef.current();
    }
  }, [session, isRunning, handleBlackboardUpdate]);

  // Request interject - pauses the loop and waits for user input
  const requestInterject = useCallback((message: string) => {
    if (!isRunning) return;
    
    // Set the pending message and add to blackboard + resume
    interjectSession(message);
  }, [isRunning, interjectSession]);

  return {
    session,
    isRunning,
    activeToolIds,
    startSession,
    respondToAssistance,
    stopSession,
    resetSession,
    continueSession,
    retrySession,
    updateScratchpad,
    getCacheSize,
    interjectSession,
  };
}
