import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, Bot, Play, CheckCircle2, AlertCircle, Circle, Trash2, Minimize2, Maximize2 } from "lucide-react";
import type { Agent } from "@/pages/Index";

interface AgentNodeProps {
  agent: Agent;
  isSelected: boolean;
  isConnecting: boolean;
  agentNumber: string;
  layoutId?: string;
  onSelect: () => void;
  onDelete: () => void;
  onToggleMinimize: () => void;
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

export const AgentNode = ({ agent, isSelected, isConnecting, agentNumber, layoutId = 'default', onSelect, onDelete, onToggleMinimize, onPortClick }: AgentNodeProps) => {
  const Icon = agentIcons[agent.type as keyof typeof agentIcons] || Bot;
  const statusInfo = statusConfig[agent.status];
  const StatusIcon = statusInfo.icon;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete agent "${agent.name}"?`)) {
      onDelete();
    }
  };

  const handleToggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleMinimize();
  };

  // Status-based styling
  const statusStyles = {
    running: "bg-yellow-50 dark:bg-yellow-950/20",
    complete: "ring-2 ring-green-500",
    error: "ring-2 ring-destructive",
    idle: "",
  };

  if (agent.minimized) {
    return (
      <Card 
        className={`w-16 h-16 cursor-pointer transition-all hover:shadow-lg bg-card/50 backdrop-blur-sm flex items-center justify-center relative ${
          isSelected ? "ring-2 ring-primary shadow-lg" : ""
        } ${statusStyles[agent.status]}`}
        onClick={onToggleMinimize}
        style={{ position: 'relative', zIndex: 20 }}
      >
        {/* Input/Output Ports */}
        <div 
          id={`port-input-${agent.id}-${layoutId}`}
          className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
            isConnecting ? "ring-2 ring-primary animate-pulse" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onPortClick(agent.id, false);
          }}
        />
        <div 
          id={`port-output-${agent.id}-${layoutId}`}
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
            isConnecting ? "ring-2 ring-primary animate-pulse" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onPortClick(agent.id, true);
          }}
        />
        
        {/* Agent number */}
        <div className="text-center">
          <div className="text-xs font-bold text-foreground">{agentNumber}</div>
          <StatusIcon className={`h-3 w-3 mx-auto mt-0.5 ${statusInfo.color}`} />
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className={`p-3 cursor-pointer transition-all hover:shadow-lg w-full bg-card/50 backdrop-blur-sm group ${
        isSelected ? "ring-2 ring-primary shadow-lg" : ""
      } ${statusStyles[agent.status]}`}
      onClick={onSelect}
      style={{ position: 'relative', zIndex: 20 }}
    >
      {/* Input/Output Ports */}
      <div 
        id={`port-input-${agent.id}-${layoutId}`}
        className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
          isConnecting ? "ring-2 ring-primary animate-pulse" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onPortClick(agent.id, false);
        }}
      />
      <div 
        id={`port-output-${agent.id}-${layoutId}`}
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
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleToggleMinimize}
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1 ${statusInfo.color}`}>
            <StatusIcon className="h-3 w-3" />
            <span className="text-xs capitalize">{agent.status}</span>
          </div>
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
