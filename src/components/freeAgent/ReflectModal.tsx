// Reflect Modal - Post-session analysis and insights
import React, { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Code,
  FileText,
  RefreshCw,
  Download,
  Lightbulb,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BlackboardEntry } from "@/types/freeAgent";

const REFLECTION_SYSTEM_PROMPT = `You are an expert AI session analyst reviewing the execution of an autonomous agent task.

Your job is to analyze the session data (blackboard entries and scratchpad) and provide actionable insights.

Answer these questions thoroughly:

## What Went Well
- Identify successful tool calls and strategies
- Highlight effective problem-solving approaches
- Note any good recovery from errors

## What Went Wrong  
- Identify obvious failures or loops
- Point out inefficient tool usage
- Note any missed opportunities

## Root Cause Analysis
- What patterns led to failures?
- Were there unclear instructions?
- Did the agent misunderstand the task?

## Recommendations for Next Time
- How should the prompt be restructured?
- What tools should be prioritized or avoided?
- What guardrails would have helped?

## Rewritten Prompt
Provide a complete, improved version of the original prompt that would avoid the issues observed.

Be specific, actionable, and constructive. Focus on practical improvements.`;

interface ReflectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blackboard: BlackboardEntry[];
  scratchpad: string;
  originalPrompt: string;
  model: string;
}

export function ReflectModal({
  open,
  onOpenChange,
  blackboard,
  scratchpad,
  originalPrompt,
  model,
}: ReflectModalProps) {
  const [reflection, setReflection] = useState("");
  const [isReflecting, setIsReflecting] = useState(false);
  const [activeTab, setActiveTab] = useState<"markdown" | "raw">("markdown");
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);

  // Format blackboard entries for context
  const formatBlackboard = (): string => {
    if (blackboard.length === 0) return "No blackboard entries.";
    return blackboard
      .map((entry, i) => `[${i + 1}] [${entry.category}] ${entry.content}`)
      .join("\n\n---\n\n");
  };

  // Get the appropriate edge function based on model
  const getEdgeFunction = (): string => {
    if (model.startsWith("claude")) return "run-agent-anthropic";
    if (model.startsWith("grok")) return "run-agent-xai";
    return "run-agent"; // Gemini default
  };

  // Stream reflection from edge function
  const streamReflection = async () => {
    setIsReflecting(true);
    setReflection("");

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const blackboardContent = formatBlackboard();
      
      const userPrompt = `Please analyze this agent session and provide insights.

## Original Prompt
${originalPrompt}

## Blackboard (Agent's Memory Log)
${blackboardContent}

## Scratchpad (Agent's Working Notes)
${scratchpad || "Empty"}

---

Reviewing the blackboard and the scratchpad, what went well and where were there some obvious failings? What can you infer from this? What would you do differently next time? How would you rewrite the original prompt to avoid this issue again?`;

      const edgeFunction = getEdgeFunction();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/${edgeFunction}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: REFLECTION_SYSTEM_PROMPT,
          userPrompt,
          model,
          maxOutputTokens: 8192,
          tools: [],
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Reflection failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "delta" && parsed.text) {
              accumulated += parsed.text;
              setReflection(accumulated);
            } else if (parsed.type === "done") {
              break;
            } else if (parsed.type === "error") {
              throw new Error(parsed.error);
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("Reflection cancelled");
      } else {
        console.error("Reflection error:", error);
        setReflection(`Error: ${(error as Error).message}`);
      }
    } finally {
      setIsReflecting(false);
    }
  };

  // Auto-start reflection when modal opens
  useEffect(() => {
    if (open && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setReflection("");
      setActiveTab("markdown");
      streamReflection();
    }
    if (!open) {
      hasStartedRef.current = false;
    }
  }, [open]);

  const handleDownload = () => {
    const blob = new Blob([reflection], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-reflection-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onOpenChange(false);
  };

  const handleRegenerate = () => {
    streamReflection();
  };

  // Get model display info
  const getModelInfo = () => {
    const modelMap: Record<string, { label: string; provider: string; color: string }> = {
      "gemini-2.5-flash": { label: "Gemini 2.5 Flash", provider: "gemini", color: "text-blue-500" },
      "gemini-2.5-flash-lite": { label: "Gemini 2.5 Flash Lite", provider: "gemini", color: "text-blue-500" },
      "gemini-3-pro-preview": { label: "Gemini 3 Pro", provider: "gemini", color: "text-blue-500" },
      "gemini-3-flash-preview": { label: "Gemini 3 Flash", provider: "gemini", color: "text-blue-500" },
      "claude-sonnet-4-5": { label: "Claude Sonnet 4.5", provider: "claude", color: "text-orange-500" },
      "claude-haiku-4-5": { label: "Claude Haiku 4.5", provider: "claude", color: "text-orange-500" },
      "claude-opus-4-5": { label: "Claude Opus 4.5", provider: "claude", color: "text-orange-500" },
      "grok-4-1-fast-reasoning": { label: "Grok 4.1 Reasoning", provider: "grok", color: "text-purple-500" },
      "grok-4-1-fast-non-reasoning": { label: "Grok 4.1", provider: "grok", color: "text-purple-500" },
      "grok-code-fast-1": { label: "Grok Code", provider: "grok", color: "text-purple-500" },
    };
    return modelMap[model] || { label: model, provider: "unknown", color: "text-muted-foreground" };
  };

  const modelInfo = getModelInfo();

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent
        className="w-[calc(100%-50px)] h-[calc(100%-50px)] max-w-[calc(100%-50px)] max-h-[calc(100%-50px)] flex flex-col p-0 gap-0"
      >
        <DialogHeader className="px-3 py-2 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Lightbulb className="w-4 h-4 text-purple-500 shrink-0" />
              <DialogTitle className="text-base truncate">Reflect on Session</DialogTitle>
            </div>
            <Badge variant="outline" className={`${modelInfo.color} shrink-0 text-xs`}>
              {modelInfo.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 p-3 gap-2 overflow-hidden">
            {/* Loading state */}
            {isReflecting && (
              <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analyzing session...</span>
              </div>
            )}

            {/* Reflection display */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "markdown" | "raw")}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="flex items-center justify-between shrink-0 gap-2">
                <TabsList className="h-7">
                  <TabsTrigger value="markdown" className="text-xs gap-1 px-2">
                    <FileText className="w-3 h-3" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="text-xs gap-1 px-2">
                    <Code className="w-3 h-3" />
                    Raw
                  </TabsTrigger>
                </TabsList>
                {!isReflecting && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    className="gap-1 text-xs h-7 px-2"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </Button>
                )}
              </div>

              <div className="flex-1 min-h-0 mt-2 border rounded-md overflow-hidden">
                <TabsContent value="markdown" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-3 prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {reflection || "_Analyzing session..._"}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="raw" className="h-full m-0 p-0">
                  <Textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    className="h-full w-full border-0 rounded-none resize-none font-mono text-sm"
                    placeholder="Reflection will appear here..."
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!reflection || isReflecting}
              className="gap-1"
            >
              <Download className="w-3 h-3" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
