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
import { Plus, Grid3x3, Layers, StickyNote as StickyNoteIcon } from "lucide-react";
import type { Workflow, WorkflowNode, Stage as StageType, StickyNote as StickyNoteType } from "@/types/workflow";
import { AgentSelector } from "@/components/AgentSelector";
import { FunctionSelector } from "@/components/FunctionSelector";
import { StageNode } from "./StageNode";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";
import { useIsMobile } from "@/hooks/use-mobile";

import { StickyNoteNode } from "./StickyNoteNode";

const nodeTypes: NodeTypes = {
  stage: StageNode,
  workflowNode: WorkflowNodeComponent,
  stickyNote: StickyNoteNode,
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
  onAddAgent: (stageId: string, agent: any, position?: { x: number; y: number }) => void;
  onAddFunction: (stageId: string, functionType: string, position?: { x: number; y: number }) => void;
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
  onAddStickyNote?: () => void;
  onUpdateStickyNote?: (id: string, updates: Partial<StickyNoteType>) => void;
  onDeleteStickyNote?: (id: string) => void;
}

function WorkflowCanvasModeInner({
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
  onAddStickyNote,
  onUpdateStickyNote,
  onDeleteStickyNote,
}: WorkflowCanvasModeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showAddAgent, setShowAddAgent] = useState<string | null>(null);
  const [showAddFunction, setShowAddFunction] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { project } = useReactFlow();

  // Get viewport center in flow coordinates
  const getViewportCenter = useCallback(() => {
    const bounds = document.querySelector('.react-flow__viewport')?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    
    // Convert screen coordinates to flow coordinates
    return project({ x: centerX, y: centerY });
  }, [project]);

  // Calculate stage bounds and position - recalculated when any node position changes
  const stageBounds = useMemo(() => {
    const bounds: Record<string, { 
      width: number; 
      height: number; 
      stageX: number;
      stageY: number;
      contentMinX: number;
      contentMinY: number;
    }> = {};
    
    const stagePadding = 40;
    const stageHeaderHeight = 135; // Increased from 60 to 135 for button visibility
    const nodeWidth = 250;
    const nodeHeight = 150;
    const minStageWidth = 400;
    const minStageHeight = 300;
    
    workflow.stages.forEach((stage, stageIndex) => {
      const defaultStageY = stageIndex * 400;
      
      if (stage.nodes.length === 0) {
        bounds[stage.id] = { 
          width: minStageWidth, 
          height: minStageHeight, 
          stageX: stage.position?.x ?? 100,
          stageY: stage.position?.y ?? defaultStageY,
          contentMinX: 0,
          contentMinY: 0,
        };
        return;
      }

      // Calculate bounding box of all nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
        
        minX = Math.min(minX, nodeX);
        minY = Math.min(minY, nodeY);
        maxX = Math.max(maxX, nodeX + nodeWidth);
        maxY = Math.max(maxY, nodeY + nodeHeight);
      });

      // Calculate stage dimensions with padding
      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const stageWidth = Math.max(minStageWidth, contentWidth + stagePadding * 2);
      const stageHeight = Math.max(minStageHeight, contentHeight + stageHeaderHeight + stagePadding);

      // For single node, center it in the stage
      // For multiple nodes, position stage to contain all nodes with padding
      let stageX, stageY;
      if (stage.nodes.length === 1) {
        // Center single node in stage
        const node = stage.nodes[0];
        const nodeX = node.position?.x ?? 0;
        const nodeY = node.position?.y ?? 0;
        stageX = nodeX - (stageWidth - nodeWidth) / 2;
        stageY = nodeY - stageHeaderHeight - (stageHeight - stageHeaderHeight - nodeHeight) / 2;
      } else {
        // Position stage to contain all nodes
        stageX = minX - stagePadding;
        stageY = minY - stageHeaderHeight;
      }

      bounds[stage.id] = { 
        width: stageWidth, 
        height: stageHeight,
        stageX,
        stageY,
        contentMinX: minX,
        contentMinY: minY,
      };
    });
    
    return bounds;
  }, [workflow.stages]);

  // Convert workflow to ReactFlow nodes and edges
  useEffect(() => {
    const flowNodes: Node[] = [];
    const stagePadding = 40;
    const stageHeaderHeight = 135; // Match the calculation in stageBounds

    // Create all stage and node elements using calculated bounds
    workflow.stages.forEach((stage, stageIndex) => {
      const bounds = stageBounds[stage.id] || { 
        width: 400, 
        height: 300, 
        stageX: 100, 
        stageY: stageIndex * 400,
        contentMinX: 0,
        contentMinY: 0,
      };

      // Add stage node at calculated position (manually draggable)
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
        draggable: true, // Allow manual stage dragging
      });

      // Add workflow nodes within the stage - positioned relative to stage's top-left
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;

        // Position node relative to stage's top-left corner in canvas coordinates
        // Simply subtract the stage position from the node's workflow position
        const relativeX = nodeX - bounds.stageX;
        const relativeY = nodeY - bounds.stageY;

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
        draggable: true,
        style: {
          zIndex: 5,
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
  }, [workflow, selectedNode, isConnecting, stageBounds, onUpdateStickyNote, onDeleteStickyNote]);

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

  // Handle node drag end to update positions
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('sticky-')) {
        const stickyId = node.id.replace('sticky-', '');
        if (onUpdateStickyNote) {
          onUpdateStickyNote(stickyId, { position: node.position });
        }
      } else if (node.id.startsWith('stage-')) {
        // Update stage position when manually dragged
        const stageId = node.id.replace('stage-', '');
        const stage = workflow.stages.find(s => s.id === stageId);
        if (stage) {
          const bounds = stageBounds[stageId];
          const oldStageX = bounds.stageX;
          const oldStageY = bounds.stageY;
          const deltaX = node.position.x - oldStageX;
          const deltaY = node.position.y - oldStageY;
          
          // Update all nodes in the stage by the same delta
          stage.nodes.forEach((stageNode) => {
            const currentX = stageNode.position?.x ?? 0;
            const currentY = stageNode.position?.y ?? 0;
            onUpdateNodePosition(stageNode.id, { 
              x: currentX + deltaX, 
              y: currentY + deltaY 
            });
          });
        }
      } else if (node.parentNode) {
        const stage = workflow.stages.find(s => `stage-${s.id}` === node.parentNode);
        if (stage) {
          const bounds = stageBounds[stage.id];
          
          // Convert ReactFlow position back to workflow position
          // Add the stage's position to the node's relative position
          const workflowX = node.position.x + bounds.stageX;
          const workflowY = node.position.y + bounds.stageY;
          
          onUpdateNodePosition(node.id, { x: workflowX, y: workflowY });
        }
      }
    },
    [workflow.stages, stageBounds, onUpdateNodePosition, onUpdateStickyNote]
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
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-background/80 backdrop-blur-sm"
          />
          <Panel position="top-left">
            <Card className="p-2">
              <div className="flex gap-2">
                <Button onClick={onAddStage} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Stage
                </Button>
                {onAddStickyNote && (
                  <Button onClick={onAddStickyNote} size="sm" variant="outline">
                    <StickyNoteIcon className="h-4 w-4 mr-2" />
                    Note
                  </Button>
                )}
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
            const center = getViewportCenter();
            onAddAgent(showAddAgent, agent, center);
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
            const center = getViewportCenter();
            onAddFunction(showAddFunction, functionDef.id, center);
            setShowAddFunction(null);
          }}
        />
      )}
    </div>
  );
}

export function WorkflowCanvasMode(props: WorkflowCanvasModeProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasModeInner {...props} />
    </ReactFlowProvider>
  );
}
