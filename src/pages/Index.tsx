import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { OutputLog, LogEntry } from "@/components/output/OutputLog";
import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { useState } from "react";

export interface ToolInstance {
  id: string;
  toolId: string;
  config: any;
}

export interface Agent {
  id: string;
  name: string;
  type: string;
  systemPrompt: string;
  userPrompt: string;
  tools: ToolInstance[];
  status: "idle" | "running" | "complete" | "error";
  output?: string;
  minimized?: boolean;
}

export interface Stage {
  id: string;
  name: string;
  agents: Agent[];
}

export interface Connection {
  id: string;
  fromAgentId: string;
  toAgentId: string;
}

export interface Workflow {
  stages: Stage[];
  connections: Connection[];
}

const Index = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
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
      agents: [],
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
      const getStageIndex = (agentId: string): number => {
        for (let i = 0; i < newStages.length; i++) {
          if (newStages[i].agents.some(a => a.id === agentId)) {
            return i;
          }
        }
        return -1;
      };

      // Remove connections where output stage is after input stage (backwards connections)
      const validConnections = prev.connections.filter((conn) => {
        const fromStageIndex = getStageIndex(conn.fromAgentId);
        const toStageIndex = getStageIndex(conn.toAgentId);
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

  const addAgent = (stageId: string, agentTemplate: any) => {
    const newAgent: Agent = {
      id: `agent-${Date.now()}`,
      name: agentTemplate.name,
      type: agentTemplate.id,
      systemPrompt: agentTemplate.defaultSystemPrompt || `You are a ${agentTemplate.name} agent.`,
      userPrompt: agentTemplate.defaultUserPrompt || "Process the following input: {input}",
      tools: [],
      status: "idle",
    };

    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) =>
        stage.id === stageId
          ? { ...stage, agents: [...stage.agents, newAgent] }
          : stage
      ),
    }));
  };

  const updateAgent = (agentId: string, updates: Partial<Agent>) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        agents: stage.agents.map((agent) =>
          agent.id === agentId ? { ...agent, ...updates } : agent
        ),
      })),
    }));
  };

  const toggleMinimize = (agentId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        agents: stage.agents.map((agent) =>
          agent.id === agentId ? { ...agent, minimized: !agent.minimized } : agent
        ),
      })),
    }));
  };

  const deleteAgent = (agentId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        agents: stage.agents.filter((agent) => agent.id !== agentId),
      })),
      // Remove all connections involving this agent
      connections: prev.connections.filter(
        (conn) => conn.fromAgentId !== agentId && conn.toAgentId !== agentId
      ),
    }));
    if (selectedNode === agentId) {
      setSelectedNode(null);
    }
  };

  const deleteStage = (stageId: string) => {
    setWorkflow((prev) => {
      const stageToDelete = prev.stages.find((s) => s.id === stageId);
      const agentIdsToDelete = stageToDelete?.agents.map((a) => a.id) || [];
      
      return {
        ...prev,
        stages: prev.stages.filter((stage) => stage.id !== stageId),
        // Remove all connections involving agents in this stage
        connections: prev.connections.filter(
          (conn) => 
            !agentIdsToDelete.includes(conn.fromAgentId) && 
            !agentIdsToDelete.includes(conn.toAgentId)
        ),
      };
    });
  };

  const addToolInstance = (agentId: string, toolId: string) => {
    const newToolInstance: ToolInstance = {
      id: `tool-${Date.now()}`,
      toolId,
      config: {},
    };
    
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        agents: stage.agents.map((agent) =>
          agent.id === agentId
            ? { ...agent, tools: [...agent.tools, newToolInstance] }
            : agent
        ),
      })),
    }));
  };

  const updateToolInstance = (agentId: string, toolInstanceId: string, config: any) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        agents: stage.agents.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                tools: agent.tools.map((tool) =>
                  tool.id === toolInstanceId ? { ...tool, config } : tool
                ),
              }
            : agent
        ),
      })),
    }));
  };

  const removeToolInstance = (agentId: string, toolInstanceId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        agents: stage.agents.map((agent) =>
          agent.id === agentId
            ? { ...agent, tools: agent.tools.filter((t) => t.id !== toolInstanceId) }
            : agent
        ),
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

  const addConnection = (fromAgentId: string, toAgentId: string) => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      fromAgentId,
      toAgentId,
    };
    setWorkflow((prev) => ({
      ...prev,
      connections: [...prev.connections, newConnection],
    }));
    setConnectingFrom(null);
  };

  const deleteConnection = (connectionId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      connections: prev.connections.filter((conn) => conn.id !== connectionId),
    }));
  };

  const runSingleAgent = async (agentId: string, customInput?: string) => {
    const allAgents = workflow.stages.flatMap((s) => s.agents);
    const agent = allAgents.find((a) => a.id === agentId);
    if (!agent) return;

    addLog("info", `Starting agent: ${agent.name}`);
    updateAgent(agentId, { status: "running" });
    
    try {
      // Get input from connected agents or use user's initial input
      const incomingConnections = workflow.connections.filter(
        (c) => c.toAgentId === agentId
      );
      
      let input = userInput || "No input provided";
      if (incomingConnections.length > 0) {
        const outputs = incomingConnections
          .map((c) => {
            const fromAgent = allAgents.find((a) => a.id === c.fromAgentId);
            return fromAgent?.output || "";
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
      
      updateAgent(agentId, { status: "complete", output });
      addLog("success", `Agent ${agent.name} completed successfully`);
    } catch (error) {
      console.error("Agent execution failed:", error);
      updateAgent(agentId, { status: "error", output: `Error: ${error}` });
      addLog("error", `Agent ${agent.name} failed: ${error}`);
    }
  };

  const runWorkflow = async () => {
    const allAgents = workflow.stages.flatMap((s) => s.agents);
    
    addLog("info", "🚀 Workflow execution started");
    setLogs([]); // Clear previous logs
    addLog("info", "🚀 Workflow execution started");
    
    // Reset all agents to idle
    allAgents.forEach((agent) => {
      updateAgent(agent.id, { status: "idle", output: undefined });
    });

    const outputs = new Map<string, string>();

    const executeAgent = async (agentId: string, input: string) => {
      const agent = allAgents.find((a) => a.id === agentId);
      if (!agent) return;

      addLog("info", `Starting agent: ${agent.name}`);
      updateAgent(agentId, { status: "running" });
      
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
        
        outputs.set(agentId, output);
        updateAgent(agentId, { status: "complete", output });
        addLog("success", `✓ Agent ${agent.name} completed`);
      } catch (error) {
        console.error("Agent execution failed:", error);
        updateAgent(agentId, { status: "error", output: `Error: ${error}` });
        addLog("error", `✗ Agent ${agent.name} failed: ${error}`);
      }
    };

    // Execute stages sequentially
    for (let i = 0; i < workflow.stages.length; i++) {
      const stage = workflow.stages[i];
      if (stage.agents.length === 0) continue;

      addLog("info", `▸ Stage ${i + 1}: Processing ${stage.agents.length} agent(s)`);

      const agentPromises = stage.agents.map(async (agent) => {
        // Get incoming connections for this agent
        const incomingConnections = workflow.connections.filter(
          (c) => c.toAgentId === agent.id
        );

        let input = userInput || "No input provided";
        
        // If there are incoming connections, wait for and concatenate their outputs
        if (incomingConnections.length > 0) {
          const connectedOutputs = incomingConnections
            .map((c) => outputs.get(c.fromAgentId))
            .filter(Boolean);
          
          if (connectedOutputs.length > 0) {
            input = connectedOutputs.join("\n\n---\n\n");
            addLog("info", `Agent ${agent.name} received input from ${incomingConnections.length} connection(s)`);
          }
        }

        await executeAgent(agent.id, input);
      });

      // Wait for all agents in this stage to complete before moving to next stage
      await Promise.all(agentPromises);
      addLog("success", `✓ Stage ${i + 1} completed`);
    }
    
    addLog("success", "🎉 Workflow execution completed");
  };

  const selectedAgent = workflow.stages
    .flatMap((s) => s.agents)
    .find((a) => a.id === selectedNode);

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
            onDeleteAgent={deleteAgent}
            onDeleteStage={deleteStage}
            onRenameStage={renameStage}
            onReorderStages={reorderStages}
            onToggleMinimize={toggleMinimize}
            onStartConnection={setConnectingFrom}
            onCompleteConnection={addConnection}
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
            onDeleteAgent={deleteAgent}
            onDeleteStage={deleteStage}
            onRenameStage={renameStage}
            onReorderStages={reorderStages}
            onToggleMinimize={toggleMinimize}
            onStartConnection={setConnectingFrom}
            onCompleteConnection={addConnection}
            onDeleteConnection={deleteConnection}
          />
        }
        properties={
          <PropertiesPanel
            selectedAgent={selectedAgent}
            onUpdateAgent={updateAgent}
            onAddToolInstance={addToolInstance}
            onUpdateToolInstance={updateToolInstance}
            onRemoveToolInstance={removeToolInstance}
            onDeselectAgent={() => setSelectedNode(null)}
            onRunAgent={runSingleAgent}
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
