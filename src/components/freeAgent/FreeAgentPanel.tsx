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
  Play,
  Square,
  Upload,
  X,
  Bot,
  Loader2,
  CheckCircle,
  AlertCircle,
  Pause,
} from "lucide-react";
import type { FreeAgentSession, SessionFile } from "@/types/freeAgent";

interface FreeAgentPanelProps {
  session: FreeAgentSession | null;
  isRunning: boolean;
  onStart: (prompt: string, files: SessionFile[], existingSession?: FreeAgentSession | null) => void;
  onStop: () => void;
  onReset: () => void;
  onContinue: () => void;
  cacheSize?: number;
}

export function FreeAgentPanel({
  session,
  isRunning,
  onStart,
  onStop,
  onReset,
  onContinue,
  cacheSize = 0,
}: FreeAgentPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<SessionFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    setPrompt("");
    setFiles([]);
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
    onStart(prompt, files, session?.status === "idle" ? session : null);
    // Keep prompt and files so user can re-run
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
                className="min-h-[120px] resize-none"
              />
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
                <ScrollArea className="h-[100px] border rounded-md p-2">
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
                      [{session.blackboard[session.blackboard.length - 1]?.category}] {session.blackboard[session.blackboard.length - 1]?.content}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="destructive" onClick={onStop} className="flex-1">
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={onReset} className="flex-1">
                    Reset
                  </Button>
                  {session.status === "completed" && (
                    <Button onClick={onContinue} className="flex-1">
                      <Play className="w-4 h-4 mr-2" />
                      Continue
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
