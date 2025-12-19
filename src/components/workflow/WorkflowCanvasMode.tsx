import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  BackgroundVariant,
  NodeTypes,
  ConnectionLineType,
  MarkerType,
  ReactFlowProvider,
  Panel,
  addEdge,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './EdgeStyles.css';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlignVerticalJustifyCenter, AlignHorizontalJustifyCenter, Grid3x3, Map, StickyNote } from "lucide-react";
import type { Workflow, WorkflowNode, Stage as StageType, Note } from "@/types/workflow";
import { AgentSelector } from "@/components/AgentSelector";
import { FunctionSelector } from "@/components/FunctionSelector";
import { StageNode } from "./StageNode";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";
import { NoteNode } from "./NoteNode";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Internal component that has access to ReactFlow instance
function AddNoteButton({ onAddNote }: { onAddNote?: (x?: number, y?: number) => void }) {
  const reactFlowInstance = useReactFlow();

  const handleAddNote = () => {
    if (!onAddNote) return;
    
    const noteWidth = 200;
    const noteHeight = 200;
    
    // Find the actual container with dimensions by traversing up the DOM
    let container = document.querySelector('.react-flow__viewport')?.parentElement;
    
    // Keep going up until we find an element with actual dimensions
    while (container && (container.clientWidth === 0 || container.clientHeight === 0)) {
      container = container.parentElement;
    }
    
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const viewport = reactFlowInstance.getViewport();
      
      // Get the left sidebar width to account for it in centering
      const leftSidebar = document.querySelector('[data-sidebar="sidebar"]');
      const sidebarWidth = leftSidebar ? leftSidebar.getBoundingClientRect().width : 0;
      
      // Calculate available width and center after subtracting sidebar
      const availableWidth = containerRect.width - sidebarWidth;
      const visualCenterX = availableWidth / 2 + sidebarWidth; // Center of available area in screen coords
      const visualCenterY = containerRect.height / 2;
      
      // Convert to flow coordinates
      const centerFlowX = visualCenterX / viewport.zoom - viewport.x / viewport.zoom;
      const centerFlowY = visualCenterY / viewport.zoom - viewport.y / viewport.zoom;
      
      // Offset by half the note size to center the note on that point
      onAddNote(centerFlowX - noteWidth / 2, centerFlowY - noteHeight / 2);
    } else {
      // Fallback to default position
      onAddNote(100, 100);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          onClick={handleAddNote}
          size="sm"
          variant="outline"
          className="bg-[#fef3c7] hover:bg-[#fde68a] border-[#fde047]"
        >
          <StickyNote className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Add note</TooltipContent>
    </Tooltip>
  );
}

const nodeTypes: NodeTypes = {
  stage: StageNode,
  workflowNode: WorkflowNodeComponent,
  note: NoteNode,
};

