// Free Agent Session Hook - Manages local state and execution
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  FreeAgentSession,
  BlackboardEntry,
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
} from "@/types/freeAgent";
import { executeFrontendTool, ToolExecutionContext } from "@/lib/freeAgentToolExecutor";

interface UseFreeAgentSessionOptions {
  maxIterations?: number;
}

const LOCAL_STORAGE_KEY = "free_agent_sessions";

// Save session to localStorage
function saveSessionToLocal(session: FreeAgentSession) {
  try {
    const sessions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
    sessions[session.id] = session;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn("Failed to save session to localStorage:", e);
  }
}

// Load session from localStorage
function loadSessionFromLocal(sessionId: string): FreeAgentSession | null {
  try {
    const sessions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
    return sessions[sessionId] || null;
  } catch {
    return null;
  }
}

// Cache-enabled tools (expensive operations) - only cache exact duplicate requests
const CACHEABLE_TOOLS = ['read_github_repo', 'read_github_file', 'web_scrape'];
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Tools that support saveAs parameter for auto-saving results to attributes
const AUTO_SAVE_TOOLS = ['brave_search', 'google_search', 'web_scrape', 'read_github_repo', 'read_github_file', 'get_call_api', 'post_call_api'];

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
  const { maxIterations = 50 } = options;

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
  
  // Tool cache for expensive operations - caches EXACT duplicate requests only
  const toolCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  
  // Retry tracking refs for synchronous access during iteration loop
  const retryCountRef = useRef(0);
  const lastErrorIterationRef = useRef(0);
  
  // Update session and persist to localStorage
  const updateSession = useCallback((updater: (prev: FreeAgentSession | null) => FreeAgentSession | null) => {
    setSession((prev) => {
      const updated = updater(prev);
      if (updated) {
        saveSessionToLocal(updated);
      }
      return updated;
    });
  }, []);

  // Handle artifact creation
  const handleArtifactCreated = useCallback((artifact: FreeAgentArtifact) => {
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
  // Returns: continue (keep iterating), toolResults, and error info for retry logic
  const executeIteration = useCallback(
    async (
      currentSession: FreeAgentSession,
      previousIterationResults: ToolResult[]
    ): Promise<{ continue: boolean; toolResults: ToolResult[]; hadError?: boolean; errorMessage?: string }> => {
      if (iterationRef.current >= maxIterations) {
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

        // Use refs for blackboard/scratchpad to ensure latest data (bypass async state)
        const currentBlackboard = blackboardRef.current.length > 0 ? blackboardRef.current : currentSession.blackboard;
        const currentScratchpad = scratchpadRef.current || currentSession.scratchpad || "";

        // Call edge function with current state - pass tool results directly
        const { data, error } = await supabase.functions.invoke("free-agent", {
          body: {
            prompt: currentSession.prompt,
            model: currentSession.model,
            blackboard: currentBlackboard.map((b) => ({
              category: b.category,
              content: b.content,
              data: b.data,
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

        // Record tool calls
        const newToolCalls: ToolCall[] = [];
        
        // Set tools as active for animation
        for (const tc of response.tool_calls || []) {
          setActiveToolIds((prev) => new Set([...prev, tc.tool]));
          
          newToolCalls.push({
            id: crypto.randomUUID(),
            tool: tc.tool,
            params: tc.params,
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
            if (result.success && saveAsName && AUTO_SAVE_TOOLS.includes(result.tool)) {
              const resultString = JSON.stringify(result.result, null, 2);
              const attribute: ToolResultAttribute = {
                id: crypto.randomUUID(),
                name: saveAsName,
                tool: result.tool,
                params: toolCall.params || {},
                result: result.result,
                resultString,
                size: resultString.length,
                createdAt: new Date().toISOString(),
                iteration: iterationRef.current,
              };
              handleAttributeCreated(attribute);
              
              // AUTO-ADD to scratchpad with handlebar reference so read_scratchpad expands it
              const scratchpadEntry = `\n\n## ${saveAsName} (from ${result.tool})\n{{${saveAsName}}}`;
              const newScratchpad = (scratchpadRef.current || "") + scratchpadEntry;
              handleScratchpadUpdate(newScratchpad);
              
              // Replace the full result with a summary message for the LLM
              const summaryResult = {
                _savedAsAttribute: saveAsName,
                _message: `Result saved to attribute '${saveAsName}' (${resultString.length} chars). Auto-added to scratchpad - use read_scratchpad to see expanded content.`,
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
            onArtifactCreated: handleArtifactCreated,
            onBlackboardUpdate: handleBlackboardUpdate,
            onScratchpadUpdate: handleScratchpadUpdate,
            onAssistanceNeeded: handleAssistanceNeeded,
          };
          const result = await executeFrontendTool(handler.tool, handler.params, context);

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

          // If assistance needed, stop here
          if (handler.tool === "request_assistance") {
            return { continue: false, toolResults: iterationToolResults };
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
        };

        // Add blackboard entry from response
        if (response.blackboard_entry) {
          const entry: BlackboardEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            category: response.blackboard_entry.category,
            content: response.blackboard_entry.content,
            data: response.blackboard_entry.data,
            iteration: iterationRef.current,
          };
          handleBlackboardUpdate(entry);
        }

        // Add assistant message
        const assistantMessage: FreeAgentMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reasoning || response.message_to_user || "",
          timestamp: new Date().toISOString(),
          iteration: iterationRef.current,
        };

        // Add artifacts from response
        const newArtifacts: FreeAgentArtifact[] = (response.artifacts || []).map((a) => ({
          id: crypto.randomUUID(),
          type: a.type,
          title: a.title,
          content: a.content,
          description: a.description,
          createdAt: new Date().toISOString(),
          iteration: iterationRef.current,
        }));

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
              title: a.title,
              description: a.description,
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
    [maxIterations, handleArtifactCreated, handleBlackboardUpdate, handleScratchpadUpdate, handleAssistanceNeeded, handleAttributeCreated, updateSession]
  );

  // Run the iteration loop with retry logic
  const runIterationLoop = useCallback(
    async (sessionId: string, initialSession: FreeAgentSession, initialToolResults: ToolResult[] = []) => {
      let shouldContinue = true;
      let lastToolResults = initialToolResults;
      
      while (shouldContinue && !shouldStopRef.current && iterationRef.current < maxIterations) {
        // Check stop flag at start of each iteration
        if (shouldStopRef.current) {
          console.log("Stop requested, breaking loop");
          break;
        }
        
        const currentSession = loadSessionFromLocal(sessionId) || initialSession;
        const result = await executeIteration(currentSession, lastToolResults);
        
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
        
        shouldContinue = result.continue;
        lastToolResults = result.toolResults;
        
        // Small delay between iterations
        if (shouldContinue && !shouldStopRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    },
    [maxIterations, executeIteration, updateSession]
  );

  // Start a new session (or resume with preserved memory if existingSession provided)
  const startSession = useCallback(
    async (prompt: string, files: SessionFile[] = [], model: string = "gemini-2.5-flash", existingSession?: FreeAgentSession | null) => {
      try {
        setIsRunning(true);
        iterationRef.current = 0;
        retryCountRef.current = 0;
        lastErrorIterationRef.current = 0;

        // If continuing from an existing session, preserve memory (blackboard, scratchpad, artifacts)
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
        };

        // Initialize refs with session memory
        blackboardRef.current = newSession.blackboard;
        scratchpadRef.current = newSession.scratchpad;
        toolResultAttributesRef.current = newSession.toolResultAttributes;
        
        // Clear tool cache only for fresh sessions (not continuations)
        if (!existingSession) {
          toolCacheRef.current.clear();
        }

        setSession(newSession);
        saveSessionToLocal(newSession);

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
    [maxIterations, runIterationLoop]
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

        // Save to localStorage IMMEDIATELY (synchronous) so executeIteration can read it
        saveSessionToLocal(updatedSession);
        console.log("Assistance response saved to localStorage:", {
          response: response.response,
          selectedChoice: response.selectedChoice,
          respondedAt: updatedSession.assistanceRequest?.respondedAt,
        });

        // Also update React state for UI
        setSession(updatedSession);

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

      saveSessionToLocal(updatedSession);
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
  };
}
