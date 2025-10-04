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

export interface Workflow {
  stages: Stage[];
  toolConfigs: Record<string, { apiKey?: string; config?: any }>;
}

const Index = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow>({
    stages: [],
    toolConfigs: {},
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
      setWorkflow({ stages: [], toolConfigs: {} });
      setSelectedNode(null);
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
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onAddAgent={addAgent} workflow={workflow} />
        
        <WorkflowCanvas 
          workflow={workflow}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onAddAgent={addAgent}
          onDeleteAgent={deleteAgent}
          onDeleteStage={deleteStage}
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