interface WorkflowCanvasModeProps {
  workflow: Workflow;
  selectedNode: WorkflowNode | null;
  isConnecting: boolean;
  customAgents?: any[];
  onSelectNode: (nodeId: string | null) => void;
  onAddStage: () => void;
  onDeleteStage: (stageId: string) => void;
  onRenameStage: (stageId: string, newName: string) => void;
  onReorderStages: (sourceIndex: number, targetIndex: number) => void;
  onAddAgent: (stageId: string, agent: any) => void;
  onAddFunction: (stageId: string, functionDef: any) => void;
  onDeleteNode: (stageId: string, nodeId: string) => void;
  onRunAgent: (nodeId: string) => void;
  onStartConnection: (nodeId: string, outputPort?: string) => void;
  onPortClick: (nodeId: string, outputPort?: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onUpdateStagePosition: (stageId: string, position: { x: number; y: number }) => void;
  onUpdateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  onDeleteConnection?: (connectionId: string) => void;
  onCompleteConnection?: (fromNodeId: string, toNodeId: string, fromOutputPort?: string) => void;
  onToggleViewMode?: () => void;
  onAutoLayoutVertical?: () => void;
  onAutoLayoutHorizontal?: () => void;
  onAutoLayoutGrid?: () => void;
  onAddNote?: (x?: number, y?: number) => void;
  onUpdateNote?: (noteId: string, updates: Partial<Note>) => void;
  onDeleteNote?: (noteId: string) => void;
  onCloneNode?: (nodeId: string) => void;
  onCloneStage?: (stageId: string) => void;
  onRunStage?: (stageId: string) => void;
  onMoveNodeToStage?: (nodeId: string, fromStageId: string, toStageId: string) => void;
}

export function WorkflowCanvasMode({
  workflow,
  selectedNode,
  isConnecting,
  customAgents = [],
  onSelectNode,
  onAddStage,
  onDeleteStage,
  onRenameStage,
  onAddAgent,
  onAddFunction,
  onDeleteNode,
  onRunAgent,
  onStartConnection,
  onPortClick,
  onUpdateNode,
  onUpdateStagePosition,
  onUpdateNodePosition,
  onDeleteConnection,
  onCompleteConnection,
  onToggleViewMode,
  onAutoLayoutVertical,
  onAutoLayoutHorizontal,
  onAutoLayoutGrid,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onCloneNode,
  onCloneStage,
  onRunStage,
  onMoveNodeToStage,
}: WorkflowCanvasModeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showAddAgent, setShowAddAgent] = useState<string | null>(null);
  const [showAddFunction, setShowAddFunction] = useState<string | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const [crossStageDragNodeId, setCrossStageDragNodeId] = useState<string | null>(null);
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Keyboard shortcuts for copy/paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl (or Cmd on Mac) is pressed
      const isModifierPressed = e.ctrlKey || e.metaKey;
      
