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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { Workflow, WorkflowNode, Stage as StageType } from "@/types/workflow";
import { AgentSelector } from "@/components/AgentSelector";
import { FunctionSelector } from "@/components/FunctionSelector";
import { StageNode } from "./StageNode";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";

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
  onAddFunction: (stageId: string, functionType: string) => void;
  onDeleteNode: (stageId: string, nodeId: string) => void;
  onRunAgent: (nodeId: string) => void;
  onStartConnection: (nodeId: string, outputPort?: string) => void;
  onPortClick: (nodeId: string, outputPort?: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onUpdateStagePosition: (stageId: string, position: { x: number; y: number }) => void;
  onUpdateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
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
}: WorkflowCanvasModeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showAddAgent, setShowAddAgent] = useState<string | null>(null);
  const [showAddFunction, setShowAddFunction] = useState<string | null>(null);

  // Convert workflow to ReactFlow nodes and edges
  useEffect(() => {
    const flowNodes: Node[] = [];
    const nodeSpacing = 280;
    const stageSpacing = 150;

    // Create stage nodes
    workflow.stages.forEach((stage, stageIndex) => {
      const stageX = stage.position?.x ?? stageIndex * 400;
      const stageY = stage.position?.y ?? 100;

      // Calculate stage bounds based on contained nodes
      let minX = 0, minY = 0, maxX = 300, maxY = 200;
      
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * nodeSpacing;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
        
        minX = Math.min(minX, nodeX);
        minY = Math.min(minY, nodeY);
        maxX = Math.max(maxX, nodeX + 250);
        maxY = Math.max(maxY, nodeY + 150);
      });

      const stagePadding = 40;
      const stageWidth = Math.max(350, maxX - minX + stagePadding * 2);
      const stageHeight = Math.max(250, maxY - minY + stagePadding * 2);

      // Add stage node
      flowNodes.push({
        id: `stage-${stage.id}`,
        type: 'stage',
        position: { x: stageX, y: stageY },
        data: {
          stage,
          onDelete: () => onDeleteStage(stage.id),
          onRename: (name: string) => onRenameStage(stage.id, name),
          onAddAgent: () => setShowAddAgent(stage.id),
          onAddFunction: () => setShowAddFunction(stage.id),
          width: stageWidth,
          height: stageHeight,
        },
        style: {
          width: stageWidth,
          height: stageHeight,
        },
        draggable: true,
      });

      // Add workflow nodes within the stage
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * nodeSpacing;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;

        flowNodes.push({
          id: node.id,
          type: 'workflowNode',
          position: { x: stageX + stagePadding + nodeX, y: stageY + 60 + nodeY },
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
          extent: 'parent' as const,
          draggable: true,
        });
      });
    });

    setNodes(flowNodes);

    // Create edges from connections
    const flowEdges: Edge[] = workflow.connections.map((conn) => ({
      id: conn.id,
      source: conn.fromNodeId,
      target: conn.toNodeId,
      sourceHandle: conn.fromOutputPort,
      type: ConnectionLineType.SmoothStep,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
    }));

    setEdges(flowEdges);
  }, [workflow, selectedNode, isConnecting]);

  // Handle node drag end to update positions
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith('stage-')) {
        const stageId = node.id.replace('stage-', '');
        onUpdateStagePosition(stageId, node.position);
      } else if (node.parentNode) {
        // Get parent stage position to calculate relative position
        const parentNode = nodes.find(n => n.id === node.parentNode);
        if (parentNode) {
          const relativeX = node.position.x - parentNode.position.x - 40;
          const relativeY = node.position.y - parentNode.position.y - 60;
          onUpdateNodePosition(node.id, { x: relativeX, y: relativeY });
        }
      }
    },
    [nodes, onUpdateStagePosition, onUpdateNodePosition]
  );

  return (
    <div className="h-full w-full relative">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          fitView
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
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
              <Button onClick={onAddStage} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
              </Button>
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
    </div>
  );
}
