import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Settings, Play, Database, Download, Eye, Save, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useState, useRef } from "react";
import type { WorkflowNode, AgentNode, FunctionNode, ToolInstance } from "@/types/workflow";
import { getFunctionById } from "@/lib/functionDefinitions";
import { FunctionExecutor } from "@/lib/functionExecutor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { extractTextFromFile, formatExtractedContent, ExtractedContent } from "@/utils/fileTextExtraction";
import { parseExcelFile, ExcelData } from "@/utils/parseExcel";
import { ExcelSelector } from "@/components/ExcelSelector";

interface PropertiesPanelProps {
  selectedAgent: AgentNode | undefined;
  selectedNode?: WorkflowNode;
  onUpdateAgent: (agentId: string, updates: Partial<AgentNode>) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onAddToolInstance: (agentId: string, toolId: string) => void;
  onUpdateToolInstance: (agentId: string, toolInstanceId: string, config: any) => void;
  onRemoveToolInstance: (agentId: string, toolInstanceId: string) => void;
  onDeselectAgent: () => void;
  onRunAgent: (agentId: string, customInput?: string) => void;
  onRunFunction?: (functionId: string, customInput?: string) => void;
}

const availableTools = [
  { id: "google_search", name: "Google Search", requiresApiKey: true },
  { id: "weather", name: "Weather", requiresApiKey: true },
  { id: "time", name: "Time", requiresApiKey: false },
  { id: "api_call", name: "API Call", requiresApiKey: true },
  { id: "web_scrape", name: "Web Scrape", requiresApiKey: false },
];

