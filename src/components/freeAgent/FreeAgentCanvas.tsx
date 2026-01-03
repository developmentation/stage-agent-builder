// Free Agent Canvas - Main visualization component
import React, { useMemo, useCallback, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { FreeAgentNode } from "./FreeAgentNode";
import { ToolNode } from "./ToolNode";
import { ArtifactNode } from "./ArtifactNode";
import { FileNode } from "./FileNode";
import { ScratchpadNode } from "./ScratchpadNode";
import { PromptNode } from "./PromptNode";
import { PromptFileNode } from "./PromptFileNode";
import type {
  FreeAgentSession,
  ToolsManifest,
  FreeAgentNodeData,
} from "@/types/freeAgent";

interface FreeAgentCanvasProps {
  session: FreeAgentSession | null;
  toolsManifest: ToolsManifest | null;
  activeToolIds: Set<string>;
  onToolClick?: (toolId: string) => void;
  onArtifactClick?: (artifactId: string) => void;
  onFileClick?: (fileId: string) => void;
  onScratchpadChange?: (content: string) => void;
}

const nodeTypes = {
  agent: FreeAgentNode,
  tool: ToolNode,
  artifact: ArtifactNode,
  file: FileNode,
  scratchpad: ScratchpadNode,
  prompt: PromptNode,
  promptFile: PromptFileNode,
};

export function FreeAgentCanvas({
  session,
  toolsManifest,
  activeToolIds,
  onToolClick,
  onArtifactClick,
  onFileClick,
  onScratchpadChange,
}: FreeAgentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Calculate node positions with new layout
  const generateLayout = useCallback(() => {
    if (!toolsManifest) return { nodes: [], edges: [] };

    const tools = Object.entries(toolsManifest.tools);
    
    // Layout dimensions - wider canvas for left-center-right layout
    const centerX = 500;
    const centerY = 350;
    const toolRadius = 280;
    const artifactRadius = 180;
    
    // Left side for prompt and files
    const leftX = 80;
    const promptY = 150;
    
    // Right side for scratchpad
    const scratchpadX = 850;
    const scratchpadY = 150;

    const newNodes: Node<FreeAgentNodeData>[] = [];
    const newEdges: Edge[] = [];

    // === LEFT SIDE: Prompt and Files ===
    
    // Prompt node
    if (session?.prompt) {
      newNodes.push({
        id: "prompt",
        type: "prompt",
        position: { x: leftX, y: promptY },
        data: {
          type: "prompt",
          label: "User Prompt",
          content: session.prompt,
          status: "idle",
        },
      });

      // Edge from prompt to agent
      newEdges.push({
        id: "edge-prompt-agent",
        source: "prompt",
        target: "agent",
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "5,5" },
      });
    }

    // Prompt file nodes (stacked below prompt)
    session?.sessionFiles.forEach((file, index) => {
      const fileY = promptY + 180 + (index * 80);
      
      newNodes.push({
        id: `promptFile-${file.id}`,
        type: "promptFile",
        position: { x: leftX, y: fileY },
        data: {
          type: "promptFile",
          label: file.filename,
          fileId: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          size: file.size,
          status: activeToolIds.has(`read_file_${file.id}`) ? "reading" : "idle",
        },
      });

      // Edge from file to agent
      newEdges.push({
        id: `edge-promptFile-agent-${file.id}`,
        source: `promptFile-${file.id}`,
        target: "agent",
        style: { stroke: "#10b981", strokeWidth: 1, strokeDasharray: "3,3" },
      });
    });

    // === CENTER: Agent and Tools ===
    
    // Agent node in center
    const agentStatus = session?.status === "running" 
      ? "thinking" 
      : session?.status === "completed" 
        ? "success" 
        : session?.status === "error" 
          ? "error" 
          : "idle";

    newNodes.push({
      id: "agent",
      type: "agent",
      position: { x: centerX - 60, y: centerY - 60 },
      data: {
        type: "agent",
        label: "Free Agent",
        status: agentStatus,
        iteration: session?.currentIteration || 0,
        reasoning: session?.messages[session.messages.length - 1]?.content,
      },
    });

    // Tool nodes in radial layout around agent (right semicircle only to leave space for scratchpad)
    tools.forEach(([toolId, tool], index) => {
      // Adjust angle to be on the right side (from -90 to +90 degrees)
      const angleRange = Math.PI * 1.2; // Slightly more than semicircle
      const startAngle = -Math.PI * 0.6;
      const angle = startAngle + (angleRange * index) / tools.length;
      const x = centerX + toolRadius * Math.cos(angle) - 50;
      const y = centerY + toolRadius * Math.sin(angle) - 30;

      const isActive = activeToolIds.has(toolId);
      const wasUsed = session?.toolCalls.some((tc) => tc.tool === toolId && tc.status === "completed");

      newNodes.push({
        id: `tool-${toolId}`,
        type: "tool",
        position: { x, y },
        data: {
          type: "tool",
          label: tool.name,
          status: isActive ? "active" : wasUsed ? "success" : "idle",
          icon: tool.icon,
          category: tool.category,
          toolId,
        },
      });

      // Add edge from agent to active tools
      if (isActive) {
        newEdges.push({
          id: `edge-agent-${toolId}`,
          source: "agent",
          target: `tool-${toolId}`,
          animated: true,
          style: { stroke: "#f59e0b", strokeWidth: 2 },
        });
      }
    });

    // Artifact nodes (near agent)
    session?.artifacts.forEach((artifact, index) => {
      const angle = (2 * Math.PI * index) / Math.max(session.artifacts.length, 1) + Math.PI / 4;
      const x = centerX + artifactRadius * Math.cos(angle) - 40;
      const y = centerY + artifactRadius * Math.sin(angle) - 25;

      newNodes.push({
        id: `artifact-${artifact.id}`,
        type: "artifact",
        position: { x, y },
        data: {
          type: "artifact",
          label: artifact.title,
          status: "success",
          artifactId: artifact.id,
          artifactType: artifact.type,
        },
      });

      // Edge from agent to artifact
      newEdges.push({
        id: `edge-agent-artifact-${artifact.id}`,
        source: "agent",
        target: `artifact-${artifact.id}`,
        style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "5,5" },
      });
    });

    // === RIGHT SIDE: Scratchpad ===
    
    const isWritingToScratchpad = activeToolIds.has("write_scratchpad");
    
    newNodes.push({
      id: "scratchpad",
      type: "scratchpad",
      position: { x: scratchpadX, y: scratchpadY },
      style: { width: 320, height: 400 },
      data: {
        type: "scratchpad",
        label: "Scratchpad",
        content: session?.scratchpad || "",
        status: isWritingToScratchpad ? "active" : "idle",
        isWriting: isWritingToScratchpad,
        onContentChange: onScratchpadChange,
      },
    });

    // Edge from agent to scratchpad
    newEdges.push({
      id: "edge-agent-scratchpad",
      source: "agent",
      target: "scratchpad",
      animated: isWritingToScratchpad,
      style: { 
        stroke: isWritingToScratchpad ? "#f59e0b" : "#f59e0b50", 
        strokeWidth: isWritingToScratchpad ? 2 : 1,
        strokeDasharray: isWritingToScratchpad ? undefined : "5,5",
      },
    });

    return { nodes: newNodes, edges: newEdges };
  }, [toolsManifest, session, activeToolIds, onScratchpadChange]);

  // Update nodes and edges when session changes
  React.useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = generateLayout();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [generateLayout, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "tool" && onToolClick) {
        onToolClick(node.data.toolId);
      } else if (node.type === "artifact" && onArtifactClick) {
        onArtifactClick(node.data.artifactId);
      } else if ((node.type === "file" || node.type === "promptFile") && onFileClick) {
        onFileClick(node.data.fileId);
      }
    },
    [onToolClick, onArtifactClick, onFileClick]
  );

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
        >
          <Background color="#374151" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "scratchpad") return "#f59e0b";
              if (node.type === "prompt") return "#3b82f6";
              if (node.type === "promptFile") return "#10b981";
              if (node.data?.status === "active" || node.data?.status === "thinking") return "#f59e0b";
              if (node.data?.status === "success") return "#10b981";
              if (node.data?.status === "error") return "#ef4444";
              return "#6b7280";
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
          />
          <Panel position="top-left" className="bg-background/80 backdrop-blur-sm p-2 rounded-lg border">
            <div className="text-sm font-medium">
              {session ? (
                <span>
                  Iteration {session.currentIteration} / {session.maxIterations}
                </span>
              ) : (
                <span>No active session</span>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
