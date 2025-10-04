import { Card } from "@/components/ui/card";
import { AgentNode } from "./AgentNode";
import { GripVertical, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StageProps {
  stageNumber: number;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
}

export const Stage = ({ stageNumber, selectedNode, onSelectNode }: StageProps) => {
  return (
    <Card className="p-4 bg-card/80 backdrop-blur border-border/60 shadow-md">
      {/* Stage Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/60">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Stage {stageNumber}</h3>
          <p className="text-xs text-muted-foreground">Drag agents here to add them</p>
        </div>
        <Button variant="ghost" size="sm">
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Stage Content - Agent Nodes */}
      <div className="space-y-3 min-h-[100px]">
        {/* Example agent nodes */}
        <AgentNode
          id="agent-1"
          name="Research Agent"
          type="researcher"
          status="idle"
          isSelected={selectedNode === "agent-1"}
          onSelect={() => onSelectNode("agent-1")}
        />
        <AgentNode
          id="agent-2"
          name="Analyzer Agent"
          type="analyst"
          status="idle"
          isSelected={selectedNode === "agent-2"}
          onSelect={() => onSelectNode("agent-2")}
        />
        
        {/* Add Agent Button */}
        <Button 
          variant="outline" 
          className="w-full border-dashed hover:bg-primary/5 hover:border-primary/50"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Agent
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-xs font-medium text-foreground">0%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-secondary w-0 transition-all duration-300" />
        </div>
      </div>
    </Card>
  );
};