export const PropertiesPanel = ({
  selectedAgent,
  selectedNode,
  onUpdateAgent,
  onUpdateNode,
  onAddToolInstance,
  onUpdateToolInstance,
  onRemoveToolInstance,
  onDeselectAgent,
  onRunAgent,
  onRunFunction,
}: PropertiesPanelProps) => {
  const [toolDialogOpen, setToolDialogOpen] = useState(false);
  const [configDialogInstance, setConfigDialogInstance] = useState<string | null>(null);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [isEditingOutput, setIsEditingOutput] = useState(false);
  const [editedOutput, setEditedOutput] = useState("");
  const contentFileInputRef = useRef<HTMLInputElement>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [excelQueue, setExcelQueue] = useState<File[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isViewContentOpen, setIsViewContentOpen] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [outputTab, setOutputTab] = useState("edit");

  // Use selectedNode if provided, otherwise fall back to selectedAgent
  const activeNode = selectedNode || selectedAgent;

  if (!activeNode) {
    return (
      <div className="bg-card flex items-center justify-center p-6 h-full">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            Select a node to view and edit its properties
          </p>
        </div>
      </div>
    );
  }

  // Get function definition if it's a function node
  const functionDef = activeNode.nodeType === "function" 
    ? getFunctionById((activeNode as FunctionNode).functionType)
    : null;

  const handleToolToggle = (toolId: string, checked: boolean) => {
    if (checked && activeNode.nodeType === "agent") {
      onAddToolInstance(activeNode.id, toolId);
    }
  };

  const updateNodeConfig = (config: Record<string, any>) => {
    if (onUpdateNode && activeNode.nodeType === "function") {
      onUpdateNode(activeNode.id, { config });
    }
  };

  const processNextExcel = async () => {
    if (excelQueue.length === 0) {
      setIsProcessingFiles(false);
      return;
    }

    const nextFile = excelQueue[0];
    try {
      const excelData = await parseExcelFile(nextFile);
      setExcelData(excelData);
      setExcelQueue(prev => prev.slice(1));
    } catch (error) {
      console.error(`Failed to parse Excel file ${nextFile.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to parse ${nextFile.name}`;
      toast({
        title: "Excel parsing failed",
        description: errorMessage,
        variant: "destructive",
      });
      setExcelQueue(prev => prev.slice(1));
      
      setTimeout(() => {
        if (excelQueue.length > 1) {
          processNextExcel();
        } else {
          setIsProcessingFiles(false);
        }
      }, 500);
    }
  };

  const handleContentFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (activeNode.nodeType !== "function") return;
    const functionNode = activeNode as FunctionNode;
    
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    const extractedContents: ExtractedContent[] = [];
    const excelFiles: File[] = [];

    try {
      for (const file of Array.from(files)) {
        const extension = file.name.toLowerCase().split('.').pop();

        if (extension === 'xlsx' || extension === 'xls') {
          excelFiles.push(file);
        } else {
          try {
            const extracted = await extractTextFromFile(file);
            extractedContents.push(extracted);
            toast({
              title: "File extracted",
              description: `Extracted text from ${file.name}`,
            });
          } catch (error) {
            console.error(`Failed to extract from ${file.name}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast({
              title: "Extraction failed",
              description: errorMessage.includes('Unsupported file type') 
                ? `Unsupported file type: ${file.name}`
                : `Failed to extract text from ${file.name}`,
              variant: "destructive",
            });
          }
        }
      }

      if (extractedContents.length > 0) {
        const formattedContent = formatExtractedContent(extractedContents);
        const currentContent = functionNode.config.content || "";
        const newContent = currentContent ? `${currentContent}${formattedContent}` : formattedContent.trim();
        updateNodeConfig({ ...functionNode.config, content: newContent });
      }

      if (excelFiles.length > 0) {
        setExcelQueue(excelFiles);
        try {
          const firstExcel = excelFiles[0];
          const excelData = await parseExcelFile(firstExcel);
          setExcelData(excelData);
          setExcelQueue(excelFiles.slice(1));
        } catch (error) {
          console.error('Failed to parse first Excel file:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to parse Excel file';
          toast({
            title: "Excel parsing failed",
            description: errorMessage,
            variant: "destructive",
          });
          if (excelFiles.length > 1) {
            setExcelQueue(excelFiles.slice(1));
            setTimeout(() => processNextExcel(), 500);
          } else {
            setIsProcessingFiles(false);
          }
        }
      } else {
        setIsProcessingFiles(false);
      }
    } catch (error) {
      console.error("File processing error:", error);
      toast({
        title: "Processing failed",
        description: "Failed to process files",
        variant: "destructive",
      });
      setIsProcessingFiles(false);
    } finally {
      if (contentFileInputRef.current) {
        contentFileInputRef.current.value = "";
      }
    }
  };

  const handleExcelSelect = (selectedData: {
    fileName: string;
    selectedData: any[];
    formattedContent: string;
    totalRows: number;
  }) => {
    if (activeNode.nodeType !== "function") return;
    const functionNode = activeNode as FunctionNode;
    
    const currentContent = functionNode.config.content || "";
    const newContent = currentContent 
      ? `${currentContent}${selectedData.formattedContent}` 
      : selectedData.formattedContent.trim();
    updateNodeConfig({ ...functionNode.config, content: newContent });
    
    toast({
      title: "Excel data added",
      description: `Added ${selectedData.totalRows} rows from ${selectedData.fileName}`,
    });
    setExcelData(null);
    
    if (excelQueue.length > 0) {
      processNextExcel();
    } else {
      setIsProcessingFiles(false);
    }
  };

  const handleExcelClose = () => {
    setExcelData(null);
    
    if (excelQueue.length > 0) {
      processNextExcel();
    } else {
      setIsProcessingFiles(false);
    }
  };

  const handleClearContent = () => {
    if (activeNode.nodeType !== "function") return;
    const functionNode = activeNode as FunctionNode;
    updateNodeConfig({ ...functionNode.config, content: "" });
    toast({
      title: "Content cleared",
      description: "Content has been cleared",
    });
  };

  const handleViewContent = () => {
    if (activeNode.nodeType !== "function") return;
    const functionNode = activeNode as FunctionNode;
    setEditedContent(functionNode.config.content || "");
    setIsViewContentOpen(true);
  };

  const handleSaveEditedContent = () => {
    if (activeNode.nodeType !== "function") return;
    const functionNode = activeNode as FunctionNode;
    updateNodeConfig({ ...functionNode.config, content: editedContent });
    setIsViewContentOpen(false);
    toast({
      title: "Content updated",
      description: "Your changes have been saved",
    });
  };

  // Render function configuration fields
  const renderFunctionConfig = (node: FunctionNode) => {
    if (!functionDef?.configSchema) return null;

    // Special rendering for Content function
    if (node.functionType === "content") {
      return (
        <div className="space-y-4">
          <Label className="text-sm font-medium">Content Configuration</Label>
          <Card className="p-3 bg-muted/30 space-y-3">
            <Textarea 
              placeholder="Enter your content here or upload files..."
              className="min-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0"
              value={node.config.content || ""}
              onChange={(e) => updateNodeConfig({ ...node.config, content: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                ref={contentFileInputRef}
                type="file"
                accept=".txt,.md,.json,.xml,.csv,.yaml,.yml,.toml,.js,.jsx,.ts,.tsx,.vue,.html,.css,.scss,.sass,.py,.java,.c,.cpp,.cs,.go,.php,.rb,.sql,.sh,.log,.pdf,.docx,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={handleContentFileUpload}
              />
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => contentFileInputRef.current?.click()}
                disabled={isProcessingFiles}
              >
                <Upload className="h-3.5 w-3.5" />
                {isProcessingFiles ? "Processing..." : "Upload Files"}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-9 w-9 p-0"
                onClick={handleViewContent}
                disabled={!node.config.content}
                title="View/Edit Content"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-9 w-9 p-0"
                onClick={handleClearContent}
                disabled={!node.config.content}
                title="Clear Content"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload files or enter content manually. Supports text files, PDFs, DOCX, and Excel files.
            </p>
          </Card>

          {/* View/Edit Content Dialog */}
          <Dialog open={isViewContentOpen} onOpenChange={setIsViewContentOpen}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>View / Edit Content</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0 py-4">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-full min-h-[60vh] resize-none"
                  placeholder="No content..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsViewContentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEditedContent}>
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Excel Selector Dialog */}
          {excelData && (
            <ExcelSelector
              excelData={excelData}
              onSelect={handleExcelSelect}
              onClose={handleExcelClose}
            />
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Label className="text-sm font-medium">Configuration</Label>
        <Card className="p-3 bg-muted/30 space-y-3">
          {Object.entries(functionDef.configSchema).map(([key, schema]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key} className="text-xs">
                {schema.label}
                {schema.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              
              {schema.type === "boolean" ? (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={key}
                    checked={node.config[key] ?? schema.default ?? false}
                    onCheckedChange={(checked) =>
                      updateNodeConfig({ ...node.config, [key]: checked })
                    }
                  />
                  {schema.description && (
                    <span className="text-xs text-muted-foreground">
                      {schema.description}
                    </span>
                  )}
                </div>
              ) : schema.type === "number" ? (
                <Input
                  id={key}
                  type="number"
                  placeholder={schema.placeholder}
                  value={node.config[key] ?? schema.default ?? ""}
                  min={key === "numResults" ? 1 : undefined}
                  max={key === "numResults" ? 1000 : undefined}
                  onChange={(e) => {
                    let value = parseFloat(e.target.value) || 0;
                    // Apply min/max constraints for numResults
                    if (key === "numResults") {
                      value = Math.max(1, Math.min(1000, value));
                    }
                    updateNodeConfig({ ...node.config, [key]: value });
                  }}
                  className="h-8 text-xs"
                />
              ) : (
                <Input
                  id={key}
                  type="text"
                  placeholder={schema.placeholder}
                  value={node.config[key] ?? schema.default ?? ""}
                  onChange={(e) =>
                    updateNodeConfig({ ...node.config, [key]: e.target.value })
                  }
                  className="h-8 text-xs"
                />
              )}
              
              {schema.description && schema.type !== "boolean" && (
                <p className="text-xs text-muted-foreground">{schema.description}</p>
              )}
            </div>
          ))}
        </Card>
      </div>
    );
  };

  // Render memory viewer for Memory function
  const renderMemoryViewer = (node: FunctionNode) => {
    if (node.functionType !== "memory") return null;

    const memoryKey = node.config.memoryKey || "default";
    const entries = FunctionExecutor.getMemoryEntries(memoryKey);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Memory Entries</Label>
          <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Database className="h-3 w-3 mr-1" />
                View ({entries.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Memory: {memoryKey}</DialogTitle>
                <DialogDescription>
                  All stored outputs from workflow runs
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[500px]">
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No entries yet. Run the workflow to store data.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Run ID</TableHead>
                        <TableHead className="w-[150px]">Timestamp</TableHead>
                        <TableHead>Output</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">
                            {entry.runId.slice(-8)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(entry.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs max-w-[400px] truncate">
                            {entry.output}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const csv = entries.map(e => 
                      `"${e.runId}","${new Date(e.timestamp).toISOString()}","${e.output.replace(/"/g, '""')}"`
                    ).join("\n");
                    const blob = new Blob([`"Run ID","Timestamp","Output"\n${csv}`], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `memory-${memoryKey}-${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Export CSV
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm("Clear all memory entries?")) {
                      FunctionExecutor.clearMemory(memoryKey);
                      setMemoryDialogOpen(false);
                    }
                  }}
                >
                  Clear Memory
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <Card className="p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {entries.length === 0 
              ? "No entries stored yet"
              : `${entries.length} entry(s) stored`
            }
          </p>
        </Card>
      </div>
    );
  };

  return (
    <div className="bg-card flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            {activeNode.nodeType === "agent" && "Agent Properties"}
            {activeNode.nodeType === "function" && "Function Properties"}
            {activeNode.nodeType === "tool" && "Tool Properties"}
          </h3>
          <Button variant="ghost" size="sm" onClick={onDeselectAgent} className="lg:flex hidden">
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {activeNode.nodeType === "agent" && (
          <Button 
            onClick={() => onRunAgent(activeNode.id)}
            className="w-full mt-3"
            variant="default"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Run Agent
          </Button>
        )}

        {activeNode.nodeType === "function" && onRunFunction && (
          <Button 
            onClick={() => onRunFunction(activeNode.id)}
            className="w-full mt-3"
            variant="default"
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            Run Function
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Common: Name */}
          <div className="space-y-2">
            <Label htmlFor="node-name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="node-name"
              placeholder="Node name..."
              value={activeNode.name}
              onChange={(e) => {
                if (activeNode.nodeType === "agent") {
                  onUpdateAgent(activeNode.id, { name: e.target.value });
                } else if (onUpdateNode) {
                  onUpdateNode(activeNode.id, { name: e.target.value });
                }
              }}
            />
          </div>

          {/* Agent-specific fields */}
          {activeNode.nodeType === "agent" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="system-prompt" className="text-sm font-medium">
                  System Prompt
                </Label>
                <Textarea
                  id="system-prompt"
                  placeholder="You are a helpful assistant..."
                  className="min-h-[100px] resize-none"
                  value={(activeNode as AgentNode).systemPrompt}
                  onChange={(e) =>
                    onUpdateAgent(activeNode.id, { systemPrompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Define the agent's role and behavior
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-prompt" className="text-sm font-medium">
                  User Prompt Template
                </Label>
                <Textarea
                  id="user-prompt"
                  placeholder="Analyze the following: {input}"
                  className="min-h-[80px] resize-none"
                  value={(activeNode as AgentNode).userPrompt}
                  onChange={(e) =>
                    onUpdateAgent(activeNode.id, { userPrompt: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{input}"} for stage inputs
                </p>
              </div>
            </>
          )}

          {/* Function-specific fields */}
          {activeNode.nodeType === "function" && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Function Type</Label>
                <Card className="p-3 bg-muted/30">
                  <p className="text-xs text-foreground">{functionDef?.name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {functionDef?.description}
                  </p>
                </Card>
              </div>

              {/* Show condition result for conditional functions */}
              {(() => {
                const output = activeNode.output as any;
                // Check if output is a conditional output object
                if (!output || typeof output !== 'object') return null;
                if (!('true' in output) || !('false' in output)) return null;
                
                const conditionalOutput = output as Record<string, string>;
                // Check for non-empty strings
                const trueHasContent = typeof conditionalOutput.true === 'string' && conditionalOutput.true.length > 0;
                const falseHasContent = typeof conditionalOutput.false === 'string' && conditionalOutput.false.length > 0;
                
                return (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Condition Result</Label>
                    <Card className="p-3 bg-muted/30">
                      {trueHasContent ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">✓ True</span>
                          <span className="text-xs text-muted-foreground">condition matched</span>
                        </div>
                      ) : falseHasContent ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">✗ False</span>
                          <span className="text-xs text-muted-foreground">condition not matched</span>
                        </div>
                      ) : null}
                    </Card>
                  </div>
                );
              })()}

              {renderFunctionConfig(activeNode as FunctionNode)}
              {renderMemoryViewer(activeNode as FunctionNode)}
            </>
          )}

          {/* Common: Output */}
          {activeNode.output && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">Output</Label>
                <Dialog open={isEditingOutput} onOpenChange={setIsEditingOutput}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 flex-shrink-0"
                      onClick={() => {
                        const output = activeNode.output;
                        let outputText = '';
                        if (typeof output === 'object') {
                          const obj = output as any;
                          if ('true' in obj || 'false' in obj) {
                            outputText = obj.true || obj.false || '';
                          } else {
                            outputText = JSON.stringify(output, null, 2);
                          }
                        } else {
                          outputText = String(output);
                        }
                        setEditedOutput(outputText);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] flex flex-col p-6">
                    <DialogHeader className="pb-4">
                      <DialogTitle>Edit Output</DialogTitle>
                      <DialogDescription>
                        Manually edit the output from this {activeNode.nodeType}
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs value={outputTab} onValueChange={setOutputTab} className="flex-1 flex flex-col overflow-hidden">
                      <TabsList className="w-full justify-start mb-4">
                        <TabsTrigger value="edit">Edit</TabsTrigger>
                        <TabsTrigger value="view">View</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="edit" className="flex-1 overflow-hidden mt-0">
                        <ScrollArea className="h-full">
                          <Textarea
                            value={editedOutput}
                            onChange={(e) => setEditedOutput(e.target.value)}
                            className="min-h-[calc(90vh-270px)] font-mono text-xs resize-none w-full"
                            placeholder="Edit output..."
                          />
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="view" className="flex-1 overflow-hidden mt-0">
                        <ScrollArea className="h-full">
                          <div className="prose prose-sm dark:prose-invert max-w-none p-4">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ children }) => (
                                  <Table className="my-4">
                                    {children}
                                  </Table>
                                ),
                                thead: ({ children }) => <TableHeader>{children}</TableHeader>,
                                tbody: ({ children }) => <TableBody>{children}</TableBody>,
                                tr: ({ children }) => <TableRow>{children}</TableRow>,
                                th: ({ children }) => (
                                  <TableHead className="font-bold">{children}</TableHead>
                                ),
                                td: ({ children }) => <TableCell>{children}</TableCell>,
                                code: ({ inline, children, ...props }: any) => {
                                  return inline ? (
                                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <pre className="bg-muted p-3 rounded-md overflow-x-auto my-2">
                                      <code className="text-xs font-mono" {...props}>
                                        {children}
                                      </code>
                                    </pre>
                                  );
                                },
                              }}
                            >
                              {editedOutput}
                            </ReactMarkdown>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                    
                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditingOutput(false);
                          setOutputTab("edit");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (activeNode.nodeType === "agent") {
                            onUpdateAgent(activeNode.id, { output: editedOutput });
                          } else if (onUpdateNode) {
                            onUpdateNode(activeNode.id, { output: editedOutput });
                          }
                          setIsEditingOutput(false);
                          setOutputTab("edit");
                        }}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <Card className="p-3 bg-muted/30 max-h-[200px] overflow-y-auto">
                <p className="text-xs whitespace-pre-wrap break-all overflow-wrap-anywhere">
                  {(() => {
                    const output = activeNode.output;
                    if (!output) return 'No output';
                    // Handle conditional outputs (objects with true/false keys)
                    if (typeof output === 'object') {
                      const obj = output as any;
                      if ('true' in obj || 'false' in obj) {
                        const trueContent = obj.true || '';
                        const falseContent = obj.false || '';
                        if (trueContent) return trueContent;
                        if (falseContent) return falseContent;
                        return 'No output';
                      }
                    }
                    // Handle regular string output
                    return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                  })()}
                </p>
              </Card>
            </div>
          )}

          {/* Agent Tools (only for agents) */}
          {activeNode.nodeType === "agent" && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Attached Tools</Label>
              <Card className="p-3 bg-muted/30 space-y-2">
                {(activeNode as AgentNode).tools.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No tools attached
                  </p>
                ) : (
                  (activeNode as AgentNode).tools.map((toolInstance) => {
                    const tool = availableTools.find((t) => t.id === toolInstance.toolId);
                    return (
                      <div key={toolInstance.id} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{tool?.name}</span>
                        <div className="flex gap-1">
                          <Dialog
                            open={configDialogInstance === toolInstance.id}
                            onOpenChange={(open) =>
                              setConfigDialogInstance(open ? toolInstance.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Settings className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{tool?.name} Configuration</DialogTitle>
                                <DialogDescription>
                                  Configure the settings for this tool instance.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Tool config remains unchanged - keeping existing implementation */}
                                {toolInstance.toolId === 'google_search' && (
                                  <>
                                    <div className="space-y-2">
                                      <Label htmlFor="api-key">API Key</Label>
                                      <Input
                                        id="api-key"
                                        type="password"
                                        placeholder="Enter Google API key"
                                        value={toolInstance.config?.apiKey || ""}
                                        onChange={(e) =>
                                          onUpdateToolInstance(activeNode.id, toolInstance.id, {
                                            ...toolInstance.config,
                                            apiKey: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="search-engine-id">Search Engine ID</Label>
                                      <Input
                                        id="search-engine-id"
                                        placeholder="Enter Custom Search Engine ID"
                                        value={toolInstance.config?.searchEngineId || ""}
                                        onChange={(e) =>
                                          onUpdateToolInstance(activeNode.id, toolInstance.id, {
                                            ...toolInstance.config,
                                            searchEngineId: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  </>
                                )}
                                {toolInstance.toolId === 'weather' && (
                                  <div className="space-y-2">
                                    <Label htmlFor="api-key">OpenWeatherMap API Key</Label>
                                    <Input
                                      id="api-key"
                                      type="password"
                                      placeholder="Enter API key"
                                      value={toolInstance.config?.apiKey || ""}
                                      onChange={(e) =>
                                        onUpdateToolInstance(activeNode.id, toolInstance.id, {
                                          ...toolInstance.config,
                                          apiKey: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                )}
                                {toolInstance.toolId === 'api_call' && (
                                  <>
                                    <div className="space-y-2">
                                      <Label htmlFor="api-url">API URL</Label>
                                      <Input
                                        id="api-url"
                                        placeholder="https://api.example.com/endpoint"
                                        value={toolInstance.config?.url || ""}
                                        onChange={(e) =>
                                          onUpdateToolInstance(activeNode.id, toolInstance.id, {
                                            ...toolInstance.config,
                                            url: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="api-method">Method</Label>
                                      <Input
                                        id="api-method"
                                        placeholder="GET, POST, etc."
                                        value={toolInstance.config?.method || "GET"}
                                        onChange={(e) =>
                                          onUpdateToolInstance(activeNode.id, toolInstance.id, {
                                            ...toolInstance.config,
                                            method: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="api-headers">Headers (JSON)</Label>
                                      <Textarea
                                        id="api-headers"
                                        placeholder='{"Authorization": "Bearer token"}'
                                        value={toolInstance.config?.headers || ""}
                                        onChange={(e) =>
                                          onUpdateToolInstance(activeNode.id, toolInstance.id, {
                                            ...toolInstance.config,
                                            headers: e.target.value,
                                          })
                                        }
                                        className="min-h-[60px]"
                                      />
                                    </div>
                                  </>
                                )}
                                {toolInstance.toolId === 'web_scrape' && (
                                  <div className="space-y-2">
                                    <Label htmlFor="scrape-url">URL to Scrape</Label>
                                    <Input
                                      id="scrape-url"
                                      placeholder="https://example.com"
                                      value={toolInstance.config?.url || ""}
                                      onChange={(e) =>
                                        onUpdateToolInstance(activeNode.id, toolInstance.id, {
                                          ...toolInstance.config,
                                          url: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                )}
                                <Button
                                  onClick={() => setConfigDialogInstance(null)}
                                  className="w-full"
                                >
                                  Save
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => onRemoveToolInstance(activeNode.id, toolInstance.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>

              <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Add Tool
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Tool</DialogTitle>
                    <DialogDescription>
                      Select tools to attach to this agent.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {availableTools.map((tool) => {
                      const hasThisTool = (activeNode as AgentNode).tools.some(t => t.toolId === tool.id);
                      return (
                        <div key={tool.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={tool.id}
                            checked={hasThisTool}
                            onCheckedChange={(checked) =>
                              handleToolToggle(tool.id, checked as boolean)
                            }
                          />
                          <label
                            htmlFor={tool.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {tool.name}
                            {tool.requiresApiKey && (
                              <span className="text-xs text-muted-foreground ml-2">
                                (requires API key)
                              </span>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
