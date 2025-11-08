// Core node types in the workflow
export type NodeType = "agent" | "function" | "tool";

// Base interface for all nodes
export interface BaseNode {
  id: string;
  name: string;
  nodeType: NodeType;
  status: "idle" | "running" | "complete" | "error";
  output?: string;
  minimized?: boolean;
  position?: { x: number; y: number }; // For canvas mode positioning within stage
}

// Agent-specific properties
export interface AgentNode extends BaseNode {
  nodeType: "agent";
  type: string; // researcher, summarizer, analyst, or custom
  systemPrompt: string;
  userPrompt: string;
  tools: ToolInstance[];
}

// Function-specific properties
export interface FunctionNode extends BaseNode {
  nodeType: "function";
  functionType: string; // string_contains, concat, is_json, memory, etc.
  config: Record<string, any>; // Function-specific configuration
  outputPorts: string[]; // Array of output port names (e.g., ["true", "false"] for if/else)
}

// Tool-specific properties (standalone tools)
export interface ToolNode extends BaseNode {
  nodeType: "tool";
  toolType: string; // google_search, web_scrape, api_call, etc.
  config: Record<string, any>; // Tool-specific configuration
}

// Union type for all node types
export type WorkflowNode = AgentNode | FunctionNode | ToolNode;

// Tool instance attached to an agent
export interface ToolInstance {
  id: string;
  toolId: string;
  config: any;
}

// Stage containing nodes
export interface Stage {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  position?: { x: number; y: number }; // For canvas mode
  size?: { width: number; height: number }; // For canvas mode
}

// Connection between nodes with output port support
export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromOutputPort?: string; // Which output port (for multi-output functions)
}

// Complete workflow
export interface Workflow {
  stages: Stage[];
  connections: Connection[];
  viewMode?: "stacked" | "canvas"; // Toggle between visualization modes
}

// Log entry for output
export interface LogEntry {
  time: string;
  type: "info" | "warning" | "error" | "success" | "running";
  message: string;
}
