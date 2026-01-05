// Child Agent Node - Visualization for spawned child agents
import React from "react";
import { Handle, Position } from "reactflow";
import { cn } from "@/lib/utils";
import { GitBranch, Loader2, CheckCircle, XCircle, Pause } from "lucide-react";
import type { FreeAgentNodeData } from "@/types/freeAgent";

interface ChildAgentNodeProps {
  data: FreeAgentNodeData;
}

export function ChildAgentNode({ data }: ChildAgentNodeProps) {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'thinking':
        return <Loader2 className="w-4 h-4 animate-spin text-amber-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'waiting':
      case 'paused':
        return <Pause className="w-4 h-4 text-orange-500" />;
      default:
        return <GitBranch className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 min-w-[100px] max-w-[140px] transition-all duration-300",
        // Status-based styling
        data.status === "thinking" && "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20",
        data.status === "success" && "border-green-500 bg-green-500/10",
        data.status === "error" && "border-red-500 bg-red-500/10",
        data.status === "waiting" && "border-orange-500 bg-orange-500/10 animate-pulse",
        data.status === "paused" && "border-orange-500 bg-orange-500/10",
        data.status === "idle" && "border-border bg-muted/50"
      )}
    >
      {/* Input handle - connection from parent */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-amber-500 !border-amber-600"
      />

      {/* Header with icon and name */}
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="font-medium text-sm truncate" title={data.label}>
          {data.childName || data.label}
        </span>
      </div>

      {/* Progress indicator */}
      <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
        <span>
          {data.currentIteration || 0}/{data.maxIterations || 20}
        </span>
        {data.status === "thinking" && (
          <span className="text-amber-500">working...</span>
        )}
        {data.status === "success" && (
          <span className="text-green-500">done</span>
        )}
        {data.status === "error" && (
          <span className="text-red-500">failed</span>
        )}
      </div>

      {/* Output handle - for potential future connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-amber-500 !border-amber-600"
      />
    </div>
  );
}
