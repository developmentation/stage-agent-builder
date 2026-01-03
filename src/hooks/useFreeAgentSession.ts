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
} from "@/types/freeAgent";
import { executeFrontendTool } from "@/lib/freeAgentToolExecutor";

interface UseFreeAgentSessionOptions {
  model?: string;
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

export function useFreeAgentSession(options: UseFreeAgentSessionOptions = {}) {
  const { model = "gemini-2.5-flash", maxIterations = 50 } = options;

  const [session, setSession] = useState<FreeAgentSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeToolIds, setActiveToolIds] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const iterationRef = useRef(0);
  const shouldStopRef = useRef(false); // Flag to stop execution loop
  
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

  // Handle blackboard update
  const handleBlackboardUpdate = useCallback((entry: BlackboardEntry) => {
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            blackboard: [...prev.blackboard, entry],
          }
        : null
    );
  }, [updateSession]);

  // Handle scratchpad update
  const handleScratchpadUpdate = useCallback((content: string) => {
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            scratchpad: content,
          }
        : null
    );
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
  const executeIteration = useCallback(
    async (
      currentSession: FreeAgentSession,
      previousIterationResults: ToolResult[]
    ): Promise<{ continue: boolean; toolResults: ToolResult[] }> => {
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

        // Call edge function with current state - pass tool results directly
        const { data, error } = await supabase.functions.invoke("free-agent", {
          body: {
            prompt: currentSession.prompt,
            model: currentSession.model,
            blackboard: currentSession.blackboard.map((b) => ({
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
            scratchpad: currentSession.scratchpad || "",
            assistanceResponse,
          },
        });

        if (error) throw error;

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

        // Process edge function results
        for (const result of data.toolResults || []) {
          const toolCall = newToolCalls.find((t) => t.tool === result.tool && t.status === "executing");
          if (toolCall) {
            toolCall.status = result.success ? "completed" : "error";
            toolCall.result = result.result;
            toolCall.error = result.error;
            toolCall.endTime = new Date().toISOString();
          }
          // Add to iteration results
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
          
          const result = await executeFrontendTool(handler.tool, handler.params, {
            sessionId: currentSession.id,
            prompt: currentSession.prompt,
            scratchpad: currentSession.scratchpad,
            blackboard: currentSession.blackboard,
            sessionFiles: currentSession.sessionFiles,
            onArtifactCreated: handleArtifactCreated,
            onBlackboardUpdate: handleBlackboardUpdate,
            onScratchpadUpdate: handleScratchpadUpdate,
            onAssistanceNeeded: handleAssistanceNeeded,
          });

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
        updateSession((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              }
            : null
        );
        toast.error("Free Agent error: " + (error instanceof Error ? error.message : "Unknown error"));
        return { continue: false, toolResults: [] };
      }
    },
    [maxIterations, handleArtifactCreated, handleBlackboardUpdate, handleScratchpadUpdate, handleAssistanceNeeded, updateSession]
  );

  // Start a new session (or resume with preserved memory if existingSession provided)
  const startSession = useCallback(
    async (prompt: string, files: SessionFile[] = [], existingSession?: FreeAgentSession | null) => {
      try {
        setIsRunning(true);
        iterationRef.current = 0;

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
          sessionFiles: files,
          startTime: new Date().toISOString(),
          lastActivityTime: new Date().toISOString(),
          rawData: existingSession?.rawData || [],
        };

        setSession(newSession);
        saveSessionToLocal(newSession);

        // Run iterations - pass tool results directly between iterations
        shouldStopRef.current = false;
        let shouldContinue = true;
        let lastToolResults: ToolResult[] = []; // Track tool results between iterations
        
        while (shouldContinue && !shouldStopRef.current && iterationRef.current < maxIterations) {
          // Check stop flag at start of each iteration
          if (shouldStopRef.current) {
            console.log("Stop requested, breaking loop");
            break;
          }
          
          const currentSession = loadSessionFromLocal(newSession.id) || newSession;
          const result = await executeIteration(currentSession, lastToolResults);
          shouldContinue = result.continue;
          lastToolResults = result.toolResults; // Pass results to next iteration
          
          // Small delay between iterations
          if (shouldContinue && !shouldStopRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        setIsRunning(false);
        return newSession.id;
      } catch (error) {
        console.error("Failed to start session:", error);
        toast.error("Failed to start Free Agent session");
        setIsRunning(false);
        throw error;
      }
    },
    [model, maxIterations, executeIteration]
  );

  // Respond to assistance request
  const respondToAssistance = useCallback(
    async (response: { response?: string; fileId?: string; selectedChoice?: string }) => {
      if (!session) return;

      try {
        setIsRunning(true);

        // Add user response as message
        const userMessage: FreeAgentMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: response.response || response.selectedChoice || "[File provided]",
          timestamp: new Date().toISOString(),
          iteration: iterationRef.current,
        };

        updateSession((prev) =>
          prev
            ? {
                ...prev,
                status: "running",
                messages: [...prev.messages, userMessage],
                assistanceRequest: prev.assistanceRequest
                  ? {
                      ...prev.assistanceRequest,
                      response: response.response,
                      fileId: response.fileId,
                      selectedChoice: response.selectedChoice,
                      respondedAt: new Date().toISOString(),
                    }
                  : undefined,
              }
            : null
        );

        // Continue iterations - pass tool results directly between iterations
        shouldStopRef.current = false;
        let shouldContinue = true;
        let lastToolResults: ToolResult[] = [];
        
        while (shouldContinue && !shouldStopRef.current && iterationRef.current < maxIterations) {
          if (shouldStopRef.current) break;
          
          const currentSession = loadSessionFromLocal(session.id);
          if (!currentSession) break;
          const result = await executeIteration(currentSession, lastToolResults);
          shouldContinue = result.continue;
          lastToolResults = result.toolResults;
          
          if (shouldContinue && !shouldStopRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        setIsRunning(false);
      } catch (error) {
        console.error("Failed to respond to assistance:", error);
        toast.error("Failed to send response");
        setIsRunning(false);
      }
    },
    [session, maxIterations, executeIteration, updateSession]
  );

  // Stop session - set flag to break out of while loop
  const stopSession = useCallback(() => {
    console.log("Stop session called - setting shouldStopRef to true");
    shouldStopRef.current = true; // Signal to stop the while loop
    abortControllerRef.current?.abort();
    setIsRunning(false);
    updateSession((prev) =>
      prev
        ? {
            ...prev,
            status: "completed",
            endTime: new Date().toISOString(),
          }
        : null
    );
    toast.info("Free Agent stopped");
  }, [updateSession]);

  // Reset session completely
  const resetSession = useCallback(() => {
    setSession(null);
    setIsRunning(false);
    setActiveToolIds(new Set());
    iterationRef.current = 0;
  }, []);

  // Continue session - preserve blackboard, scratchpad, artifacts but allow new prompt
  const continueSession = useCallback(() => {
    if (!session) return;
    
    // Clear the prompt input and session files but keep memory
    updateSession((prev) => 
      prev
        ? {
            ...prev,
            status: "idle",
            prompt: "",
            currentIteration: 0,
            toolCalls: [],
            messages: [],
            sessionFiles: [],
            finalReport: undefined,
            error: undefined,
            startTime: new Date().toISOString(),
            lastActivityTime: new Date().toISOString(),
            // Keep these for continuity:
            // - blackboard (planning history)
            // - scratchpad (accumulated data)
            // - artifacts (created outputs)
            // - rawData (debug history)
          }
        : null
    );
    
    setIsRunning(false);
    iterationRef.current = 0;
  }, [session, updateSession]);

  // Set tool as active (for animation)
  const setToolActive = useCallback((toolId: string, active: boolean) => {
    setActiveToolIds((prev) => {
      const next = new Set(prev);
      if (active) {
        next.add(toolId);
      } else {
        next.delete(toolId);
      }
      return next;
    });
  }, []);

  // Update scratchpad from UI
  const updateScratchpad = useCallback((content: string) => {
    handleScratchpadUpdate(content);
  }, [handleScratchpadUpdate]);

  return {
    session,
    isRunning,
    activeToolIds,
    startSession,
    respondToAssistance,
    stopSession,
    resetSession,
    continueSession,
    setToolActive,
    updateScratchpad,
  };
}
