// Free Agent Canvas - Main visualization component
import React, { useMemo, useCallback, useState, useRef } from "react";
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
  NodeChange,
  XYPosition,
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

// Read tools - gather/retrieve information (displayed ABOVE agent)
// Only include tools that exist in toolsManifest.json
const READ_TOOLS = [
  // Web & Search
  "brave_search", "google_search", "web_scrape",
  // GitHub  
  "read_github_repo", "read_github_file",
  // Memory reads
  "read_blackboard", "read_scratchpad", "read_prompt", "read_prompt_files",
  // File operations
  "read_file", "read_zip_contents", "read_zip_file", "extract_zip_files",
  // Documents
  "pdf_info", "pdf_extract_text", "ocr_image",
  // API reads
  "get_call_api", "get_time", "get_weather",
];

// Write tools - create/send/modify (displayed BELOW agent)
const WRITE_TOOLS = [
  // Memory writes
  "write_blackboard", "write_scratchpad",
  // Communication
  "send_email", "request_assistance",
  // API writes
  "post_call_api", "execute_sql",
  // Export/Generation
  "export_word", "export_pdf", "image_generation", "elevenlabs_tts",
];

// Layout dimensions
const LAYOUT = {
  // Agent center position
  agentX: 550,
  agentY: 350,
  
  // Left side - Prompt
  // Position so right edge of prompt aligns with left edge of tools area
  promptX: 50,
  promptY: 180,  // Same Y as scratchpad
  promptWidth: 280,
  promptHeight: 300,
  
  // User files - below prompt
  userFileGap: 75,
  
  // Right side - Scratchpad
  scratchpadX: 850,
  scratchpadY: 180,  // Same Y as prompt
  scratchpadWidth: 320,
  scratchpadHeight: 300,
  
  // Artifacts - below scratchpad
  artifactGap: 75,
  
  // Tool grid settings
  toolNodeWidth: 120,
  toolNodeHeight: 50,
  toolColumnGap: 15,
  toolRowGap: 8,
  toolColumns: 2,
  
  // Read tools - ABOVE agent
  // Calculate: 2 columns of tools centered above agent
  readToolsStartX: 420,
  readToolsStartY: 30,
  
  // Write tools - BELOW agent  
  writeToolsStartX: 420,
  writeToolsStartY: 480,
};

