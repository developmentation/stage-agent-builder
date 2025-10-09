import { Card } from "@/components/ui/card";
import { Stage } from "./Stage";
import type { Workflow } from "@/types/workflow";
import { useEffect, useState } from "react";

interface WorkflowCanvasProps {
  workflow: Workflow;
  selectedNode: string | null;
  connectingFrom: string | null;
  layoutId?: string;
  onSelectNode: (id: string | null) => void;
  onAddAgent: (stageId: string, agentTemplate: any) => void;
  onAddNode: (stageId: string, template: any, nodeType: "agent" | "function" | "tool") => void;
  onDeleteAgent: (agentId: string) => void;
  onDeleteStage: (stageId: string) => void;
  onRenameStage: (stageId: string, name: string) => void;
  onReorderStages: (fromIndex: number, toIndex: number) => void;
  onToggleMinimize: (agentId: string) => void;
  onStartConnection: (agentId: string, outputPort?: string) => void;
  onCompleteConnection: (fromAgentId: string, toAgentId: string, fromOutputPort?: string) => void;
  onDeleteConnection: (connectionId: string) => void;
}

export const WorkflowCanvas = ({
  workflow,
  selectedNode,
  connectingFrom,
  layoutId = 'default',
  onSelectNode,
  onAddAgent,
  onAddNode,
  onDeleteAgent,
  onDeleteStage,
  onRenameStage,
  onReorderStages,
  onToggleMinimize,
  onStartConnection,
  onCompleteConnection,
  onDeleteConnection,
}: WorkflowCanvasProps) => {
  const [forceUpdate, setForceUpdate] = useState(0);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  // Update SVG dimensions based on scroll content
  const updateSvgDimensions = () => {
    const scrollContainer = document.getElementById(`workflow-scroll-container-${layoutId}`);
    if (scrollContainer) {
      // Use clientWidth to prevent horizontal expansion, scrollHeight for vertical scrolling
      setSvgDimensions({
        width: scrollContainer.clientWidth,
        height: Math.max(scrollContainer.scrollHeight, scrollContainer.clientHeight)
      });
    }
  };

  // Force redraw of arrows when workflow changes
  useEffect(() => {
    // Multiple redraws to ensure DOM is ready
    const timers = [
      setTimeout(() => {
        updateSvgDimensions();
        setForceUpdate((prev) => prev + 1);
      }, 50),
      setTimeout(() => {
        updateSvgDimensions();
        setForceUpdate((prev) => prev + 1);
      }, 150),
      setTimeout(() => {
        updateSvgDimensions();
        setForceUpdate((prev) => prev + 1);
      }, 300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [workflow.connections, workflow.stages, workflow.stages.flatMap(s => s.nodes).length]);

  const [connectingFromPort, setConnectingFromPort] = useState<string | undefined>(undefined);

  // Clear selection when entering connection mode
  useEffect(() => {
    if (connectingFrom !== null) {
      setSelectedConnection(null);
    } else {
      setConnectingFromPort(undefined);
    }
  }, [connectingFrom]);

  // Redraw arrows on window resize
  useEffect(() => {
    const handleResize = () => {
      updateSvgDimensions();
      setForceUpdate((prev) => prev + 1);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle delete key for connections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedConnection) {
        onDeleteConnection(selectedConnection);
        setSelectedConnection(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConnection, onDeleteConnection]);

  const handlePortClick = (agentId: string, isOutput: boolean, outputPort?: string) => {
    if (isOutput && !connectingFrom) {
      setConnectingFromPort(outputPort);
      onStartConnection(agentId, outputPort);
    } else if (!isOutput && connectingFrom && connectingFrom !== agentId) {
      onCompleteConnection(connectingFrom, agentId, connectingFromPort);
      setConnectingFromPort(undefined);
    } else if (connectingFrom) {
      setConnectingFromPort(undefined);
      onStartConnection(null);
    }
  };

  const renderConnections = () => {
    const scrollContainer = document.getElementById(`workflow-scroll-container-${layoutId}`);
    if (!scrollContainer) return null;
    
    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollTop = scrollContainer.scrollTop;
    
    return workflow.connections.map((conn) => {
      const fromNode = workflow.stages.flatMap(s => s.nodes).find(n => n.id === conn.fromNodeId);
      const toNode = workflow.stages.flatMap(s => s.nodes).find(n => n.id === conn.toNodeId);
      if (!fromNode || !toNode) return null;
      
      // Build the correct output port ID
      let outputPortId = `port-output-${conn.fromNodeId}-${layoutId}`;
      if (conn.fromOutputPort) {
        outputPortId = `port-output-${conn.fromNodeId}-${conn.fromOutputPort}-${layoutId}`;
      }
      
      const fromEl = document.getElementById(outputPortId);
      const toEl = document.getElementById(`port-input-${conn.toNodeId}-${layoutId}`);
      if (!fromEl || !toEl) return null;
      
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      
      const x1 = fromRect.left + fromRect.width / 2 - containerRect.left + scrollLeft - 1;
      const y1 = fromRect.top + fromRect.height / 2 - containerRect.top + scrollTop + 5;
      const x2 = toRect.left + toRect.width / 2 - containerRect.left + scrollLeft - 1;
      const y2 = toRect.top + toRect.height / 2 - containerRect.top + scrollTop - 5;
      
      const controlY1 = y1 + Math.abs(y2 - y1) * 0.5;
      const controlY2 = y2 - Math.abs(y2 - y1) * 0.5;
      
      const path = `M ${x1} ${y1} C ${x1} ${controlY1}, ${x2} ${controlY2}, ${x2} ${y2}`;
      
      const isSelected = selectedConnection === conn.id;
      
      // If we're in connecting mode, don't allow selecting connections
      const isConnectingMode = connectingFrom !== null;
      
      return (
        <g key={conn.id} style={{ pointerEvents: isConnectingMode ? 'none' : 'auto' }}>
          {/* Invisible wider path for easier clicking */}
          <path
            d={path}
            stroke="transparent"
            strokeWidth="20"
            fill="none"
            style={{ cursor: 'pointer', pointerEvents: isConnectingMode ? 'none' : 'stroke' }}
            onClick={(e) => {
              if (!isConnectingMode) {
                e.stopPropagation();
                setSelectedConnection(conn.id);
              }
            }}
          />
          {/* Visible path */}
          <path
            d={path}
            stroke={isSelected ? "hsl(var(--warning))" : "hsl(var(--primary))"}
            strokeWidth="2"
            strokeOpacity={isSelected ? "0.6" : "0.3"}
            fill="none"
            markerEnd={isSelected ? `url(#arrowhead-selected-${layoutId})` : `url(#arrowhead-${layoutId})`}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      );
    });
  };
  return (
    <div className="h-full bg-gradient-to-br from-canvas-background to-muted/20 overflow-hidden relative" id={`workflow-canvas-${layoutId}`}>
      <div className="h-full p-2 lg:p-3">
        <Card className="h-full bg-canvas-background/50 backdrop-blur-sm border-2 border-dashed border-border/50 rounded-xl overflow-x-hidden overflow-y-auto flex flex-col relative" id={`workflow-scroll-container-${layoutId}`} onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedConnection(null);
              }
            }}>
            <svg 
              key={forceUpdate}
              className="absolute top-0 left-0 pointer-events-none" 
              style={{ 
                width: `${svgDimensions.width}px`, 
                height: `${svgDimensions.height}px`, 
                zIndex: 15,
                minWidth: '100%',
                minHeight: '100%'
              }}
            >
              <defs>
                <marker id={`arrowhead-${layoutId}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="hsl(var(--primary))" fillOpacity="0.3" />
                </marker>
                <marker id={`arrowhead-selected-${layoutId}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="hsl(var(--warning))" fillOpacity="0.6" />
                </marker>
              </defs>
              {renderConnections()}
            </svg>
            
            {/* Mobile connection delete button */}
            {selectedConnection && !connectingFrom && (
              <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 lg:hidden">
                <Card className="p-2 bg-card shadow-lg flex items-center gap-2">
                  <span className="text-xs text-muted-foreground px-2">Connection selected</span>
                  <button
                    onClick={() => {
                      onDeleteConnection(selectedConnection);
                      setSelectedConnection(null);
                    }}
                    className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedConnection(null)}
                    className="px-3 py-1.5 bg-muted text-foreground rounded-md text-sm font-medium hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                </Card>
              </div>
            )}
            
            <div className="p-2 lg:p-3 space-y-3 w-full max-w-full" style={{ position: 'relative', zIndex: 5 }}>
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
                    stageIndex={index}
                    selectedNode={selectedNode}
                    connectingFrom={connectingFrom}
                    layoutId={layoutId}
                    onSelectNode={onSelectNode}
                    onAddAgent={onAddAgent}
                    onAddNode={onAddNode}
                    onDeleteAgent={onDeleteAgent}
                    onDeleteStage={onDeleteStage}
                    onRenameStage={onRenameStage}
                    onReorderStages={onReorderStages}
                    onToggleMinimize={onToggleMinimize}
                    onPortClick={handlePortClick}
                  />
                ))
              )}
            </div>
        </Card>
      </div>
    </div>
  );
};
