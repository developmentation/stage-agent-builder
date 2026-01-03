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
} from "reactflow";
import "reactflow/dist/style.css";
import { FreeAgentNode } from "./FreeAgentNode";
import { ToolNode } from "./ToolNode";
import { ArtifactNode } from "./ArtifactNode";
import { FileNode } from "./FileNode";
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
}

const nodeTypes = {
  agent: FreeAgentNode,
  tool: ToolNode,
  artifact: ArtifactNode,
  file: FileNode,
};

export function FreeAgentCanvas({
  session,
  toolsManifest,
  activeToolIds,
  onToolClick,
  onArtifactClick,
  onFileClick,
}: FreeAgentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Calculate node positions in a radial layout
  const generateLayout = useCallback(() => {
    if (!toolsManifest) return { nodes: [], edges: [] };

    const tools = Object.entries(toolsManifest.tools);
    const centerX = 400;
    const centerY = 300;
    const toolRadius = 280;
    const artifactRadius = 180;
    const fileRadius = 120;

    const newNodes: Node<FreeAgentNodeData>[] = [];
    const newEdges: Edge[] = [];

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

    // Tool nodes in outer circle
    tools.forEach(([toolId, tool], index) => {
      const angle = (2 * Math.PI * index) / tools.length - Math.PI / 2;
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

    // Artifact nodes
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

    // File nodes
    session?.sessionFiles.forEach((file, index) => {
      const angle = (2 * Math.PI * index) / Math.max(session.sessionFiles.length, 1) - Math.PI / 4;
      const x = centerX + fileRadius * Math.cos(angle) - 35;
      const y = centerY + fileRadius * Math.sin(angle) - 20;

      newNodes.push({
        id: `file-${file.id}`,
        type: "file",
        position: { x, y },
        data: {
          type: "file",
          label: file.filename,
          status: "idle",
          fileId: file.id,
          mimeType: file.mimeType,
        },
      });

      // Edge from file to agent
      newEdges.push({
        id: `edge-file-agent-${file.id}`,
        source: `file-${file.id}`,
        target: "agent",
        style: { stroke: "#6b7280", strokeWidth: 1, strokeDasharray: "3,3" },
      });
    });

    return { nodes: newNodes, edges: newEdges };
  }, [toolsManifest, session, activeToolIds]);

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
      } else if (node.type === "file" && onFileClick) {
        onFileClick(node.data.fileId);
      }
    },
    [onToolClick, onArtifactClick, onFileClick]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#374151" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
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
    </div>
  );
}
