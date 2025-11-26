import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, AlertCircle, Circle, Trash2, Minimize2, Download, Copy, Lock, Unlock } from "lucide-react";
import type { FunctionNode as FunctionNodeType } from "@/types/workflow";
import { useToast } from "@/hooks/use-toast";
import { getFunctionById } from "@/lib/functionDefinitions";

interface FunctionNodeProps {
  node: FunctionNodeType;
  isSelected: boolean;
  isConnecting: boolean;
  nodeNumber: string;
  stageIndex: number;
  layoutId?: string;
  onSelect: () => void;
  onDelete: () => void;
  onToggleMinimize: () => void;
  onToggleLock: () => void;
  onPortClick: (nodeId: string, isOutput: boolean, outputPort?: string) => void;
  onRun?: () => void;
}

const statusConfig = {
  idle: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted" },
  running: { icon: Play, color: "text-warning", bg: "bg-warning/10" },
  complete: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

export const FunctionNode = ({ 
  node, 
  isSelected, 
  isConnecting, 
  nodeNumber, 
  stageIndex, 
  layoutId = 'default', 
  onSelect, 
  onDelete, 
  onToggleMinimize,
  onToggleLock,
  onPortClick,
  onRun 
}: FunctionNodeProps) => {
  const functionDef = getFunctionById(node.functionType);
  const Icon = functionDef?.icon || Circle;
  const statusInfo = statusConfig[node.status];
  const StatusIcon = statusInfo.icon;
  const { toast } = useToast();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete function "${node.name}"?`)) {
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

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node.output) {
      toast({
        title: "No output",
        description: "This function hasn't generated any output yet.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(node.output);
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

  // Status-based styling
  const statusStyles = {
    running: "bg-yellow-50 dark:bg-yellow-950/20",
    complete: "ring-2 ring-green-500",
    error: "ring-2 ring-destructive",
    idle: "",
  };

  if (node.minimized) {
    return (
      <Card 
        className={`w-16 h-16 cursor-pointer transition-all hover:shadow-lg backdrop-blur-sm flex items-center justify-center relative ${
          isSelected ? "ring-2 ring-primary shadow-lg" : ""
        } ${statusStyles[node.status]} ${functionDef?.color || "bg-card/50"}`}
        onClick={onToggleMinimize}
        style={{ position: 'relative', zIndex: 20 }}
      >
        {/* Input Port */}
        <div 
          id={`port-input-${node.id}-${layoutId}`}
          className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
            isConnecting ? "ring-2 ring-primary animate-pulse" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onPortClick(node.id, false);
          }}
        />
        
        {/* Output Port(s) */}
        {node.outputPorts.map((portName, idx) => (
          <div 
            key={portName}
            id={`port-output-${node.id}-${portName}-${layoutId}`}
            className={`absolute -bottom-2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
              isConnecting ? "ring-2 ring-primary animate-pulse" : ""
            }`}
            style={{ 
              left: node.outputPorts.length > 1 
                ? `${((idx + 1) / (node.outputPorts.length + 1)) * 100}%` 
                : '50%',
              transform: 'translateX(-50%)'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPortClick(node.id, true, portName);
            }}
          />
        ))}
        
        {/* Node number and locked icon */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-0.5">
            <div className="text-xs font-bold text-foreground">{nodeNumber}</div>
            {node.locked && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
          </div>
          <StatusIcon className={`h-3 w-3 mx-auto mt-0.5 ${statusInfo.color}`} />
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className={`p-3 cursor-pointer transition-all hover:shadow-lg w-full min-w-[240px] backdrop-blur-sm group ${
        isSelected ? "ring-2 ring-primary shadow-lg" : ""
      } ${statusStyles[node.status]} ${functionDef?.color || "bg-card/50"}`}
      onClick={onSelect}
      style={{ position: 'relative', zIndex: 20 }}
    >
      {/* Input Port */}
      <div 
        id={`port-input-${node.id}-${layoutId}`}
        className={`absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
          isConnecting ? "ring-2 ring-primary animate-pulse" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onPortClick(node.id, false);
        }}
      />
      
      {/* Output Port(s) - Multiple ports for functions with conditional outputs */}
      {node.outputPorts.map((portName, idx) => (
        <div 
          key={portName}
          id={`port-output-${node.id}-${portName}-${layoutId}`}
          className={`absolute -bottom-2 w-3 h-3 rounded-full bg-primary border-2 border-card cursor-pointer hover:scale-125 transition-transform z-20 ${
            isConnecting ? "ring-2 ring-primary animate-pulse" : ""
          }`}
          style={{ 
            left: node.outputPorts.length > 1 
              ? `${((idx + 1) / (node.outputPorts.length + 1)) * 100}%` 
              : '50%',
            transform: 'translateX(-50%)'
          }}
          onClick={(e) => {
            e.stopPropagation();
            onPortClick(node.id, true, portName);
          }}
          title={portName}
        />
      ))}

      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${functionDef?.color || "bg-primary/10"}`}>
            <Icon className="h-4 w-4" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <h4 className="text-sm font-semibold text-foreground truncate">{node.name}</h4>
                {node.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {onRun && node.status !== "running" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleRun}
                    title="Run function"
                  >
                    <Play className="h-3 w-3 text-primary" />
                  </Button>
                )}
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
                  title={node.locked ? "Unlock function" : "Lock function"}
                >
                  {node.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
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
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1 ${statusInfo.color}`}>
            <StatusIcon className="h-3 w-3" />
            <span className="text-xs capitalize">{node.status}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {functionDef?.category || "function"}
          </Badge>
          {node.outputPorts.length > 1 && (
            <Badge variant="outline" className="text-xs">
              {node.outputPorts.length} outputs
            </Badge>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2">
          {functionDef?.description || "Custom function"}
        </p>
        
        {/* Show output port labels for multi-output functions */}
        {node.outputPorts.length > 1 && (
          <div className="flex gap-1 text-[10px] text-muted-foreground">
            <span>Outputs:</span>
            {node.outputPorts.map((port, idx) => {
              // Check if this specific output port has content (non-empty string)
              const output = node.output as any;
              const hasContent = output && typeof output === 'object' && typeof output[port] === 'string' && output[port].length > 0;
              
              return (
                <Badge 
                  key={port} 
                  variant="outline" 
                  className={`text-[9px] px-1 py-0 h-4 ${
                    hasContent ? 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-400' : ''
                  }`}
                >
                  {port}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
