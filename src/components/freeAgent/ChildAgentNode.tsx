// Child Agent Node - Round visualization for spawned child agents (matches FreeAgentNode style)
import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import { GitBranch, Loader2, CheckCircle, XCircle, Pause, Bot } from "lucide-react";
import type { FreeAgentNodeData } from "@/types/freeAgent";

export function ChildAgentNode({ data }: NodeProps<FreeAgentNodeData>) {
  const getStatusStyles = () => {
    switch (data.status) {
      case "thinking":
        return "border-amber-500 bg-amber-500/10 shadow-amber-500/30";
      case "success":
        return "border-green-500 bg-green-500/10 shadow-green-500/30";
      case "error":
        return "border-red-500 bg-red-500/10 shadow-red-500/30";
      case "waiting":
      case "paused":
        return "border-orange-500 bg-orange-500/10 shadow-orange-500/30";
      default:
        return "border-muted-foreground/30 bg-muted/30";
    }
  };

  const getStatusIcon = () => {
    switch (data.status) {
      case "thinking":
        return <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />;
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "waiting":
      case "paused":
        return <Pause className="w-5 h-5 text-orange-500" />;
      default:
        return <GitBranch className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center cursor-pointer",
        "w-[90px] h-[90px] rounded-full border-2",
        "shadow-lg transition-all duration-300",
        getStatusStyles(),
        data.status === "thinking" && "animate-pulse"
      )}
      title={`${data.childName || data.label}\nTask: ${data.task || 'N/A'}\nClick to view details`}
    >
      {/* Input handle - connection from parent */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-background"
      />

      {/* Icon */}
      <div className="mb-0.5">
        {getStatusIcon()}
      </div>

      {/* Name - truncated */}
      <div className="text-[10px] font-semibold text-foreground text-center px-1 max-w-[80px] truncate">
        {data.childName || data.label}
      </div>

      {/* Progress indicator */}
      <div className="text-[9px] text-muted-foreground flex items-center gap-0.5">
        <span>
          {data.currentIteration || 0}/{data.maxIterations || 10}
        </span>
        {data.status === "success" && (
          <span className="text-green-500">✓</span>
        )}
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-background"
      />

      {/* Animated ring for thinking state */}
      {data.status === "thinking" && (
        <div className="absolute inset-0 rounded-full border-2 border-amber-500/50 animate-ping" />
      )}
    </div>
  );
}
