import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import { StickyNote as StickyNoteIcon, Type, Square, Circle, Triangle, Pencil, Plus } from "lucide-react";
import type { Workflow, WorkflowNode, Stage as StageType, StickyNote as StickyNoteType, TextBox as TextBoxType, Shape as ShapeType, Drawing as DrawingType } from "@/types/workflow";
import { AgentSelector } from "@/components/AgentSelector";
import { FunctionSelector } from "@/components/FunctionSelector";
import { StageNode } from "./StageNode";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

import { StickyNoteNode } from "./StickyNoteNode";
import { TextBoxNode } from "./TextBoxNode";
import { ShapeNode } from "./ShapeNode";
import { DrawingNode } from "./DrawingNode";

// Define nodeTypes outside component to prevent recreation on every render
const NODE_TYPES: NodeTypes = {
  stage: StageNode,
  workflowNode: WorkflowNodeComponent,
  stickyNote: StickyNoteNode,
  textBox: TextBoxNode,
  shape: ShapeNode,
  drawing: DrawingNode,
};

interface WorkflowCanvasModeProps {
  workflow: Workflow;
  selectedNode: WorkflowNode | null;
  isConnecting: boolean;
  onSelectNode: (nodeId: string | null) => void;
  onAddStage: () => void;
  onDeleteStage: (stageId: string) => void;
  onRenameStage: (stageId: string, newName: string) => void;
  onReorderStages: (sourceIndex: number, targetIndex: number) => void;
  onAddAgent: (stageId: string, agent: any) => void;
  onAddFunction: (stageId: string, functionType: string) => void;
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
  onAddStickyNote?: (position?: { x: number; y: number }) => void;
  onUpdateStickyNote?: (id: string, updates: Partial<StickyNoteType>) => void;
  onDeleteStickyNote?: (id: string) => void;
  onAddTextBox?: (position?: { x: number; y: number }) => void;
  onUpdateTextBox?: (id: string, updates: Partial<TextBoxType>) => void;
  onDeleteTextBox?: (id: string) => void;
  onAddShape?: (type: "rectangle" | "circle" | "triangle", position?: { x: number; y: number }) => void;
  onUpdateShape?: (id: string, updates: Partial<ShapeType>) => void;
  onDeleteShape?: (id: string) => void;
  onAddDrawing?: (path: string, position: { x: number; y: number }) => void;
  onDeleteDrawing?: (id: string) => void;
  drawingMode?: boolean;
  onSetDrawingMode?: (enabled: boolean) => void;
}

export function WorkflowCanvasMode({
  workflow,
  selectedNode,
  isConnecting,
  onSelectNode,
  onAddStage,
  onDeleteStage,
  onRenameStage,
  onReorderStages,
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
  onAddStickyNote,
  onUpdateStickyNote,
  onDeleteStickyNote,
  onAddTextBox,
  onUpdateTextBox,
  onDeleteTextBox,
  onAddShape,
  onUpdateShape,
  onDeleteShape,
  onAddDrawing,
  onDeleteDrawing,
  drawingMode,
  onSetDrawingMode,
}: WorkflowCanvasModeProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasModeInner
        workflow={workflow}
        selectedNode={selectedNode}
        isConnecting={isConnecting}
        onSelectNode={onSelectNode}
        onAddStage={onAddStage}
        onDeleteStage={onDeleteStage}
        onRenameStage={onRenameStage}
        onReorderStages={onReorderStages}
        onAddAgent={onAddAgent}
        onAddFunction={onAddFunction}
        onDeleteNode={onDeleteNode}
        onRunAgent={onRunAgent}
        onStartConnection={onStartConnection}
        onPortClick={onPortClick}
        onUpdateNode={onUpdateNode}
        onUpdateStagePosition={onUpdateStagePosition}
        onUpdateNodePosition={onUpdateNodePosition}
        onDeleteConnection={onDeleteConnection}
        onCompleteConnection={onCompleteConnection}
        onToggleViewMode={onToggleViewMode}
        onAddStickyNote={onAddStickyNote}
        onUpdateStickyNote={onUpdateStickyNote}
        onDeleteStickyNote={onDeleteStickyNote}
        onAddTextBox={onAddTextBox}
        onUpdateTextBox={onUpdateTextBox}
        onDeleteTextBox={onDeleteTextBox}
        onAddShape={onAddShape}
        onUpdateShape={onUpdateShape}
        onDeleteShape={onDeleteShape}
        onAddDrawing={onAddDrawing}
        onDeleteDrawing={onDeleteDrawing}
        drawingMode={drawingMode}
        onSetDrawingMode={onSetDrawingMode}
      />
    </ReactFlowProvider>
  );
}

