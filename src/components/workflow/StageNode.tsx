import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, FunctionSquare, Bot } from "lucide-react";
import { useState } from "react";
import type { Stage } from "@/types/workflow";

interface StageNodeData {
  stage: Stage;
  onDelete: () => void;
  onRename: (name: string) => void;
  onAddAgent: () => void;
  onAddFunction: () => void;
  width: number;
  height: number;
}

export const StageNode = memo(({ data }: NodeProps<StageNodeData>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [stageName, setStageName] = useState(data.stage.name);

  const handleRename = () => {
    if (stageName.trim()) {
      data.onRename(stageName);
      setIsEditing(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-card/95 backdrop-blur-sm shadow-lg">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={data.onDelete}
            className="h-7 w-7 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={data.onAddAgent}
            className="h-7 text-xs flex-1"
          >
            <Bot className="h-3 w-3 mr-1" />
            Agent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={data.onAddFunction}
            className="h-7 text-xs flex-1"
          >
            <FunctionSquare className="h-3 w-3 mr-1" />
            Function
          </Button>
        </div>
      </CardHeader>
      
      {/* Stage container for child nodes */}
      <div className="p-4 pt-0 min-h-[150px]">
        {/* Child nodes will be rendered here by ReactFlow */}
      </div>
    </Card>
  );
});

StageNode.displayName = "StageNode";
