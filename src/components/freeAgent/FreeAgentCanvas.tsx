// Free Agent Canvas - Main visualization component with arc-based tool layout
import React, { useMemo, useCallback, useRef } from "react";
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
import { AttributeNode } from "./AttributeNode";
import { ChildAgentNode } from "./ChildAgentNode";
import { CategoryLabelNode } from "./CategoryLabelNode";
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
  onAttributeClick?: (attributeName: string) => void;
  onRetry?: () => void;
  onChildClick?: (childName: string) => void;
}

const nodeTypes = {
  agent: FreeAgentNode,
  tool: ToolNode,
  artifact: ArtifactNode,
  file: FileNode,
  scratchpad: ScratchpadNode,
  prompt: PromptNode,
  promptFile: PromptFileNode,
  attribute: AttributeNode,
  childAgent: ChildAgentNode,
  categoryLabel: CategoryLabelNode,
};

// Read tools - gather/retrieve information
const READ_TOOLS = [
  "brave_search", "google_search", "web_scrape",
  "read_github_repo", "read_github_file",
  "read_blackboard", "read_scratchpad", "read_prompt", "read_prompt_files",
  "read_file", "read_zip_contents", "read_zip_file", "extract_zip_files",
  "pdf_info", "pdf_extract_text", "ocr_image",
  "get_call_api", "get_time", "get_weather",
];

// Write tools - create/send/modify
const WRITE_TOOLS = [
  "write_blackboard", "write_scratchpad",
  "send_email", "request_assistance",
  "post_call_api", "execute_sql",
  "export_word", "export_pdf", "image_generation", "elevenlabs_tts",
];

// All tools combined
const ALL_TOOLS = [...READ_TOOLS, ...WRITE_TOOLS];

// Layout dimensions - Concentric arcs layout
const LAYOUT = {
  // Agent centered between prompt and scratchpad
  agentX: 500,
  agentY: 600,
  
  // Concentric arcs for tools (above agent) - 50% larger radii with more spread
  arcs: [
    { radius: 550, categories: ["utility", "api", "database", "web", "code"] },
    { radius: 420, categories: ["memory", "file", "document", "reasoning"] },
    { radius: 310, categories: ["communication", "interaction", "generation", "export", "advanced_self_author", "advanced_spawn"] },
  ],
  toolArcStartAngle: -170,   // Even wider arc spread (degrees)
  toolArcEndAngle: -10,
  toolNodeWidth: 100,
  toolNodeHeight: 60,
  
  // Left side - Prompt
  promptX: -80,
  promptY: 420,
  promptWidth: 260,
  promptHeight: 280,
  userFileGap: 70,
  
  // Right side - Scratchpad (closer to center)
  scratchpadX: 820,
  scratchpadY: 420,
  scratchpadWidth: 300,
  scratchpadHeight: 280,
  artifactGap: 70,
  
  // Attributes - right of scratchpad
  attributeX: 1200,
  attributeGap: 65,
  attributeColumnGap: 220,
  attributesPerColumn: 10,
  
  // Child agents - below agent
  childOffsetY: 280,
};

