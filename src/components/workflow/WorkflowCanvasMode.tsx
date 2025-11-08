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
  NodeResizeControl,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './EdgeStyles.css';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, StickyNote } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Workflow, WorkflowNode, Stage as StageType, Note } from "@/types/workflow";
import { AgentSelector } from "@/components/AgentSelector";
import { FunctionSelector } from "@/components/FunctionSelector";
import { StageNode } from "./StageNode";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";
import { NoteNode } from "./NoteNode";
import { useIsMobile } from "@/hooks/use-mobile";

const nodeTypes: NodeTypes = {
  stage: StageNode,
  workflowNode: WorkflowNodeComponent,
  note: NoteNode,
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
  onAddNote?: () => void;
  onUpdateNote?: (noteId: string, updates: Partial<Note>) => void;
  onDeleteNote?: (noteId: string) => void;
}

export function WorkflowCanvasMode({
  workflow,
  selectedNode,
  isConnecting,
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
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: WorkflowCanvasModeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showAddAgent, setShowAddAgent] = useState<string | null>(null);
  const [showAddFunction, setShowAddFunction] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Custom nodes change handler to intercept resize events
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChange(changes);
      
      // Handle dimension changes for notes
      changes.forEach((change: any) => {
        if (change.type === 'dimensions' && change.id.startsWith('note-')) {
          const noteId = change.id.replace('note-', '');
          if (change.dimensions) {
            onUpdateNote?.(noteId, { 
              size: { 
                width: change.dimensions.width, 
                height: change.dimensions.height 
              } 
            });
          }
        }
      });
    },
    [onNodesChange, onUpdateNote]
  );

  // Calculate stage bounds and offset - memoized to prevent recalculation during dragging
  const stageBounds = useMemo(() => {
    const bounds: Record<string, { width: number; height: number; stageX: number; stageY: number }> = {};
    
    // Asymmetric padding to account for p-4 class in StageNode content div
    const stagePaddingLeft = 40; // Left padding (no p-4 interference)
    const stagePaddingRight = 24; // 24px + 16px from p-4 = 40px effective
    const stagePaddingTop = 100; // Header (~60-70px) + gap (30-40px)
    const stagePaddingBottom = 24; // 24px + 16px from p-4 = 40px effective
    const stageHeaderHeight = 60;
    const nodeWidth = 250;
    const nodeHeight = 150;
    
    workflow.stages.forEach((stage) => {
      if (stage.nodes.length === 0) {
        const stageX = stage.position?.x ?? 0;
        const stageY = stage.position?.y ?? 0;
        bounds[stage.id] = { width: 400, height: 300, stageX, stageY };
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

      // Stage position: subtract padding to get stage edges
      const stageX = minX - stagePaddingLeft;
      const stageY = minY - stagePaddingTop;
      
      // Stage size with asymmetric padding
      const stageWidth = Math.max(400, maxX - minX + stagePaddingLeft + stagePaddingRight);
      const stageHeight = Math.max(300, maxY - minY + stagePaddingTop + stagePaddingBottom);

      bounds[stage.id] = { width: stageWidth, height: stageHeight, stageX, stageY };
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
      const bounds = stageBounds[stage.id] || { width: 400, height: 300, stageX: 100, stageY: stageIndex * 400 };

      // Add stage node
      flowNodes.push({
        id: `stage-${stage.id}`,
        type: 'stage',
        position: { x: bounds.stageX, y: bounds.stageY },
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
          position: { x: 40 + (nodeX - bounds.stageX - 40), y: 100 + (nodeY - bounds.stageY - 100) },
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

    // Add note nodes
    if (workflow.notes) {
      workflow.notes.forEach((note) => {
        flowNodes.push({
          id: `note-${note.id}`,
          type: 'note',
          position: note.position,
          data: {
            content: note.content,
            color: note.color,
            onUpdate: (content: string) => onUpdateNote?.(note.id, { content }),
            onDelete: () => onDeleteNote?.(note.id),
            onColorChange: (color: string) => onUpdateNote?.(note.id, { color }),
          },
          style: {
            width: note.size.width,
            height: note.size.height,
            zIndex: 5,
          },
          draggable: true,
          resizing: true,
        });
      });
    }

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
  }, [workflow, selectedNode, isConnecting, stageBounds]);

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
      if (node.id.startsWith('note-')) {
        // Update note position
        const noteId = node.id.replace('note-', '');
        onUpdateNote?.(noteId, { position: node.position });
      } else if (node.id.startsWith('stage-')) {
        const stageId = node.id.replace('stage-', '');
        const stage = workflow.stages.find(s => s.id === stageId);
        if (stage) {
          const bounds = stageBounds[stageId];
          const deltaX = node.position.x - bounds.stageX;
          const deltaY = node.position.y - bounds.stageY;
          
          // Update all child node positions by the same delta
          stage.nodes.forEach(childNode => {
            const currentX = childNode.position?.x ?? 0;
            const currentY = childNode.position?.y ?? 0;
            onUpdateNodePosition(childNode.id, {
              x: currentX + deltaX,
              y: currentY + deltaY
            });
          });
        }
      } else if (node.parentNode) {
        const stage = workflow.stages.find(s => `stage-${s.id}` === node.parentNode);
        if (stage) {
          const bounds = stageBounds[stage.id];
          
          // Calculate node position in absolute coordinates (accounting for stage padding)
          const nodeAbsoluteX = bounds.stageX + 40 + node.position.x;
          const nodeAbsoluteY = bounds.stageY + 100 + node.position.y;
          
          // Store the absolute position (removing the padding offsets)
          const nodeRelativePosition = { 
            x: nodeAbsoluteX - 40,
            y: nodeAbsoluteY - 100
          };
          onUpdateNodePosition(node.id, nodeRelativePosition);
        }
      }
    },
    [workflow.stages, stageBounds, onUpdateStagePosition, onUpdateNodePosition, onUpdateNote]
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={(nodes) => {
            // Handle note deletion when delete key is pressed
            nodes.forEach((node) => {
              if (node.id.startsWith('note-')) {
                const noteId = node.id.replace('note-', '');
                onDeleteNote?.(noteId);
              }
            });
          }}
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
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={onAddNote} size="sm" variant="outline">
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add Note</p>
                  </TooltipContent>
                </Tooltip>
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
