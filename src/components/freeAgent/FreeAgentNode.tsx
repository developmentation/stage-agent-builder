// Free Agent Node - Central agent visualization
import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Bot, Brain, CheckCircle, AlertCircle, Loader2, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface FreeAgentNodeData {
  type: "agent";
  label: string;
  status: "idle" | "thinking" | "active" | "success" | "error" | "paused";
  iteration?: number;
  reasoning?: string;
  retryCount?: number;
  onRetry?: () => void;
}

export function FreeAgentNode({ data }: NodeProps<FreeAgentNodeData>) {
  const getStatusStyles = () => {
    switch (data.status) {
      case "thinking":
        return "border-yellow-500 bg-yellow-500/10 shadow-yellow-500/30";
      case "active":
        return "border-blue-500 bg-blue-500/10 shadow-blue-500/30";
      case "success":
        return "border-green-500 bg-green-500/10 shadow-green-500/30";
      case "error":
        return "border-red-500 bg-red-500/10 shadow-red-500/30";
      case "paused":
        return "border-orange-500 bg-orange-500/10 shadow-orange-500/30";
      default:
        return "border-muted-foreground/30 bg-muted/30";
    }
  };

  const getStatusIcon = () => {
    switch (data.status) {
      case "thinking":
        return <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />;
      case "active":
        return <Brain className="w-6 h-6 text-blue-500 animate-pulse" />;
      case "success":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "error":
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case "paused":
        return <Pause className="w-6 h-6 text-orange-500" />;
      default:
        return <Bot className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const canRetry = (data.status === "error" || data.status === "paused") && data.onRetry;

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onRetry) {
      data.onRetry();
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center",
        "w-[120px] h-[120px] rounded-full border-2",
        "shadow-lg transition-all duration-300",
        getStatusStyles(),
        data.status === "thinking" && "animate-pulse"
      )}
    >
      {/* Handles for connections */}
      {/* Left: User prompt and files input */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
      {/* Right: Scratchpad and artifacts output */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      />
      {/* Top: Read tools input (blue) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background"
      />
      {/* Bottom: Write tools output (amber) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-amber-500 !w-3 !h-3 !border-2 !border-background"
      />

      {/* Icon or Retry Button */}
      <div className="mb-1">
        {canRetry ? (
          <button
            onClick={handleRetryClick}
            className="w-10 h-10 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors cursor-pointer shadow-md"
            title="Click to retry"
          >
            <Play className="w-5 h-5 text-white ml-0.5" />
          </button>
        ) : (
          getStatusIcon()
        )}
      </div>

      {/* Label */}
      <div className="text-xs font-semibold text-foreground text-center px-2">
        {canRetry ? "Click to Retry" : data.label}
      </div>

      {/* Iteration badge */}
      {data.iteration !== undefined && (
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {data.iteration}
        </div>
      )}

      {/* Retry count badge */}
      {data.retryCount !== undefined && data.retryCount > 0 && (
        <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
          {data.retryCount}
        </div>
      )}

      {/* Animated ring for thinking state */}
      {data.status === "thinking" && (
        <div className="absolute inset-0 rounded-full border-2 border-yellow-500/50 animate-ping" />
      )}
    </div>
  );
}
