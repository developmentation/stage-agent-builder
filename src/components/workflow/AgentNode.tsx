import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, Bot, Play, CheckCircle2, AlertCircle, Circle, Trash2, Minimize2, Maximize2, Download, Copy, Lock, Unlock } from "lucide-react";
import type { Agent } from "@/pages/Index";
import { useToast } from "@/hooks/use-toast";

interface AgentNodeProps {
  agent: Agent;
  isSelected: boolean;
  isConnecting: boolean;
  agentNumber: string;
  stageIndex: number;
  layoutId?: string;
  onSelect: () => void;
  onDelete: () => void;
  onToggleMinimize: () => void;
  onToggleLock: () => void;
  onPortClick: (agentId: string, isOutput: boolean) => void;
  onRun?: () => void;
  onDragStart?: (e: React.DragEvent, nodeId: string) => void;
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

export const AgentNode = ({ agent, isSelected, isConnecting, agentNumber, stageIndex, layoutId = 'default', onSelect, onDelete, onToggleMinimize, onToggleLock, onPortClick, onRun, onDragStart }: AgentNodeProps) => {
  const Icon = agentIcons[agent.type as keyof typeof agentIcons] || Bot;
  const statusInfo = statusConfig[agent.status];
  const StatusIcon = statusInfo.icon;
  const { toast } = useToast();

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

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLock();
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!agent.output) {
      toast({
        title: "No output",
        description: "This agent hasn't generated any output yet.",
        variant: "destructive",
      });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${agent.name}_stage${stageIndex + 1}_agent${agentNumber}_${timestamp}.md`;
    
    const blob = new Blob([agent.output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: `Output saved as ${filename}`,
    });
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!agent.output) {
      toast({
        title: "No output",
        description: "This agent hasn't generated any output yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(agent.output);
      toast({
        title: "Copied",
        description: "Output copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRun) {
      onRun();
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("existingNodeId", agent.id);
    if (onDragStart) {
      onDragStart(e, agent.id);
    }
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
        draggable
        onDragStart={handleDragStart}
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
        
        {/* Agent number and locked icon */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-0.5">
            <div className="text-xs font-bold text-foreground">{agentNumber}</div>
            {agent.locked && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
          </div>
          <StatusIcon className={`h-3 w-3 mx-auto mt-0.5 ${statusInfo.color}`} />
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className={`p-3 cursor-pointer transition-all hover:shadow-lg w-full min-w-[240px] bg-card/50 backdrop-blur-sm group ${
        isSelected ? "ring-2 ring-primary shadow-lg" : ""
      } ${statusStyles[agent.status]}`}
      onClick={onSelect}
      draggable
      onDragStart={handleDragStart}
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
          
          <div className="flex-1 min-w-0 space-y-1">
            {/* Title row - truncates with ellipsis */}
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-semibold text-foreground truncate">{agent.name}</h4>
              {agent.locked && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </div>
            
            {/* Buttons row - wraps if needed */}
            <div className="flex items-center gap-0.5 flex-wrap">
              {onRun && agent.status !== "running" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleRun}
                  title="Run agent"
                >
                  <Play className="h-3 w-3 text-primary" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hidden xl:flex"
                onClick={handleDownload}
                title="Download output"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleCopy}
                title="Copy output"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleToggleLock}
                title={agent.locked ? "Unlock agent" : "Lock agent"}
              >
                {agent.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </Button>
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
