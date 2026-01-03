// Artifact Node - Created artifact visualization (styled like PromptFileNode)
import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileText, Image, Database, File, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtifactNodeData {
  type: "artifact";
  label: string;
  status: "idle" | "success";
  artifactId?: string;
  artifactType?: "text" | "file" | "image" | "data";
}

export function ArtifactNode({ data }: NodeProps<ArtifactNodeData>) {
  const getIcon = () => {
    switch (data.artifactType) {
      case "image":
        return <Image className="w-4 h-4" />;
      case "data":
        return <Database className="w-4 h-4" />;
      case "file":
        return <File className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (data.artifactType) {
      case "image":
        return "Generated Image";
      case "data":
        return "Data Output";
      case "file":
        return "Generated File";
      default:
        return "Text Content";
    }
  };

  return (
    <div className="w-48 rounded-lg border-2 border-green-300 dark:border-green-700 bg-green-50/90 dark:bg-green-950/40 shadow-md overflow-hidden">
      {/* Handle for connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-green-500 !w-3 !h-3"
      />

      {/* Header */}
      <div className="px-2 py-1.5 bg-green-200/80 dark:bg-green-900/60 border-b border-green-300 dark:border-green-700 flex items-center gap-2">
        <div className="text-green-600 dark:text-green-400">{getIcon()}</div>
        <span className="font-medium text-xs text-green-800 dark:text-green-200 truncate flex-1">
          {data.label}
        </span>
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
      </div>

      {/* Metadata row */}
      <div className="px-2 py-1.5 flex items-center justify-between text-[10px] text-green-700/70 dark:text-green-300/70">
        <span>{getTypeLabel()}</span>
      </div>
    </div>
  );
}
