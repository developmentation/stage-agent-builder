import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Search, FileText, Bot, Plus, Download, Trash2, X, Eye } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { functionDefinitions } from "@/lib/functionDefinitions";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { extractTextFromFile, formatExtractedContent, ExtractedContent } from "@/utils/fileTextExtraction";
import { parseExcelFile, ExcelData } from "@/utils/parseExcel";
import { ExcelSelector } from "@/components/ExcelSelector";

// Icon mapping for serialization
const iconMap: Record<string, LucideIcon> = {
  Search,
  FileText,
  Bot
};
const agentTemplates = [{
  id: "researcher",
  name: "Researcher",
  iconName: "Search",
  description: "Gather and analyze information",
  defaultSystemPrompt: "You are a research assistant specializing in gathering and analyzing information from various sources.",
  defaultUserPrompt: "Research the following topic and provide detailed findings: {input}"
}, {
  id: "summarizer",
  name: "Summarizer",
  iconName: "FileText",
  description: "Condense long content",
  defaultSystemPrompt: "You are a summarization expert who creates concise, accurate summaries of long content.",
  defaultUserPrompt: "Summarize the following content: {input}"
}, {
  id: "analyst",
  name: "Analyst",
  iconName: "Bot",
  description: "Deep data analysis",
  defaultSystemPrompt: "You are a data analyst who provides insightful analysis and identifies patterns in data.",
  defaultUserPrompt: "Analyze the following data and provide insights: {input}"
}];
const tools = [{
  id: "google_search",
  name: "Google Search",
  icon: Search,
  description: "Search the web for information",
  requiresApiKey: true
}, {
  id: "weather",
  name: "Weather",
  icon: Search,
  description: "Get current weather data",
  requiresApiKey: true
}, {
  id: "time",
  name: "Time",
  icon: Search,
  description: "Get current time/date",
  requiresApiKey: false
}, {
  id: "api_call",
  name: "API Call",
  icon: Search,
  description: "Call external APIs",
  requiresApiKey: true
}, {
  id: "web_scrape",
  name: "Web Scrape",
  icon: Search,
  description: "Extract web page content",
  requiresApiKey: false
}];
interface SidebarProps {
  onAddAgent: (stageId: string, agentTemplate: any) => void;
  onAddNode: (stageId: string, template: any, nodeType: "agent" | "function" | "tool") => void;
  workflow: any;
  userInput: string;
  onUserInputChange: (value: string) => void;
  workflowName: string;
  onWorkflowNameChange: (value: string) => void;
  customAgents: any[];
  onCustomAgentsChange: (agents: any[]) => void;
}
export const Sidebar = ({
  onAddAgent,
  onAddNode,
  workflow,
  userInput,
  onUserInputChange,
  workflowName,
  onWorkflowNameChange,
  customAgents,
  onCustomAgentsChange
}: SidebarProps) => {
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");
  const [newAgentSystemPrompt, setNewAgentSystemPrompt] = useState("");
  const [newAgentUserPrompt, setNewAgentUserPrompt] = useState("");
  const [functionSearch, setFunctionSearch] = useState("");
  const [functionCategory, setFunctionCategory] = useState<string>("all");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [excelQueue, setExcelQueue] = useState<File[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isViewInputOpen, setIsViewInputOpen] = useState(false);
  const [editedInput, setEditedInput] = useState("");
  const handleDragStart = (e: React.DragEvent, template: any, nodeType: "agent" | "function" | "tool" = "agent") => {
    e.dataTransfer.setData("agentTemplate", JSON.stringify(template));
    e.dataTransfer.setData("nodeType", nodeType);
  };
  const handleAddCustomAgent = () => {
    if (!newAgentName.trim()) return;
    const newAgent = {
      id: `custom-${Date.now()}`,
      name: newAgentName,
      iconName: "Bot",
      // Store as string, not component
      description: newAgentDescription || "Custom agent",
      defaultSystemPrompt: newAgentSystemPrompt || `You are a ${newAgentName} agent.`,
      defaultUserPrompt: newAgentUserPrompt || "Process the following: {input}"
    };
    onCustomAgentsChange([...customAgents, newAgent]);
    setNewAgentName("");
    setNewAgentDescription("");
    setNewAgentSystemPrompt("");
    setNewAgentUserPrompt("");
    setIsAddAgentOpen(false);
  };
  const handleDownloadAgent = (agent: any) => {
    const agentData = {
      ...agent,
      type: "agent-definition",
      exportedAt: new Date().toISOString()
    };
    const json = JSON.stringify(agentData, null, 2);
    const blob = new Blob([json], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-agent.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Agent downloaded",
      description: `Agent "${agent.name}" has been downloaded`
    });
  };
  const handleDeleteAgent = (agentId: string) => {
    const agent = customAgents.find(a => a.id === agentId);
    if (agent) {
      onCustomAgentsChange(customAgents.filter(a => a.id !== agentId));
      toast({
        title: "Agent deleted",
        description: `Agent "${agent.name}" has been deleted`
      });
    }
  };
  const handleUploadAgents = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    let importedCount = 0;
    const newAgents: any[] = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target?.result as string);

          // Check if it's a workflow file with customAgents
          if (data.workflow && data.customAgents) {
            // Import custom agents from workflow
            data.customAgents.forEach((agent: any) => {
              // Generate new ID to avoid conflicts
              const importedAgent = {
                ...agent,
                id: `custom-${Date.now()}-${Math.random()}`
              };
              newAgents.push(importedAgent);
              importedCount++;
            });
          }
          // Check if it's a single agent definition
          else if (data.type === "agent-definition" || data.defaultSystemPrompt) {
            const importedAgent = {
              id: data.id || `custom-${Date.now()}-${Math.random()}`,
              name: data.name,
              iconName: data.iconName || "Bot",
              description: data.description || "Imported agent",
              defaultSystemPrompt: data.defaultSystemPrompt,
              defaultUserPrompt: data.defaultUserPrompt
            };
            newAgents.push(importedAgent);
            importedCount++;
          } else {
            toast({
              title: "Invalid file",
              description: `Invalid agent file: ${file.name}`,
              variant: "destructive"
            });
          }

          // Update state after processing all files
          if (importedCount > 0 && newAgents.length > 0) {
            onCustomAgentsChange([...customAgents, ...newAgents]);
            toast({
              title: "Agents imported",
              description: `Imported ${importedCount} agent(s)`
            });
          }
        } catch (error) {
          console.error("Failed to import agent:", error);
          toast({
            title: "Import failed",
            description: `Failed to import ${file.name}`,
            variant: "destructive"
          });
        }
      };
      reader.readAsText(file);
    });

    // Reset file input
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
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
      setExcelQueue(prev => prev.slice(1)); // Remove processed file from queue
    } catch (error) {
      console.error(`Failed to parse Excel file ${nextFile.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to parse ${nextFile.name}`;
      toast({
        title: "Excel parsing failed",
        description: errorMessage,
        variant: "destructive"
      });
      setExcelQueue(prev => prev.slice(1)); // Remove failed file and continue

      // Try next file after a short delay
      setTimeout(() => {
        if (excelQueue.length > 1) {
          processNextExcel();
        } else {
          setIsProcessingFiles(false);
        }
      }, 500);
    }
  };
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);
    const extractedContents: ExtractedContent[] = [];
    const excelFiles: File[] = [];
    try {
      // First, categorize all files
      for (const file of Array.from(files)) {
        const extension = file.name.toLowerCase().split('.').pop();
        if (extension === 'xlsx' || extension === 'xls') {
          excelFiles.push(file);
        } else {
          // Try to process as text-based file (includes txt, docx, pdf, and all code/config files)
          try {
            const extracted = await extractTextFromFile(file);
            extractedContents.push(extracted);
            toast({
              title: "File extracted",
              description: `Extracted text from ${file.name}`
            });
          } catch (error) {
            console.error(`Failed to extract from ${file.name}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast({
              title: "Extraction failed",
              description: errorMessage.includes('Unsupported file type') ? `Unsupported file type: ${file.name}` : `Failed to extract text from ${file.name}`,
              variant: "destructive"
            });
          }
        }
      }

      // Add all extracted text content to input first
      if (extractedContents.length > 0) {
        const formattedContent = formatExtractedContent(extractedContents);
        const newInput = userInput ? `${userInput}${formattedContent}` : formattedContent.trim();
        onUserInputChange(newInput);
      }

      // Then process Excel files one by one
      if (excelFiles.length > 0) {
        setExcelQueue(excelFiles);
        // Process the first Excel file
        try {
          const firstExcel = excelFiles[0];
          const excelData = await parseExcelFile(firstExcel);
          setExcelData(excelData);
          setExcelQueue(excelFiles.slice(1)); // Queue the rest
        } catch (error) {
          console.error('Failed to parse first Excel file:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to parse Excel file';
          toast({
            title: "Excel parsing failed",
            description: errorMessage,
            variant: "destructive"
          });
          // Try to process the rest if there are more
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
        variant: "destructive"
      });
      setIsProcessingFiles(false);
    } finally {
      // Reset file input
      if (fileUploadInputRef.current) {
        fileUploadInputRef.current.value = "";
      }
    }
  };
  const handleExcelSelect = (selectedData: {
    fileName: string;
    selectedData: any[];
    formattedContent: string;
    totalRows: number;
  }) => {
    const newInput = userInput ? `${userInput}${selectedData.formattedContent}` : selectedData.formattedContent.trim();
    onUserInputChange(newInput);
    toast({
      title: "Excel data added",
      description: `Added ${selectedData.totalRows} rows from ${selectedData.fileName}`
    });
    setExcelData(null);

    // Process next Excel file if any
    if (excelQueue.length > 0) {
      processNextExcel();
    } else {
      setIsProcessingFiles(false);
    }
  };
  const handleExcelClose = () => {
    setExcelData(null);

    // Process next Excel file if any
    if (excelQueue.length > 0) {
      processNextExcel();
    } else {
      setIsProcessingFiles(false);
    }
  };
  const handleClearInput = () => {
    onUserInputChange("");
    toast({
      title: "Input cleared",
      description: "Input has been cleared"
    });
  };
  const handleViewInput = () => {
    setEditedInput(userInput);
    setIsViewInputOpen(true);
  };
  const handleSaveEditedInput = () => {
    onUserInputChange(editedInput);
    setIsViewInputOpen(false);
    toast({
      title: "Input updated",
      description: "Your changes have been saved"
    });
  };
  const allAgents = [...agentTemplates, ...customAgents];

  // Filter functions based on search and category
  const filteredFunctions = functionDefinitions.filter(func => {
    const matchesSearch = func.name.toLowerCase().includes(functionSearch.toLowerCase()) || func.description.toLowerCase().includes(functionSearch.toLowerCase());
    const matchesCategory = functionCategory === "all" || func.category === functionCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = ["all", ...new Set(functionDefinitions.map(f => f.category))];
  return <div className="bg-card flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Workflow Name */}
          <div className="space-y-2">
            <Label htmlFor="workflow-name" className="text-sm font-semibold text-foreground">
              Workflow Name
            </Label>
            <Input id="workflow-name" placeholder="Untitled Workflow" value={workflowName} onChange={e => onWorkflowNameChange(e.target.value)} className="h-9" />
          </div>

          {/* Input Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Prompt</h3>
            <Card className="p-3 bg-muted/30">
              <Textarea placeholder="Enter your initial prompt or paste text here..." className="min-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0" value={userInput} onChange={e => onUserInputChange(e.target.value)} />
              <div className="flex gap-2 mt-3">
                <input ref={fileUploadInputRef} type="file" accept=".txt,.md,.json,.xml,.csv,.yaml,.yml,.toml,.js,.jsx,.ts,.tsx,.vue,.html,.css,.scss,.sass,.py,.java,.c,.cpp,.cs,.go,.php,.rb,.sql,.sh,.log,.pdf,.docx,.xlsx,.xls" multiple className="hidden" onChange={handleFileUpload} />
                <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => fileUploadInputRef.current?.click()} disabled={isProcessingFiles}>
                  <Upload className="h-3.5 w-3.5" />
                  {isProcessingFiles ? "Processing..." : "Upload Files"}
                </Button>
                <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={handleViewInput} disabled={!userInput} title="View/Edit Input">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={handleClearInput} disabled={!userInput} title="Clear Input">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          </div>

          {/* Agent Templates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Agent Library</h3>
              <div className="flex items-center gap-1">
                <input ref={uploadInputRef} type="file" accept=".json" multiple className="hidden" onChange={handleUploadAgents} />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => uploadInputRef.current?.click()} title="Upload agent(s)">
                  <Upload className="h-4 w-4" />
                </Button>
                <Dialog open={isAddAgentOpen} onOpenChange={setIsAddAgentOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Custom Agent</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="agent-name">Agent Name</Label>
                        <Input id="agent-name" placeholder="e.g., Code Reviewer" value={newAgentName} onChange={e => setNewAgentName(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="agent-desc">Description</Label>
                        <Input id="agent-desc" placeholder="Brief description" value={newAgentDescription} onChange={e => setNewAgentDescription(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="agent-system">System Prompt</Label>
                        <Textarea id="agent-system" placeholder="You are a helpful assistant..." value={newAgentSystemPrompt} onChange={e => setNewAgentSystemPrompt(e.target.value)} className="min-h-[80px]" />
                      </div>
                      <div>
                        <Label htmlFor="agent-user">User Prompt Template</Label>
                        <Textarea id="agent-user" placeholder="Process: {input}" value={newAgentUserPrompt} onChange={e => setNewAgentUserPrompt(e.target.value)} className="min-h-[60px]" />
                      </div>
                      <Button onClick={handleAddCustomAgent} className="w-full">
                        Add Agent
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="space-y-2">
              {allAgents.map(agent => {
              const IconComponent = iconMap[agent.iconName] || Bot;
              const isCustom = customAgents.some(a => a.id === agent.id);
              return <Card key={agent.id} className="p-3 cursor-move hover:shadow-md transition-shadow bg-gradient-to-br from-card to-muted/20 group" draggable onDragStart={e => handleDragStart(e, agent)}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <IconComponent className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground">{agent.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={e => {
                      e.stopPropagation();
                      handleDownloadAgent(agent);
                    }} title="Download agent">
                          <Download className="h-3 w-3" />
                        </Button>
                        {isCustom && <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={e => {
                      e.stopPropagation();
                      handleDeleteAgent(agent.id);
                    }} title="Delete agent">
                            <Trash2 className="h-3 w-3" />
                          </Button>}
                      </div>
                    </div>
                  </Card>;
            })}
            </div>
          </div>

          {/* Tools Library - Now replaced with Functions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Functions Library</h3>
            
            {/* Search and Filter */}
            <div className="space-y-2">
              <Input placeholder="Search functions..." value={functionSearch} onChange={e => setFunctionSearch(e.target.value)} className="h-8 text-xs" />
              <Select value={functionCategory} onValueChange={setFunctionCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => <SelectItem key={cat} value={cat} className="text-xs">
                      {cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {/* Functions List */}
            <div className="space-y-2">
              {filteredFunctions.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">
                  No functions found
                </p> : filteredFunctions.map(func => {
              const FuncIcon = func.icon;
              return <Card key={func.id} className="p-2.5 cursor-move hover:shadow-md transition-all bg-gradient-to-br from-card to-muted/10" draggable onDragStart={e => handleDragStart(e, func, "function")}>
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${func.color}`}>
                          <FuncIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-medium text-foreground">{func.name}</h4>
                            {func.outputs.length > 1 && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                {func.outputs.length} outputs
                              </Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                            {func.description}
                          </p>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 mt-1">
                            {func.category}
                          </Badge>
                        </div>
                      </div>
                    </Card>;
            })}
            </div>
          </div>
        </div>
      </ScrollArea>
      
      {/* View/Edit Input Modal */}
      <Dialog open={isViewInputOpen} onOpenChange={setIsViewInputOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>View / Edit Input</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 py-4">
            <Textarea value={editedInput} onChange={e => setEditedInput(e.target.value)} className="w-full h-full min-h-[60vh] resize-none" placeholder="No input text..." />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsViewInputOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditedInput}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Excel Selector Modal */}
      {excelData && <ExcelSelector excelData={excelData} onClose={handleExcelClose} onSelect={handleExcelSelect} />}
    </div>;
};