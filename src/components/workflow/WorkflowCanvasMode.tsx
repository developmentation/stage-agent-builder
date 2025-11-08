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
} from 'reactflow';
import 'reactflow/dist/style.css';
import './EdgeStyles.css';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Grid3x3, Layers } from "lucide-react";
import type { Workflow, WorkflowNode, Stage as StageType } from "@/types/workflow";
import { AgentSelector } from "@/components/AgentSelector";
import { FunctionSelector } from "@/components/FunctionSelector";
import { StageNode } from "./StageNode";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";
import { useIsMobile } from "@/hooks/use-mobile";

const nodeTypes: NodeTypes = {
  stage: StageNode,
  workflowNode: WorkflowNodeComponent,
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
}: WorkflowCanvasModeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showAddAgent, setShowAddAgent] = useState<string | null>(null);
  const [showAddFunction, setShowAddFunction] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Calculate stage bounds - positioned directly from node bounding boxes
  const stageBounds = useMemo(() => {
    const bounds: Record<string, { x: number; y: number; width: number; height: number; minX: number; minY: number }> = {};
    
    const stagePaddingLeft = 40;
    const stagePaddingRight = 24; // 24 + 16 (p-4) = 40px effective
    const stagePaddingTop = 100; // Accounts for header + gap
    const stagePaddingBottom = 24; // 24 + 16 (p-4) = 40px effective
    const nodeWidth = 250;
    const nodeHeight = 150;
    
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
        
        // Calculate bounding box from node positions
        minX = Math.min(minX, nodeX);
        minY = Math.min(minY, nodeY);
        maxX = Math.max(maxX, nodeX + nodeWidth);
        maxY = Math.max(maxY, nodeY + nodeHeight);
      });

      // Stage position is the bounding box with padding
      const stageX = minX - stagePaddingLeft;
      const stageY = minY - stagePaddingTop;
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
          },
          parentNode: `stage-${stage.id}`,
          draggable: true,
          style: {
            zIndex: 10,
          },
        });
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

  // Handle node drag end to update positions
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node, nodes: Node[]) => {
      if (node.id.startsWith('stage-')) {
        // Stage was dragged - move all child nodes by the delta
        const stageId = node.id.replace('stage-', '');
        const stage = workflow.stages.find(s => s.id === stageId);
        if (!stage) return;

        const oldBounds = stageBounds[stageId];
        const deltaX = node.position.x - oldBounds.x;
        const deltaY = node.position.y - oldBounds.y;

        // Update all child node positions by the delta
        stage.nodes.forEach((workflowNode) => {
          const currentX = workflowNode.position?.x ?? 0;
          const currentY = workflowNode.position?.y ?? 0;
          onUpdateNodePosition(workflowNode.id, {
            x: currentX + deltaX,
            y: currentY + deltaY,
          });
        });
      } else if (node.parentNode) {
        // Individual node was dragged
        const stage = workflow.stages.find(s => `stage-${s.id}` === node.parentNode);
        if (!stage) return;

        const bounds = stageBounds[stage.id];
        const stagePaddingLeft = 40;
        const stagePaddingTop = 100;

        // Calculate absolute position from relative position within stage
        const absoluteX = bounds.minX + (node.position.x - stagePaddingLeft);
        const absoluteY = bounds.minY + (node.position.y - stagePaddingTop);

        onUpdateNodePosition(node.id, { x: absoluteX, y: absoluteY });
      }
    },
    [workflow.stages, stageBounds, onUpdateNodePosition]
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
                {isMobile && onToggleViewMode && (
                  <Button onClick={onToggleViewMode} size="sm" variant="outline">
                    <Layers className="h-4 w-4 mr-2" />
                    Stacked
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
