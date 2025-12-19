import { Card } from "@/components/ui/card";
import { AgentNode } from "./AgentNode";
import { FunctionNode } from "./FunctionNode";
import { GripVertical, Plus, Trash2, Copy, Play, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FunctionSelector } from "@/components/FunctionSelector";
import { AgentSelector } from "@/components/AgentSelector";
import { useState } from "react";
import type { Stage as StageType } from "@/types/workflow";

interface StageProps {
  stage: StageType;
  stageNumber: number;
  stageIndex: number;
  selectedNode: string | null;
  connectingFrom: string | null;
  layoutId?: string;
  customAgents?: any[];
  onSelectNode: (id: string | null) => void;
  onAddAgent: (stageId: string, agentTemplate: any) => void;
  onAddNode: (stageId: string, template: any, nodeType: "agent" | "function" | "tool") => void;
  onDeleteAgent: (agentId: string) => void;
  onDeleteStage: (stageId: string) => void;
  onRenameStage: (stageId: string, name: string) => void;
  onReorderStages: (fromIndex: number, toIndex: number) => void;
  onToggleMinimize: (agentId: string) => void;
  onToggleLock: (nodeId: string) => void;
  onPortClick: (agentId: string, isOutput: boolean, outputPort?: string) => void;
  onRunAgent?: (agentId: string, customInput?: string) => void;
  onRunFunction?: (functionId: string, customInput?: string) => void;
  onCloneStage?: (stageId: string) => void;
  onRunStage?: (stageId: string) => void;
}

