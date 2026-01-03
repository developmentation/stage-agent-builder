// Artifact Node - Created artifact visualization
import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileText, Image, Database, File } from "lucide-react";
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

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "w-[80px] h-[50px] rounded-md border",
        "bg-green-500/10 border-green-500/50",
        "shadow-sm cursor-pointer hover:shadow-md transition-all"
      )}
    >
      {/* Handle for connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-500 !w-2 !h-2"
      />

      {/* Icon */}
      <div className="text-green-500 mb-0.5">{getIcon()}</div>

      {/* Label */}
      <div className="text-[9px] font-medium text-foreground text-center px-1 truncate w-full">
        {data.label}
      </div>

      {/* Checkmark badge */}
      <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-3 h-3 flex items-center justify-center">
        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  );
}
