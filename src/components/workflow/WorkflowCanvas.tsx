import { Card } from "@/components/ui/card";
import { Stage } from "./Stage";
import type { Workflow } from "@/pages/Index";
import { useEffect, useState } from "react";

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
  const [forceUpdate, setForceUpdate] = useState(0);

  // Force redraw of arrows when workflow changes
  useEffect(() => {
    // Multiple redraws to ensure DOM is ready
    const timers = [
      setTimeout(() => setForceUpdate((prev) => prev + 1), 50),
      setTimeout(() => setForceUpdate((prev) => prev + 1), 150),
      setTimeout(() => setForceUpdate((prev) => prev + 1), 300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [workflow.connections, workflow.stages, workflow.stages.flatMap(s => s.agents).length]);

  const handlePortClick = (agentId: string, isOutput: boolean) => {
    if (isOutput && !connectingFrom) {
      onStartConnection(agentId);
    } else if (!isOutput && connectingFrom && connectingFrom !== agentId) {
      onCompleteConnection(connectingFrom, agentId);
    } else if (connectingFrom) {
      onStartConnection(null);
    }
  };

  const renderConnections = () => {
    const scrollContainer = document.getElementById('workflow-scroll-container');
    if (!scrollContainer) return null;
    
    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollTop = scrollContainer.scrollTop;
    
    return workflow.connections.map((conn) => {
      const fromAgent = workflow.stages.flatMap(s => s.agents).find(a => a.id === conn.fromAgentId);
      const toAgent = workflow.stages.flatMap(s => s.agents).find(a => a.id === conn.toAgentId);
      if (!fromAgent || !toAgent) return null;
      
      const fromEl = document.getElementById(`port-output-${conn.fromAgentId}`);
      const toEl = document.getElementById(`port-input-${conn.toAgentId}`);
      if (!fromEl || !toEl) return null;
      
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      
      const x1 = fromRect.left + fromRect.width / 2 - containerRect.left + scrollLeft;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top + scrollTop;
      const x2 = toRect.left + toRect.width / 2 - containerRect.left + scrollLeft;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top + scrollTop;
      
      const controlY1 = y1 + Math.abs(y2 - y1) * 0.5;
      const controlY2 = y2 - Math.abs(y2 - y1) * 0.5;
      
      const path = `M ${x1} ${y1} C ${x1} ${controlY1}, ${x2} ${controlY2}, ${x2} ${y2}`;
      
      return (
        <path
          key={conn.id}
          d={path}
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#arrowhead)"
        />
      );
    });
  };
  return (
    <main className="flex-1 bg-gradient-to-br from-canvas-background to-muted/20 overflow-hidden relative" id="workflow-canvas">
      <div className="absolute inset-0 p-6">
        <Card className="h-full bg-canvas-background/50 backdrop-blur-sm border-2 border-dashed border-border/50 rounded-xl overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-auto relative" id="workflow-scroll-container">
            <div className="p-6 space-y-6 min-h-full">
              <svg 
                key={forceUpdate}
                className="absolute inset-0 pointer-events-none z-[15]" 
                style={{ width: '100%', height: '100%' }}
              >
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                    <polygon points="0 0, 10 3, 0 6" fill="hsl(var(--primary))" />
                  </marker>
                </defs>
                {renderConnections()}
              </svg>
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
          </div>
        </Card>
      </div>
    </main>
  );
};
