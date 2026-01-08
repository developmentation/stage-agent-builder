// Free Agent Canvas - Clustered tree layout for tools with instance support
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
import type { ToolInstance } from "@/types/toolInstance";

interface FreeAgentCanvasProps {
  session: FreeAgentSession | null;
  toolsManifest: ToolsManifest | null;
  activeToolIds: Set<string>;
  toolInstances?: ToolInstance[];
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

// Category order for tree layout (left to right clusters)
const CATEGORY_ORDER = [
  "utility", "web", "code", "memory", "file", "document", 
  "reasoning", "communication", "interaction", "generation", 
  "export", "api", "database", "advanced_self_author", "advanced_spawn"
];

// Cluster layout - tools arranged in category groups above agent
const LAYOUT = {
  // Agent position (center bottom of tree)
  agentX: 700,
  agentY: 900,
  
  // Tree cluster settings
  treeStartY: 300,           // Top of tree
  clusterGapX: 40,           // Gap between category clusters
  clusterStartX: -350,       // Left edge start
  
  // Tool node dimensions
  toolNodeWidth: 100,
  toolNodeHeight: 60,
  toolGapY: 70,              // Vertical gap between tools in cluster
  toolGapX: 105,             // Horizontal gap for multi-column clusters
  maxToolsPerColumn: 4,      // Tools per column before wrapping
  
  // Category label offset
  labelOffsetY: -30,
  
  // Left side - Prompt
  promptX: -100,
  promptY: 900,
  promptWidth: 260,
  promptHeight: 280,
  userFileGap: 70,
  
  // Right side - Scratchpad
  scratchpadX: 1150,
  scratchpadY: 900,
  scratchpadWidth: 300,
  scratchpadHeight: 280,
  artifactGap: 70,
  
  // Attributes
  attributeX: 1550,
  attributeY: 900,
  attributeGap: 65,
  attributeColumnGap: 220,
  attributesPerColumn: 10,
  
  // Child agents
  childOffsetY: 200,
  childSpacing: 180,
  childRowGap: 120,
  childrenPerRow: 3,
};

export function FreeAgentCanvas({
  session,
  toolsManifest,
  activeToolIds,
  toolInstances = [],
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

  // Build effective tools list: instances replace global tools
  const effectiveTools = useMemo(() => {
    if (!toolsManifest) return [];
    
    // Get all base tool IDs that have instances
    const toolsWithInstances = new Set(toolInstances.map(i => i.baseToolId));
    
    // Build the effective list
    const tools: Array<{
      id: string;           // Full tool ID (or instance ID)
      baseToolId: string;   // Base tool ID
      isInstance: boolean;
      instanceLabel?: string;
      instanceDescription?: string;
      category: string;
      name: string;
      icon?: string;
    }> = [];
    
    // Add all tools from manifest (skip those with instances)
    Object.entries(toolsManifest.tools).forEach(([toolId, tool]) => {
      if (!toolsWithInstances.has(toolId)) {
        const cat = Array.isArray(tool.category) ? tool.category[0] : tool.category;
        tools.push({
          id: toolId,
          baseToolId: toolId,
          isInstance: false,
          category: cat,
          name: tool.name,
          icon: tool.icon,
        });
      }
    });
    
    // Add all instances
    toolInstances.forEach(instance => {
      const baseTool = toolsManifest.tools[instance.baseToolId];
      if (baseTool) {
        const cat = Array.isArray(baseTool.category) ? baseTool.category[0] : baseTool.category;
        tools.push({
          id: instance.fullToolId,
          baseToolId: instance.baseToolId,
          isInstance: true,
          instanceLabel: instance.label,
          instanceDescription: instance.description,
          category: cat,
          name: instance.label,
          icon: baseTool.icon,
        });
      }
    });
    
    return tools;
  }, [toolsManifest, toolInstances]);

  // Group tools by category
  const toolsByCategory = useMemo(() => {
    const groups: Record<string, typeof effectiveTools> = {};
    effectiveTools.forEach(tool => {
      if (!groups[tool.category]) groups[tool.category] = [];
      groups[tool.category].push(tool);
    });
    return groups;
  }, [effectiveTools]);

  // Layout tools in clustered tree formation
  const layoutToolsInClusters = useCallback((
    toolsByCategory: Record<string, typeof effectiveTools>
  ): Array<{ 
    tool: typeof effectiveTools[0]; 
    x: number; 
    y: number;
    clusterCenterX: number;
    clusterCenterY: number;
  }> => {
    const positions: Array<{ 
      tool: typeof effectiveTools[0]; 
      x: number; 
      y: number;
      clusterCenterX: number;
      clusterCenterY: number;
    }> = [];
    
    let currentX = LAYOUT.clusterStartX;
    
    // Process categories in order
    CATEGORY_ORDER.forEach(category => {
      const categoryTools = toolsByCategory[category];
      if (!categoryTools || categoryTools.length === 0) return;
      
      // Calculate cluster dimensions
      const numColumns = Math.ceil(categoryTools.length / LAYOUT.maxToolsPerColumn);
      const clusterWidth = numColumns * LAYOUT.toolGapX;
      const clusterHeight = Math.min(categoryTools.length, LAYOUT.maxToolsPerColumn) * LAYOUT.toolGapY;
      
      const clusterCenterX = currentX + clusterWidth / 2;
      const clusterCenterY = LAYOUT.treeStartY + clusterHeight / 2;
      
      // Position each tool in the cluster
      categoryTools.forEach((tool, index) => {
        const column = Math.floor(index / LAYOUT.maxToolsPerColumn);
        const row = index % LAYOUT.maxToolsPerColumn;
        
        const x = currentX + column * LAYOUT.toolGapX;
        const y = LAYOUT.treeStartY + row * LAYOUT.toolGapY;
        
        positions.push({
          tool,
          x,
          y,
          clusterCenterX,
          clusterCenterY,
        });
      });
      
      // Move to next cluster position
      currentX += clusterWidth + LAYOUT.clusterGapX;
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

    // === TOOLS: Clustered tree layout above agent ===
    const toolPositions = layoutToolsInClusters(toolsByCategory);

    const currentIteration = session?.currentIteration || 0;
    const recentIterations = [currentIteration, currentIteration - 1].filter(i => i > 0);

    // Track cluster centers for category label positioning
    const clusterCenters: Record<string, { x: number; y: number }> = {};

    toolPositions.forEach(({ tool, x, y, clusterCenterX, clusterCenterY }) => {
      const nodeId = `tool-${tool.id}`;
      newNodeIds.add(nodeId);

      const isActive = activeToolIds.has(tool.id) || activeToolIds.has(tool.baseToolId);
      const wasUsedEver = session?.toolCalls.some((tc) => 
        (tc.tool === tool.id || tc.tool === tool.baseToolId) && tc.status === "completed"
      );

      // Determine if it's a read-type tool based on category
      const readCategories = ["utility", "web", "code", "memory", "file", "document", "api", "database"];
      const isReadTool = readCategories.includes(tool.category);
      
      // Get category color
      const categoryData = toolsManifest.categories?.[tool.category];
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
          toolId: tool.id,
          isInstance: tool.isInstance,
          instanceLabel: tool.instanceLabel,
        },
      });

      // Track cluster centers for category labels
      if (!clusterCenters[tool.category]) {
        clusterCenters[tool.category] = { x: clusterCenterX, y: clusterCenterY };
      }

      // Edge from tool to agent - persist after use
      if (isActive || wasUsedEver) {
        newEdges.push({
          id: `edge-tool-agent-${tool.id}`,
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

    // Add category labels above each cluster
    Object.entries(clusterCenters).forEach(([category, pos]) => {
      const labelId = `category-label-${category}`;
      newNodeIds.add(labelId);
      
      const categoryData = toolsManifest.categories?.[category];
      const categoryColor = categoryData?.color || "#6B7280";
      const categoryName = categoryData?.name || category.replace(/_/g, ' ');
      
      newNodes.push({
        id: labelId,
        type: "categoryLabel",
        position: { x: pos.x - 50, y: LAYOUT.treeStartY + LAYOUT.labelOffsetY },
        selectable: false,
        draggable: false,
        data: {
          type: "categoryLabel",
          label: categoryName,
          color: categoryColor,
        },
      });
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

    // === CHILD AGENTS: Below agent (3 per row with wrapping) ===
    if (session?.orchestration?.role === 'orchestrator' && session.orchestration.children) {
      const children = session.orchestration.children;
      const childStartY = LAYOUT.agentY + LAYOUT.childOffsetY;
      const childSpacing = LAYOUT.childSpacing;
      const childrenPerRow = LAYOUT.childrenPerRow;
      const rowGap = LAYOUT.childRowGap;
      
      children.forEach((child, index) => {
        const row = Math.floor(index / childrenPerRow);
        const col = index % childrenPerRow;
        const rowChildCount = Math.min(childrenPerRow, children.length - row * childrenPerRow);
        const rowWidth = (rowChildCount - 1) * childSpacing;
        const rowStartX = LAYOUT.agentX - rowWidth / 2 - 60;
        
        const childX = rowStartX + col * childSpacing;
        const childY = childStartY + row * rowGap;
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
          isBinary: attribute.isBinary,
          mimeType: attribute.mimeType,
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
  }, [toolsManifest, toolsByCategory, layoutToolsInClusters, session, activeToolIds, onScratchpadChange, onRetry]);

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
