import { Card } from "@/components/ui/card";
import { Stage } from "./Stage";
import type { Workflow } from "@/pages/Index";

interface WorkflowCanvasProps {
  workflow: Workflow;
  selectedNode: string | null;
  connectingFrom: string | null;
  onSelectNode: (id: string | null) => void;
  onAddAgent: (stageId: string, agentTemplate: any) => void;
  onDeleteAgent: (agentId: string) => void;
  onDeleteStage: (stageId: string) => void;
  onStartConnection: (agentId: string) => void;
  onCompleteConnection: (fromAgentId: string, toAgentId: string) => void;
}

export const WorkflowCanvas = ({
  workflow,
  selectedNode,
  connectingFrom,
  onSelectNode,
  onAddAgent,
  onDeleteAgent,
  onDeleteStage,
  onStartConnection,
  onCompleteConnection,
}: WorkflowCanvasProps) => {
  const handlePortClick = (agentId: string, isOutput: boolean) => {
    if (isOutput && !connectingFrom) {
      onStartConnection(agentId);
    } else if (!isOutput && connectingFrom && connectingFrom !== agentId) {
      onCompleteConnection(connectingFrom, agentId);
    } else if (connectingFrom) {
      onStartConnection(null);
    }
  };
  return (
    <main className="flex-1 bg-gradient-to-br from-canvas-background to-muted/20 overflow-auto">
      <div className="h-full p-6 relative">
        <Card className="h-full bg-canvas-background/50 backdrop-blur-sm border-2 border-dashed border-border/50 rounded-xl">
          <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="hsl(var(--primary))" />
              </marker>
            </defs>
            {workflow.connections.map((conn) => {
              const fromAgent = workflow.stages.flatMap(s => s.agents).find(a => a.id === conn.fromAgentId);
              const toAgent = workflow.stages.flatMap(s => s.agents).find(a => a.id === conn.toAgentId);
              if (!fromAgent || !toAgent) return null;
              
              const fromEl = document.getElementById(`agent-${conn.fromAgentId}`);
              const toEl = document.getElementById(`agent-${conn.toAgentId}`);
              if (!fromEl || !toEl) return null;
              
              const fromRect = fromEl.getBoundingClientRect();
              const toRect = toEl.getBoundingClientRect();
              const container = fromEl.closest('main')?.getBoundingClientRect();
              if (!container) return null;
              
              const x1 = fromRect.left + fromRect.width / 2 - container.left;
              const y1 = fromRect.bottom - container.top;
              const x2 = toRect.left + toRect.width / 2 - container.left;
              const y2 = toRect.top - container.top;
              
              return (
                <line
                  key={conn.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
          </svg>
          <div className="h-full p-6 space-y-6 overflow-auto">
            {workflow.stages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3 max-w-md">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mx-auto">
                    <svg className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Start Building Your Workflow</h3>
                  <p className="text-sm text-muted-foreground">
                    Click "Add Stage" to create your first stage, then drag agents from the sidebar to build your workflow.
                  </p>
                </div>
              </div>
            ) : (
              workflow.stages.map((stage, index) => (
                <Stage
                  key={stage.id}
                  stage={stage}
                  stageNumber={index + 1}
                  selectedNode={selectedNode}
                  connectingFrom={connectingFrom}
                  onSelectNode={onSelectNode}
                  onAddAgent={onAddAgent}
                  onDeleteAgent={onDeleteAgent}
                  onDeleteStage={onDeleteStage}
                  onPortClick={handlePortClick}
                />
              ))
            )}
          </div>
        </Card>
      </div>
    </main>
  );
};
