import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  FileText,
  Trash2,
  Play,
  Circle,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  Search,
  BarChart,
  FunctionSquare,
  Lock,
  LockOpen,
} from "lucide-react";
import type { WorkflowNode, AgentNode, FunctionNode } from "@/types/workflow";

interface WorkflowNodeComponentData {
  node: WorkflowNode;
  selected: boolean;
  isConnecting: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRun: () => void;
  onPortClick: (outputPort?: string) => void;
  onToggleLock: () => void;
}

const agentIcons: Record<string, any> = {
  researcher: Search,
  summarizer: FileText,
  analyst: BarChart,
  custom: Brain,
};

const statusConfig = {
  idle: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted" },
  running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-500/10" },
  complete: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
};

export const WorkflowNodeComponent = memo(({ data }: NodeProps<WorkflowNodeComponentData>) => {
  const { node, selected, isConnecting, onSelect, onDelete, onRun, onPortClick, onToggleLock } = data;
  const status = statusConfig[node.status];
  const StatusIcon = status.icon;

  const getIcon = () => {
    if (node.nodeType === "agent") {
      const agentNode = node as AgentNode;
      const IconComponent = agentIcons[agentNode.type] || Brain;
      return <IconComponent className="h-4 w-4" />;
    } else if (node.nodeType === "function") {
      return <FunctionSquare className="h-4 w-4" />;
    }
    return <Bot className="h-4 w-4" />;
  };

  const getOutputPorts = () => {
    if (node.nodeType === "function") {
      const functionNode = node as FunctionNode;
      return functionNode.outputPorts || ["default"];
    }
    return ["default"];
  };

  const outputPorts = getOutputPorts();
  const hasMultiplePorts = outputPorts.length > 1;

  return (
    <Card
      className={`
        min-w-[200px] max-w-[250px] cursor-pointer transition-all
        ${selected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"}
        ${node.status === "running" ? "animate-pulse" : ""}
      `}
      onClick={onSelect}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-primary"
        isConnectable={true}
      />

      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`${status.bg} p-1.5 rounded-md`}>
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm truncate">{node.name}</CardTitle>
              {node.nodeType === "agent" && (
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {(node as AgentNode).output?.length || 0} chars
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {(node as AgentNode).tools.length} tools
                  </Badge>
                </div>
              )}
              {node.nodeType === "function" && (
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {(node as FunctionNode).output?.length || 0} chars
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <StatusIcon className={`h-4 w-4 ${status.color} ${node.status === "running" ? "animate-spin" : ""}`} />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock();
              }}
              className="h-6 w-6 p-0"
            >
              {node.locked ? (
                <Lock className="h-3 w-3 text-red-500" />
              ) : (
                <LockOpen className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {node.nodeType === "agent" && (
        <CardContent className="p-3 pt-0">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            disabled={node.status === "running" || node.locked}
            variant={node.locked ? "secondary" : "default"}
            className="w-full h-7 text-xs"
          >
            <Play className="h-3 w-3 mr-1" />
            Run
          </Button>
        </CardContent>
      )}

      {/* Output Handles */}
      {hasMultiplePorts ? (
        <div className="flex justify-around pb-2">
          {outputPorts.map((port, index) => (
            <div key={port} className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{port}</span>
              <Handle
                type="source"
                position={Position.Bottom}
                id={port}
                className="w-3 h-3 !bg-primary relative !top-0"
                isConnectable={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-primary"
          isConnectable={true}
        />
      )}
    </Card>
  );
});

WorkflowNodeComponent.displayName = "WorkflowNodeComponent";
