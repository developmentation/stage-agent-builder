import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { OutputLog } from "@/components/output/OutputLog";
import { useState } from "react";

export interface Agent {
  id: string;
  name: string;
  type: string;
  systemPrompt: string;
  userPrompt: string;
  tools: string[];
  status: "idle" | "running" | "complete" | "error";
}

export interface Stage {
  id: string;
  agents: Agent[];
}

export interface Connection {
  id: string;
  fromAgentId: string;
  toAgentId: string;
}

export interface Workflow {
  stages: Stage[];
  toolConfigs: Record<string, { apiKey?: string; config?: any }>;
  connections: Connection[];
}

const Index = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow>({
    stages: [],
    toolConfigs: {},
    connections: [],
  });

  const addStage = () => {
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      agents: [],
    };
    setWorkflow((prev) => ({
      ...prev,
      stages: [...prev.stages, newStage],
    }));
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

  const deleteAgent = (agentId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.map((stage) => ({
        ...stage,
        agents: stage.agents.filter((agent) => agent.id !== agentId),
      })),
    }));
    if (selectedNode === agentId) {
      setSelectedNode(null);
    }
  };

  const deleteStage = (stageId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      stages: prev.stages.filter((stage) => stage.id !== stageId),
    }));
  };

  const updateToolConfig = (toolId: string, config: any) => {
    setWorkflow((prev) => ({
      ...prev,
      toolConfigs: {
        ...prev.toolConfigs,
        [toolId]: config,
      },
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
      setWorkflow({ stages: [], toolConfigs: {}, connections: [] });
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

  const runWorkflow = async () => {
    const allAgents = workflow.stages.flatMap((s) => s.agents);
    
    // Reset all agents to idle
    allAgents.forEach((agent) => {
      updateAgent(agent.id, { status: "idle" });
    });

    // Build execution order based on connections
    const executed = new Set<string>();
    const outputs = new Map<string, string>();

    const executeAgent = async (agentId: string, input: string = "") => {
      if (executed.has(agentId)) return;
      
      const agent = allAgents.find((a) => a.id === agentId);
      if (!agent) return;

      updateAgent(agentId, { status: "running" });
      
      // Simulate agent execution
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const output = `Output from ${agent.name}: processed "${input}"`;
      outputs.set(agentId, output);
      executed.add(agentId);
      
      updateAgent(agentId, { status: "complete" });

      // Find and execute connected agents
      const outgoingConnections = workflow.connections.filter(
        (c) => c.fromAgentId === agentId
      );
      
      for (const conn of outgoingConnections) {
        // Gather all inputs for the target agent
        const incomingConnections = workflow.connections.filter(
          (c) => c.toAgentId === conn.toAgentId
        );
        const combinedInput = incomingConnections
          .map((c) => outputs.get(c.fromAgentId) || "")
          .filter(Boolean)
          .join("\n");
        
        await executeAgent(conn.toAgentId, combinedInput);
      }
    };

    // Find root agents (no incoming connections)
    const agentsWithInputs = new Set(workflow.connections.map((c) => c.toAgentId));
    const rootAgents = allAgents.filter((a) => !agentsWithInputs.has(a.id));

    // Execute from roots
    for (const agent of rootAgents) {
      await executeAgent(agent.id);
    }
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
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onAddAgent={addAgent} workflow={workflow} />
        
        <WorkflowCanvas 
          workflow={workflow}
          selectedNode={selectedNode}
          connectingFrom={connectingFrom}
          onSelectNode={setSelectedNode}
          onAddAgent={addAgent}
          onDeleteAgent={deleteAgent}
          onDeleteStage={deleteStage}
          onStartConnection={setConnectingFrom}
          onCompleteConnection={addConnection}
        />
        
        <PropertiesPanel
          selectedAgent={selectedAgent}
          workflow={workflow}
          onUpdateAgent={updateAgent}
          onUpdateToolConfig={updateToolConfig}
          onDeselectAgent={() => setSelectedNode(null)}
        />
      </div>
      
      <OutputLog />
    </div>
  );
};

export default Index;
