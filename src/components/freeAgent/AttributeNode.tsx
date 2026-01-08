// Attribute Node - Tool result attribute visualization (similar to ArtifactNode)
import React, { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Database, Search, Globe, Github, Cloud, CheckCircle2, Image, Volume2, Binary } from "lucide-react";
import type { FreeAgentNodeData } from "@/types/freeAgent";
import { AttributeViewerModal } from "./AttributeViewerModal";

interface ExtendedAttributeNodeData extends FreeAgentNodeData {
  isBinary?: boolean;
}

export function AttributeNode({ data }: NodeProps<ExtendedAttributeNodeData>) {
  const [modalOpen, setModalOpen] = useState(false);

  const getIcon = () => {
    // Binary content icons
    if (data.isBinary) {
      if (data.mimeType?.startsWith('image/')) return <Image className="w-4 h-4" />;
      if (data.mimeType?.startsWith('audio/')) return <Volume2 className="w-4 h-4" />;
      return <Binary className="w-4 h-4" />;
    }
    
    // Tool-based icons
    switch (data.attributeTool) {
      case "brave_search":
      case "google_search":
        return <Search className="w-4 h-4" />;
      case "web_scrape":
        return <Globe className="w-4 h-4" />;
      case "read_github_repo":
      case "read_github_file":
        return <Github className="w-4 h-4" />;
      case "get_call_api":
      case "post_call_api":
        return <Cloud className="w-4 h-4" />;
      case "image_generation":
        return <Image className="w-4 h-4" />;
      case "elevenlabs_tts":
        return <Volume2 className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const formatSize = (bytes: number, isBinary?: boolean) => {
    if (isBinary || bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} chars`;
  };

  const handleClick = () => {
    setModalOpen(true);
  };
  
  // Use different border color for binary attributes
  const borderClass = data.isBinary 
    ? "border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500"
    : "border-cyan-300 dark:border-cyan-700 hover:border-cyan-400 dark:hover:border-cyan-500";
  const bgClass = data.isBinary
    ? "bg-purple-50/90 dark:bg-purple-950/40"
    : "bg-cyan-50/90 dark:bg-cyan-950/40";
  const headerBgClass = data.isBinary
    ? "bg-purple-200/80 dark:bg-purple-900/60 border-purple-300 dark:border-purple-700"
    : "bg-cyan-200/80 dark:bg-cyan-900/60 border-cyan-300 dark:border-cyan-700";
  const textClass = data.isBinary
    ? "text-purple-600 dark:text-purple-400"
    : "text-cyan-600 dark:text-cyan-400";
  const labelTextClass = data.isBinary
    ? "text-purple-800 dark:text-purple-200"
    : "text-cyan-800 dark:text-cyan-200";
  const metaTextClass = data.isBinary
    ? "text-purple-700/70 dark:text-purple-300/70"
    : "text-cyan-700/70 dark:text-cyan-300/70";

  return (
    <>
      <div
        onClick={handleClick}
        className={`w-52 rounded-lg border-2 ${borderClass} ${bgClass} shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-all`}
      >
        {/* Handle for connections */}
        <Handle
          type="target"
          position={Position.Left}
          className={data.isBinary ? "!bg-purple-500 !w-3 !h-3" : "!bg-cyan-500 !w-3 !h-3"}
        />

        {/* Header */}
        <div className={`px-2 py-1.5 ${headerBgClass} border-b flex items-center gap-2`}>
          <div className={textClass}>{getIcon()}</div>
          <span className={`font-mono font-medium text-xs ${labelTextClass} truncate flex-1`}>
            {`{{${data.attributeName}}}`}
          </span>
          {data.isBinary && (
            <span className="text-[9px] bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1 rounded">
              BINARY
            </span>
          )}
          <CheckCircle2 className={`w-3.5 h-3.5 ${textClass}`} />
        </div>

        {/* Metadata row */}
        <div className={`px-2 py-1.5 flex items-center justify-between text-[10px] ${metaTextClass}`}>
          <span className="truncate">{data.attributeTool}</span>
          <span className="font-mono">{formatSize(data.size || 0, data.isBinary)}</span>
        </div>
      </div>

      <AttributeViewerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        attributeName={data.attributeName || ""}
        attributeValue={data.attributeValue || ""}
        attributeTool={data.attributeTool}
        isBinary={data.isBinary}
        mimeType={data.mimeType}
      />
    </>
  );
}
