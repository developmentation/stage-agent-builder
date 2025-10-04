import { Card } from "@/components/ui/card";
import { AgentNode } from "./AgentNode";
import { GripVertical, ChevronDown, Plus, Trash2, Search, FileText, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Stage as StageType } from "@/pages/Index";

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

interface StageProps {
  stage: StageType;
  stageNumber: number;
  selectedNode: string | null;
  connectingFrom: string | null;
  onSelectNode: (id: string | null) => void;
  onAddAgent: (stageId: string, agentTemplate: any) => void;
  onDeleteAgent: (agentId: string) => void;
  onDeleteStage: (stageId: string) => void;
  onToggleMinimize: (agentId: string) => void;
  onPortClick: (agentId: string, isOutput: boolean) => void;
}

export const Stage = ({
  stage,
  stageNumber,
  selectedNode,
  connectingFrom,
  onSelectNode,
  onAddAgent,
  onDeleteAgent,
  onDeleteStage,
  onToggleMinimize,
  onPortClick,
}: StageProps) => {
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("border-primary");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("border-primary");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-primary");
    
    const templateData = e.dataTransfer.getData("agentTemplate");
    if (templateData) {
      const template = JSON.parse(templateData);
      onAddAgent(stage.id, template);
    }
  };

  const completedAgents = stage.agents.filter((a) => a.status === "complete").length;
  const progress = stage.agents.length > 0 ? (completedAgents / stage.agents.length) * 100 : 0;

  const handleAddAgent = (template: any) => {
    onAddAgent(stage.id, template);
    setIsAddAgentOpen(false);
  };

  return (
    <Card
      className="p-4 bg-card/80 backdrop-blur border-border/60 shadow-md transition-colors"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/60">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move hidden lg:block" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Stage {stageNumber}</h3>
          <p className="text-xs text-muted-foreground hidden lg:block">Drag agents here to add them</p>
        </div>
        
        {/* Mobile Add Agent Button */}
        <Dialog open={isAddAgentOpen} onOpenChange={setIsAddAgentOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden gap-2">
              <Plus className="h-4 w-4" />
              Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Agent to Stage {stageNumber}</DialogTitle>
              <DialogDescription>
                Select an agent to add to this stage
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {agentTemplates.map((template) => (
                <Card
                  key={template.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-card to-muted/20"
                  onClick={() => handleAddAgent(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <template.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground">{template.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        
        <Button variant="ghost" size="sm" onClick={() => onDeleteStage(stage.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="min-h-[100px]">
        {stage.agents.length === 0 ? (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground hidden lg:block">Drop an agent here</p>
            <p className="text-sm text-muted-foreground lg:hidden">No agents yet</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${
            stage.agents.some(a => !a.minimized) 
              ? "grid-cols-1 md:grid-cols-2" 
              : "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
          }`}>
            {stage.agents.map((agent, index) => (
              <div key={agent.id} id={`agent-${agent.id}`}>
                <AgentNode
                  agent={agent}
                  isSelected={selectedNode === agent.id}
                  isConnecting={connectingFrom !== null}
                  agentNumber={`${stageNumber}.${index + 1}`}
                  onSelect={() => onSelectNode(agent.id)}
                  onDelete={() => onDeleteAgent(agent.id)}
                  onToggleMinimize={() => onToggleMinimize(agent.id)}
                  onPortClick={onPortClick}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-xs font-medium text-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
};