export const Stage = ({
  stage,
  stageNumber,
  stageIndex,
  selectedNode,
  connectingFrom,
  layoutId = 'default',
  customAgents = [],
  onSelectNode,
  onAddAgent,
  onAddNode,
  onDeleteAgent,
  onDeleteStage,
  onRenameStage,
  onReorderStages,
  onToggleMinimize,
  onToggleLock,
  onPortClick,
  onRunAgent,
  onRunFunction,
  onCloneStage,
  onRunStage,
}: StageProps) => {
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isAddFunctionOpen, setIsAddFunctionOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const displayName = stage.name || `Stage ${stageNumber}`;
  const [editedName, setEditedName] = useState(displayName);
  const [stageMinimized, setStageMinimized] = useState(false);

  // Check if all nodes are minimized to determine initial state
  const allMinimized = stage.nodes.length > 0 && stage.nodes.every(node => node.minimized);

  const handleToggleAllMinimize = () => {
    // Determine target state: if currently minimized, expand all; otherwise minimize all
    const targetMinimized = !stageMinimized;
    
    // Set all nodes to the target state
    stage.nodes.forEach(node => {
      if (node.minimized !== targetMinimized) {
        onToggleMinimize(node.id);
      }
    });
    
    setStageMinimized(targetMinimized);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("stageIndex", stageIndex.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const templateData = e.dataTransfer.types.includes("agenttemplate");
    const stageData = e.dataTransfer.types.includes("text/plain");
    
    if (templateData) {
      e.currentTarget.classList.add("border-primary");
    } else if (stageData) {
      e.dataTransfer.dropEffect = "move";
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("border-primary");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-primary");
    
    const templateData = e.dataTransfer.getData("agentTemplate");
    const nodeType = e.dataTransfer.getData("nodeType") as "agent" | "function" | "tool";
    const draggedStageIndex = e.dataTransfer.getData("stageIndex");
    
    if (templateData) {
      const template = JSON.parse(templateData);
      if (nodeType && nodeType !== "agent") {
        onAddNode(stage.id, template, nodeType);
      } else {
        onAddAgent(stage.id, template);
      }
    } else if (draggedStageIndex) {
      const fromIndex = parseInt(draggedStageIndex);
      if (fromIndex !== stageIndex) {
        onReorderStages(fromIndex, stageIndex);
      }
    }
  };

  const completedNodes = stage.nodes.filter((n) => n.status === "complete").length;
  const progress = stage.nodes.length > 0 ? (completedNodes / stage.nodes.length) * 100 : 0;

  const handleAddAgent = (template: any) => {
    onAddAgent(stage.id, template);
    setIsAddAgentOpen(false);
  };

  const handleAddFunction = (functionDef: any) => {
    onAddNode(stage.id, functionDef, "function");
    setIsAddFunctionOpen(false);
  };

  const handleNameBlur = () => {
    if (editedName.trim() && editedName !== displayName) {
      onRenameStage(stage.id, editedName.trim());
    } else {
      setEditedName(displayName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameBlur();
    } else if (e.key === "Escape") {
      setEditedName(displayName);
      setIsEditingName(false);
    }
  };

  return (
    <Card
      className="p-3 bg-card/80 backdrop-blur border-border/60 shadow-md transition-colors w-full max-w-full"
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/60">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move hidden lg:block" />
        <div className="flex-1">
          {isEditingName ? (
            <Input
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              className="h-7 text-sm font-semibold"
              autoFocus
            />
          ) : (
            <h3 
              className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsEditingName(true)}
            >
              {displayName}
            </h3>
          )}
          <p className="text-xs text-muted-foreground hidden lg:block">Drag agents here to add them</p>
        </div>
        
        {/* Mobile Add Agent and Add Function Buttons */}
        <Button 
          variant="outline" 
          size="sm" 
          className="lg:hidden gap-2"
          onClick={() => setIsAddAgentOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </Button>

        <AgentSelector
          open={isAddAgentOpen}
          onOpenChange={setIsAddAgentOpen}
          onSelectAgent={handleAddAgent}
          customAgents={customAgents}
        />

        <Button 
          variant="outline" 
          size="sm" 
          className="lg:hidden gap-2"
          onClick={() => setIsAddFunctionOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Function
        </Button>

        <FunctionSelector
          open={isAddFunctionOpen}
          onOpenChange={setIsAddFunctionOpen}
          onSelectFunction={handleAddFunction}
        />
        
        {onRunStage && (
          <Button variant="ghost" size="sm" onClick={() => onRunStage(stage.id)} title="Run Stage">
            <Play className="h-4 w-4 text-primary" />
          </Button>
        )}
        
        {stage.nodes.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleToggleAllMinimize} 
            title={stageMinimized ? "Expand All" : "Collapse All"}
          >
            {stageMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {onCloneStage && (
          <Button variant="ghost" size="sm" onClick={() => onCloneStage(stage.id)} title="Clone Stage">
            <Copy className="h-4 w-4" />
          </Button>
        )}
        
        <Button variant="ghost" size="sm" onClick={() => onDeleteStage(stage.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="min-h-[100px]">
        {stage.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground hidden lg:block">Drop an agent or function here</p>
            <p className="text-sm text-muted-foreground lg:hidden">No nodes yet</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 items-start">
            {stage.nodes.map((node, index) => (
              <div 
                key={node.id} 
                id={`agent-${node.id}`}
                className={node.minimized ? "w-16 flex-shrink-0" : "w-full md:w-[calc(50%-0.375rem)] flex-shrink-0"}
              >
                {node.nodeType === "agent" ? (
                  <AgentNode
                    agent={node}
                    isSelected={selectedNode === node.id}
                    isConnecting={connectingFrom !== null}
                    agentNumber={`${stageNumber}.${index + 1}`}
                    stageIndex={stageNumber - 1}
                    layoutId={layoutId}
                    onSelect={() => onSelectNode(node.id)}
                    onDelete={() => onDeleteAgent(node.id)}
                    onToggleMinimize={() => onToggleMinimize(node.id)}
                    onToggleLock={() => onToggleLock(node.id)}
                    onPortClick={onPortClick}
                    onRun={onRunAgent ? () => onRunAgent(node.id) : undefined}
                  />
                ) : node.nodeType === "function" ? (
                  <FunctionNode
                    node={node}
                    isSelected={selectedNode === node.id}
                    isConnecting={connectingFrom !== null}
                    nodeNumber={`${stageNumber}.${index + 1}`}
                    stageIndex={stageNumber - 1}
                    layoutId={layoutId}
                    onSelect={() => onSelectNode(node.id)}
                    onDelete={() => onDeleteAgent(node.id)}
                    onToggleMinimize={() => onToggleMinimize(node.id)}
                    onToggleLock={() => onToggleLock(node.id)}
                    onPortClick={onPortClick}
                    onRun={onRunFunction ? () => onRunFunction(node.id) : undefined}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground p-2">Tool nodes coming soon</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-xs font-medium text-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
};
