// Free Agent Control Panel - Start, stop, and monitor agent
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  Square,
  Upload,
  X,
  Bot,
  Loader2,
  CheckCircle,
  AlertCircle,
  Pause,
  RotateCcw,
  MessageSquarePlus,
  Wand2,
  Settings,
  ChevronDown,
} from "lucide-react";
import type { FreeAgentSession, SessionFile } from "@/types/freeAgent";
import { InterjectModal } from "./InterjectModal";
import { EnhancePromptModal } from "./EnhancePromptModal";
import { EnhancePromptSettingsModal } from "./EnhancePromptSettingsModal";
import { safeStringify } from "@/lib/safeRender";

// Available models - same as workflow tool
const MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "gemini" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", provider: "gemini" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", provider: "gemini" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "claude" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "claude" },
  { value: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "claude" },
  { value: "grok-4-1-fast-reasoning", label: "Grok 4.1 Fast Reasoning", provider: "grok" },
  { value: "grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast Non-Reasoning", provider: "grok" },
  { value: "grok-code-fast-1", label: "Grok Code Fast 1", provider: "grok" },
];

interface FreeAgentPanelProps {
  session: FreeAgentSession | null;
  isRunning: boolean;
  onStart: (prompt: string, files: SessionFile[], model: string, maxIterations: number, existingSession?: FreeAgentSession | null) => void;
  onStop: () => void;
  onReset: () => void;
  onContinue: () => void;
  onRetry: () => void;
  onInterject: (message: string) => void;
  cacheSize?: number;
}

