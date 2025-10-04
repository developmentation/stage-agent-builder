import { Card } from "@/components/ui/card";
import { Stage } from "./Stage";

interface WorkflowCanvasProps {
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
}

export const WorkflowCanvas = ({ selectedNode, onSelectNode }: WorkflowCanvasProps) => {
  return (
    <main className="flex-1 bg-gradient-to-br from-canvas-background to-muted/20 overflow-auto">
      <div className="h-full p-6">
        <Card className="h-full bg-canvas-background/50 backdrop-blur-sm border-2 border-dashed border-border/50 rounded-xl">
          <div className="h-full p-6 space-y-6 overflow-auto">
            {/* Empty State */}
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

            {/* Example Stage - will be dynamic later */}
            <Stage 
              stageNumber={1}
              selectedNode={selectedNode}
              onSelectNode={onSelectNode}
            />
          </div>
        </Card>
      </div>
    </main>
  );
};