// Helper to lay out tools in 2 columns
const layoutToolsInColumns = (
  toolIds: string[],
  startX: number,
  startY: number,
  columns: number = 2
): Array<{ id: string; x: number; y: number }> => {
  return toolIds.map((toolId, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: toolId,
      x: startX + col * (LAYOUT.toolNodeWidth + LAYOUT.toolColumnGap),
      y: startY + row * (LAYOUT.toolNodeHeight + LAYOUT.toolRowGap),
    };
  });
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
  
  // Track user-moved node positions to preserve them across layout updates
  const userPositionsRef = useRef<Map<string, XYPosition>>(new Map());
  
  // Track user-resized node dimensions (for scratchpad)
  const userSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  
  // Track which nodes exist to detect new ones
  const existingNodeIdsRef = useRef<Set<string>>(new Set());

  // Handle node position and size changes - save user adjustments
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        userPositionsRef.current.set(change.id, change.position);
      }
      if (change.type === 'dimensions' && change.dimensions && change.resizing === false) {
        userSizesRef.current.set(change.id, {
          width: change.dimensions.width,
          height: change.dimensions.height,
        });
      }
    });
    onNodesChange(changes);
  }, [onNodesChange]);

  // Calculate node positions with new layout
  const generateLayout = useCallback(() => {
    if (!toolsManifest) return { nodes: [], edges: [] };

    const newNodes: Node<FreeAgentNodeData>[] = [];
    const newEdges: Edge[] = [];
    const newNodeIds = new Set<string>();

    // Helper to get position (use user position if exists, otherwise default)
    const getPosition = (nodeId: string, defaultPos: XYPosition): XYPosition => {
      const userPos = userPositionsRef.current.get(nodeId);
      if (userPos && existingNodeIdsRef.current.has(nodeId)) {
        return userPos;
      }
      return defaultPos;
    };

    // Calculate dynamic positions based on tool counts
    const availableReadTools = READ_TOOLS.filter(id => toolsManifest.tools[id]);
    const availableWriteTools = WRITE_TOOLS.filter(id => toolsManifest.tools[id]);
    
    const readToolRows = Math.ceil(availableReadTools.length / LAYOUT.toolColumns);
    const readToolsHeight = readToolRows * (LAYOUT.toolNodeHeight + LAYOUT.toolRowGap);
    
    // Agent positioned after read tools with gap
    const agentY = LAYOUT.readToolsStartY + readToolsHeight + 40;
    const agentX = LAYOUT.readToolsStartX + (LAYOUT.toolColumns * (LAYOUT.toolNodeWidth + LAYOUT.toolColumnGap)) / 2 - 60;
    
    // Write tools positioned after agent
    const writeToolsStartY = agentY + 140;
    
    // Position prompt and scratchpad to be centered with agent Y
    const sideNodesY = agentY - 80;

    // === LEFT SIDE: Prompt (always visible, always connected) ===
    const promptId = "prompt";
    newNodeIds.add(promptId);
    newNodes.push({
      id: promptId,
      type: "prompt",
      position: getPosition(promptId, { x: LAYOUT.promptX, y: sideNodesY }),
      data: {
        type: "prompt",
        label: "User Prompt",
        content: session?.prompt || "",
        status: "idle",
      },
    });

    // Edge from prompt to agent LEFT side (always connected)
    newEdges.push({
      id: "edge-prompt-agent",
      source: "prompt",
      target: "agent",
      targetHandle: "left",
      style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: session?.prompt ? undefined : "5,5" },
    });

    // User files (stacked below prompt)
    session?.sessionFiles.forEach((file, index) => {
      const fileY = sideNodesY + LAYOUT.promptHeight + 20 + (index * LAYOUT.userFileGap);
      const fileId = `promptFile-${file.id}`;
      newNodeIds.add(fileId);
      
      newNodes.push({
        id: fileId,
        type: "promptFile",
        position: getPosition(fileId, { x: LAYOUT.promptX, y: fileY }),
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

      // Edge from file to agent LEFT side
      newEdges.push({
        id: `edge-promptFile-agent-${file.id}`,
        source: fileId,
        target: "agent",
        targetHandle: "left",
        style: { stroke: "#10b981", strokeWidth: 1, strokeDasharray: "3,3" },
      });
    });

    // === READ TOOLS: Above agent in 2 columns ===
    const readToolPositions = layoutToolsInColumns(
      availableReadTools,
      LAYOUT.readToolsStartX,
      LAYOUT.readToolsStartY,
      LAYOUT.toolColumns
    );

    readToolPositions.forEach(({ id: toolId, x, y }) => {
      const tool = toolsManifest.tools[toolId];
      if (!tool) return;

      const nodeId = `tool-${toolId}`;
      newNodeIds.add(nodeId);

      const isActive = activeToolIds.has(toolId);
      const wasUsed = session?.toolCalls.some((tc) => tc.tool === toolId && tc.status === "completed");

      newNodes.push({
        id: nodeId,
        type: "tool",
        position: getPosition(nodeId, { x, y }),
        data: {
          type: "tool",
          label: tool.name,
          status: isActive ? "active" : wasUsed ? "success" : "idle",
          icon: tool.icon,
          category: tool.category,
          toolId,
        },
      });

      // Edge from read tool to agent TOP (input)
      if (isActive || wasUsed) {
        newEdges.push({
          id: `edge-tool-agent-${toolId}`,
          source: nodeId,
          target: "agent",
          targetHandle: "top",
          animated: isActive,
          style: { stroke: "#3b82f6", strokeWidth: isActive ? 2 : 1 },
        });
      }
    });

    // === CENTER: Agent ===
    const agentStatus = session?.status === "running" 
      ? "thinking" 
      : session?.status === "completed" 
        ? "success" 
        : session?.status === "error" 
          ? "error" 
          : "idle";

    const agentId = "agent";
    newNodeIds.add(agentId);
    newNodes.push({
      id: agentId,
      type: "agent",
      position: getPosition(agentId, { x: agentX, y: agentY }),
      data: {
        type: "agent",
        label: "Free Agent",
        status: agentStatus,
        iteration: session?.currentIteration || 0,
        reasoning: session?.messages[session.messages.length - 1]?.content,
      },
    });

    // === WRITE TOOLS: Below agent in 2 columns ===
    const writeToolPositions = layoutToolsInColumns(
      availableWriteTools,
      LAYOUT.writeToolsStartX,
      writeToolsStartY,
      LAYOUT.toolColumns
    );

    writeToolPositions.forEach(({ id: toolId, x, y }) => {
      const tool = toolsManifest.tools[toolId];
      if (!tool) return;

      const nodeId = `tool-${toolId}`;
      newNodeIds.add(nodeId);

      const isActive = activeToolIds.has(toolId);
      const wasUsed = session?.toolCalls.some((tc) => tc.tool === toolId && tc.status === "completed");

      newNodes.push({
        id: nodeId,
        type: "tool",
        position: getPosition(nodeId, { x, y }),
        data: {
          type: "tool",
          label: tool.name,
          status: isActive ? "active" : wasUsed ? "success" : "idle",
          icon: tool.icon,
          category: tool.category,
          toolId,
        },
      });

      // Edge from agent BOTTOM to write tool (output)
      if (isActive || wasUsed) {
        newEdges.push({
          id: `edge-agent-tool-${toolId}`,
          source: "agent",
          sourceHandle: "bottom",
          target: nodeId,
          animated: isActive,
          style: { stroke: "#f59e0b", strokeWidth: isActive ? 2 : 1 },
        });
      }
    });

    // === RIGHT SIDE: Scratchpad ===
    const isWritingToScratchpad = activeToolIds.has("write_scratchpad");
    const scratchpadId = "scratchpad";
    newNodeIds.add(scratchpadId);
    
    const userScratchpadSize = userSizesRef.current.get(scratchpadId);
    const scratchpadStyle = userScratchpadSize 
      ? { width: userScratchpadSize.width, height: userScratchpadSize.height }
      : { width: LAYOUT.scratchpadWidth, height: LAYOUT.scratchpadHeight };
    
    newNodes.push({
      id: scratchpadId,
      type: "scratchpad",
      position: getPosition(scratchpadId, { x: LAYOUT.scratchpadX, y: sideNodesY }),
      style: scratchpadStyle,
      data: {
        type: "scratchpad",
        label: "Scratchpad",
        content: session?.scratchpad || "",
        status: isWritingToScratchpad ? "active" : "idle",
        isWriting: isWritingToScratchpad,
        onContentChange: onScratchpadChange,
      },
    });

    // Edge from agent RIGHT side to scratchpad
    newEdges.push({
      id: "edge-agent-scratchpad",
      source: "agent",
      sourceHandle: "right",
      target: "scratchpad",
      animated: isWritingToScratchpad,
      style: { 
        stroke: isWritingToScratchpad ? "#f59e0b" : "#f59e0b50", 
        strokeWidth: isWritingToScratchpad ? 2 : 1,
        strokeDasharray: isWritingToScratchpad ? undefined : "5,5",
      },
    });

    // === Artifacts: Below scratchpad (styled like user files) ===
    session?.artifacts.forEach((artifact, index) => {
      const artifactY = sideNodesY + LAYOUT.scratchpadHeight + 20 + (index * LAYOUT.artifactGap);
      
      const nodeId = `artifact-${artifact.id}`;
      newNodeIds.add(nodeId);

      newNodes.push({
        id: nodeId,
        type: "artifact",
        position: getPosition(nodeId, { x: LAYOUT.scratchpadX, y: artifactY }),
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
        sourceHandle: "right",
        target: nodeId,
        style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "5,5" },
      });
    });

    // Update existing node IDs for next render
    existingNodeIdsRef.current = newNodeIds;

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
          onNodesChange={handleNodesChange}
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
