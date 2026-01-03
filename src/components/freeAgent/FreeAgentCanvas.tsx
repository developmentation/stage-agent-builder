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

// Tool categories for grid layout
const TOOL_CATEGORIES: Record<string, string[]> = {
  "Web & Search": ["brave_search", "google_search", "web_scrape"],
  "GitHub": ["read_github_repo", "read_github_file"],
  "Files & Export": ["read_file", "export_word", "export_pdf"],
  "Memory": ["read_blackboard", "write_blackboard", "read_scratchpad", "write_scratchpad", "read_prompt", "read_prompt_files"],
  "Communication": ["send_email", "request_assistance"],
  "API & Data": ["get_call_api", "post_call_api", "execute_sql", "get_time"],
  "AI": ["image_generation", "elevenlabs_tts"],
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
        // User finished dragging - save their position
        userPositionsRef.current.set(change.id, change.position);
      }
      // Track dimension changes (from NodeResizer)
      if (change.type === 'dimensions' && change.dimensions && change.resizing === false) {
        userSizesRef.current.set(change.id, {
          width: change.dimensions.width,
          height: change.dimensions.height,
        });
      }
    });
    onNodesChange(changes);
  }, [onNodesChange]);

  // Calculate node positions with categorized grid layout
  const generateLayout = useCallback(() => {
    if (!toolsManifest) return { nodes: [], edges: [] };

    const tools = Object.entries(toolsManifest.tools);
    
    // Layout dimensions
    const centerX = 450;
    const centerY = 280;
    const artifactRadius = 150;
    
    // Left side for prompt and files
    const leftX = 60;
    const promptY = 100;
    
    // Right side for scratchpad
    const scratchpadX = 780;
    const scratchpadY = 80;
    
    // Tool grid layout - below and around agent
    const toolGridStartX = 100;
    const toolGridStartY = 480;
    const toolNodeWidth = 130;
    const toolNodeHeight = 60;
    const toolGapX = 20;
    const toolGapY = 15;
    const categoryGapY = 30;

    const newNodes: Node<FreeAgentNodeData>[] = [];
    const newEdges: Edge[] = [];
    const newNodeIds = new Set<string>();

    // Helper to get position (use user position if exists, otherwise default)
    const getPosition = (nodeId: string, defaultPos: XYPosition): XYPosition => {
      const userPos = userPositionsRef.current.get(nodeId);
      // Only use user position if this node already existed (not new)
      if (userPos && existingNodeIdsRef.current.has(nodeId)) {
        return userPos;
      }
      return defaultPos;
    };

    // === LEFT SIDE: Prompt and Files ===
    
    // Prompt node
    if (session?.prompt) {
      const promptId = "prompt";
      newNodeIds.add(promptId);
      newNodes.push({
        id: promptId,
        type: "prompt",
        position: getPosition(promptId, { x: leftX, y: promptY }),
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
      const fileY = promptY + 160 + (index * 70);
      const fileId = `promptFile-${file.id}`;
      newNodeIds.add(fileId);
      
      newNodes.push({
        id: fileId,
        type: "promptFile",
        position: getPosition(fileId, { x: leftX, y: fileY }),
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
        source: fileId,
        target: "agent",
        style: { stroke: "#10b981", strokeWidth: 1, strokeDasharray: "3,3" },
      });
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
      position: getPosition(agentId, { x: centerX - 60, y: centerY - 60 }),
      data: {
        type: "agent",
        label: "Free Agent",
        status: agentStatus,
        iteration: session?.currentIteration || 0,
        reasoning: session?.messages[session.messages.length - 1]?.content,
      },
    });

    // === TOOL GRID: Categorized layout below agent ===
    let currentY = toolGridStartY;
    
    Object.entries(TOOL_CATEGORIES).forEach(([categoryName, categoryToolIds]) => {
      // Filter to only tools that exist in manifest
      const categoryTools = categoryToolIds.filter(id => toolsManifest.tools[id]);
      if (categoryTools.length === 0) return;
      
      // Calculate grid for this category
      const toolsPerRow = 5;
      let currentX = toolGridStartX;
      let rowIndex = 0;
      
      categoryTools.forEach((toolId, index) => {
        const tool = toolsManifest.tools[toolId];
        if (!tool) return;
        
        const colIndex = index % toolsPerRow;
        if (index > 0 && colIndex === 0) {
          rowIndex++;
          currentX = toolGridStartX;
        }
        
        const x = toolGridStartX + colIndex * (toolNodeWidth + toolGapX);
        const y = currentY + rowIndex * (toolNodeHeight + toolGapY);
        
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

        // Add edge from agent to active tools
        if (isActive) {
          newEdges.push({
            id: `edge-agent-${toolId}`,
            source: "agent",
            target: nodeId,
            animated: true,
            style: { stroke: "#f59e0b", strokeWidth: 2 },
          });
        }
      });
      
      // Move to next category section
      const rowsUsed = Math.ceil(categoryTools.length / 5);
      currentY += rowsUsed * (toolNodeHeight + toolGapY) + categoryGapY;
    });

    // Artifact nodes (between agent and scratchpad)
    session?.artifacts.forEach((artifact, index) => {
      const artifactX = centerX + 180 + (index % 2) * 100;
      const artifactY = centerY - 80 + Math.floor(index / 2) * 80;
      
      const nodeId = `artifact-${artifact.id}`;
      newNodeIds.add(nodeId);

      newNodes.push({
        id: nodeId,
        type: "artifact",
        position: getPosition(nodeId, { x: artifactX, y: artifactY }),
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
        target: nodeId,
        style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "5,5" },
      });
    });

    // === RIGHT SIDE: Scratchpad ===
    
    const isWritingToScratchpad = activeToolIds.has("write_scratchpad");
    const scratchpadId = "scratchpad";
    newNodeIds.add(scratchpadId);
    
    // Get user-saved size or use defaults
    const userScratchpadSize = userSizesRef.current.get(scratchpadId);
    const scratchpadStyle = userScratchpadSize 
      ? { width: userScratchpadSize.width, height: userScratchpadSize.height }
      : { width: 320, height: 380 };
    
    newNodes.push({
      id: scratchpadId,
      type: "scratchpad",
      position: getPosition(scratchpadId, { x: scratchpadX, y: scratchpadY }),
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