      // Ignore if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (isModifierPressed && e.key.toLowerCase() === 'c' && selectedNode) {
        e.preventDefault();
        setCopiedNodeId(selectedNode.id);
      } else if (isModifierPressed && e.key.toLowerCase() === 'v' && copiedNodeId && onCloneNode) {
        e.preventDefault();
        onCloneNode(copiedNodeId);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, copiedNodeId, onCloneNode]);

  // Calculate stage bounds - positioned directly from node bounding boxes
  const stageBounds = useMemo(() => {
    const bounds: Record<string, { x: number; y: number; width: number; height: number; minX: number; minY: number }> = {};
    
    const stagePaddingLeft = 40;
    const stagePaddingRight = 24; // 24 + 16 (p-4) = 40px effective
    const stagePaddingTop = 100; // Accounts for header + gap
    const stagePaddingBottom = 24; // 24 + 16 (p-4) = 40px effective
    const defaultNodeHeight = 150;
    
    // Function to calculate actual node width based on output ports
    const getNodeWidth = (node: WorkflowNode): number => {
      if (node.nodeType === "function") {
        const functionNode = node as import("@/types/workflow").FunctionNode;
        const outputPorts = functionNode.outputPorts || ["output"];
        const hasMultiplePorts = outputPorts.length > 1;
        
        if (hasMultiplePorts) {
          const minWidth = 200;
          const portSpacing = 30; // Match the spacing in WorkflowNodeComponent
          return Math.max(minWidth, outputPorts.length * portSpacing);
        }
      }
      return 250; // Default width
    };
    
    workflow.stages.forEach((stage) => {
      if (stage.nodes.length === 0) {
        // Empty stage gets default size at stage position
        const stageX = stage.position?.x ?? 0;
        const stageY = stage.position?.y ?? 0;
        bounds[stage.id] = { 
          x: stageX, 
          y: stageY, 
          width: 400, 
          height: 300,
          minX: stageX + stagePaddingLeft,
          minY: stageY + stagePaddingTop,
        };
        return;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
        const nodeWidth = getNodeWidth(node);
        const nodeHeight = defaultNodeHeight;
        
        // Calculate bounding box from node positions and actual sizes
        minX = Math.min(minX, nodeX);
        minY = Math.min(minY, nodeY);
        maxX = Math.max(maxX, nodeX + nodeWidth);
        maxY = Math.max(maxY, nodeY + nodeHeight);
      });

      // Use saved stage position if available, otherwise calculate from nodes
      let stageX: number;
      let stageY: number;
      
      if (stage.position !== undefined) {
        // Stage has a saved position - use it and adjust minX/minY accordingly
        stageX = stage.position.x;
        stageY = stage.position.y;
      } else {
        // No saved position - calculate from node bounding box with padding
        stageX = minX - stagePaddingLeft;
        stageY = minY - stagePaddingTop;
      }
      
      const stageWidth = (maxX - minX) + stagePaddingLeft + stagePaddingRight;
      const stageHeight = (maxY - minY) + stagePaddingTop + stagePaddingBottom;

      bounds[stage.id] = { 
        x: stageX, 
        y: stageY, 
        width: stageWidth, 
        height: stageHeight,
        minX,
        minY,
      };
    });
    
    return bounds;
  }, [workflow.stages]);

  // Convert workflow to ReactFlow nodes and edges
  useEffect(() => {
    const flowNodes: Node[] = [];
    const stagePaddingLeft = 40;
    const stagePaddingTop = 100;

    // Create all stage and node elements using pre-calculated bounds
    workflow.stages.forEach((stage, stageIndex) => {
      const bounds = stageBounds[stage.id] || { 
        x: 100, 
        y: stageIndex * 400, 
        width: 400, 
        height: 300,
        minX: 140,
        minY: 100 + stagePaddingTop,
      };

      // Add stage node - positioned directly from bounds
      flowNodes.push({
        id: `stage-${stage.id}`,
        type: 'stage',
        position: { x: bounds.x, y: bounds.y },
        data: {
          stage,
          onDelete: () => onDeleteStage(stage.id),
          onRename: (name: string) => onRenameStage(stage.id, name),
          onAddAgent: (template?: any) => {
            if (template) {
              onAddAgent(stage.id, template);
            } else {
              setShowAddAgent(stage.id);
            }
          },
          onAddFunction: (template?: any) => {
            if (template) {
              onAddFunction(stage.id, template);
            } else {
              setShowAddFunction(stage.id);
            }
          },
          onClone: onCloneStage ? () => onCloneStage(stage.id) : undefined,
          onRunStage: onRunStage ? () => onRunStage(stage.id) : undefined,
          width: bounds.width,
          height: bounds.height,
          isDropTarget: crossStageDragNodeId && hoveredStageId === stage.id,
        },
        style: {
          width: bounds.width,
          height: bounds.height,
          zIndex: 1,
        },
        draggable: true,
      });

      // Add workflow nodes within the stage - position relative to stage bounds
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;

        // Position node relative to the stage's calculated bounds
        const relativeX = nodeX - bounds.minX + stagePaddingLeft;
        const relativeY = nodeY - bounds.minY + stagePaddingTop;

        flowNodes.push({
          id: node.id,
          type: 'workflowNode',
          position: { x: relativeX, y: relativeY },
          data: {
            node,
            selected: selectedNode?.id === node.id,
            isConnecting,
            onSelect: () => onSelectNode(node.id),
            onDelete: () => onDeleteNode(stage.id, node.id),
            onRun: () => onRunAgent(node.id),
            onPortClick: (outputPort?: string) => onPortClick(node.id, outputPort),
            onToggleLock: () => onUpdateNode(node.id, { locked: !node.locked }),
          },
          parentNode: `stage-${stage.id}`,
          draggable: true,
          style: {
            zIndex: 10,
          },
        });
      });
    });

    // Add note nodes
    workflow.notes?.forEach((note) => {
      flowNodes.push({
        id: note.id,
        type: 'note',
        position: note.position,
        data: {
          note,
          onUpdate: (updates: Partial<Note>) => {
            onUpdateNote?.(note.id, updates);
          },
          onDelete: () => {
            onDeleteNote?.(note.id);
          },
        },
        draggable: true,
        style: {
          zIndex: 5, // Below workflow nodes but above stages
        },
      });
    });

    setNodes(flowNodes);

    // Create edges from connections with proper styling
    const flowEdges: Edge[] = workflow.connections.map((conn) => ({
      id: conn.id,
      source: conn.fromNodeId,
      target: conn.toNodeId,
      sourceHandle: conn.fromOutputPort,
      type: 'default', // Use default for smooth bezier curves
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: 'hsl(var(--primary))',
      },
      style: { 
        stroke: 'hsl(var(--primary))', 
        strokeWidth: 2,
      },
      // Style when selected
      className: 'workflow-edge',
      zIndex: 100,
    }));

    setEdges(flowEdges);
  }, [workflow, selectedNode, isConnecting, stageBounds, onUpdateNote, onDeleteNote]);

  // Handle connection between nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      console.log("=== Canvas onConnect START ===");
      console.log("Connection object:", JSON.stringify(connection, null, 2));
      console.log("Current workflow connections before:", workflow.connections.length);
      
      if (connection.source && connection.target && onCompleteConnection) {
        const fromNodeId = connection.source;
        const toNodeId = connection.target;
        const fromOutputPort = connection.sourceHandle || undefined;
        
        console.log("Preparing to call onCompleteConnection with:");
        console.log("  fromNodeId:", fromNodeId);
        console.log("  toNodeId:", toNodeId);
        console.log("  fromOutputPort:", fromOutputPort);
        
        // Call the parent's connection completion handler
        onCompleteConnection(fromNodeId, toNodeId, fromOutputPort);
        
        console.log("onCompleteConnection called");
        console.log("=== Canvas onConnect END ===");
      } else {
        console.log("Connection not created - missing source, target, or handler");
        console.log("  has source:", !!connection.source);
        console.log("  has target:", !!connection.target);
        console.log("  has onCompleteConnection:", !!onCompleteConnection);
      }
    },
    [onCompleteConnection, workflow.connections.length]
  );

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      console.log("Canvas onEdgesDelete triggered:", edgesToDelete);
      if (!onDeleteConnection) {
        console.log("No onDeleteConnection handler provided");
        return;
      }
      
      edgesToDelete.forEach((edge) => {
        // Find the corresponding workflow connection and delete it
        const connection = workflow.connections.find(
          (c) => c.id === edge.id
        );
        console.log("Found connection to delete:", connection);
        if (connection) {
          onDeleteConnection(connection.id);
        }
      });
    },
    [workflow.connections, onDeleteConnection]
  );

  // Handle node drag start to detect Alt+drag for cross-stage movement
  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (event.altKey && node.parentNode && !node.id.startsWith('stage-') && !node.id.startsWith('note-')) {
        setCrossStageDragNodeId(node.id);
      }
    },
    []
  );

  // Handle node drag to highlight target stages
  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!crossStageDragNodeId || crossStageDragNodeId !== node.id) return;
      
      // Find which stage the mouse is over based on node position and stage bounds
      for (const stage of workflow.stages) {
        const bounds = stageBounds[stage.id];
        if (!bounds) continue;
        
        // Check if node center is within stage bounds
        const nodeCenter = {
          x: node.position.x + (node.parentNode ? stageBounds[node.parentNode.replace('stage-', '')]?.x || 0 : 0),
          y: node.position.y + (node.parentNode ? stageBounds[node.parentNode.replace('stage-', '')]?.y || 0 : 0),
        };
        
        if (
          nodeCenter.x >= bounds.x &&
          nodeCenter.x <= bounds.x + bounds.width &&
          nodeCenter.y >= bounds.y &&
          nodeCenter.y <= bounds.y + bounds.height
        ) {
          setHoveredStageId(stage.id);
          return;
        }
      }
      setHoveredStageId(null);
    },
    [crossStageDragNodeId, workflow.stages, stageBounds]
  );

  // Handle node drag end to update positions
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node, nodes: Node[]) => {
      // Check for cross-stage drag completion
      if (crossStageDragNodeId === node.id && event.altKey && onMoveNodeToStage && hoveredStageId) {
        const currentStage = workflow.stages.find(s => `stage-${s.id}` === node.parentNode);
        if (currentStage && hoveredStageId !== currentStage.id) {
          onMoveNodeToStage(node.id, currentStage.id, hoveredStageId);
        }
        setCrossStageDragNodeId(null);
        setHoveredStageId(null);
        return;
      }
      
      // Reset cross-stage drag state
      setCrossStageDragNodeId(null);
      setHoveredStageId(null);

      if (node.id.startsWith('note-')) {
        const noteId = node.id;
        onUpdateNote?.(noteId, { position: node.position });
      } else if (node.id.startsWith('stage-')) {
        const stageId = node.id.replace('stage-', '');
        const stage = workflow.stages.find(s => s.id === stageId);
        if (!stage) return;

        const oldBounds = stageBounds[stageId];
        const deltaX = node.position.x - oldBounds.x;
        const deltaY = node.position.y - oldBounds.y;

        if (stage.nodes.length === 0) {
          onUpdateStagePosition(stageId, { x: node.position.x, y: node.position.y });
        } else {
          onUpdateStagePosition(stageId, { x: node.position.x, y: node.position.y });
          stage.nodes.forEach((workflowNode) => {
            const currentX = workflowNode.position?.x ?? 0;
            const currentY = workflowNode.position?.y ?? 0;
            onUpdateNodePosition(workflowNode.id, { x: currentX + deltaX, y: currentY + deltaY });
          });
        }
      } else if (node.parentNode) {
        const stage = workflow.stages.find(s => `stage-${s.id}` === node.parentNode);
        if (!stage) return;

        const bounds = stageBounds[stage.id];
        const stagePaddingLeft = 40;
        const stagePaddingTop = 100;

        const absoluteX = bounds.minX + (node.position.x - stagePaddingLeft);
        const absoluteY = bounds.minY + (node.position.y - stagePaddingTop);

        onUpdateNodePosition(node.id, { x: absoluteX, y: absoluteY });
      }
    },
    [workflow.stages, stageBounds, onUpdateNodePosition, onUpdateStagePosition, onUpdateNote, crossStageDragNodeId, hoveredStageId, onMoveNodeToStage]
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.Bezier}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          deleteKeyCode="Delete"
          defaultEdgeOptions={{
            type: 'default',
            animated: true,
          }}
          edgesUpdatable={false}
          edgesFocusable={true}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          {showMiniMap && (
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="bg-background/80 backdrop-blur-sm"
            />
          )}
          <Panel position="top-left">
            <Card className="p-2">
              <TooltipProvider>
                <div className="flex gap-2">
                  <AddNoteButton onAddNote={onAddNote} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={onAutoLayoutVertical} 
                        size="sm"
                        variant="outline"
                      >
                        <AlignVerticalJustifyCenter className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Arrange vertically</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={onAutoLayoutHorizontal} 
                        size="sm"
                        variant="outline"
                      >
                        <AlignHorizontalJustifyCenter className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Arrange horizontally</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={onAutoLayoutGrid} 
                        size="sm"
                        variant="outline"
                      >
                        <Grid3x3 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Arrange in grid</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={() => setShowMiniMap(!showMiniMap)} 
                        size="sm"
                        variant={showMiniMap ? "default" : "outline"}
                      >
                        <Map className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle mini map</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </Card>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>

      {/* Agent Selector Dialog */}
      {showAddAgent && (
        <AgentSelector
          open={true}
          onOpenChange={(open) => !open && setShowAddAgent(null)}
          onSelectAgent={(agent) => {
            onAddAgent(showAddAgent, agent);
            setShowAddAgent(null);
          }}
          customAgents={customAgents}
        />
      )}

      {/* Function Selector Dialog */}
      {showAddFunction && (
        <FunctionSelector
          open={true}
          onOpenChange={(open) => !open && setShowAddFunction(null)}
          onSelectFunction={(functionDef) => {
            onAddFunction(showAddFunction, functionDef);
            setShowAddFunction(null);
          }}
        />
      )}
    </div>
  );
}
