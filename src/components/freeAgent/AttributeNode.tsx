// Attribute Node - Tool result attribute visualization (similar to ArtifactNode)
import React, { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Database, Search, Globe, Github, FileCode, Cloud, CheckCircle2 } from "lucide-react";
import type { FreeAgentNodeData } from "@/types/freeAgent";
import { AttributeViewerModal } from "./AttributeViewerModal";

export function AttributeNode({ data }: NodeProps<FreeAgentNodeData>) {
  const [modalOpen, setModalOpen] = useState(false);

  const getIcon = () => {
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
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} chars`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleClick = () => {
    setModalOpen(true);
  };

  return (
    <>
      <div
        onClick={handleClick}
        className="w-52 rounded-lg border-2 border-cyan-300 dark:border-cyan-700 bg-cyan-50/90 dark:bg-cyan-950/40 shadow-md overflow-hidden cursor-pointer hover:border-cyan-400 dark:hover:border-cyan-500 hover:shadow-lg transition-all"
      >
        {/* Handle for connections */}
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-cyan-500 !w-3 !h-3"
        />

        {/* Header */}
        <div className="px-2 py-1.5 bg-cyan-200/80 dark:bg-cyan-900/60 border-b border-cyan-300 dark:border-cyan-700 flex items-center gap-2">
          <div className="text-cyan-600 dark:text-cyan-400">{getIcon()}</div>
          <span className="font-mono font-medium text-xs text-cyan-800 dark:text-cyan-200 truncate flex-1">
            {`{{${data.attributeName}}}`}
          </span>
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
        </div>

        {/* Metadata row */}
        <div className="px-2 py-1.5 flex items-center justify-between text-[10px] text-cyan-700/70 dark:text-cyan-300/70">
          <span className="truncate">{data.attributeTool}</span>
          <span className="font-mono">{formatSize(data.size || 0)}</span>
        </div>
      </div>

      <AttributeViewerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        attributeName={data.attributeName || ""}
        attributeValue={data.attributeValue || ""}
        attributeTool={data.attributeTool}
      />
    </>
  );
}
