import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowCanvasMode } from "@/components/workflow/WorkflowCanvasMode";
import { SimpleView } from "@/components/workflow/SimpleView";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { OutputLog } from "@/components/output/OutputLog";
import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { useState } from "react";
import type { 
  Workflow, 
  WorkflowNode, 
  AgentNode, 
  FunctionNode, 
  ToolNode,
  Stage,
  Connection,
  ToolInstance,
  LogEntry,
  Note 
} from "@/types/workflow";
import { FunctionExecutor } from "@/lib/functionExecutor";

// Legacy export for backward compatibility
export type { ToolInstance, LogEntry } from "@/types/workflow";
export type Agent = AgentNode;

const Index = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectingFromPort, setConnectingFromPort] = useState<string | undefined>(undefined);
  const [userInput, setUserInput] = useState<string>("");
  const [workflowName, setWorkflowName] = useState<string>("Untitled Workflow");
  const [customAgents, setCustomAgents] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedModel, setSelectedModel] = useState<"gemini-2.5-flash" | "gemini-2.5-pro" | "gemini-2.5-flash-lite" | "claude-sonnet-4-5" | "claude-haiku-4-5" | "claude-opus-4-1" | "grok-4-fast-reasoning" | "grok-4-fast-non-reasoning">("gemini-2.5-flash");
  const [responseLength, setResponseLength] = useState<number>(16384);
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(false);
  const [thinkingBudget, setThinkingBudget] = useState<number>(0);
  const [workflow, setWorkflow] = useState<Workflow>({
    stages: [],
    connections: [],
    notes: [],
    viewMode: "stacked",
  });

  const addLog = (type: LogEntry["type"], message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev, { time, type, message }]);
  };

  const handleThinkingEnabledChange = (enabled: boolean) => {
    setThinkingEnabled(enabled);
    // When enabling thinking, default to -1 (fully activated) if currently 0
    if (enabled && thinkingBudget === 0) {
      setThinkingBudget(-1);
    } else if (!enabled) {
      // When disabling, reset to 0
      setThinkingBudget(0);
    }
  };

  const toggleViewMode = () => {
    setWorkflow((prev) => {
      const currentMode = prev.viewMode || "stacked";
      let nextMode: "stacked" | "canvas" | "simple";
      
      if (currentMode === "stacked") {
        nextMode = "canvas";
      } else if (currentMode === "canvas") {
        nextMode = "simple";
      } else {
        nextMode = "stacked";
      }
      
      return {
        ...prev,
        viewMode: nextMode,
      };
    });
  };

  const setViewMode = (mode: "stacked" | "canvas" | "simple") => {
    setWorkflow((prev) => ({
      ...prev,
      viewMode: mode,
    }));
  };

  const updateStagePosition = (stageId: string, position: { x: number; y: number }) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId ? { ...stage, position } : stage
      ),
    }));
  };

  const updateNodePosition = (nodeId: string, position: { x: number; y: number }) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) =>
          node.id === nodeId ? { ...node, position } : node
        ),
      })),
    }));
  };

  const autoLayoutVertical = () => {
    const stageGap = 50;
    const nodeGap = 30;
    const startX = 100;
    let currentY = 100;
    const nodeWidth = 250;
    const nodeHeight = 150;
    const stagePaddingLeft = 40;
    const stagePaddingTop = 100;
    const stagePaddingBottom = 24;

    setWorkflow((prev) => {
      const updatedStages = prev.stages.map((stage) => {
        if (stage.nodes.length === 0) {
          // Empty stage - set position directly
          const emptyStagePosition = { x: startX, y: currentY };
          currentY += 300 + stageGap; // Default empty stage height
          return { ...stage, position: emptyStagePosition };
        }

        // Arrange nodes in a grid within the stage
        const nodesPerRow = Math.ceil(Math.sqrt(stage.nodes.length));
        const updatedNodes = stage.nodes.map((node, index) => {
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;
          const nodeX = startX + stagePaddingLeft + col * (nodeWidth + nodeGap);
          const nodeY = currentY + stagePaddingTop + row * (nodeHeight + nodeGap);
          return { ...node, position: { x: nodeX, y: nodeY } };
        });

        const numRows = Math.ceil(stage.nodes.length / nodesPerRow);
        const stageHeight = numRows * (nodeHeight + nodeGap) + stagePaddingTop + stagePaddingBottom + nodeGap;
        currentY += stageHeight + stageGap;
        
        return { ...stage, nodes: updatedNodes, position: undefined };
      });

      return { ...prev, stages: updatedStages };
    });
  };

  const autoLayoutHorizontal = () => {
    const stageGap = 50;
    const nodeGap = 30;
    const startY = 100;
    let currentX = 100;
    const nodeWidth = 250;
    const nodeHeight = 150;
    const stagePaddingLeft = 40;
    const stagePaddingTop = 100;
    const stagePaddingRight = 24;

    setWorkflow((prev) => {
      const updatedStages = prev.stages.map((stage) => {
        if (stage.nodes.length === 0) {
          // Empty stage - set position directly
          const emptyStagePosition = { x: currentX, y: startY };
          currentX += 400 + stageGap; // Default empty stage width
          return { ...stage, position: emptyStagePosition };
        }

        // Arrange nodes in a grid within the stage
        const nodesPerRow = Math.ceil(Math.sqrt(stage.nodes.length));
        const updatedNodes = stage.nodes.map((node, index) => {
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;
          const nodeX = currentX + stagePaddingLeft + col * (nodeWidth + nodeGap);
          const nodeY = startY + stagePaddingTop + row * (nodeHeight + nodeGap);
          return { ...node, position: { x: nodeX, y: nodeY } };
        });

        const stageWidth = nodesPerRow * (nodeWidth + nodeGap) + stagePaddingLeft + stagePaddingRight + nodeGap;
        currentX += stageWidth + stageGap;
        
        return { ...stage, nodes: updatedNodes, position: undefined };
      });

      return { ...prev, stages: updatedStages };
    });
  };

  const autoLayoutGrid = () => {
    const stageGap = 50;
    const nodeGap = 30;
    const startX = 100;
    const startY = 100;
    const nodeWidth = 250;
    const nodeHeight = 150;
    const stagePaddingLeft = 40;
    const stagePaddingTop = 100;
    const stagePaddingRight = 24;
    const stagePaddingBottom = 24;
    
    const stagesPerRow = Math.ceil(Math.sqrt(workflow.stages.length));
    const defaultStageWidth = 400;
    const defaultStageHeight = 300;

    setWorkflow((prev) => {
      const updatedStages = prev.stages.map((stage, stageIndex) => {
        const stageRow = Math.floor(stageIndex / stagesPerRow);
        const stageCol = stageIndex % stagesPerRow;
        
        // Calculate stage position in grid
        const stageX = startX + stageCol * (600 + stageGap);
        const stageY = startY + stageRow * (500 + stageGap);
        
        if (stage.nodes.length === 0) {
          // Empty stage - set position directly
          return { ...stage, position: { x: stageX, y: stageY } };
        }
        
        // Arrange nodes in a grid within the stage
        const nodesPerRow = Math.ceil(Math.sqrt(stage.nodes.length));
        const updatedNodes = stage.nodes.map((node, index) => {
          const row = Math.floor(index / nodesPerRow);
          const col = index % nodesPerRow;
          const nodeX = stageX + stagePaddingLeft + col * (nodeWidth + nodeGap);
          const nodeY = stageY + stagePaddingTop + row * (nodeHeight + nodeGap);
          return { ...node, position: { x: nodeX, y: nodeY } };
        });
        
        return { ...stage, nodes: updatedNodes, position: undefined };
      });

      return { ...prev, stages: updatedStages };
    });
  };

  const addStage = () => {
    // Calculate position for new stage - below all existing stages
    let newStageY = 100; // Start position
    const startX = 100;
    const stageGap = 50;
    const stagePaddingTop = 100;
    const stagePaddingBottom = 24;
    const nodeWidth = 250;
    const nodeHeight = 150;

    workflow.stages.forEach((stage) => {
      if (stage.nodes.length === 0) {
        // Empty stage has default height
        newStageY += 300 + stageGap;
      } else {
        // Calculate stage height from nodes
        let minY = Infinity, maxY = -Infinity;
        stage.nodes.forEach((node, nodeIndex) => {
          const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
          minY = Math.min(minY, nodeY);
          maxY = Math.max(maxY, nodeY + nodeHeight);
        });
        const stageHeight = (maxY - minY) + stagePaddingTop + stagePaddingBottom;
        newStageY += stageHeight + stageGap;
      }
    });

    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: `Stage ${workflow.stages.length + 1}`,
      nodes: [],
      position: { x: startX, y: newStageY },
    };
    setWorkflow((prev) => ({
      ...prev,
      stages: [...prev.stages, newStage],
    }));
  };

  const renameStage = (stageId: string, name: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId ? { ...stage, name } : stage
      ),
    }));
  };

  const reorderStages = (fromIndex: number, toIndex: number) => {
    setWorkflow((prev) => {
      const newStages = [...prev.stages];
      const [movedStage] = newStages.splice(fromIndex, 1);
      newStages.splice(toIndex, 0, movedStage);

      // Validate connections after reordering
      const getStageIndex = (nodeId: string): number => {
        for (let i = 0; i < newStages.length; i++) {
          if (newStages[i].nodes.some(n => n.id === nodeId)) {
            return i;
          }
        }
        return -1;
      };

      // Remove connections where output stage is after input stage (backwards connections)
      const validConnections = prev.connections.filter((conn) => {
        const fromStageIndex = getStageIndex(conn.fromNodeId);
        const toStageIndex = getStageIndex(conn.toNodeId);
        return fromStageIndex !== -1 && toStageIndex !== -1 && fromStageIndex < toStageIndex;
      });

      const removedCount = prev.connections.length - validConnections.length;
      if (removedCount > 0) {
        addLog("warning", `Removed ${removedCount} invalid connection(s) after stage reordering`);
      }

      return {
        ...prev,
        stages: newStages,
        connections: validConnections,
      };
    });
  };

  const addNode = (stageId: string, template: any, nodeType: "agent" | "function" | "tool" = "agent") => {
    let newNode: WorkflowNode;

    if (nodeType === "agent") {
      newNode = {
        id: `agent-${Date.now()}`,
        nodeType: "agent",
        name: template.name,
        type: template.id,
        systemPrompt: template.defaultSystemPrompt || `You are a ${template.name} agent.`,
        userPrompt: template.defaultUserPrompt || "Process the following input: {input}",
        tools: [],
        status: "idle",
      } as AgentNode;
    } else if (nodeType === "function") {
      newNode = {
        id: `function-${Date.now()}`,
        nodeType: "function",
        name: template.name,
        functionType: template.id,
        config: {},
        outputPorts: template.supportsMultipleOutputs 
          ? ["output_1"] 
          : (template.outputs || ["output"]),
        outputCount: template.supportsMultipleOutputs ? 1 : undefined,
        outputs: {},
        status: "idle",
      } as FunctionNode;

    } else {
      newNode = {
        id: `tool-${Date.now()}`,
        nodeType: "tool",
        name: template.name,
        toolType: template.id,
        config: {},
        status: "idle",
      } as ToolNode;
    }

    setWorkflow((prev) => {
      const targetStage = prev.stages.find(s => s.id === stageId);
      if (!targetStage) return prev;

      const nodeHeight = 150;
      const nodeSpacing = 30;

      // Calculate position for the new node - below lowest, left of leftmost
      if (targetStage.nodes.length === 0) {
        // First node in the stage
        if (targetStage.position) {
          const stagePaddingLeft = 40;
          const stagePaddingTop = 100;
          newNode.position = {
            x: targetStage.position.x + stagePaddingLeft,
            y: targetStage.position.y + stagePaddingTop,
          };
        } else {
          newNode.position = { x: 0, y: 0 };
        }
      } else {
        // Find the leftmost X and lowest Y among existing nodes
        let minX = Infinity;
        let maxY = -Infinity;
        
        targetStage.nodes.forEach((node) => {
          const nodeX = node.position?.x ?? 0;
          const nodeY = node.position?.y ?? 0;
          minX = Math.min(minX, nodeX);
          maxY = Math.max(maxY, nodeY);
        });

        // Position new node: same X as leftmost, below the lowest
        newNode.position = {
          x: minX,
          y: maxY + nodeHeight + nodeSpacing,
        };
      }

      return {
        ...prev,
        stages: prev.stages.map((stage) =>
          stage.id === stageId
            ? { ...stage, nodes: [...stage.nodes, newNode] }
            : stage
        ),
      };
    });
  };

  // Legacy method for backward compatibility
  const addAgent = (stageId: string, agentTemplate: any) => {
    addNode(stageId, agentTemplate, "agent");
  };

  const addFunction = (stageId: string, functionTemplate: any) => {
    addNode(stageId, functionTemplate, "function");
  };

  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          
          const updatedNode = { ...node, ...updates } as WorkflowNode;
          
          // If outputCount changed for a function node, update outputPorts
          if (updatedNode.nodeType === "function" && "outputCount" in updates) {
            const functionNode = updatedNode as FunctionNode;
            const count = functionNode.outputCount || 1;
            functionNode.outputPorts = Array.from({ length: count }, (_, i) => `output_${i + 1}`);
          }
          
          return updatedNode;
        }),
      })),
    }));
  };

  // Legacy method for backward compatibility
  const updateAgent = (agentId: string, updates: Partial<AgentNode>) => {
    updateNode(agentId, updates);
  };

  const runStage = async (stageId: string) => {
    const stage = workflow.stages.find((s) => s.id === stageId);
    if (!stage) return;
    
    addLog("info", `🎯 Stage "${stage.name}" execution started`);
    setLogs([]);
    addLog("info", `🎯 Stage "${stage.name}" execution started`);
    
    // Reset all non-locked nodes in this stage to idle
    stage.nodes.forEach((node) => {
      if (!node.locked) {
        updateNode(node.id, { status: "idle", output: undefined });
      }
    });

    // Execute all nodes in the stage sequentially
    for (const node of stage.nodes) {
      // Skip locked nodes
      if (node.locked) {
        addLog("info", `${node.nodeType === "agent" ? "Agent" : "Function"} "${node.name}" is locked, skipping execution`);
        continue;
      }

      // Get input from connected nodes or use user input
      const incomingConnections = workflow.connections.filter(
        (c) => c.toNodeId === node.id
      );
      
      let input = userInput || "";
      if (incomingConnections.length > 0) {
        const allNodes = workflow.stages.flatMap((s) => s.nodes);
        const outputs = incomingConnections
          .map((c) => {
            const fromNode = allNodes.find((n) => n.id === c.fromNodeId);
            if (!fromNode) return "";
            
            // Handle output port selection for multi-output functions
            if (c.fromOutputPort && fromNode.nodeType === "function") {
              const funcNode = fromNode as FunctionNode;
              const portValue = funcNode.outputs?.[c.fromOutputPort];
              if (portValue !== undefined) {
                return portValue;
              }
              if (typeof funcNode.output === 'object' && funcNode.output !== null) {
                return (funcNode.output as any)[c.fromOutputPort] || "";
              }
              return funcNode.output || "";
            }
            
            return fromNode.output || "";
          })
          .filter(Boolean);
        if (outputs.length > 0) {
          input = outputs.join("\n\n");
        }
      }

      // Execute the node based on type
      if (node.nodeType === "agent") {
        await runSingleAgent(node.id, input);
      } else if (node.nodeType === "function") {
        await runSingleFunction(node.id, input);
      }
    }
    
    addLog("success", `✓ Stage "${stage.name}" execution completed`);
  };

  const toggleMinimize = (nodeId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) =>
          node.id === nodeId ? { ...node, minimized: !node.minimized } : node
        ),
      })),
    }));
  };

  const toggleNodeLock = (nodeId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) =>
          node.id === nodeId ? { ...node, locked: !node.locked } : node
        ),
      })),
    }));
  };

  const cloneNode = (nodeId: string) => {
    let clonedNodeId: string | null = null;

    setWorkflow((prev) => {
      let foundStageId: string | null = null;
      let nodeToClone: WorkflowNode | null = null;

      // Find the node and its stage
      for (const stage of prev.stages) {
        const node = stage.nodes.find(n => n.id === nodeId);
        if (node) {
          foundStageId = stage.id;
          nodeToClone = node;
          break;
        }
      }

      if (!foundStageId || !nodeToClone) return prev;

      // Create a deep copy of the node with a new ID
      const clonedNode: WorkflowNode = JSON.parse(JSON.stringify(nodeToClone));
      clonedNode.id = `${nodeToClone.nodeType}-${Date.now()}`;
      clonedNode.name = `${nodeToClone.name} (Copy)`;
      clonedNode.output = undefined; // Clear the output
      clonedNode.status = "idle";
      
      // Store the cloned node ID to select it after update
      clonedNodeId = clonedNode.id;
      
      // Clear outputs for function nodes
      if (clonedNode.nodeType === "function") {
        (clonedNode as FunctionNode).outputs = {};
      }

      // Offset position by 50px right and 50px down
      if (nodeToClone.position) {
        clonedNode.position = {
          x: nodeToClone.position.x + 50,
          y: nodeToClone.position.y + 50,
        };
      }

      return {
        ...prev,
        stages: prev.stages.map((stage) =>
          stage.id === foundStageId
            ? { ...stage, nodes: [...stage.nodes, clonedNode] }
            : stage
        ),
      };
    });

    // Select the cloned node
    if (clonedNodeId) {
      setSelectedNode(clonedNodeId);
    }

    addLog("success", "Node cloned successfully");
  };

  const cloneStage = (stageId: string) => {
    setWorkflow((prev) => {
      const stageToClone = prev.stages.find(s => s.id === stageId);
      if (!stageToClone) return prev;

      // Deep copy the stage
      const clonedStage: Stage = JSON.parse(JSON.stringify(stageToClone));
      clonedStage.id = `stage-${Date.now()}`;
      clonedStage.name = `${stageToClone.name} (Copy)`;

      // Update all node IDs in the cloned stage
      clonedStage.nodes = clonedStage.nodes.map((node) => {
        const clonedNode = { ...node };
        clonedNode.id = `${node.nodeType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        clonedNode.output = undefined;
        clonedNode.status = "idle";
        
        // Clear outputs for function nodes
        if (clonedNode.nodeType === "function") {
          (clonedNode as FunctionNode).outputs = {};
        }

        // Offset position if exists
        if (clonedNode.position) {
          clonedNode.position = {
            x: clonedNode.position.x + 50,
            y: clonedNode.position.y + 50,
          };
        }
        return clonedNode;
      });

      // Offset stage position if exists
      if (clonedStage.position) {
        clonedStage.position = {
          x: clonedStage.position.x + 100,
          y: clonedStage.position.y + 100,
        };
      }

      // Insert after the original stage
      const stageIndex = prev.stages.findIndex(s => s.id === stageId);
      const newStages = [...prev.stages];
      newStages.splice(stageIndex + 1, 0, clonedStage);

      return {
        ...prev,
        stages: newStages,
      };
    });

    addLog("success", "Stage cloned successfully");
  };

  const deleteNode = (stageId: string, nodeId: string) => {
    setWorkflow((prev) => {
      const targetStage = prev.stages.find(s => s.id === stageId);
      if (!targetStage) return prev;

      const remainingNodes = targetStage.nodes.filter((node) => node.id !== nodeId);

      // If deleting the last node, preserve the stage position
      let updatedStagePosition = targetStage.position;
      if (remainingNodes.length === 0 && targetStage.nodes.length > 0) {
        // Calculate current stage position from nodes before deletion
        const stagePaddingLeft = 40;
        const stagePaddingTop = 100;
        const nodeWidth = 250;
        const nodeHeight = 150;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        targetStage.nodes.forEach((node, nodeIndex) => {
          const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
          const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
          minX = Math.min(minX, nodeX);
          minY = Math.min(minY, nodeY);
          maxX = Math.max(maxX, nodeX + nodeWidth);
          maxY = Math.max(maxY, nodeY + nodeHeight);
        });

        // Store the stage position so it stays where it is
        updatedStagePosition = {
          x: minX - stagePaddingLeft,
          y: minY - stagePaddingTop,
        };
      }

      return {
        ...prev,
        stages: prev.stages.map((stage) => 
          stage.id === stageId 
            ? { ...stage, nodes: remainingNodes, position: updatedStagePosition }
            : stage
        ),
        connections: prev.connections.filter(
          (conn) => conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId
        ),
      };
    });

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    }
  };

  // Legacy method for backward compatibility
  const deleteAgent = (nodeId: string) => {
    // For legacy calls, we don't know the stage ID, so we pass empty string
    const stage = workflow.stages.find(s => s.nodes.some(n => n.id === nodeId));
    deleteNode(stage?.id || '', nodeId);
  };

  const deleteStage = (stageId: string) => {
    setWorkflow((prev) => {
      const stageToDelete = prev.stages.find((s) => s.id === stageId);
      const nodeIdsToDelete = stageToDelete?.nodes.map((n) => n.id) || [];
      
      return {
        ...prev,
        stages: prev.stages.filter((stage) => stage.id !== stageId),
        // Remove all connections involving nodes in this stage
        connections: prev.connections.filter(
          (conn) => 
            !nodeIdsToDelete.includes(conn.fromNodeId) && 
            !nodeIdsToDelete.includes(conn.toNodeId)
        ),
      };
    });
  };

  const addToolInstance = (nodeId: string, toolId: string) => {
    const newToolInstance: ToolInstance = {
      id: `tool-${Date.now()}`,
      toolId,
      config: {},
    };
    
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) => {
          if (node.id === nodeId && node.nodeType === "agent") {
            return { ...node, tools: [...node.tools, newToolInstance] } as AgentNode;
          }
          return node;
        }),
      })),
    }));
  };

  const updateToolInstance = (nodeId: string, toolInstanceId: string, config: any) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) => {
          if (node.id === nodeId && node.nodeType === "agent") {
            return {
              ...node,
              tools: node.tools.map((tool) =>
                tool.id === toolInstanceId ? { ...tool, config } : tool
              ),
            } as AgentNode;
          }
          return node;
        }),
      })),
    }));
  };

  const removeToolInstance = (nodeId: string, toolInstanceId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) => {
          if (node.id === nodeId && node.nodeType === "agent") {
            return { ...node, tools: node.tools.filter((t) => t.id !== toolInstanceId) } as AgentNode;
          }
          return node;
        }),
      })),
    }));
  };

  const saveWorkflow = () => {
    const saveData = {
      workflow,
      userInput,
      workflowName,
      customAgents,
      selectedModel,
      responseLength,
      thinkingEnabled,
      thinkingBudget,
    };
    const json = JSON.stringify(saveData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Use workflow name in filename if it's not the default
    const filename = workflowName !== "Untitled Workflow" 
      ? `${workflowName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`
      : `workflow-${Date.now()}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper function to reposition stages vertically with proper spacing
  const repositionStagesVertically = (loadedWorkflow: Workflow) => {
    const stagePaddingLeft = 40;
    const stagePaddingTop = 100;
    const stagePaddingBottom = 24;
    const stageGap = 50;
    const nodeWidth = 250;
    const nodeHeight = 150;
    const startX = 100;
    let currentY = 100;

    const repositionedStages = loadedWorkflow.stages.map((stage) => {
      if (stage.nodes.length === 0) {
        // Empty stage
        currentY += 300 + stageGap;
        return stage;
      }

      // Calculate current bounds of nodes
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      stage.nodes.forEach((node, nodeIndex) => {
        const nodeX = node.position?.x ?? (nodeIndex % 2) * 280;
        const nodeY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
        minX = Math.min(minX, nodeX);
        minY = Math.min(minY, nodeY);
        maxX = Math.max(maxX, nodeX + nodeWidth);
        maxY = Math.max(maxY, nodeY + nodeHeight);
      });

      // Calculate where the stage should be positioned
      const targetStageX = startX;
      const targetStageY = currentY;
      
      // Calculate where nodes should be to achieve this stage position
      const targetMinX = targetStageX + stagePaddingLeft;
      const targetMinY = targetStageY + stagePaddingTop;

      // Calculate offset to move all nodes
      const deltaX = targetMinX - minX;
      const deltaY = targetMinY - minY;

      // Move all nodes by the delta
      const repositionedNodes = stage.nodes.map((node, nodeIndex) => {
        const currentX = node.position?.x ?? (nodeIndex % 2) * 280;
        const currentY = node.position?.y ?? Math.floor(nodeIndex / 2) * 180;
        return {
          ...node,
          position: {
            x: currentX + deltaX,
            y: currentY + deltaY,
          },
        };
      });

      // Calculate the stage height for positioning the next stage
      const stageHeight = (maxY - minY) + stagePaddingTop + stagePaddingBottom;
      currentY += stageHeight + stageGap;

      return {
        ...stage,
        nodes: repositionedNodes,
      };
    });

    return {
      ...loadedWorkflow,
      stages: repositionedStages,
    };
  };

  const loadWorkflow = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loaded = JSON.parse(e.target?.result as string);
        
        let loadedWorkflow: Workflow;
        
        // Handle both old format (just workflow) and new format (with metadata)
        if (loaded.workflow) {
          // New format with metadata
          loadedWorkflow = loaded.workflow;
          setUserInput(loaded.userInput || "");
          setWorkflowName(loaded.workflowName || "Untitled Workflow");
          setCustomAgents(loaded.customAgents || []);
          setSelectedModel(loaded.selectedModel || "gemini-2.5-flash");
          // Ensure responseLength is always a number, not a string like "2xl"
          const loadedLength = loaded.responseLength ?? 8192;
          setResponseLength(typeof loadedLength === 'number' ? loadedLength : 8192);
          setThinkingEnabled(loaded.thinkingEnabled || false);
          setThinkingBudget(loaded.thinkingBudget ?? 0);
        } else {
          // Old format (just the workflow object) - ensure stages array exists
          loadedWorkflow = {
            stages: loaded.stages || [],
            connections: loaded.connections || [],
            notes: loaded.notes || [],
          };
        }
        
        // Reposition stages vertically to prevent overlap
        const repositionedWorkflow = repositionStagesVertically(loadedWorkflow);
        setWorkflow(repositionedWorkflow);
        
        setSelectedNode(null);
      } catch (error) {
        console.error("Failed to load workflow:", error);
        alert("Failed to load workflow file");
      }
    };
    reader.readAsText(file);
  };

  const clearWorkflow = () => {
    if (confirm("Are you sure you want to clear the entire workflow?")) {
      setWorkflow({ stages: [], connections: [], notes: [] });
      setUserInput("");
      setWorkflowName("Untitled Workflow");
      setCustomAgents([]); // Reset to only default agents
      setSelectedModel("gemini-2.5-flash");
      setThinkingEnabled(false);
      setThinkingBudget(0);
      setSelectedNode(null);
      setConnectingFrom(null);
    }
  };

  const handleStartConnection = (nodeId: string | null, outputPort?: string) => {
    setConnectingFrom(nodeId);
    setConnectingFromPort(outputPort);
  };

  const handleCompleteConnection = (fromNodeId: string, toNodeId: string, fromOutputPort?: string) => {
    console.log("=== handleCompleteConnection START ===");
    console.log("fromNodeId:", fromNodeId);
    console.log("toNodeId:", toNodeId);
    console.log("fromOutputPort:", fromOutputPort);
    console.log("Current connections:", workflow.connections.length);
    
    addConnection(fromNodeId, toNodeId, fromOutputPort);
    setConnectingFrom(null);
    setConnectingFromPort(undefined);
    
    console.log("=== handleCompleteConnection END ===");
  };

  const addConnection = (fromNodeId: string, toNodeId: string, fromOutputPort?: string) => {
    console.log("=== addConnection START ===");
    console.log("Creating connection from", fromNodeId, "to", toNodeId, "port:", fromOutputPort);
    
    const newConnection: Connection = {
      id: `conn-${Date.now()}-${Math.random()}`,
      fromNodeId,
      toNodeId,
      fromOutputPort,
    };
    
    console.log("New connection object:", JSON.stringify(newConnection));
    
    setWorkflow((prev) => {
      const updated = {
        ...prev,
        connections: [...prev.connections, newConnection],
      };
      console.log("Workflow updated - connections count:", updated.connections.length);
      console.log("All connections:", JSON.stringify(updated.connections, null, 2));
      return updated;
    });
    
    console.log("=== addConnection END ===");
  };

  const deleteConnection = (connectionId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      connections: prev.connections.filter((conn) => conn.id !== connectionId),
    }));
  };

  const addNote = (x?: number, y?: number) => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      content: "",
      position: { x: x ?? 200, y: y ?? 200 },
      size: { width: 200, height: 200 },
      color: "#fef3c7", // Default yellow
    };
    setWorkflow((prev) => ({
      ...prev,
      notes: [...(prev.notes || []), newNote],
    }));
  };

  const updateNote = (noteId: string, updates: Partial<Note>) => {
    setWorkflow((prev) => ({
      ...prev,
      notes: (prev.notes || []).map((note) =>
        note.id === noteId ? { ...note, ...updates } : note
      ),
    }));
  };

  const deleteNote = (noteId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      notes: (prev.notes || []).filter((note) => note.id !== noteId),
    }));
  };

  // Helper to check if a value is null-like (null, empty string, empty array, empty object, or their string equivalents)
  const isNullLikeValue = (value: string): boolean => {
    if (!value || value.trim() === "") return true;
    
    const trimmed = value.trim();
    // Check for empty array or object representations
    if (trimmed === "[]" || trimmed === "{}") return true;
    
    // Try parsing as JSON to check for actual empty arrays/objects
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length === 0) return true;
      if (typeof parsed === "object" && parsed !== null && Object.keys(parsed).length === 0) return true;
    } catch {
      // Not valid JSON, continue with other checks
    }
    
    return false;
  };

  const runSingleAgent = async (nodeId: string, customInput?: string) => {
    const allNodes = workflow.stages.flatMap((s) => s.nodes);
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node || node.nodeType !== "agent") return;
    
    const agent = node as AgentNode;

    // Skip execution if node is locked
    if (agent.locked) {
      addLog("info", `Agent "${agent.name}" is locked, skipping execution`);
      return;
    }

    // Check if input is null-like and executeOnNullInput is false
    if (!agent.executeOnNullInput) {
      const incomingConnections = workflow.connections.filter((c) => c.toNodeId === nodeId);
      const allNodes = workflow.stages.flatMap((s) => s.nodes);
      const isStage1 = workflow.stages[0]?.nodes.some(n => n.id === agent.id);
      
      let input = "";
      
      if (incomingConnections.length > 0) {
        const outputsFromConnections = incomingConnections
          .map((c) => {
            const fromNode = allNodes.find((n) => n.id === c.fromNodeId);
            if (!fromNode) return "";
            
            // Determine which port to read from (universal port syntax)
            let portToRead = c.fromOutputPort;
            
            // Legacy support: if no port specified, default to first port
            if (!portToRead && fromNode.nodeType === "function") {
              const funcNode = fromNode as FunctionNode;
              if (funcNode.outputs) {
                portToRead = Object.keys(funcNode.outputs)[0] || "output";
              } else {
                portToRead = "output";
              }
            }
            
            // For functions, read from the specific port
            if (fromNode.nodeType === "function" && portToRead) {
              const funcNode = fromNode as FunctionNode;
              const portValue = funcNode.outputs?.[portToRead];
              return portValue !== undefined && portValue !== null ? String(portValue) : "";
            }
            
            // For agents, use the primary output
            return fromNode?.output || "";
          });
        
        const nonEmptyOutputs = outputsFromConnections.filter((v) => v !== undefined && v !== null && String(v).trim().length > 0);
        
        if (nonEmptyOutputs.length > 0) {
          input = nonEmptyOutputs.join("\n\n---\n\n");
        } else {
          input = "";
        }
      } else if (isStage1) {
        input = userInput || "";
      }
      
      if (isNullLikeValue(input)) {
        addLog("warning", `Agent "${agent.name}" skipped - input is null/empty and "Execute on NULL Input" is disabled`);
        updateNode(nodeId, { status: "idle", output: "" });
        return;
      }
    }

    addLog("info", `Starting agent: ${agent.name}`);
    updateNode(nodeId, { status: "running" });
    
    try {
      // Get input from connected nodes or use user's initial input
      const incomingConnections = workflow.connections.filter(
        (c) => c.toNodeId === nodeId
      );
      
      let input = "";
      const isStage1 = workflow.stages[0]?.nodes.some(n => n.id === agent.id);
      
      if (incomingConnections.length > 0) {
        const outputsFromConnections = incomingConnections
          .map((c) => {
            const fromNode = allNodes.find((n) => n.id === c.fromNodeId);
            if (!fromNode) return "";
            
            // Special handling for Content function
            if (fromNode.nodeType === "function" && (fromNode as FunctionNode).functionType === "content") {
              const contentNode = fromNode as FunctionNode;
              return contentNode.output || contentNode.config.content || "";
            }
            
            // Determine which port to read from (universal port syntax)
            let portToRead = c.fromOutputPort;
            
            // Legacy support: if no port specified, default to first port
            if (!portToRead && fromNode.nodeType === "function") {
              const funcNode = fromNode as FunctionNode;
              if (funcNode.outputs) {
                portToRead = Object.keys(funcNode.outputs)[0] || "output";
              } else {
                portToRead = "output";
              }
            }
            
            // For functions, read from the specific port
            if (fromNode.nodeType === "function" && portToRead) {
              const funcNode = fromNode as FunctionNode;
              const portValue = funcNode.outputs?.[portToRead];
              return portValue !== undefined && portValue !== null ? String(portValue) : "";
            }
            
            // For agents, use the primary output
            return fromNode?.output || "";
          });
        
        const nonEmptyOutputs = outputsFromConnections.filter((v) => v !== undefined && v !== null && String(v).trim().length > 0);
        
        if (nonEmptyOutputs.length > 0) {
          input = nonEmptyOutputs.join("\n\n---\n\n");
          addLog("info", `Agent ${agent.name} received input from ${incomingConnections.length} connection(s)`);
        } else {
          input = "";
        }
      } else if (isStage1) {
        // Only use userInput if in stage 1 and no connections
        input = userInput || "";
      }

      // Log tool execution
      if (agent.tools.length > 0) {
        agent.tools.forEach(tool => {
          addLog("running", `Executing tool: ${tool.toolId}`);
        });
      }
      
      // {input} uses the resolved input, {prompt} uses global userInput only in stage 1
      const promptValue = isStage1 ? (userInput || "") : input;
      
      const userPrompt = agent.userPrompt
        .replace(/{input}/gi, input)
        .replace(/{prompt}/gi, promptValue);
      
      // Convert tool instances to the format expected by the edge function
      const toolsPayload = agent.tools.map(t => ({
        toolId: t.toolId,
        config: t.config,
      }));
      
      addLog("running", `Agent ${agent.name} processing with AI...`);
      
      // Determine which edge function to use based on model
      const edgeFunction = selectedModel.startsWith("claude-") 
        ? "run-agent-anthropic" 
        : selectedModel.startsWith("grok-")
        ? "run-agent-xai"
        : "run-agent";
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${edgeFunction}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: agent.systemPrompt,
          userPrompt,
          tools: toolsPayload,
          model: selectedModel,
          maxOutputTokens: responseLength,
          thinkingEnabled,
          thinkingBudget,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Full error from edge function:", errorText);
        throw new Error(errorText || `Server error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error("No response body reader available");
      }

      let accumulatedOutput = "";
      let textBuffer = "";
      let lastUpdate = Date.now();
      let chunksReceived = 0;
      let isFirstDelta = true;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`Client stream ended. Total chunks: ${chunksReceived}, Final output length: ${accumulatedOutput.length}`);
            break;
          }

          chunksReceived++;
          textBuffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              
              if (parsed.type === 'tools' && parsed.toolOutputs) {
                // Log tool outputs
                parsed.toolOutputs.forEach((toolOutput: any) => {
                  console.log(`Tool Output [${toolOutput.toolId}]:`, toolOutput.output);
                  addLog("info", `Tool Output [${toolOutput.toolId}]: ${JSON.stringify(toolOutput.output, null, 2)}`);
                });
              } else if (parsed.type === 'delta' && parsed.text) {
                // Clear output on first delta to prevent jumpy updates
                if (isFirstDelta) {
                  updateNode(nodeId, { output: "" });
                  isFirstDelta = false;
                }
                
                // Accumulate text and update node in real-time
                accumulatedOutput += parsed.text;
                
                // Throttle UI updates to avoid excessive re-renders
                const now = Date.now();
                if (now - lastUpdate > 100) {
                  updateNode(nodeId, { output: accumulatedOutput });
                  lastUpdate = now;
                }
              } else if (parsed.type === 'done') {
                // Stream complete
                console.log(`Stream finished. Reason: ${parsed.finishReason}, Total output length: ${accumulatedOutput.length}`);
                if (parsed.truncated) {
                  addLog("warning", `Response was truncated (${parsed.finishReason})`);
                }
              }
            } catch (parseError) {
              console.error(`Failed to parse SSE chunk at line ${chunksReceived}:`, parseError);
            }
          }
        }
        
        // Final update to ensure latest content is shown
        updateNode(nodeId, { output: accumulatedOutput });
      } catch (streamError) {
        console.error("Stream reading error:", streamError);
        addLog("error", `Stream error: ${streamError}`);
      } finally {
        reader.releaseLock();
      }
      
      updateNode(nodeId, { status: "complete", output: accumulatedOutput || "No output generated" });
      addLog("success", `Agent ${agent.name} completed successfully`);
    } catch (error) {
      console.error("Agent execution failed:", error);
      updateNode(nodeId, { status: "error", output: `Error: ${error}` });
      addLog("error", `Agent ${agent.name} failed: ${error}`);
    }
  };

  const runSingleFunction = async (nodeId: string, customInput?: string) => {
    const allNodes = workflow.stages.flatMap((s) => s.nodes);
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node || node.nodeType !== "function") return;
    
    const functionNode = node as FunctionNode;

    // Skip execution if node is locked
    if (functionNode.locked) {
      addLog("info", `Function "${functionNode.name}" is locked, skipping execution`);
      return;
    }

    // Check if input is null-like and executeOnNullInput is false
    if (!functionNode.executeOnNullInput) {
      const incomingConnections = workflow.connections.filter((c) => c.toNodeId === nodeId);
      const allNodes = workflow.stages.flatMap((s) => s.nodes);
      const isStage1 = workflow.stages[0]?.nodes.some(n => n.id === functionNode.id);
      
      let input = "";
      
      if (incomingConnections.length > 0) {
        const outputsFromConnections = incomingConnections
          .map((c) => {
            const fromNode = allNodes.find((n) => n.id === c.fromNodeId);
            if (!fromNode) return "";
            
            // Determine which port to read from (universal port syntax)
            let portToRead = c.fromOutputPort;
            
            // Legacy support: if no port specified, default to first port
            if (!portToRead && fromNode.nodeType === "function") {
              const funcNode = fromNode as FunctionNode;
              if (funcNode.outputs) {
                portToRead = Object.keys(funcNode.outputs)[0] || "output";
              } else {
                portToRead = "output";
              }
            }
            
            // For functions, read from the specific port
            if (fromNode.nodeType === "function" && portToRead) {
              const funcNode = fromNode as FunctionNode;
              const portValue = funcNode.outputs?.[portToRead];
              return portValue !== undefined && portValue !== null ? String(portValue) : "";
            }
            
            // For agents, use the primary output
            return fromNode?.output || "";
          });
        
        const nonEmptyOutputs = outputsFromConnections.filter((v) => v !== undefined && v !== null && String(v).trim().length > 0);
        
        if (nonEmptyOutputs.length > 0) {
          input = nonEmptyOutputs.join("\n\n---\n\n");
        } else {
          input = "";
        }
      } else if (isStage1) {
        input = userInput || "";
      }
      
      if (isNullLikeValue(input)) {
        addLog("warning", `Function "${functionNode.name}" skipped - input is null/empty and "Execute on NULL Input" is disabled`);
        updateNode(nodeId, { status: "idle", output: "" });
        return;
      }
    }

    addLog("info", `Executing function: ${functionNode.name}`);
    updateNode(nodeId, { status: "running" });
    
    try {
      // Get input from connected nodes or use user's initial input
      const incomingConnections = workflow.connections.filter(
        (c) => c.toNodeId === nodeId
      );
      
      let input = userInput || "";
      if (incomingConnections.length > 0) {
        const outputs = incomingConnections
          .map((c) => {
            const fromNode = allNodes.find((n) => n.id === c.fromNodeId);
            if (!fromNode) return "";
            
            // Special handling for Content function - get from config if not yet executed
            if (fromNode.nodeType === "function" && (fromNode as FunctionNode).functionType === "content") {
              const contentNode = fromNode as FunctionNode;
              return contentNode.output || contentNode.config.content || "";
            }
            
            return fromNode?.output || "";
          })
          .filter(Boolean);
        
        if (outputs.length > 0) {
          input = outputs.join("\n\n---\n\n");
          addLog("info", `Function ${functionNode.name} received input from ${incomingConnections.length} connection(s)`);
        }
      }
      
      const result = await FunctionExecutor.execute(functionNode, input);
      
      if (!result.success) {
        throw new Error(result.error || "Function execution failed");
      }

      // Store the full outputs object for multi-output functions, or primary output for single-output
      const hasMultipleOutputs = Object.keys(result.outputs).length > 1;
      
      if (hasMultipleOutputs) {
        // For multi-output functions, store outputs in the outputs map and a summary in output
        const outputSummary = Object.entries(result.outputs)
          .filter(([_, value]) => value)
          .map(([key, value]) => `${key}: ${String(value).substring(0, 50)}...`)
          .join(', ') || "No outputs";
        updateNode(nodeId, { 
          status: "complete", 
          output: outputSummary,
          outputs: result.outputs 
        });
      } else {
        // For single-output functions, store in output
        const outputValue = result.outputs.output || Object.values(result.outputs)[0] || "";
        updateNode(nodeId, { 
          status: "complete", 
          output: outputValue as any,
          outputs: undefined
        });
      }
      addLog("success", `✓ Function ${functionNode.name} completed`);
    } catch (error) {
      console.error("Function execution failed:", error);
      updateNode(nodeId, { status: "error", output: `Error: ${error}` });
      addLog("error", `✗ Function ${functionNode.name} failed: ${error}`);
    }
  };

  const runWorkflow = async () => {
    const allNodes = workflow.stages.flatMap((s) => s.nodes);
    
    addLog("info", "🚀 Workflow execution started");
    setLogs([]); // Clear previous logs
    addLog("info", "🚀 Workflow execution started");
    
    // Reset all non-locked nodes to idle
    allNodes.forEach((node) => {
      if (!node.locked) {
        updateNode(node.id, { status: "idle", output: undefined });
      }
    });

    const outputs = new Map<string, string>();

    const executeAgent = async (nodeId: string, input: string): Promise<string> => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node || node.nodeType !== "agent") return "";
      
      const agent = node as AgentNode;

      // Skip execution if node is locked
      if (agent.locked) {
        addLog("info", `Agent "${agent.name}" is locked, using existing output`);
        return agent.output || "";
      }

      // Check if input is null-like and executeOnNullInput is false
      if (!agent.executeOnNullInput && isNullLikeValue(input)) {
        addLog("warning", `Agent "${agent.name}" skipped - input is null/empty and "Execute on NULL Input" is disabled`);
        updateNode(nodeId, { status: "idle", output: "" });
        return "";
      }

      addLog("info", `Starting agent: ${agent.name} (input length: ${input.length} chars)`);
      updateNode(nodeId, { status: "running" });
      
      try {
        // Log tool execution
        if (agent.tools.length > 0) {
          agent.tools.forEach(tool => {
            const toolName = tool.toolId.replace('_', ' ');
            addLog("running", `Executing tool: ${toolName}`);
          });
        }
        
        // Determine if we're in stage 1
        const agentStageIndex = workflow.stages.findIndex(s => s.nodes.some(n => n.id === nodeId));
        const isStage1 = agentStageIndex === 0;
        
        // {input} always uses the actual input from connections or stage 1 user input
        // {prompt} only uses global userInput in stage 1 OR if explicitly in template
        const promptValue = isStage1 ? (userInput || "") : input;
        
        const userPrompt = agent.userPrompt
          .replace(/{input}/gi, input)
          .replace(/{prompt}/gi, promptValue);
        
        // Convert tool instances to the format expected by the edge function
        const toolsPayload = agent.tools.map(t => ({
          toolId: t.toolId,
          config: t.config,
        }));
        
        addLog("running", `Agent ${agent.name} processing with AI...`);
        
        // Determine which edge function to use based on model
        const edgeFunction = selectedModel.startsWith("claude-") 
          ? "run-agent-anthropic" 
          : selectedModel.startsWith("grok-")
          ? "run-agent-xai"
          : "run-agent";
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${edgeFunction}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemPrompt: agent.systemPrompt,
            userPrompt,
            tools: toolsPayload,
            model: selectedModel,
            maxOutputTokens: responseLength,
            thinkingEnabled,
            thinkingBudget,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Full error from edge function:", errorText);
          throw new Error(errorText || `Server error: ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          throw new Error("No response body reader available");
        }

        let accumulatedOutput = "";
        let textBuffer = "";
        let lastUpdate = Date.now();
        let chunksReceived = 0;
        let isFirstDelta = true;
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`Workflow agent stream ended. Total chunks: ${chunksReceived}, Final output length: ${accumulatedOutput.length}`);
              break;
            }

            chunksReceived++;
            textBuffer += decoder.decode(value, { stream: true });
            
            // Process complete lines
            let newlineIndex: number;
            while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
              let line = textBuffer.slice(0, newlineIndex);
              textBuffer = textBuffer.slice(newlineIndex + 1);

              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (line.startsWith(":") || line.trim() === "") continue;
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const parsed = JSON.parse(jsonStr);
                
                if (parsed.type === 'tools' && parsed.toolOutputs) {
                  // Log tool outputs
                  parsed.toolOutputs.forEach((toolOutput: any) => {
                    console.log(`Tool Output [${toolOutput.toolId}]:`, toolOutput.output);
                    addLog("info", `Tool Output [${toolOutput.toolId}]: ${JSON.stringify(toolOutput.output, null, 2)}`);
                  });
                } else if (parsed.type === 'delta' && parsed.text) {
                  // Clear output on first delta to prevent jumpy updates
                  if (isFirstDelta) {
                    updateNode(nodeId, { output: "" });
                    isFirstDelta = false;
                  }
                  
                  // Accumulate text and update node in real-time
                  accumulatedOutput += parsed.text;
                  
                  // Throttle UI updates to avoid excessive re-renders
                  const now = Date.now();
                  if (now - lastUpdate > 100) {
                    updateNode(nodeId, { output: accumulatedOutput });
                    lastUpdate = now;
                  }
                } else if (parsed.type === 'done') {
                  // Stream complete
                  console.log(`Workflow agent finished. Reason: ${parsed.finishReason}, Total output length: ${accumulatedOutput.length}`);
                  if (parsed.truncated) {
                    addLog("warning", `Response was truncated (${parsed.finishReason})`);
                  }
                }
              } catch (parseError) {
                console.error(`Failed to parse SSE chunk at line ${chunksReceived}:`, parseError);
              }
            }
          }
          
          // Final update to ensure latest content is shown
          updateNode(nodeId, { output: accumulatedOutput });
        } catch (streamError) {
          console.error("Stream reading error:", streamError);
          addLog("error", `Stream error: ${streamError}`);
        } finally {
          reader.releaseLock();
        }
        
        updateNode(nodeId, { status: "complete", output: accumulatedOutput || "No output generated" });
        addLog("success", `✓ Agent ${agent.name} completed (output length: ${accumulatedOutput.length} chars)`);
        return accumulatedOutput;
      } catch (error) {
        console.error("Agent execution failed:", error);
        const errorMsg = `Error: ${error}`;
        updateNode(nodeId, { status: "error", output: errorMsg });
        addLog("error", `✗ Agent ${agent.name} failed: ${error}`);
        return errorMsg;
      }
    };

    const executeFunction = async (nodeId: string, input: string, fromOutputPort?: string): Promise<{ outputs: Map<string, string>; primaryOutput: string }> => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node || node.nodeType !== "function") return { outputs: new Map(), primaryOutput: "" };
      
      const functionNode = node as FunctionNode;

      // Skip execution if node is locked
      if (functionNode.locked) {
        addLog("info", `Function "${functionNode.name}" is locked, using existing output`);
        const existingOutputs = new Map<string, string>();
        
        // For multi-output functions, use the outputs map
        if (functionNode.outputs) {
          Object.entries(functionNode.outputs).forEach(([key, value]) => {
            const outputKey = `${nodeId}:${key}`;
            existingOutputs.set(outputKey, String(value));
          });
          // Use first non-empty output as primary, or concatenate all
          const primaryOutput = Object.values(functionNode.outputs).find(v => v) || 
            Object.values(functionNode.outputs).filter(v => v).join("\n\n---\n\n");
          return { outputs: existingOutputs, primaryOutput: String(primaryOutput) };
        } 
        // For single-output functions, use the output property
        else if (functionNode.output) {
          existingOutputs.set("output", String(functionNode.output));
          return { outputs: existingOutputs, primaryOutput: String(functionNode.output) };
        }
        
        return { outputs: existingOutputs, primaryOutput: "" };
      }

      // Check if input is null-like and executeOnNullInput is false
      if (!functionNode.executeOnNullInput && isNullLikeValue(input)) {
        addLog("warning", `Function "${functionNode.name}" skipped - input is null/empty and "Execute on NULL Input" is disabled`);
        updateNode(nodeId, { status: "idle", output: "" });
        return { outputs: new Map(), primaryOutput: "" };
      }

      addLog("info", `Executing function: ${functionNode.name} (input length: ${input.length} chars)`);
      updateNode(nodeId, { status: "running" });
      
      try {
        const result = await FunctionExecutor.execute(functionNode, input);
        
        if (!result.success) {
          throw new Error(result.error || "Function execution failed");
        }

        // Store all outputs with port-specific keys
        const functionOutputs = new Map<string, string>();
        Object.entries(result.outputs).forEach(([port, value]) => {
          const outputKey = `${nodeId}:${port}`;
          functionOutputs.set(outputKey, value);
        });

        // Determine primary output as a string (for nodes that don't specify a port)
        let primaryOutput: string;
        if (Object.keys(result.outputs).length > 1) {
          // Multi-output function: concatenate all non-empty outputs
          primaryOutput = Object.values(result.outputs).filter(v => v).join("\n\n---\n\n");
        } else {
          // Single-output function: use the single output value
          primaryOutput = result.outputs.output || Object.values(result.outputs)[0] || "";
        }

        // Store outputs using universal port-based structure
        // For multi-output functions, store each port value in the outputs object
        // For single-output functions, normalize to "output" port
        let normalizedOutputs: Record<string, string> = {};
        
        if (Object.keys(result.outputs).length > 1) {
          // Multi-output: use as-is (output_1, output_2, true, false, etc.)
          normalizedOutputs = { ...result.outputs };
        } else {
          // Single-output: normalize to "output" port for consistency
          const singleValue = result.outputs.output || Object.values(result.outputs)[0] || "";
          normalizedOutputs.output = singleValue;
        }
        
        updateNode(nodeId, { 
          status: "complete", 
          output: primaryOutput,  // Keep primary output for display
          outputs: normalizedOutputs  // Store port-specific values
        });
        addLog("success", `✓ Function ${functionNode.name} completed (output length: ${primaryOutput.length} chars)`);

        return { outputs: functionOutputs, primaryOutput };
      } catch (error) {
        console.error("Function execution failed:", error);
        const errorMsg = `Error: ${error}`;
        updateNode(nodeId, { status: "error", output: errorMsg });
        addLog("error", `✗ Function ${functionNode.name} failed: ${error}`);
        return { outputs: new Map(), primaryOutput: errorMsg };
      }
    };

    // Execute stages sequentially
    for (let i = 0; i < workflow.stages.length; i++) {
      const stage = workflow.stages[i];
      if (stage.nodes.length === 0) continue;

      // Filter nodes to only execute those whose dependencies are met
      // A node's dependencies are met if ALL incoming connections come from current or previous stages
      const nodesToExecute = stage.nodes.filter(node => {
        const incomingConnections = workflow.connections.filter(c => c.toNodeId === node.id);
        
        // If no incoming connections, node can execute
        if (incomingConnections.length === 0) return true;
        
        // Check if all incoming connections come from current or previous stages
        return incomingConnections.every(conn => {
          const fromNode = allNodes.find(n => n.id === conn.fromNodeId);
          if (!fromNode) return false;
          
          // Find which stage the source node is in
          const fromStageIndex = workflow.stages.findIndex(s => 
            s.nodes.some(n => n.id === conn.fromNodeId)
          );
          
          // Only execute if source is in current or previous stages
          return fromStageIndex <= i;
        });
      });

      // Skip stage if no nodes should execute
      if (nodesToExecute.length === 0) {
        addLog("info", `▸ Stage ${i + 1}: Skipped (no nodes ready for execution)`);
        continue;
      }

      const agentCount = nodesToExecute.filter(n => n.nodeType === "agent").length;
      const functionCount = nodesToExecute.filter(n => n.nodeType === "function").length;
      addLog("info", `▸ Stage ${i + 1}: Processing ${agentCount} agent(s) and ${functionCount} function(s)`);

      const nodePromises = nodesToExecute.map(async (node) => {
        // Get incoming connections for this node
        const incomingConnections = workflow.connections.filter(
          (c) => c.toNodeId === node.id
        );

        let input = userInput || "";
        
        // If there are incoming connections, use the output from the specific port
        if (incomingConnections.length > 0) {
          const rawOutputs = incomingConnections
            .map((c) => {
              const fromNode = allNodes.find(n => n.id === c.fromNodeId);
              if (!fromNode) return "";
              
              // Determine which port to read from
              let portToRead = c.fromOutputPort;
              
              // Legacy support: if no port specified, default to first port
              if (!portToRead) {
                if (fromNode.nodeType === "function") {
                  const funcNode = fromNode as FunctionNode;
                  // For functions, check if outputs exist and use the first port
                  if (funcNode.outputs) {
                    const firstPort = Object.keys(funcNode.outputs)[0];
                    portToRead = firstPort || "output";
                  } else {
                    portToRead = "output";
                  }
                } else {
                  // For agents, no port syntax needed - use the primary output
                  return outputs.get(c.fromNodeId) ?? "";
                }
              }
              
              // Read from the specific port
              const portOutput = outputs.get(`${c.fromNodeId}:${portToRead}`);
              return portOutput ?? "";
            });
          
          const nonEmptyOutputs = rawOutputs.filter((v) => v !== undefined && v !== null && String(v).trim().length > 0);
          
          if (nonEmptyOutputs.length > 0) {
            input = nonEmptyOutputs.join("\n\n---\n\n");
            addLog("info", `${node.name} received input from ${incomingConnections.length} connection(s) (${input.length} chars)`);
          } else {
            // Connections exist but all produced null-like outputs; treat input as empty
            input = "";
          }
        }

        if (node.nodeType === "agent") {
          const output = await executeAgent(node.id, input);
          outputs.set(node.id, output);
        } else if (node.nodeType === "function") {
          const { outputs: functionOutputs, primaryOutput } = await executeFunction(node.id, input);
          // Merge port-specific outputs into the main outputs map
          functionOutputs.forEach((value, key) => {
            outputs.set(key, value);
          });
          // Set the primary output (string) for connections that don't specify a port
          outputs.set(node.id, primaryOutput);
        }
      });

      // Wait for all nodes in this stage to complete before moving to next stage
      await Promise.all(nodePromises);
      addLog("success", `✓ Stage ${i + 1} completed`);
    }
    
    addLog("success", "🎉 Workflow execution completed");
  };

  const selectedNodeData = workflow.stages
    .flatMap((s) => s.nodes)
    .find((n) => n.id === selectedNode);
  
  // For backward compatibility with PropertiesPanel
  const selectedAgent = selectedNodeData?.nodeType === "agent" ? (selectedNodeData as AgentNode) : undefined;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Toolbar
        onAddStage={addStage}
        onSave={saveWorkflow}
        onLoad={loadWorkflow}
        onClear={clearWorkflow}
        onRun={runWorkflow}
        viewMode={workflow.viewMode || "stacked"}
        onSetViewMode={setViewMode}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <ResponsiveLayout
          sidebar={
            <Sidebar 
              onAddAgent={addAgent}
              onAddNode={addNode}
              workflow={workflow} 
              userInput={userInput}
              onUserInputChange={setUserInput}
              workflowName={workflowName}
              onWorkflowNameChange={setWorkflowName}
              customAgents={customAgents}
              onCustomAgentsChange={setCustomAgents}
              selectedModel={selectedModel}
              onSelectedModelChange={setSelectedModel}
              responseLength={responseLength}
              onResponseLengthChange={setResponseLength}
              thinkingEnabled={thinkingEnabled}
              onThinkingEnabledChange={handleThinkingEnabledChange}
              thinkingBudget={thinkingBudget}
              onThinkingBudgetChange={setThinkingBudget}
            />
          }
          mobileCanvas={
            workflow.viewMode === "simple" ? (
              <SimpleView 
                workflow={workflow}
                userInput={userInput}
                onUserInputChange={setUserInput}
                onRunAgent={runSingleAgent}
                onRunFunction={runSingleFunction}
              />
            ) : workflow.viewMode === "canvas" ? (
              <WorkflowCanvasMode
                workflow={workflow}
                selectedNode={selectedNodeData || null}
                isConnecting={!!connectingFrom}
                onSelectNode={(nodeId) => setSelectedNode(nodeId)}
                onAddStage={addStage}
                onDeleteStage={deleteStage}
                onRenameStage={renameStage}
                onReorderStages={reorderStages}
                onAddAgent={addAgent}
                onAddFunction={addFunction}
                onDeleteNode={deleteNode}
                onRunAgent={runSingleAgent}
                onStartConnection={handleStartConnection}
                onPortClick={(nodeId, outputPort) => {
                  if (connectingFrom) {
                    handleCompleteConnection(connectingFrom, nodeId, connectingFromPort);
                  } else {
                    handleStartConnection(nodeId, outputPort);
                  }
                }}
                onCompleteConnection={handleCompleteConnection}
                onDeleteConnection={deleteConnection}
                onUpdateNode={updateNode}
                onUpdateStagePosition={updateStagePosition}
                onUpdateNodePosition={updateNodePosition}
                onToggleViewMode={toggleViewMode}
                onAutoLayoutVertical={autoLayoutVertical}
                onAutoLayoutHorizontal={autoLayoutHorizontal}
                onAutoLayoutGrid={autoLayoutGrid}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                onCloneNode={cloneNode}
                onCloneStage={cloneStage}
                onRunStage={runStage}
              />
            ) : (
              <WorkflowCanvas 
                workflow={workflow}
                selectedNode={selectedNode}
                connectingFrom={connectingFrom}
                layoutId="mobile"
                onSelectNode={setSelectedNode}
                onAddAgent={addAgent}
                onAddNode={addNode}
                onDeleteAgent={deleteAgent}
                onDeleteStage={deleteStage}
                onRenameStage={renameStage}
                onReorderStages={reorderStages}
                onToggleMinimize={toggleMinimize}
                onToggleLock={toggleNodeLock}
                onStartConnection={handleStartConnection}
                onCompleteConnection={handleCompleteConnection}
                onDeleteConnection={deleteConnection}
                onRunAgent={runSingleAgent}
                onRunFunction={runSingleFunction}
                onCloneStage={cloneStage}
                onRunStage={runStage}
              />
            )
          }
          desktopCanvas={
            workflow.viewMode === "simple" ? (
              <SimpleView 
                workflow={workflow}
                userInput={userInput}
                onUserInputChange={setUserInput}
                onRunAgent={runSingleAgent}
                onRunFunction={runSingleFunction}
              />
            ) : workflow.viewMode === "canvas" ? (
              <WorkflowCanvasMode
                workflow={workflow}
                selectedNode={selectedNodeData || null}
                isConnecting={!!connectingFrom}
                onSelectNode={(nodeId) => setSelectedNode(nodeId)}
                onAddStage={addStage}
                onDeleteStage={deleteStage}
                onRenameStage={renameStage}
                onReorderStages={reorderStages}
                onAddAgent={addAgent}
                onAddFunction={addFunction}
                onDeleteNode={deleteNode}
                onRunAgent={runSingleAgent}
                onStartConnection={handleStartConnection}
                onPortClick={(nodeId, outputPort) => {
                  if (connectingFrom) {
                    handleCompleteConnection(connectingFrom, nodeId, connectingFromPort);
                  } else {
                    handleStartConnection(nodeId, outputPort);
                  }
                }}
                onCompleteConnection={handleCompleteConnection}
                onDeleteConnection={deleteConnection}
                onUpdateNode={updateNode}
                onUpdateStagePosition={updateStagePosition}
                onUpdateNodePosition={updateNodePosition}
                onToggleViewMode={toggleViewMode}
                onAutoLayoutVertical={autoLayoutVertical}
                onAutoLayoutHorizontal={autoLayoutHorizontal}
                onAutoLayoutGrid={autoLayoutGrid}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                onCloneNode={cloneNode}
                onCloneStage={cloneStage}
                onRunStage={runStage}
              />
            ) : (
              <WorkflowCanvas 
                workflow={workflow}
                selectedNode={selectedNode}
                connectingFrom={connectingFrom}
                layoutId="desktop"
                onSelectNode={setSelectedNode}
                onAddAgent={addAgent}
                onAddNode={addNode}
                onDeleteAgent={deleteAgent}
                onDeleteStage={deleteStage}
                onRenameStage={renameStage}
                onReorderStages={reorderStages}
                onToggleMinimize={toggleMinimize}
                onToggleLock={toggleNodeLock}
                onStartConnection={handleStartConnection}
                onCompleteConnection={handleCompleteConnection}
                onDeleteConnection={deleteConnection}
                onRunAgent={runSingleAgent}
                onRunFunction={runSingleFunction}
                onCloneStage={cloneStage}
                onRunStage={runStage}
              />
            )
          }
          properties={
            <PropertiesPanel
              selectedAgent={selectedAgent}
              selectedNode={selectedNodeData}
              onUpdateAgent={updateAgent}
              onUpdateNode={updateNode}
              onAddToolInstance={addToolInstance}
              onUpdateToolInstance={updateToolInstance}
              onRemoveToolInstance={removeToolInstance}
              onDeselectAgent={() => setSelectedNode(null)}
              onRunAgent={runSingleAgent}
              onRunFunction={runSingleFunction}
              onCloneNode={cloneNode}
              onAddAgentToLibrary={(agent) => {
                const agentTemplate = {
                  id: `custom-${Date.now()}`,
                  name: agent.name,
                  description: `Custom agent: ${agent.name}`,
                  icon: agent.type || "Bot",
                  defaultSystemPrompt: agent.systemPrompt,
                  defaultUserPrompt: agent.userPrompt,
                  isCustom: true,
                };
                setCustomAgents([...customAgents, agentTemplate]);
                addLog("success", `Agent "${agent.name}" added to library`);
              }}
              workflow={workflow}
            />
          }
          onAddStage={addStage}
          onRun={runWorkflow}
          onSave={saveWorkflow}
          onLoad={loadWorkflow}
          onClear={clearWorkflow}
          hasSelectedAgent={!!selectedNodeData}
          viewMode={workflow.viewMode}
          onToggleViewMode={toggleViewMode}
          workflow={workflow}
        />
        
        <OutputLog logs={logs} />
      </div>
    </div>
  );
};

export default Index;