export function FreeAgentCanvas({
  session,
  toolsManifest,
  activeToolIds,
  onToolClick,
  onArtifactClick,
  onFileClick,
  onScratchpadChange,
  onAttributeClick,
  onRetry,
  onChildClick,
}: FreeAgentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const userPositionsRef = useRef<Map<string, XYPosition>>(new Map());
  const userSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map());
  const existingNodeIdsRef = useRef<Set<string>>(new Set());

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

  // Group tools by category
  const toolsByCategory = useMemo(() => {
    if (!toolsManifest) return {};
    
    const groups: Record<string, string[]> = {};
    ALL_TOOLS.forEach(toolId => {
      const tool = toolsManifest.tools[toolId];
      if (!tool) return;
      const cat = Array.isArray(tool.category) ? tool.category[0] : tool.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(toolId);
    });
    return groups;
  }, [toolsManifest]);

  // Layout tools in concentric arcs grouped by category
  const layoutToolsInConcentricArcs = useCallback((
    toolsByCategory: Record<string, string[]>,
    centerX: number,
    centerY: number
  ): Array<{ id: string; x: number; y: number; category: string; arcIndex: number }> => {
    const positions: Array<{ id: string; x: number; y: number; category: string; arcIndex: number }> = [];
    
    LAYOUT.arcs.forEach((arc, arcIndex) => {
      // Get tools for this arc's categories
      const arcTools: Array<{ id: string; category: string }> = [];
      arc.categories.forEach(cat => {
        (toolsByCategory[cat] || []).forEach(toolId => {
          arcTools.push({ id: toolId, category: cat });
        });
      });
      
      if (arcTools.length === 0) return;
      
      // Calculate angle range for this arc
      const angleRange = LAYOUT.toolArcEndAngle - LAYOUT.toolArcStartAngle;
      const angleStep = angleRange / (arcTools.length + 1);
      
      arcTools.forEach((tool, index) => {
        const angle = (LAYOUT.toolArcStartAngle + angleStep * (index + 1)) * (Math.PI / 180);
        positions.push({
          id: tool.id,
          x: centerX + arc.radius * Math.cos(angle) - LAYOUT.toolNodeWidth / 2,
          y: centerY + arc.radius * Math.sin(angle) - LAYOUT.toolNodeHeight / 2,
          category: tool.category,
          arcIndex,
        });
      });
    });
    
    return positions;
  }, []);

  const generateLayout = useCallback(() => {
    if (!toolsManifest) return { nodes: [], edges: [] };

    const newNodes: Node<FreeAgentNodeData>[] = [];
    const newEdges: Edge[] = [];
    const newNodeIds = new Set<string>();

    const getPosition = (nodeId: string, defaultPos: XYPosition): XYPosition => {
      const userPos = userPositionsRef.current.get(nodeId);
      if (userPos && existingNodeIdsRef.current.has(nodeId)) {
        return userPos;
      }
      return defaultPos;
    };

    // === LEFT SIDE: Prompt ===
    const promptId = "prompt";
    newNodeIds.add(promptId);
    
    const userPromptSize = userSizesRef.current.get(promptId);
    const promptStyle = userPromptSize 
      ? { width: userPromptSize.width, height: userPromptSize.height }
      : { width: LAYOUT.promptWidth, height: LAYOUT.promptHeight };
    
    newNodes.push({
      id: promptId,
      type: "prompt",
      position: getPosition(promptId, { x: LAYOUT.promptX, y: LAYOUT.promptY }),
      style: promptStyle,
      data: {
        type: "prompt",
        label: "User Prompt",
        content: session?.prompt || "",
        status: "idle",
      },
    });

    newEdges.push({
      id: "edge-prompt-agent",
      source: "prompt",
      target: "agent",
      targetHandle: "left",
      style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: session?.prompt ? undefined : "5,5" },
    });

    // User files below prompt
    session?.sessionFiles.forEach((file, index) => {
      const fileY = LAYOUT.promptY + LAYOUT.promptHeight + 20 + (index * LAYOUT.userFileGap);
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

      newEdges.push({
        id: `edge-promptFile-agent-${file.id}`,
        source: fileId,
        target: "agent",
        targetHandle: "left",
        style: { stroke: "#10b981", strokeWidth: 1, strokeDasharray: "3,3" },
      });
    });

    // === TOOLS: Concentric arcs layout above agent ===
    const toolPositions = layoutToolsInConcentricArcs(
      toolsByCategory,
      LAYOUT.agentX,
      LAYOUT.agentY
    );

    const currentIteration = session?.currentIteration || 0;
    const recentIterations = [currentIteration, currentIteration - 1].filter(i => i > 0);

    // Track categories for labels
    const categoryPositions: Record<string, { x: number; y: number; count: number }> = {};

    toolPositions.forEach(({ id: toolId, x, y, category }) => {
      const tool = toolsManifest.tools[toolId];
      if (!tool) return;

      const nodeId = `tool-${toolId}`;
      newNodeIds.add(nodeId);

      const isActive = activeToolIds.has(toolId);
      const wasUsedEver = session?.toolCalls.some((tc) => tc.tool === toolId && tc.status === "completed");
      const wasUsedRecently = session?.toolCalls.some(
        (tc) => tc.tool === toolId && tc.status === "completed" && recentIterations.includes(tc.iteration)
      );

      const isReadTool = READ_TOOLS.includes(toolId);
      
      // Get category color
      const categoryData = toolsManifest.categories?.[category];
      const categoryColor = categoryData?.color || "#6B7280";

      newNodes.push({
        id: nodeId,
        type: "tool",
        position: getPosition(nodeId, { x, y }),
        data: {
          type: "tool",
          label: tool.name,
          status: isActive ? "active" : wasUsedEver ? "success" : "idle",
          icon: tool.icon,
          category: tool.category,
          categoryColor,
          toolId,
        },
      });

      // Track for category labels
      if (!categoryPositions[category]) {
        categoryPositions[category] = { x, y, count: 1 };
      } else {
        categoryPositions[category].x = (categoryPositions[category].x + x) / 2;
        categoryPositions[category].y = Math.min(categoryPositions[category].y, y);
        categoryPositions[category].count++;
      }

      // Edge from tool to agent
      if (isActive || wasUsedRecently) {
        newEdges.push({
          id: `edge-tool-agent-${toolId}`,
          source: nodeId,
          sourceHandle: "bottom",
          target: "agent",
          targetHandle: "top",
          animated: isActive,
          style: { 
            stroke: isReadTool ? "#3b82f6" : "#f59e0b", 
            strokeWidth: isActive ? 2 : 1.5 
          },
        });
      }
    });

    // Category labels removed for cleaner look

    // === CENTER: Agent ===
    const isWaitingForChildren = session?.status === 'waiting' || (
      session?.orchestration?.role === 'orchestrator' && 
      session?.orchestration?.awaitingChildren === true
    );
    
    const agentStatus = isWaitingForChildren 
      ? "idle"
      : session?.status === "running" 
        ? "thinking" 
        : session?.status === "completed" 
          ? "success" 
          : session?.status === "error" 
            ? "error" 
            : session?.status === "paused"
              ? "paused"
              : "idle";

    const agentId = "agent";
    newNodeIds.add(agentId);
    newNodes.push({
      id: agentId,
      type: "agent",
      position: getPosition(agentId, { x: LAYOUT.agentX - 60, y: LAYOUT.agentY - 60 }),
      data: {
        type: "agent",
        label: "Free Agent",
        status: agentStatus,
        isWaiting: isWaitingForChildren,
        iteration: session?.currentIteration || 0,
        reasoning: session?.messages[session.messages.length - 1]?.content,
        retryCount: session?.retryCount,
        onRetry: (agentStatus === "error" || agentStatus === "paused") ? onRetry : undefined,
      },
    });

    // === CHILD AGENTS: Below agent ===
    if (session?.orchestration?.role === 'orchestrator' && session.orchestration.children) {
      const children = session.orchestration.children;
      const childStartY = LAYOUT.agentY + LAYOUT.childOffsetY;
      const childSpacing = 160;
      const totalWidth = (children.length - 1) * childSpacing;
      const startX = LAYOUT.agentX - totalWidth / 2 - 60;
      
      children.forEach((child, index) => {
        const childX = startX + index * childSpacing;
        const childY = childStartY;
        const childNodeId = `child-${child.name}`;
        newNodeIds.add(childNodeId);
        
        const childStatus = child.status === 'running' ? 'thinking' : 
                           child.status === 'completed' ? 'success' : 
                           child.status === 'error' ? 'error' : 'idle';
        
        newNodes.push({
          id: childNodeId,
          type: 'childAgent',
          position: getPosition(childNodeId, { x: childX, y: childY }),
          data: {
            type: 'childAgent',
            label: child.name,
            childName: child.name,
            status: childStatus,
            task: child.task,
            currentIteration: child.currentIteration,
            maxIterations: child.maxIterations,
          },
        });
        
        newEdges.push({
          id: `edge-orchestrator-${child.name}`,
          source: 'agent',
          target: childNodeId,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          animated: child.status === 'running',
          style: { stroke: '#f59e0b', strokeWidth: 2 },
        });
      });
    }

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
      position: getPosition(scratchpadId, { x: LAYOUT.scratchpadX, y: LAYOUT.scratchpadY }),
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

    // === Artifacts: Below scratchpad ===
    session?.artifacts.forEach((artifact, index) => {
      const artifactY = LAYOUT.scratchpadY + LAYOUT.scratchpadHeight + 20 + (index * LAYOUT.artifactGap);
      
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

      newEdges.push({
        id: `edge-agent-artifact-${artifact.id}`,
        source: "agent",
        sourceHandle: "right",
        target: nodeId,
        style: { stroke: "#10b981", strokeWidth: 1.5, strokeDasharray: "5,5" },
      });
    });

    // === Attributes: Right of scratchpad ===
    const attributeEntries = Object.entries(session?.toolResultAttributes || {});
    attributeEntries.forEach(([name, attribute], index) => {
      const column = Math.floor(index / LAYOUT.attributesPerColumn);
      const row = index % LAYOUT.attributesPerColumn;
      
      const attributeX = LAYOUT.attributeX + (column * LAYOUT.attributeColumnGap);
      const attributeY = LAYOUT.scratchpadY + (row * LAYOUT.attributeGap);
      
      const nodeId = `attribute-${name}`;
      newNodeIds.add(nodeId);

      newNodes.push({
        id: nodeId,
        type: "attribute",
        position: getPosition(nodeId, { x: attributeX, y: attributeY }),
        data: {
          type: "attribute",
          label: name,
          status: "success",
          attributeName: name,
          attributeTool: attribute.tool,
          attributeValue: attribute.resultString,
          size: attribute.size,
          iteration: attribute.iteration,
        },
      });

      newEdges.push({
        id: `edge-scratchpad-attribute-${name}`,
        source: "scratchpad",
        sourceHandle: "attributes",
        target: nodeId,
        style: { stroke: "#06b6d4", strokeWidth: 1.5 },
      });
    });

    existingNodeIdsRef.current = newNodeIds;

    return { nodes: newNodes, edges: newEdges };
  }, [toolsManifest, toolsByCategory, layoutToolsInConcentricArcs, session, activeToolIds, onScratchpadChange, onRetry]);

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
      } else if (node.type === "attribute" && onAttributeClick) {
        onAttributeClick(node.data.attributeName);
      } else if (node.type === "childAgent" && onChildClick) {
        onChildClick(node.data.childName);
      }
    },
    [onToolClick, onArtifactClick, onFileClick, onAttributeClick, onChildClick]
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
          minZoom={0.1}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-left"
        >
          <Background color="#374151" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === "categoryLabel") return "transparent";
              if (node.type === "scratchpad") return "#f59e0b";
              if (node.type === "prompt") return "#3b82f6";
              if (node.type === "promptFile") return "#10b981";
              if (node.type === "childAgent") return "#f59e0b";
              if (node.data?.categoryColor) return node.data.categoryColor;
              if (node.data?.status === "active" || node.data?.status === "thinking") return "#f59e0b";
              if (node.data?.status === "success") return "#10b981";
              if (node.data?.status === "error") return "#ef4444";
              if (node.data?.status === "waiting") return "#f59e0b";
              return "#6b7280";
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
          />
          <Panel position="top-left" className="bg-background/80 backdrop-blur-sm p-2 rounded-lg border">
            <div className="text-sm font-medium">
              {session ? (
                <span>
                  Iteration {session.currentIteration} / {session.maxIterations}
                  {session.status === 'waiting' && session.orchestration?.children && (
                    <span className="ml-2 text-amber-500">
                      (Waiting for {session.orchestration.children.filter(c => c.status === 'running').length} children)
                    </span>
                  )}
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