function WorkflowCanvasModeInner({
  workflow,
  selectedNode,
  isConnecting,
  onSelectNode,
  onAddStage,
  onDeleteStage,
  onRenameStage,
  onReorderStages,
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
  onAddStickyNote,
  onUpdateStickyNote,
  onDeleteStickyNote,
  onAddTextBox,
  onUpdateTextBox,
  onDeleteTextBox,
  onAddShape,
  onUpdateShape,
  onDeleteShape,
  onAddDrawing,
  onDeleteDrawing,
  drawingMode,
  onSetDrawingMode,
}: WorkflowCanvasModeProps) {
  const { project, getViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showAddAgent, setShowAddAgent] = useState<string | null>(null);
  const [showAddFunction, setShowAddFunction] = useState<string | null>(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);
  const [isDrawingPath, setIsDrawingPath] = useState(false);
  const [drawingPath, setDrawingPath] = useState<Array<{x: number, y: number}>>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Get viewport center for placing new elements
  const getViewportCenter = useCallback(() => {
    const viewport = getViewport();
    const canvasCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    
    // Convert screen coordinates to flow coordinates
    return project({
      x: canvasCenter.x,
      y: canvasCenter.y,
    });
  }, [getViewport, project]);

  // Calculate stage bounds and offset - memoized to prevent recalculation during dragging
  const stageBounds = useMemo(() => {
    const bounds: Record<string, { width: number; height: number; offsetX: number; offsetY: number }> = {};
    
    const stagePadding = 40;
    const stageHeaderHeight = 60;
    const nodeWidth = 250;
    const nodeHeight = 150;
    
    workflow.stages.forEach((stage) => {
      if (stage.nodes.length === 0) {
        bounds[stage.id] = { width: 400, height: 300, offsetX: 0, offsetY: 0 };
        return;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
        
        // Account for full node dimensions
        minX = Math.min(minX, nodeX);
        minY = Math.min(minY, nodeY);
        maxX = Math.max(maxX, nodeX + nodeWidth);
        maxY = Math.max(maxY, nodeY + nodeHeight);
      });

      // Calculate offset needed if nodes go negative
      const offsetX = Math.min(0, minX - stagePadding);
      const offsetY = Math.min(0, minY - stageHeaderHeight);

      const stageWidth = Math.max(400, maxX - minX + stagePadding * 2);
      const stageHeight = Math.max(300, maxY - minY + stageHeaderHeight + stagePadding);

      bounds[stage.id] = { width: stageWidth, height: stageHeight, offsetX, offsetY };
    });
    
    return bounds;
  }, [workflow.stages]);

  // Convert workflow to ReactFlow nodes and edges
  useEffect(() => {
    const flowNodes: Node[] = [];
    const stagePadding = 40;
    const stageHeaderHeight = 60;

    // Create all stage and node elements using pre-calculated bounds
    workflow.stages.forEach((stage, stageIndex) => {
      const stageX = stage.position?.x ?? 100;
      const stageY = stage.position?.y ?? stageIndex * 400;
      const bounds = stageBounds[stage.id] || { width: 400, height: 300, offsetX: 0, offsetY: 0 };

      // Add stage node
      flowNodes.push({
        id: `stage-${stage.id}`,
        type: 'stage',
        position: { x: stageX + bounds.offsetX, y: stageY + bounds.offsetY },
        data: {
          stage,
          onDelete: () => onDeleteStage(stage.id),
          onRename: (name: string) => onRenameStage(stage.id, name),
          onAddAgent: () => setShowAddAgent(stage.id),
          onAddFunction: () => setShowAddFunction(stage.id),
          width: bounds.width,
          height: bounds.height,
        },
        style: {
          width: bounds.width,
          height: bounds.height,
          zIndex: 1,
        },
        draggable: true,
      });

      // Add workflow nodes within the stage
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;

        flowNodes.push({
          id: node.id,
          type: 'workflowNode',
          position: { x: stagePadding + nodeX - bounds.offsetX, y: stageHeaderHeight + nodeY - bounds.offsetY },
          data: {
            node,
            selected: selectedNode?.id === node.id,
            isConnecting,
            onSelect: () => onSelectNode(node.id),
            onDelete: () => onDeleteNode(stage.id, node.id),
            onRun: () => onRunAgent(node.id),
            onPortClick: (outputPort?: string) => onPortClick(node.id, outputPort),
          },
          parentNode: `stage-${stage.id}`,
          draggable: true,
          style: {
            zIndex: 10,
          },
        });
      });
    });

    // Add sticky notes
    const stickyNotes = workflow.stickyNotes || [];
    stickyNotes.forEach((note) => {
      flowNodes.push({
        id: `sticky-${note.id}`,
        type: 'stickyNote',
        position: note.position,
        data: {
          note,
          onUpdate: onUpdateStickyNote,
          onDelete: onDeleteStickyNote,
        },
        draggable: !drawingMode,
        selectable: !drawingMode,
        style: {
          zIndex: note.zIndex || 5,
        },
      });
    });

    // Add text boxes
    const textBoxes = workflow.textBoxes || [];
    textBoxes.forEach((textBox) => {
      const isEditingThis = editingTextBoxId === textBox.id;
      flowNodes.push({
        id: `textbox-${textBox.id}`,
        type: 'textBox',
        position: textBox.position,
        data: {
          textBox,
          onUpdate: onUpdateTextBox,
          onDelete: onDeleteTextBox,
          onEditStart: (id: string) => setEditingTextBoxId(id),
          onEditEnd: () => setEditingTextBoxId(null),
        },
        draggable: !isEditingThis && !drawingMode,
        selectable: !isEditingThis && !drawingMode,
        style: {
          zIndex: textBox.zIndex || 5,
        },
      });
    });

    // Add shapes
    const shapes = workflow.shapes || [];
    shapes.forEach((shape) => {
      flowNodes.push({
        id: `shape-${shape.id}`,
        type: 'shape',
        position: shape.position,
        data: {
          shape,
          onUpdate: onUpdateShape,
          onDelete: onDeleteShape,
        },
        draggable: !drawingMode,
        selectable: !drawingMode,
        style: {
          zIndex: shape.zIndex || 5,
        },
      });
    });

    // Add drawings
    const drawings = workflow.drawings || [];
    drawings.forEach((drawing) => {
      flowNodes.push({
        id: `drawing-${drawing.id}`,
        type: 'drawing',
        position: drawing.position || { x: 0, y: 0 },
        data: {
          drawing,
          onDelete: onDeleteDrawing,
        },
        draggable: !drawingMode,
        selectable: !drawingMode,
        style: {
          zIndex: drawing.zIndex || 4,
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
  }, [workflow, selectedNode, isConnecting, stageBounds, onUpdateStickyNote, onDeleteStickyNote, onUpdateTextBox, onDeleteTextBox, onUpdateShape, onDeleteShape, onDeleteDrawing, editingTextBoxId, drawingMode]);

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

  // Handle node drag end to update positions (only update on drag END to prevent flashing)
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('sticky-')) {
        const stickyId = node.id.replace('sticky-', '');
        if (onUpdateStickyNote) {
          onUpdateStickyNote(stickyId, { position: node.position });
        }
      } else if (node.id.startsWith('textbox-')) {
        const textBoxId = node.id.replace('textbox-', '');
        if (onUpdateTextBox) {
          onUpdateTextBox(textBoxId, { position: node.position });
        }
      } else if (node.id.startsWith('shape-')) {
        const shapeId = node.id.replace('shape-', '');
        if (onUpdateShape) {
          onUpdateShape(shapeId, { position: node.position });
        }
      } else if (node.id.startsWith('stage-')) {
        const stageId = node.id.replace('stage-', '');
        const stage = workflow.stages.find(s => s.id === stageId);
        if (stage) {
          const bounds = stageBounds[stageId];
          onUpdateStagePosition(stageId, { 
            x: node.position.x - bounds.offsetX, 
            y: node.position.y - bounds.offsetY 
          });
        }
      } else if (node.parentNode) {
        const stage = workflow.stages.find(s => `stage-${s.id}` === node.parentNode);
        if (stage) {
          const bounds = stageBounds[stage.id];
          onUpdateNodePosition(node.id, { 
            x: node.position.x - 40 + bounds.offsetX, 
            y: node.position.y - 60 + bounds.offsetY 
          });
        }
      }
    },
    [workflow.stages, stageBounds, onUpdateStagePosition, onUpdateNodePosition, onUpdateStickyNote, onUpdateTextBox, onUpdateShape]
  );

  // Handle drawing
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!drawingMode || !onAddDrawing) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const viewport = getViewport();
    const canvasBounds = event.currentTarget.getBoundingClientRect();
    
    // Get mouse position in screen coordinates
    const screenX = event.clientX - canvasBounds.left;
    const screenY = event.clientY - canvasBounds.top;
    
    // Convert to flow coordinates
    const flowPos = project({ x: screenX, y: screenY });
    
    setIsDrawingPath(true);
    setDrawingPath([flowPos]);
  }, [drawingMode, onAddDrawing, getViewport, project]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDrawingPath || !drawingMode) return;
    
    const canvasBounds = event.currentTarget.getBoundingClientRect();
    const screenX = event.clientX - canvasBounds.left;
    const screenY = event.clientY - canvasBounds.top;
    
    const flowPos = project({ x: screenX, y: screenY });
    
    setDrawingPath(prev => [...prev, flowPos]);
  }, [isDrawingPath, drawingMode, project]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawingPath || !onAddDrawing || drawingPath.length < 2) {
      setIsDrawingPath(false);
      setDrawingPath([]);
      return;
    }

    // Find bounding box of the path
    const xs = drawingPath.map(p => p.x);
    const ys = drawingPath.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    // Normalize path to start from (0, 0)
    const normalizedPath = drawingPath.map(p => ({
      x: p.x - minX,
      y: p.y - minY
    }));

    // Convert normalized points to SVG path
    const pathData = normalizedPath.reduce((path, point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `${path} L ${point.x} ${point.y}`;
    }, '');

    // Pass the path and position (in flow coordinates)
    onAddDrawing(pathData, { x: minX, y: minY });
    setIsDrawingPath(false);
    setDrawingPath([]);
  }, [isDrawingPath, onAddDrawing, drawingPath]);

  return (
    <div 
      ref={reactFlowWrapper}
      className="h-full w-full relative"
      style={{ cursor: drawingMode ? 'crosshair' : 'default' }}
      onMouseDown={drawingMode ? handleMouseDown : undefined}
      onMouseMove={drawingMode ? handleMouseMove : undefined}
      onMouseUp={drawingMode ? handleMouseUp : undefined}
      onMouseLeave={drawingMode ? handleMouseUp : undefined}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
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
          nodesDraggable={!drawingMode}
          nodesConnectable={!drawingMode}
          elementsSelectable={!drawingMode}
          panOnDrag={!drawingMode}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-background/80 backdrop-blur-sm"
          />
          <Panel position="top-left">
            <Card className="p-2">
               <div className="flex flex-wrap gap-1">
                <Button 
                  onClick={() => onAddStickyNote?.(getViewportCenter())} 
                  size="sm" 
                  variant="outline"
                  title="Add sticky note"
                  className="h-8 w-8 p-0"
                >
                  <StickyNoteIcon className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => onAddTextBox?.(getViewportCenter())} 
                  size="sm" 
                  variant="outline"
                  title="Add text box"
                  className="h-8 w-8 p-0"
                >
                  <Type className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => onAddShape?.('rectangle', getViewportCenter())} 
                  size="sm" 
                  variant="outline"
                  title="Add rectangle"
                  className="h-8 w-8 p-0"
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => onAddShape?.('circle', getViewportCenter())} 
                  size="sm" 
                  variant="outline"
                  title="Add circle"
                  className="h-8 w-8 p-0"
                >
                  <Circle className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => onAddShape?.('triangle', getViewportCenter())} 
                  size="sm" 
                  variant="outline"
                  title="Add triangle"
                  className="h-8 w-8 p-0"
                >
                  <Triangle className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => {
                    onSetDrawingMode?.(!drawingMode);
                    if (drawingMode) {
                      setIsDrawingPath(false);
                      setDrawingPath([]);
                    }
                  }}
                  size="sm" 
                  variant={drawingMode ? "default" : "outline"}
                  title="Draw freeform"
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
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
        />
      )}

      {/* Function Selector Dialog */}
      {showAddFunction && (
        <FunctionSelector
          open={true}
          onOpenChange={(open) => !open && setShowAddFunction(null)}
          onSelectFunction={(functionDef) => {
            onAddFunction(showAddFunction, functionDef.id);
            setShowAddFunction(null);
          }}
        />
      )}

      {/* Drawing overlay */}
      {isDrawingPath && drawingPath.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none z-50"
          style={{ width: '100%', height: '100%' }}
        >
          <path
            d={drawingPath.reduce((path, point, index) => {
              if (index === 0) return `M ${point.x} ${point.y}`;
              return `${path} L ${point.x} ${point.y}`;
            }, '')}
            stroke="#000000"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
