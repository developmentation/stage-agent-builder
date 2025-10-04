import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, Bot, Play, CheckCircle2, AlertCircle, Circle, Trash2 } from "lucide-react";
import type { Agent } from "@/pages/Index";

interface AgentNodeProps {
  agent: Agent;
  isSelected: boolean;
  isConnecting: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPortClick: (agentId: string, isOutput: boolean) => void;
}

const agentIcons = {
  researcher: Search,
  summarizer: FileText,
  analyst: Bot,
};

const statusConfig = {
  idle: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted" },
  running: { icon: Play, color: "text-warning", bg: "bg-warning/10" },
  complete: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

export const AgentNode = ({ agent, isSelected, isConnecting, onSelect, onDelete, onPortClick }: AgentNodeProps) => {
  const Icon = agentIcons[agent.type as keyof typeof agentIcons] || Bot;
  const statusInfo = statusConfig[agent.status];
  const StatusIcon = statusInfo.icon;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete agent "${agent.name}"?`)) {
      onDelete();
    }
  };

  return (
    <Card 
      className={`p-3 cursor-pointer transition-all hover:shadow-lg relative w-full bg-card/80 backdrop-blur-sm z-10 ${
        isSelected ? "ring-2 ring-primary shadow-lg" : ""
      }`}
      onClick={onSelect}
    >
      {/* Input/Output Ports */}
      <div 
        id={`port-input-${agent.id}`}
        className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
          isConnecting ? "ring-2 ring-primary animate-pulse" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onPortClick(agent.id, false);
        }}
      />
      <div 
        id={`port-output-${agent.id}`}
        className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
          isConnecting ? "ring-2 ring-primary animate-pulse" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onPortClick(agent.id, true);
        }}
      />

      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground truncate">{agent.name}</h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 flex-shrink-0"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1 ${statusInfo.color}`}>
            <StatusIcon className="h-3 w-3" />
            <span className="text-xs capitalize">{agent.status}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {agent.type}
          </Badge>
          {agent.tools.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {agent.tools.length} tools
            </Badge>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2">
          {agent.systemPrompt}
        </p>
      </div>
    </Card>
  );
};
