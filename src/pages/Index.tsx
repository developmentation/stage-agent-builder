import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { PropertiesPanel } from "@/components/properties/PropertiesPanel";
import { Toolbar } from "@/components/toolbar/Toolbar";
import { OutputLog } from "@/components/output/OutputLog";
import { useState } from "react";

const Index = () => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Toolbar */}
      <Toolbar />
      
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Tools & Inputs */}
        <Sidebar />
        
        {/* Center Canvas - Workflow Builder */}
        <WorkflowCanvas 
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
        />
        
        {/* Right Properties Panel */}
        <PropertiesPanel selectedNode={selectedNode} />
      </div>
      
      {/* Bottom Output Log */}
      <OutputLog />
    </div>
  );
};

export default Index;
