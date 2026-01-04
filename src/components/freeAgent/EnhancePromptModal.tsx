// Enhance Prompt Modal - AI-powered prompt planning and refinement
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
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Loader2,
  Code,
  FileText,
  RefreshCw,
  Check,
  Play,
  MessageSquare,
  Wand2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { SessionFile } from "@/types/freeAgent";

interface EnhancePromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPrompt: string;
  files: SessionFile[];
  model: string;
  onAccept: (enhancedPrompt: string) => void;
  onAcceptAndStart: (enhancedPrompt: string) => void;
}

interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, { description?: string }>;
}

export function EnhancePromptModal({
  open,
  onOpenChange,
  originalPrompt,
  files,
  model,
  onAccept,
  onAcceptAndStart,
}: EnhancePromptModalProps) {
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activeTab, setActiveTab] = useState<"markdown" | "raw">("markdown");
  const [hasEnhanced, setHasEnhanced] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setEnhancedPrompt("");
      setFeedback("");
      setIsEnhancing(false);
      setHasEnhanced(false);
      setActiveTab("markdown");
    }
  }, [open]);

  // Load tools manifest for context
  const loadToolsList = async (): Promise<ToolInfo[]> => {
    try {
      const response = await fetch("/data/toolsManifest.json");
      const manifest = await response.json();
      return Object.entries(manifest.tools).map(([key, tool]: [string, any]) => ({
        name: key,
        description: tool.description,
        parameters: tool.parameters || {},
      }));
    } catch (error) {
      console.error("Failed to load tools manifest:", error);
      return [];
    }
  };

  // Format tools list for the enhancement prompt
  const formatToolsList = (tools: ToolInfo[]): string => {
    return tools
      .map((tool) => {
        const params = Object.entries(tool.parameters)
          .map(([name, param]) => `${name}: ${param.description || ""}`)
          .join(", ");
        return `- ${tool.name}: ${tool.description}${params ? ` (params: ${params})` : ""}`;
      })
      .join("\n");
  };

  // Format files list for context
  const formatFilesList = (): string => {
    if (files.length === 0) return "No files provided.";
    return files
      .map((f) => `- ${f.filename} (${f.mimeType}, ${(f.size / 1024).toFixed(1)} KB)`)
      .join("\n");
  };

  // Get the appropriate edge function based on model
  const getEdgeFunction = (): string => {
    if (model.startsWith("claude")) return "run-agent-anthropic";
    if (model.startsWith("grok")) return "run-agent-xai";
    return "run-agent"; // Gemini default
  };

  // Enhancement system prompt
  const getEnhancementSystemPrompt = (toolsList: string, filesList: string, previousPlan?: string, userFeedback?: string): string => {
    let prompt = `You are an expert task planner for an autonomous AI agent called "Free Agent". Your job is to transform a user's request into a detailed, actionable execution plan that the agent can follow systematically.

The agent operates in iterations, calling tools and tracking progress on a blackboard. It has access to these tools:

${toolsList}

The user has provided these files:
${filesList}

Create a comprehensive execution plan that the agent can follow. The plan should be specific, actionable, and tailored to the available tools.

Format your response as follows:

## Goal
Clearly restate what needs to be accomplished in 1-2 sentences.

## Strategy  
Describe the high-level approach in 2-3 sentences.

## Execution Plan

### Phase 1: [Name]
- **Tools**: [which tools to use]
- **Actions**: [specific steps the agent should take]
- **Store**: [what to save to blackboard/scratchpad]
- **Expected Output**: [what this phase produces]

### Phase 2: [Name]
...continue for all necessary phases...

## Success Criteria
- [How to know the task is complete]
- [Quality checks to perform]

## Potential Challenges
- [Possible issues and how to handle them]

## Estimated Iterations: [number]

Be thorough but concise. Focus on practical, executable steps.`;

    if (previousPlan && userFeedback) {
      prompt += `

---

The user reviewed your previous plan and provided feedback. Please revise the plan accordingly.

Previous plan:
${previousPlan}

User feedback:
${userFeedback}

Please create an improved plan that addresses the user's feedback.`;
    }

    return prompt;
  };

  // Stream enhancement from edge function
  const streamEnhancement = async (isRefinement: boolean = false) => {
    setIsEnhancing(true);
    setEnhancedPrompt("");
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const tools = await loadToolsList();
      const toolsList = formatToolsList(tools);
      const filesList = formatFilesList();
      
      const systemPrompt = getEnhancementSystemPrompt(
        toolsList,
        filesList,
        isRefinement ? enhancedPrompt : undefined,
        isRefinement ? feedback : undefined
      );

      const userPrompt = isRefinement
        ? `Original request: ${originalPrompt}\n\nPlease revise the plan based on my feedback.`
        : originalPrompt;

      const edgeFunction = getEdgeFunction();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/${edgeFunction}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt,
          userPrompt,
          model,
          maxOutputTokens: 8192,
          tools: [],
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Enhancement failed: ${response.status}`);
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
              setEnhancedPrompt(accumulated);
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

      setHasEnhanced(true);
      setFeedback("");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log("Enhancement cancelled");
      } else {
        console.error("Enhancement error:", error);
        setEnhancedPrompt(`Error: ${(error as Error).message}`);
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleEnhance = () => {
    streamEnhancement(false);
  };

  const handleRefine = () => {
    if (!feedback.trim()) return;
    streamEnhancement(true);
  };

  const handleAccept = () => {
    onAccept(enhancedPrompt);
    onOpenChange(false);
  };

  const handleAcceptAndStart = () => {
    onAcceptAndStart(enhancedPrompt);
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onOpenChange(false);
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
        className="w-[calc(100vw-100px)] max-w-none h-[calc(100vh-100px)] flex flex-col p-0 gap-0"
        style={{ maxHeight: "calc(100vh - 100px)" }}
      >
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wand2 className="w-5 h-5 text-amber-500" />
              <DialogTitle className="text-lg">Enhance Your Prompt</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={modelInfo.color}>
                {modelInfo.label}
              </Badge>
              {files.length > 0 && (
                <Badge variant="secondary">
                  {files.length} file{files.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Original prompt section */}
          <div className="px-6 py-4 border-b bg-background shrink-0">
            <Label className="text-sm text-muted-foreground mb-2 block">
              Original Prompt
            </Label>
            <div className="bg-muted/50 rounded-md p-3 text-sm max-h-24 overflow-y-auto">
              {originalPrompt}
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0 p-6 gap-4">
            {/* Action buttons for initial enhancement */}
            {!hasEnhanced && !isEnhancing && (
              <div className="flex items-center justify-center py-8">
                <Button onClick={handleEnhance} size="lg" className="gap-2">
                  <Sparkles className="w-5 h-5" />
                  Generate Structured Plan
                </Button>
              </div>
            )}

            {/* Loading state */}
            {isEnhancing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {hasEnhanced ? "Refining plan..." : "Generating structured plan..."}
                </span>
              </div>
            )}

            {/* Enhanced prompt display */}
            {(enhancedPrompt || isEnhancing) && (
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "markdown" | "raw")}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="flex items-center justify-between shrink-0">
                  <TabsList className="h-8">
                    <TabsTrigger value="markdown" className="text-xs gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="text-xs gap-1.5">
                      <Code className="w-3.5 h-3.5" />
                      Edit
                    </TabsTrigger>
                  </TabsList>
                  {hasEnhanced && !isEnhancing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEnhance}
                      className="gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Start Over
                    </Button>
                  )}
                </div>

                <div className="flex-1 min-h-0 mt-3 border rounded-md overflow-hidden">
                  <TabsContent value="markdown" className="h-full m-0 p-0">
                    <ScrollArea className="h-full">
                      <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {enhancedPrompt || "_Generating..._"}
                        </ReactMarkdown>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="raw" className="h-full m-0 p-0">
                    <Textarea
                      value={enhancedPrompt}
                      onChange={(e) => setEnhancedPrompt(e.target.value)}
                      className="h-full w-full border-0 rounded-none resize-none font-mono text-sm"
                      placeholder="Enhanced prompt will appear here..."
                    />
                  </TabsContent>
                </div>
              </Tabs>
            )}

            {/* Feedback section */}
            {hasEnhanced && !isEnhancing && (
              <div className="shrink-0 space-y-2 border-t pt-4">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Refine with Feedback (optional)
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide feedback to refine the plan... e.g., 'Focus more on error handling' or 'Add a verification step'"
                    className="min-h-[60px] resize-none flex-1"
                  />
                  <Button
                    onClick={handleRefine}
                    disabled={!feedback.trim()}
                    variant="secondary"
                    className="shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refine
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleAccept}
                disabled={!enhancedPrompt || isEnhancing}
                className="gap-2"
              >
                <Check className="w-4 h-4" />
                Accept
              </Button>
              <Button
                onClick={handleAcceptAndStart}
                disabled={!enhancedPrompt || isEnhancing}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                Accept & Start
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
