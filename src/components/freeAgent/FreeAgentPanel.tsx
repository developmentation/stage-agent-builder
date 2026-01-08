// Free Agent Control Panel - Start, stop, and monitor agent
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Pause,
  RotateCcw,
  MessageSquarePlus,
  Wand2,
  Settings,
  ChevronDown,
  Lightbulb,
  Key,
  ClipboardList,
  AlertTriangle,
  GitBranch,
  Download,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { exportSessionToZip } from "@/utils/sessionExporter";
import { Switch } from "@/components/ui/switch";
import type { FreeAgentSession, SessionFile, ToolsManifest, AdvancedFeatures } from "@/types/freeAgent";
import { InterjectModal } from "./InterjectModal";
import { EnhancePromptModal } from "./EnhancePromptModal";
import { EnhancePromptSettingsModal } from "./EnhancePromptSettingsModal";
import { ReflectModal } from "./ReflectModal";
import { SecretsManagerModal } from "./SecretsManagerModal";
import { SecretsMiniPanel } from "./SecretsMiniPanel";
import { ToolInstancesTab } from "./ToolInstancesTab";
import { safeStringify } from "@/lib/safeRender";
import type { SecretsManager } from "@/hooks/useSecretsManager";
import type { ToolInstancesManager } from "@/hooks/useToolInstances";
import { extractTextFromFile } from "@/utils/fileTextExtraction";
import { parseExcelFile, type ExcelData } from "@/utils/parseExcel";
import { ExcelSelector } from "@/components/ExcelSelector";

// Text-based file extensions that can be read as plain text
const TEXT_EXTENSIONS = [
  'txt', 'md', 'markdown', 'json', 'xml', 'csv', 'yaml', 'yml', 'toml',
  'js', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'html', 'css', 'scss', 'sass', 'less',
  'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt',
  'sql', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'log', 'env', 'ini', 'conf', 'config', 'gitignore', 'dockerfile'
];

const getFileType = (filename: string): 'excel' | 'document' | 'text' | 'binary' => {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  if (ext === 'pdf' || ext === 'docx') return 'document';
  if (ext && TEXT_EXTENSIONS.includes(ext)) return 'text';
  return 'binary';
};

