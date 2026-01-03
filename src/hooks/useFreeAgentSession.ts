// Free Agent Session Hook - Manages state and execution
import { useState, useCallback, useEffect, useRef } from "react";
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
} from "@/types/freeAgent";
import { executeFrontendTool, executeEdgeFunctionTool } from "@/lib/freeAgentToolExecutor";

interface UseFreeAgentSessionOptions {
  model?: string;
  maxIterations?: number;
}

export function useFreeAgentSession(options: UseFreeAgentSessionOptions = {}) {
  const { model = "gemini-2.5-flash", maxIterations = 50 } = options;

  const [session, setSession] = useState<FreeAgentSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeToolIds, setActiveToolIds] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Start a new session
  const startSession = useCallback(
    async (prompt: string, files: SessionFile[] = []) => {
      try {
        setIsRunning(true);

        const newSession: FreeAgentSession = {
          id: crypto.randomUUID(),
          status: "running",
          prompt,
          model,
          maxIterations,
          currentIteration: 0,
          blackboard: [],
          toolCalls: [],
          artifacts: [],
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
        };

        setSession(newSession);

        // Call edge function to start
        const { data, error } = await supabase.functions.invoke("free-agent", {
          body: {
            prompt,
            model,
            maxIterations,
            sessionFiles: files.map((f) => ({
              id: f.id,
              filename: f.filename,
              mimeType: f.mimeType,
              size: f.size,
              content: f.content,
            })),
          },
        });

        if (error) throw error;

        // Update session with server response
        setSession((prev) =>
          prev
            ? {
                ...prev,
                id: data.sessionId,
                currentIteration: data.iteration,
              }
            : null
        );

        // Process initial response
        await processAgentResponse(data.sessionId, data.response, data.toolResults);

        return data.sessionId;
      } catch (error) {
        console.error("Failed to start session:", error);
        toast.error("Failed to start Free Agent session");
        setIsRunning(false);
        throw error;
      }
    },
    [model, maxIterations]
  );

  // Process agent response and execute frontend tools
  const processAgentResponse = async (
    sessionId: string,
    response: AgentResponse,
    toolResults: any[]
  ) => {
    // Add blackboard entry
    if (response.blackboard_entry) {
      const entry: BlackboardEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: response.blackboard_entry.category,
        content: response.blackboard_entry.content,
        data: response.blackboard_entry.data,
        iteration: session?.currentIteration || 0,
      };

      setSession((prev) =>
        prev
          ? {
              ...prev,
              blackboard: [...prev.blackboard, entry],
            }
          : null
      );
    }

    // Add assistant message
    const assistantMessage: FreeAgentMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response.reasoning || "",
      timestamp: new Date().toISOString(),
      iteration: session?.currentIteration,
    };

    setSession((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages, assistantMessage],
            lastActivityTime: new Date().toISOString(),
          }
        : null
    );

    // Add artifacts
    if (response.artifacts) {
      const newArtifacts: FreeAgentArtifact[] = response.artifacts.map((a) => ({
        id: crypto.randomUUID(),
        type: a.type,
        title: a.title,
        content: a.content,
        description: a.description,
        createdAt: new Date().toISOString(),
        iteration: session?.currentIteration || 0,
      }));

      setSession((prev) =>
        prev
          ? {
              ...prev,
              artifacts: [...prev.artifacts, ...newArtifacts],
            }
          : null
      );
    }

    // Handle status changes
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
        totalIterations: session?.currentIteration || 0,
        totalTime: Date.now() - new Date(session?.startTime || Date.now()).getTime(),
      };

      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "completed",
              finalReport,
              endTime: new Date().toISOString(),
            }
          : null
      );

      setIsRunning(false);
      toast.success("Free Agent completed the task!");
    } else if (response.status === "needs_assistance") {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "needs_assistance",
            }
          : null
      );

      setIsRunning(false);
    } else if (response.status === "error") {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              error: response.reasoning,
            }
          : null
      );

      setIsRunning(false);
      toast.error("Free Agent encountered an error");
    } else {
      // Continue running - iterate again
      await continueSession(sessionId);
    }
  };

  // Continue running session
  const continueSession = useCallback(
    async (sessionId: string) => {
      if (!session || session.currentIteration >= maxIterations) {
        setIsRunning(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("free-agent", {
          body: { sessionId },
        });

        if (error) throw error;

        setSession((prev) =>
          prev
            ? {
                ...prev,
                currentIteration: data.iteration,
              }
            : null
        );

        await processAgentResponse(sessionId, data.response, data.toolResults);
      } catch (error) {
        console.error("Failed to continue session:", error);
        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              }
            : null
        );
        setIsRunning(false);
      }
    },
    [session, maxIterations]
  );

  // Respond to assistance request
  const respondToAssistance = useCallback(
    async (response: { response?: string; fileId?: string; selectedChoice?: string }) => {
      if (!session) return;

      try {
        setIsRunning(true);

        setSession((prev) =>
          prev
            ? {
                ...prev,
                status: "running",
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

        const { data, error } = await supabase.functions.invoke("free-agent", {
          body: {
            sessionId: session.id,
            assistanceResponse: response,
          },
        });

        if (error) throw error;

        setSession((prev) =>
          prev
            ? {
                ...prev,
                currentIteration: data.iteration,
              }
            : null
        );

        await processAgentResponse(session.id, data.response, data.toolResults);
      } catch (error) {
        console.error("Failed to respond to assistance:", error);
        toast.error("Failed to send response");
        setIsRunning(false);
      }
    },
    [session]
  );

  // Stop session
  const stopSession = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
    setSession((prev) =>
      prev
        ? {
            ...prev,
            status: "completed",
            endTime: new Date().toISOString(),
          }
        : null
    );
    toast.info("Free Agent stopped");
  }, []);

  // Reset session
  const resetSession = useCallback(() => {
    setSession(null);
    setIsRunning(false);
    setActiveToolIds(new Set());
  }, []);

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

  return {
    session,
    isRunning,
    activeToolIds,
    startSession,
    continueSession,
    respondToAssistance,
    stopSession,
    resetSession,
    setToolActive,
  };
}