export function FreeAgentPanel({
  session,
  isRunning,
  onStart,
  onStop,
  onReset,
  onContinue,
  onRetry,
  onInterject,
  cacheSize = 0,
}: FreeAgentPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<SessionFile[]>([]);
  // Preserve model selection - use session model if available, otherwise keep last selection
  const [selectedModel, setSelectedModel] = useState(() => session?.model || "gemini-2.5-flash");
  const [maxIterations, setMaxIterations] = useState(() => session?.maxIterations || 50);
  const [interjectModalOpen, setInterjectModalOpen] = useState(false);
  const [enhanceModalOpen, setEnhanceModalOpen] = useState(false);
  const [enhanceSettingsModalOpen, setEnhanceSettingsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sync model and maxIterations from session when transitioning to idle (Continue)
  React.useEffect(() => {
    if (session?.status === "idle") {
      if (session.model) setSelectedModel(session.model);
      if (session.maxIterations) setMaxIterations(session.maxIterations);
    }
  }, [session?.status]);

  const handleClear = () => {
    setPrompt("");
    setFiles([]);
    // Also reset session to clear blackboard, scratchpad, and attributes
    onReset();
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    const newFiles: SessionFile[] = [];

    for (const file of Array.from(uploadedFiles)) {
      const content = await readFileAsBase64OrText(file);
      newFiles.push({
        id: crypto.randomUUID(),
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        content,
        uploadedAt: new Date().toISOString(),
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const readFileAsBase64OrText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (file.type.startsWith("text/") || file.type.includes("json") || file.type.includes("xml")) {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      } else {
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }
    });
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleStart = () => {
    if (!prompt.trim()) return;
    // Pass existing session if in "idle" state (after Continue) to preserve memory
    onStart(prompt, files, selectedModel, maxIterations, session?.status === "idle" ? session : null);
    // Keep prompt and files so user can re-run
  };

  const handleInterject = (message: string) => {
    onInterject(message);
  };

  const handleEnhancedPromptAccept = (enhancedPrompt: string) => {
    setPrompt(enhancedPrompt);
  };

  const handleEnhancedPromptAcceptAndStart = (enhancedPrompt: string) => {
    setPrompt(enhancedPrompt);
    // Start agent with enhanced prompt after state update
    setTimeout(() => {
      onStart(enhancedPrompt, files, selectedModel, maxIterations, session?.status === "idle" ? session : null);
    }, 0);
  };

  const getStatusBadge = () => {
    if (!session) return null;

    switch (session.status) {
      case "running":
        return (
          <Badge variant="default" className="bg-yellow-500">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary" className="bg-orange-500 text-white">
            <Pause className="w-3 h-3 mr-1" />
            Paused{session.retryCount ? ` (${session.retryCount} retries)` : ""}
          </Badge>
        );
      case "needs_assistance":
        return (
          <Badge variant="secondary">
            <Pause className="w-3 h-3 mr-1" />
            Awaiting Input
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Bot className="w-3 h-3 mr-1" />
            Idle
          </Badge>
        );
    }
  };

  // Get provider badge color
  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "gemini": return "text-blue-500";
      case "claude": return "text-orange-500";
      case "grok": return "text-purple-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Free Agent
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Show input form when no session OR when session is idle (after Continue) */}
        {(!session || session.status === "idle") ? (
          <>
            {/* Prompt input */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Task Description</Label>
              <Textarea
                id="prompt"
                placeholder="Describe what you want the agent to do..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium uppercase ${getProviderColor(opt.provider)}`}>
                          {opt.provider}
                        </span>
                        <span>{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Iterations */}
            <div className="space-y-2">
              <Label htmlFor="max-iterations">Max Iterations</Label>
              <Input
                id="max-iterations"
                type="number"
                min={1}
                max={200}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of autonomous iterations (1-200)
              </p>
            </div>

            {/* File uploads */}
            <div className="space-y-2">
              <Label>Files (optional)</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </Button>
                <Input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {files.length > 0 && (
                <ScrollArea className="h-[80px] border rounded-md p-2">
                  <div className="space-y-1">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1"
                      >
                        <span className="truncate flex-1">{file.filename}</span>
                        <span className="text-muted-foreground text-xs mx-2">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => removeFile(file.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Enhance Prompt dropdown */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                onClick={() => setEnhanceModalOpen(true)}
                disabled={!prompt.trim() || isRunning}
                className="flex-1 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-500"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Enhance Prompt
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 hover:text-amber-500"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={() => setEnhanceModalOpen(true)}
                    disabled={!prompt.trim() || isRunning}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Enhance Prompt
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEnhanceSettingsModalOpen(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Enhancement Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Start button */}
            <Button
              onClick={handleStart}
              disabled={!prompt.trim() || isRunning}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Agent
            </Button>

            {/* Clear button */}
            {(prompt.trim() || files.length > 0) && (
              <Button
                variant="outline"
                onClick={handleClear}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </>
        ) : (
          <>
            {/* Session info */}
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Prompt: </span>
                <span className="line-clamp-2">{session.prompt}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Model: </span>
                <span className="font-medium">{session.model}</span>
              </div>

              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Iteration: </span>
                  <span>
                    {session.currentIteration} / {session.maxIterations}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tools: </span>
                  <span>{session.toolCalls.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Artifacts: </span>
                  <span>{session.artifacts.length}</span>
                </div>
              </div>
            </div>

            {/* Memory Stats - shows what's being tracked */}
            <div className="flex-1 overflow-hidden">
              <Label className="mb-2 block">Memory</Label>
              <div className="space-y-2 text-sm border rounded-md p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Blackboard entries:</span>
                  <span className="font-medium">{session.blackboard.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scratchpad:</span>
                  <span className="font-medium">
                    {session.scratchpad ? `${session.scratchpad.length} chars` : 'Empty'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tool cache:</span>
                  <span className="font-medium">{cacheSize} items</span>
                </div>
                {session.blackboard.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-xs text-muted-foreground mb-1">Latest entry:</div>
                    <div className="text-xs bg-muted/50 p-2 rounded line-clamp-3">
                      [{session.blackboard[session.blackboard.length - 1]?.category}] {safeStringify(session.blackboard[session.blackboard.length - 1]?.content)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {isRunning ? (
                  <>
                    <Button variant="destructive" onClick={onStop} className="flex-1">
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setInterjectModalOpen(true)}
                      className="flex-1"
                    >
                      <MessageSquarePlus className="w-4 h-4 mr-2" />
                      Interject
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={onReset} className="flex-1">
                      Reset
                    </Button>
                    {(session.status === "paused" || session.status === "error") && (
                      <Button onClick={onRetry} className="flex-1 bg-orange-500 hover:bg-orange-600">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                    )}
                    {session.status === "completed" && (
                      <Button onClick={onContinue} className="flex-1">
                        <Play className="w-4 h-4 mr-2" />
                        Continue
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Interject Modal */}
        <InterjectModal
          open={interjectModalOpen}
          onClose={() => setInterjectModalOpen(false)}
          onSubmit={handleInterject}
        />

        {/* Enhance Prompt Modal */}
        <EnhancePromptModal
          open={enhanceModalOpen}
          onOpenChange={setEnhanceModalOpen}
          originalPrompt={prompt}
          files={files}
          model={selectedModel}
          onAccept={handleEnhancedPromptAccept}
          onAcceptAndStart={handleEnhancedPromptAcceptAndStart}
        />

        {/* Enhance Prompt Settings Modal */}
        <EnhancePromptSettingsModal
          open={enhanceSettingsModalOpen}
          onOpenChange={setEnhanceSettingsModalOpen}
        />
      </CardContent>
    </Card>
  );
}
