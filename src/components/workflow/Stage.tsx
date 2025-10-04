import { Card } from "@/components/ui/card";
import { AgentNode } from "./AgentNode";
import { GripVertical, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Stage as StageType } from "@/pages/Index";

interface StageProps {
  stage: StageType;
  stageNumber: number;
  selectedNode: string | null;
  connectingFrom: string | null;
  onSelectNode: (id: string | null) => void;
  onAddAgent: (stageId: string, agentTemplate: any) => void;
  onDeleteAgent: (agentId: string) => void;
  onDeleteStage: (stageId: string) => void;
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
  onPortClick,
}: StageProps) => {
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

  return (
    <Card
      className="p-4 bg-card/80 backdrop-blur border-border/60 shadow-md transition-colors relative z-[1]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/60">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Stage {stageNumber}</h3>
          <p className="text-xs text-muted-foreground">Drag agents here to add them</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onDeleteStage(stage.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="min-h-[100px]">
        {stage.agents.length === 0 ? (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Drop an agent here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stage.agents.map((agent) => (
              <div key={agent.id} id={`agent-${agent.id}`}>
                <AgentNode
                  agent={agent}
                  isSelected={selectedNode === agent.id}
                  isConnecting={connectingFrom !== null}
                  onSelect={() => onSelectNode(agent.id)}
                  onDelete={() => onDeleteAgent(agent.id)}
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
