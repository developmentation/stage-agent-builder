import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, FunctionSquare, Bot, Copy, Play } from "lucide-react";
import { useState } from "react";
import type { Stage } from "@/types/workflow";

interface StageNodeData {
  stage: Stage;
  onDelete: () => void;
  onRename: (name: string) => void;
  onAddAgent: (template?: any) => void;
  onAddFunction: (template?: any) => void;
  onClone?: () => void;
  onRunStage?: () => void;
  width: number;
  height: number;
}

export const StageNode = memo(({ data }: NodeProps<StageNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [stageName, setStageName] = useState(data.stage.name);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleRename = () => {
    if (stageName.trim()) {
      data.onRename(stageName);
      setIsEditing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const hasTemplate = e.dataTransfer.types.includes("agenttemplate");
    if (hasTemplate) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const templateData = e.dataTransfer.getData("agentTemplate");
    const nodeType = e.dataTransfer.getData("nodeType") as "agent" | "function" | "tool";
    
    if (templateData) {
      const template = JSON.parse(templateData);
      if (nodeType === "function") {
        data.onAddFunction(template);
      } else {
        data.onAddAgent(template);
      }
    }
  };

  return (
    <Card 
      className={`border-2 bg-card/95 backdrop-blur-sm shadow-lg transition-colors ${
        isDragOver ? "border-primary bg-primary/10" : "border-primary/20"
      }`}
      style={{ width: data.width, height: data.height }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            <Input
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setStageName(data.stage.name);
                  setIsEditing(false);
                }
              }}
              className="h-7 text-sm"
              autoFocus
            />
          ) : (
            <CardTitle
              className="text-sm cursor-pointer hover:text-primary transition-colors"
              onDoubleClick={() => setIsEditing(true)}
            >
              {data.stage.name}
            </CardTitle>
          )}
          <div className="flex items-center gap-1">
            {data.onRunStage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={data.onRunStage}
                className="h-7 w-7 p-0"
                title="Run stage"
              >
                <Play className="h-3 w-3 text-primary" />
              </Button>
            )}
            {data.onClone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={data.onClone}
                className="h-7 w-7 p-0"
                title="Clone stage"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={data.onDelete}
              className="h-7 w-7 p-0"
              title="Delete stage"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => data.onAddAgent()}
            className="h-7 text-xs flex-1"
          >
            <Bot className="h-3 w-3 mr-1" />
            Agent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => data.onAddFunction()}
            className="h-7 text-xs flex-1"
          >
            <FunctionSquare className="h-3 w-3 mr-1" />
            Function
          </Button>
        </div>
      </CardHeader>
      
      {/* Stage container for child nodes - no fixed height constraint */}
      <div className="p-4 pt-0" style={{ minHeight: data.height - 100 }}>
        {/* Child nodes will be rendered here by ReactFlow */}
      </div>
    </Card>
  );
});

StageNode.displayName = "StageNode";