// Available models - Claude first, then Google, then Grok
const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "claude" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "claude" },
  { value: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "claude" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", provider: "gemini" },
  { value: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", provider: "gemini" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "gemini" },
  { value: "grok-4-1-fast-reasoning", label: "Grok 4.1 Fast Reasoning", provider: "grok" },
  { value: "grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast Non-Reasoning", provider: "grok" },
  { value: "grok-code-fast-1", label: "Grok Code Fast 1", provider: "grok" },
];

interface FreeAgentPanelProps {
  session: FreeAgentSession | null;
  isRunning: boolean;
  onStart: (prompt: string, files: SessionFile[], model: string, maxIterations: number, existingSession?: FreeAgentSession | null, advancedFeatures?: AdvancedFeatures) => void;
  onStop: () => void;
  onReset: () => void;
  onContinue: () => void;
  onRetry: () => void;
  onInterject: (message: string) => void;
  cacheSize?: number;
  secretsManager: SecretsManager;
  toolsManifest: ToolsManifest | null;
  toolInstancesManager: ToolInstancesManager;
  pendingFiles: SessionFile[];
  onPendingFilesChange: (files: SessionFile[]) => void;
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
  secretsManager,
  toolsManifest,
  toolInstancesManager,
  pendingFiles,
  onPendingFilesChange,
}: FreeAgentPanelProps) {
  const [prompt, setPrompt] = useState("");
  
  // Helper to add files to parent state
  const addFiles = (newFiles: SessionFile[]) => {
    onPendingFilesChange([...pendingFiles, ...newFiles]);
  };
  
  // Helper to remove a file from parent state
  const removeFile = (fileId: string) => {
    onPendingFilesChange(pendingFiles.filter((f) => f.id !== fileId));
  };
  
  // Preserve model selection - use session model if available, otherwise keep last selection
  const [selectedModel, setSelectedModel] = useState(() => session?.model || "claude-sonnet-4-5");
  const [maxIterations, setMaxIterations] = useState(() => session?.maxIterations || 50);
  const [interjectModalOpen, setInterjectModalOpen] = useState(false);
  const [enhanceModalOpen, setEnhanceModalOpen] = useState(false);
  const [enhanceSettingsModalOpen, setEnhanceSettingsModalOpen] = useState(false);
  const [reflectModalOpen, setReflectModalOpen] = useState(false);
  const [secretsModalOpen, setSecretsModalOpen] = useState(false);
  const [controlTab, setControlTab] = useState<'task' | 'secrets' | 'instances' | 'advanced'>('task');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Excel file handling state
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [excelQueue, setExcelQueue] = useState<File[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  
  // Advanced features state
  const [selfAuthorEnabled, setSelfAuthorEnabled] = useState(false);
  const [spawnEnabled, setSpawnEnabled] = useState(false);
  const [maxChildren, setMaxChildren] = useState(5);
  const [childMaxIterations, setChildMaxIterations] = useState(20);
  
  // Sync model and maxIterations from session when transitioning to idle (Continue)
  React.useEffect(() => {
    if (session?.status === "idle") {
      if (session.model) setSelectedModel(session.model);
      if (session.maxIterations) setMaxIterations(session.maxIterations);
    }
  }, [session?.status]);

  const handleClear = () => {
    setPrompt("");
    onPendingFilesChange([]);
    // Also reset session to clear blackboard, scratchpad, and attributes
    onReset();
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    setIsProcessingFiles(true);
    const newFiles: SessionFile[] = [];
    const excelFilesQueue: File[] = [];

    for (const file of Array.from(uploadedFiles)) {
      const fileType = getFileType(file.name);
      
      try {
        if (fileType === 'excel') {
          // Queue Excel files for interactive selection
          excelFilesQueue.push(file);
        } else if (fileType === 'document') {
          // Extract text from PDF/DOCX
          const extracted = await extractTextFromFile(file);
          newFiles.push({
            id: crypto.randomUUID(),
            filename: file.name,
            mimeType: 'text/plain',
            size: extracted.content.length,
            content: extracted.content,
            uploadedAt: new Date().toISOString(),
          });
          toast.success(`Extracted text from ${file.name}`);
        } else if (fileType === 'text') {
          // Read as plain text
          const content = await readFileAsText(file);
          newFiles.push({
            id: crypto.randomUUID(),
            filename: file.name,
            mimeType: file.type || 'text/plain',
            size: file.size,
            content,
            uploadedAt: new Date().toISOString(),
          });
        } else {
          // Binary files - read as base64
          const content = await readFileAsBase64(file);
          newFiles.push({
            id: crypto.randomUUID(),
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            content,
            uploadedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        toast.error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    addFiles(newFiles);
    setIsProcessingFiles(false);
    
    // Process Excel files queue
    if (excelFilesQueue.length > 0) {
      setExcelQueue(excelFilesQueue);
      processNextExcel(excelFilesQueue);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processNextExcel = async (queue: File[]) => {
    if (queue.length === 0) {
      setExcelData(null);
      setExcelQueue([]);
      return;
    }
    
    const file = queue[0];
    try {
      const parsed = await parseExcelFile(file);
      setExcelData(parsed);
    } catch (error) {
      console.error(`Error parsing ${file.name}:`, error);
      toast.error(`Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Move to next file
      const remaining = queue.slice(1);
      setExcelQueue(remaining);
      processNextExcel(remaining);
    }
  };

  const handleExcelSelect = (data: {
    fileName: string;
    selectedData: Array<{
      sheetName: string;
      headers: string[];
      selectedRows: Record<string, any>[];
    }>;
    formattedContent: string;
    totalRows: number;
  }) => {
    // Create session file with the pre-formatted content
    const newFile: SessionFile = {
      id: crypto.randomUUID(),
      filename: data.fileName,
      mimeType: 'application/json',
      size: data.formattedContent.length,
      content: data.formattedContent,
      uploadedAt: new Date().toISOString(),
    };
    
    addFiles([newFile]);
    toast.success(`Added ${data.fileName} with ${data.totalRows} rows`);
    
    // Process next Excel file in queue
    const remaining = excelQueue.slice(1);
    setExcelQueue(remaining);
    processNextExcel(remaining);
  };

  const handleExcelClose = () => {
    // Skip current file and process next
    const remaining = excelQueue.slice(1);
    setExcelQueue(remaining);
    processNextExcel(remaining);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };


  const handleStart = () => {
    if (!prompt.trim()) return;
    // Build advanced features from local state
    const advancedFeatures: AdvancedFeatures = {
      selfAuthorEnabled,
      spawnEnabled,
      maxChildren,
      childMaxIterations,
    };
    // Pass existing session if in "idle" state (after Continue) to preserve memory
    onStart(prompt, pendingFiles, selectedModel, maxIterations, session?.status === "idle" ? session : null, advancedFeatures);
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
      onStart(enhancedPrompt, pendingFiles, selectedModel, maxIterations, session?.status === "idle" ? session : null);
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
      <CardHeader className="pb-2 pt-2 px-2">
        {getStatusBadge()}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden px-2 pb-2">
        {/* Sub-tabs for Task, Instances, Secrets, Advanced */}
        <Tabs value={controlTab} onValueChange={(v) => setControlTab(v as 'task' | 'secrets' | 'instances' | 'advanced')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 mb-3">
            <TabsTrigger value="task" className="gap-1 text-xs">
              <ClipboardList className="w-3 h-3" />
              <span className="hidden min-[380px]:inline">Task</span>
            </TabsTrigger>
            <TabsTrigger value="instances" className="gap-1 text-xs">
              <Package className="w-3 h-3" />
              <span className="hidden min-[380px]:inline">Tools</span>
              {toolInstancesManager.instances.length > 0 && (
                <span className="min-[380px]:hidden">({toolInstancesManager.instances.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="secrets" className="gap-1 text-xs">
              <Key className="w-3 h-3" />
              <span className="hidden min-[380px]:inline">Secrets</span>
              {secretsManager.secrets.length > 0 && (
                <span className="min-[380px]:hidden">({secretsManager.secrets.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="advanced" className="gap-1 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span className="hidden min-[380px]:inline">Adv</span>
            </TabsTrigger>
          </TabsList>

          {/* Task Tab */}
          <TabsContent value="task" className="flex-1 overflow-y-auto m-0">
            <div className="flex flex-col gap-4 pr-1">
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
                  accept="*/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {pendingFiles.length > 0 && (
                <ScrollArea className="h-[80px] border rounded-md p-2">
                  <div className="space-y-1">
                    {pendingFiles.map((file) => (
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
            {(prompt.trim() || pendingFiles.length > 0) && (
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
              {isRunning ? (
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={onStop} className="flex-1">
                    <Square className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Stop</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setInterjectModalOpen(true)}
                    className="flex-1"
                  >
                    <MessageSquarePlus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Interject</span>
                  </Button>
                </div>
              ) : (
                <>
                  {/* Reflect button */}
                  <Button 
                    variant="outline" 
                    onClick={() => setReflectModalOpen(true)}
                    className="w-full border-purple-500/50 text-purple-600 hover:bg-purple-500/10"
                  >
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Reflect on Session
                  </Button>
                  
                  {/* Reset button */}
                  <Button variant="outline" onClick={onReset} className="w-full">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                  
                  {/* Retry button */}
                  {(session.status === "paused" || session.status === "error") && (
                    <Button onClick={onRetry} className="w-full bg-orange-500 hover:bg-orange-600">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  )}
                  
                  {/* Continue button */}
                  {session.status === "completed" && (
                    <Button onClick={onContinue} className="w-full">
                      <Play className="w-4 h-4 mr-2" />
                      Continue
                    </Button>
                  )}
                  
                  {/* Download button - show when completed */}
                  {session.status === "completed" && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const blob = await exportSessionToZip({
                            session,
                            promptSections: session.promptData?.sections,
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `freeagent-session-${new Date().toISOString().split("T")[0]}.zip`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success("Session exported successfully");
                        } catch (error) {
                          console.error("Failed to export session:", error);
                          toast.error("Failed to export session");
                        }
                      }}
                      className="w-full border-green-500/50 text-green-600 hover:bg-green-500/10"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Session
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
            </div>
          </TabsContent>

          {/* Instances Tab */}
          <TabsContent value="instances" className="flex-1 overflow-hidden m-0">
            <ToolInstancesTab
              toolInstancesManager={toolInstancesManager}
              toolsManifest={toolsManifest}
            />
          </TabsContent>

          {/* Secrets Tab */}
          <TabsContent value="secrets" className="flex-1 overflow-hidden m-0">
            <SecretsMiniPanel
              secretsManager={secretsManager}
              onOpenModal={() => setSecretsModalOpen(true)}
            />
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="flex-1 overflow-y-auto m-0">
            <div className="space-y-4 pr-1">
              <div className="border border-amber-500/50 rounded-lg p-3 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600">Advanced Features</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  These features grant the agent powerful capabilities. Use with caution.
                </p>
                
                {/* Max Iterations - moved here */}
                <div className="space-y-2 mb-4">
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

                {/* Self-Author Toggle */}
                <div className="flex items-start gap-3 p-3 rounded-md border border-red-500/30 bg-red-500/5 mb-4">
                  <Switch
                    checked={selfAuthorEnabled}
                    onCheckedChange={setSelfAuthorEnabled}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="text-red-600 cursor-pointer" onClick={() => setSelfAuthorEnabled(!selfAuthorEnabled)}>
                        Self-Author
                      </Label>
                      <Badge variant="outline" className="text-red-500 border-red-500/50 text-[10px]">
                        DANGER
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Agent can read and modify its own system prompt. May cause unanticipated actions. For testing only.
                    </p>
                    {selfAuthorEnabled && (
                      <p className="text-xs text-red-500 mt-1">
                        Grants: <code className="bg-muted px-1 rounded">read_self</code>, <code className="bg-muted px-1 rounded">write_self</code>
                      </p>
                    )}
                  </div>
                </div>

                {/* Spawn Toggle */}
                <div className="flex items-start gap-3 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                  <Switch
                    checked={spawnEnabled}
                    onCheckedChange={setSpawnEnabled}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="text-amber-600 cursor-pointer" onClick={() => setSpawnEnabled(!spawnEnabled)}>
                        Spawn Children
                      </Label>
                      <GitBranch className="w-3 h-3 text-amber-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Agent can create child instances for parallel work. Orchestrator waits for children to complete.
                    </p>
                    {spawnEnabled && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Max Children</Label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={maxChildren}
                            onChange={(e) => setMaxChildren(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Child Max Iter</Label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={childMaxIterations}
                            onChange={(e) => setChildMaxIterations(Math.max(1, Math.min(50, parseInt(e.target.value) || 20)))}
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}
                    {spawnEnabled && (
                      <p className="text-xs text-amber-500 mt-2">
                        Grants: <code className="bg-muted px-1 rounded">spawn</code>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

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
          files={pendingFiles}
          model={selectedModel}
          onAccept={handleEnhancedPromptAccept}
          onAcceptAndStart={handleEnhancedPromptAcceptAndStart}
        />

        {/* Enhance Prompt Settings Modal */}
        <EnhancePromptSettingsModal
          open={enhanceSettingsModalOpen}
          onOpenChange={setEnhanceSettingsModalOpen}
        />

        {/* Reflect Modal */}
        <ReflectModal
          open={reflectModalOpen}
          onOpenChange={setReflectModalOpen}
          blackboard={session?.blackboard || []}
          scratchpad={session?.scratchpad || ""}
          originalPrompt={session?.prompt || ""}
          model={selectedModel}
        />

        {/* Secrets Manager Modal */}
        <SecretsManagerModal
          open={secretsModalOpen}
          onOpenChange={setSecretsModalOpen}
          secretsManager={secretsManager}
          toolsManifest={toolsManifest}
          toolInstancesManager={toolInstancesManager}
        />

        {/* Excel Selector Modal */}
        {excelData && (
          <ExcelSelector
            excelData={excelData}
            onClose={handleExcelClose}
            onSelect={handleExcelSelect}
          />
        )}
      </CardContent>
    </Card>
  );
}
