import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Search, FileText, Bot, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { functionDefinitions } from "@/lib/functionDefinitions";
import { Badge } from "@/components/ui/badge";

const agentTemplates = [
  { 
    id: "researcher", 
    name: "Researcher", 
    icon: Search, 
    description: "Gather and analyze information",
    defaultSystemPrompt: "You are a research assistant specializing in gathering and analyzing information from various sources.",
    defaultUserPrompt: "Research the following topic and provide detailed findings: {input}"
  },
  { 
    id: "summarizer", 
    name: "Summarizer", 
    icon: FileText, 
    description: "Condense long content",
    defaultSystemPrompt: "You are a summarization expert who creates concise, accurate summaries of long content.",
    defaultUserPrompt: "Summarize the following content: {input}"
  },
  { 
    id: "analyst", 
    name: "Analyst", 
    icon: Bot, 
    description: "Deep data analysis",
    defaultSystemPrompt: "You are a data analyst who provides insightful analysis and identifies patterns in data.",
    defaultUserPrompt: "Analyze the following data and provide insights: {input}"
  },
];

const tools = [
  { id: "google_search", name: "Google Search", icon: Search, description: "Search the web for information", requiresApiKey: true },
  { id: "weather", name: "Weather", icon: Search, description: "Get current weather data", requiresApiKey: true },
  { id: "time", name: "Time", icon: Search, description: "Get current time/date", requiresApiKey: false },
  { id: "api_call", name: "API Call", icon: Search, description: "Call external APIs", requiresApiKey: true },
  { id: "web_scrape", name: "Web Scrape", icon: Search, description: "Extract web page content", requiresApiKey: false },
];

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

  const handleDragStart = (e: React.DragEvent, template: any, nodeType: "agent" | "function" | "tool" = "agent") => {
    e.dataTransfer.setData("agentTemplate", JSON.stringify(template));
    e.dataTransfer.setData("nodeType", nodeType);
  };

  const handleAddCustomAgent = () => {
    if (!newAgentName.trim()) return;
    
    const newAgent = {
      id: `custom-${Date.now()}`,
      name: newAgentName,
      icon: Bot,
      description: newAgentDescription || "Custom agent",
      defaultSystemPrompt: newAgentSystemPrompt || `You are a ${newAgentName} agent.`,
      defaultUserPrompt: newAgentUserPrompt || "Process the following: {input}",
    };
    
    onCustomAgentsChange([...customAgents, newAgent]);
    setNewAgentName("");
    setNewAgentDescription("");
    setNewAgentSystemPrompt("");
    setNewAgentUserPrompt("");
    setIsAddAgentOpen(false);
  };

  const allAgents = [...agentTemplates, ...customAgents];
  
  // Filter functions based on search and category
  const filteredFunctions = functionDefinitions.filter((func) => {
    const matchesSearch = func.name.toLowerCase().includes(functionSearch.toLowerCase()) ||
                         func.description.toLowerCase().includes(functionSearch.toLowerCase());
    const matchesCategory = functionCategory === "all" || func.category === functionCategory;
    return matchesSearch && matchesCategory;
  });
  
  // Get unique categories for filter
  const categories = ["all", ...new Set(functionDefinitions.map(f => f.category))];
  
  return (
    <div className="bg-card flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Workflow Name */}
          <div className="space-y-2">
            <Label htmlFor="workflow-name" className="text-sm font-semibold text-foreground">
              Workflow Name
            </Label>
            <Input
              id="workflow-name"
              placeholder="Untitled Workflow"
              value={workflowName}
              onChange={(e) => onWorkflowNameChange(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Input Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Input / Trigger</h3>
            <Card className="p-3 bg-muted/30">
              <Textarea 
                placeholder="Enter your initial prompt or paste text here..."
                className="min-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0"
                value={userInput}
                onChange={(e) => onUserInputChange(e.target.value)}
              />
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" className="flex-1 gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  Text
                </Button>
              </div>
            </Card>
          </div>

          {/* Agent Templates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Agent Library</h3>
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
                      <Input
                        id="agent-name"
                        placeholder="e.g., Code Reviewer"
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="agent-desc">Description</Label>
                      <Input
                        id="agent-desc"
                        placeholder="Brief description"
                        value={newAgentDescription}
                        onChange={(e) => setNewAgentDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="agent-system">System Prompt</Label>
                      <Textarea
                        id="agent-system"
                        placeholder="You are a helpful assistant..."
                        value={newAgentSystemPrompt}
                        onChange={(e) => setNewAgentSystemPrompt(e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                    <div>
                      <Label htmlFor="agent-user">User Prompt Template</Label>
                      <Textarea
                        id="agent-user"
                        placeholder="Process: {input}"
                        value={newAgentUserPrompt}
                        onChange={(e) => setNewAgentUserPrompt(e.target.value)}
                        className="min-h-[60px]"
                      />
                    </div>
                    <Button onClick={handleAddCustomAgent} className="w-full">
                      Add Agent
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {allAgents.map((agent) => (
                <Card 
                  key={agent.id}
                  className="p-3 cursor-move hover:shadow-md transition-shadow bg-gradient-to-br from-card to-muted/20"
                  draggable
                  onDragStart={(e) => handleDragStart(e, agent)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <agent.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{agent.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Tools Library - Now replaced with Functions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Functions Library</h3>
            
            {/* Search and Filter */}
            <div className="space-y-2">
              <Input
                placeholder="Search functions..."
                value={functionSearch}
                onChange={(e) => setFunctionSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <Select value={functionCategory} onValueChange={setFunctionCategory}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Functions List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredFunctions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No functions found
                </p>
              ) : (
                filteredFunctions.map((func) => {
                  const FuncIcon = func.icon;
                  return (
                    <Card 
                      key={func.id}
                      className="p-2.5 cursor-move hover:shadow-md transition-all bg-gradient-to-br from-card to-muted/10"
                      draggable
                      onDragStart={(e) => handleDragStart(e, func, "function")}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${func.color}`}>
                          <FuncIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-medium text-foreground">{func.name}</h4>
                            {func.outputs.length > 1 && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                {func.outputs.length} outputs
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                            {func.description}
                          </p>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 mt-1">
                            {func.category}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
