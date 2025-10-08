import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
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
  LogEntry 
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>({
    stages: [],
    connections: [],
  });

  const addLog = (type: LogEntry["type"], message: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev, { time, type, message }]);
  };

  const addStage = () => {
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: `Stage ${workflow.stages.length + 1}`,
      nodes: [],
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
        outputPorts: template.outputs || ["output"], // Use 'outputs' from function definition
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

    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? { ...stage, nodes: [...stage.nodes, newNode] }
          : stage
      ),
    }));
  };

  // Legacy method for backward compatibility
  const addAgent = (stageId: string, agentTemplate: any) => {
    addNode(stageId, agentTemplate, "agent");
  };

  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.map((node) =>
          node.id === nodeId ? { ...node, ...updates } as WorkflowNode : node
        ),
      })),
    }));
  };

  // Legacy method for backward compatibility
  const updateAgent = (agentId: string, updates: Partial<AgentNode>) => {
    updateNode(agentId, updates);
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

  const deleteNode = (nodeId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        nodes: stage.nodes.filter((node) => node.id !== nodeId),
      })),
      // Remove all connections involving this node
      connections: prev.connections.filter(
        (conn) => conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId
      ),
    }));
    if (selectedNode === nodeId) {
      setSelectedNode(null);
    }
  };

  // Legacy method for backward compatibility
  const deleteAgent = (nodeId: string) => {
    deleteNode(nodeId);
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
    const json = JSON.stringify(workflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadWorkflow = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loaded = JSON.parse(e.target?.result as string);
        setWorkflow(loaded);
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
      setWorkflow({ stages: [], connections: [] });
      setSelectedNode(null);
      setConnectingFrom(null);
    }
  };

  const handleStartConnection = (nodeId: string | null, outputPort?: string) => {
    setConnectingFrom(nodeId);
    setConnectingFromPort(outputPort);
  };

  const handleCompleteConnection = (fromNodeId: string, toNodeId: string, fromOutputPort?: string) => {
    addConnection(fromNodeId, toNodeId, fromOutputPort);
    setConnectingFromPort(undefined);
  };

  const addConnection = (fromNodeId: string, toNodeId: string, fromOutputPort?: string) => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      fromNodeId,
      toNodeId,
      fromOutputPort,
    };
    setWorkflow((prev) => ({
      ...prev,
      connections: [...prev.connections, newConnection],
    }));
    setConnectingFrom(null);
    setConnectingFromPort(undefined);
  };

  const deleteConnection = (connectionId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      connections: prev.connections.filter((conn) => conn.id !== connectionId),
    }));
  };

  const runSingleAgent = async (nodeId: string, customInput?: string) => {
    const allNodes = workflow.stages.flatMap((s) => s.nodes);
    const node = allNodes.find((n) => n.id === nodeId);
    if (!node || node.nodeType !== "agent") return;
    
    const agent = node as AgentNode;

    addLog("info", `Starting agent: ${agent.name}`);
    updateNode(nodeId, { status: "running" });
    
    try {
      // Get input from connected nodes or use user's initial input
      const incomingConnections = workflow.connections.filter(
        (c) => c.toNodeId === nodeId
      );
      
      let input = userInput || "No input provided";
      if (incomingConnections.length > 0) {
        const outputs = incomingConnections
          .map((c) => {
            const fromNode = allNodes.find((n) => n.id === c.fromNodeId);
            return fromNode?.output || "";
          })
          .filter(Boolean);
        
        if (outputs.length > 0) {
          input = outputs.join("\n\n---\n\n");
          addLog("info", `Agent ${agent.name} received input from ${incomingConnections.length} connection(s)`);
        }
      }
      
      // Log tool execution
      if (agent.tools.length > 0) {
        agent.tools.forEach(tool => {
          addLog("running", `Executing tool: ${tool.toolId}`);
        });
      }
      
      const userPrompt = agent.userPrompt.replace("{input}", input);
      
      // Convert tool instances to the format expected by the edge function
      const toolsPayload = agent.tools.map(t => ({
        toolId: t.toolId,
        config: t.config,
      }));
      
      addLog("running", `Agent ${agent.name} processing with AI...`);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: agent.systemPrompt,
          userPrompt,
          tools: toolsPayload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const output = data.output || "No output generated";
      const toolOutputs = data.toolOutputs || [];
      
      // Log tool outputs
      if (toolOutputs.length > 0) {
        toolOutputs.forEach((toolOutput: any) => {
          console.log(`Tool Output [${toolOutput.toolId}]:`, toolOutput.output);
          addLog("info", `Tool Output [${toolOutput.toolId}]: ${JSON.stringify(toolOutput.output, null, 2)}`);
        });
      }
      
      updateNode(nodeId, { status: "complete", output });
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

    addLog("info", `Executing function: ${functionNode.name}`);
    updateNode(nodeId, { status: "running" });
    
    try {
      // Get input from connected nodes or use user's initial input
      const incomingConnections = workflow.connections.filter(
        (c) => c.toNodeId === nodeId
      );
      
      let input = userInput || "No input provided";
      if (incomingConnections.length > 0) {
        const outputs = incomingConnections
          .map((c) => {
            const fromNode = allNodes.find((n) => n.id === c.fromNodeId);
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
      const outputValue = Object.keys(result.outputs).length > 1 
        ? result.outputs 
        : (result.outputs.output || Object.values(result.outputs)[0] || "");
      updateNode(nodeId, { status: "complete", output: outputValue as any });
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
    
    // Reset all nodes to idle
    allNodes.forEach((node) => {
      updateNode(node.id, { status: "idle", output: undefined });
    });

    const outputs = new Map<string, string>();

    const executeAgent = async (nodeId: string, input: string) => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node || node.nodeType !== "agent") return;
      
      const agent = node as AgentNode;

      addLog("info", `Starting agent: ${agent.name}`);
      updateNode(nodeId, { status: "running" });
      
      try {
        // Log tool execution
        if (agent.tools.length > 0) {
          agent.tools.forEach(tool => {
            const toolName = tool.toolId.replace('_', ' ');
            addLog("running", `Executing tool: ${toolName}`);
          });
        }
        
        const userPrompt = agent.userPrompt.replace("{input}", input);
        
        // Convert tool instances to the format expected by the edge function
        const toolsPayload = agent.tools.map(t => ({
          toolId: t.toolId,
          config: t.config,
        }));
        
        addLog("running", `Agent ${agent.name} processing with AI...`);
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-agent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemPrompt: agent.systemPrompt,
            userPrompt,
            tools: toolsPayload,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        const output = data.output || "No output generated";
        const toolOutputs = data.toolOutputs || [];
        
        // Log tool outputs
        if (toolOutputs.length > 0) {
          toolOutputs.forEach((toolOutput: any) => {
            console.log(`Tool Output [${toolOutput.toolId}]:`, toolOutput.output);
            addLog("info", `Tool Output [${toolOutput.toolId}]: ${JSON.stringify(toolOutput.output, null, 2)}`);
          });
        }
        
        outputs.set(nodeId, output);
        updateNode(nodeId, { status: "complete", output });
        addLog("success", `✓ Agent ${agent.name} completed`);
      } catch (error) {
        console.error("Agent execution failed:", error);
        updateNode(nodeId, { status: "error", output: `Error: ${error}` });
        addLog("error", `✗ Agent ${agent.name} failed: ${error}`);
      }
    };

    const executeFunction = async (nodeId: string, input: string, fromOutputPort?: string): Promise<Map<string, string>> => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node || node.nodeType !== "function") return new Map();
      
      const functionNode = node as FunctionNode;

      addLog("info", `Executing function: ${functionNode.name}`);
      updateNode(nodeId, { status: "running" });
      
      try {
        const result = await FunctionExecutor.execute(functionNode, input);
        
        if (!result.success) {
          throw new Error(result.error || "Function execution failed");
        }

        // Store all outputs
        const functionOutputs = new Map<string, string>();
        Object.entries(result.outputs).forEach(([port, value]) => {
          const outputKey = `${nodeId}:${port}`;
          functionOutputs.set(outputKey, value);
        });

        // Store the full outputs object for multi-output functions, or primary output for single-output
        const outputValue = Object.keys(result.outputs).length > 1 
          ? result.outputs 
          : (result.outputs.output || Object.values(result.outputs)[0] || "");
        updateNode(nodeId, { status: "complete", output: outputValue as any });
        addLog("success", `✓ Function ${functionNode.name} completed`);
        
        return functionOutputs;
      } catch (error) {
        console.error("Function execution failed:", error);
        updateNode(nodeId, { status: "error", output: `Error: ${error}` });
        addLog("error", `✗ Function ${functionNode.name} failed: ${error}`);
        return new Map();
      }
    };

    // Execute stages sequentially
    for (let i = 0; i < workflow.stages.length; i++) {
      const stage = workflow.stages[i];
      if (stage.nodes.length === 0) continue;

      const agentCount = stage.nodes.filter(n => n.nodeType === "agent").length;
      const functionCount = stage.nodes.filter(n => n.nodeType === "function").length;
      addLog("info", `▸ Stage ${i + 1}: Processing ${agentCount} agent(s) and ${functionCount} function(s)`);

      const nodePromises = stage.nodes.map(async (node) => {
        // Get incoming connections for this node
        const incomingConnections = workflow.connections.filter(
          (c) => c.toNodeId === node.id
        );

        let input = userInput || "No input provided";
        
        // If there are incoming connections, use the output from the specific port
        if (incomingConnections.length > 0) {
          const connectedOutputs = incomingConnections
            .map((c) => {
              // Check if there's a specific output port
              if (c.fromOutputPort) {
                return outputs.get(`${c.fromNodeId}:${c.fromOutputPort}`);
              }
              return outputs.get(c.fromNodeId);
            })
            .filter(Boolean);
          
          if (connectedOutputs.length > 0) {
            input = connectedOutputs.join("\n\n---\n\n");
            addLog("info", `${node.name} received input from ${incomingConnections.length} connection(s)`);
          }
        }

        if (node.nodeType === "agent") {
          await executeAgent(node.id, input);
          outputs.set(node.id, allNodes.find(n => n.id === node.id)?.output || "");
        } else if (node.nodeType === "function") {
          const functionOutputs = await executeFunction(node.id, input);
          // Merge function outputs into the main outputs map
          functionOutputs.forEach((value, key) => {
            outputs.set(key, value);
          });
          // Also set the primary output
          outputs.set(node.id, allNodes.find(n => n.id === node.id)?.output || "");
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
    <div className="flex flex-col h-screen bg-background">
      <Toolbar
        onAddStage={addStage}
        onSave={saveWorkflow}
        onLoad={loadWorkflow}
        onClear={clearWorkflow}
        onRun={runWorkflow}
      />
      
      <ResponsiveLayout
        sidebar={
          <Sidebar 
            onAddAgent={addAgent}
            onAddNode={addNode}
            workflow={workflow} 
            userInput={userInput}
            onUserInputChange={setUserInput}
          />
        }
        mobileCanvas={
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
            onStartConnection={handleStartConnection}
            onCompleteConnection={handleCompleteConnection}
            onDeleteConnection={deleteConnection}
          />
        }
        desktopCanvas={
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
            onStartConnection={handleStartConnection}
            onCompleteConnection={handleCompleteConnection}
            onDeleteConnection={deleteConnection}
          />
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
          />
        }
        onAddStage={addStage}
        onRun={runWorkflow}
        onSave={saveWorkflow}
        onLoad={loadWorkflow}
        onClear={clearWorkflow}
        hasSelectedAgent={!!selectedAgent}
      />
      
      <OutputLog logs={logs} />
    </div>
  );
};

export default Index;
