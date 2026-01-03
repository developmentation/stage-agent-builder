// File Node - User-provided file visualization
import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FileText, FileImage, FileArchive, FileAudio, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileNodeData {
  type: "file";
  label: string;
  status: "idle" | "active";
  fileId?: string;
  mimeType?: string;
}

export function FileNode({ data }: NodeProps<FileNodeData>) {
  const getIcon = () => {
    const mimeType = data.mimeType || "";
    
    if (mimeType.startsWith("image/")) {
      return <FileImage className="w-4 h-4" />;
    }
    if (mimeType.includes("zip") || mimeType.includes("archive")) {
      return <FileArchive className="w-4 h-4" />;
    }
    if (mimeType.startsWith("audio/")) {
      return <FileAudio className="w-4 h-4" />;
    }
    if (mimeType.includes("text") || mimeType.includes("pdf") || mimeType.includes("document")) {
      return <FileText className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "w-[70px] h-[40px] rounded-md border",
        "bg-blue-500/10 border-blue-500/30",
        "shadow-sm cursor-pointer hover:shadow-md hover:border-blue-500/50 transition-all",
        data.status === "active" && "border-blue-500 bg-blue-500/20"
      )}
    >
      {/* Handle for connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-500 !w-2 !h-2"
      />

      {/* Icon */}
      <div className="text-blue-500 mb-0.5">{getIcon()}</div>

      {/* Label */}
      <div className="text-[8px] font-medium text-foreground text-center px-1 truncate w-full">
        {data.label}
      </div>
    </div>
  );
}
