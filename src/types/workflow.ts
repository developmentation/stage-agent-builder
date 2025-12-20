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
  locked?: boolean; // Prevents re-execution when true
  executeOnNullInput?: boolean; // If false (default), skip execution when input is null/empty/falsey
  position?: { x: number; y: number }; // For canvas mode positioning within stage
}

// Beast Mode configuration
export interface BeastModeConfig {
  enabled: boolean;
  outputMode: "concatenate" | "split";
}

// Agent-specific properties
export interface AgentNode extends BaseNode {
  nodeType: "agent";
  type: string; // researcher, summarizer, analyst, or custom
  systemPrompt: string;
  userPrompt: string;
  tools: ToolInstance[];
  // Per-agent model configuration (optional - defaults to global workflow settings)
  useSpecificModel?: boolean;
  model?: "gemini-2.5-flash" | "gemini-2.5-pro" | "gemini-3-pro-preview" | "gemini-2.5-flash-lite" | "claude-sonnet-4-5" | "claude-haiku-4-5" | "claude-opus-4-5" | "grok-4-1-fast-reasoning" | "grok-4-1-fast-non-reasoning";
  responseLength?: number;
  thinkingEnabled?: boolean;
  thinkingBudget?: number;
  beastMode?: BeastModeConfig;
  // Beast Mode split outputs
  beastModeOutputs?: Record<string, string>;
  beastModeOutputPorts?: string[];
}

// Function-specific properties
export interface FunctionNode extends BaseNode {
  nodeType: "function";
  functionType: string; // string_contains, concat, is_json, memory, etc.
  config: Record<string, any>; // Function-specific configuration
  outputPorts: string[]; // Array of output port names (e.g., ["true", "false"] for if/else)
  outputCount?: number; // Number of output ports for multi-output functions (1-50)
  outputs?: Record<string, string>; // Map of output port to value for visual indicators
  imageOutput?: string; // Base64 image data for image generation functions
  audioOutput?: string; // Base64 audio data for TTS functions
  imageOutputs?: string[]; // Array of base64 images for Beast Mode
  audioOutputs?: string[]; // Array of base64 audio for Beast Mode
  beastMode?: BeastModeConfig;
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
  fromOutputPort?: string; // Which output port (e.g., "output_1", "output_2")
}

// Note for canvas annotations
export interface Note {
  id: string;
  content: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  color: string;
}

// Complete workflow
export interface Workflow {
  stages: Stage[];
  connections: Connection[];
  notes?: Note[]; // Canvas-only notes
  viewMode?: "stacked" | "canvas" | "simple"; // Toggle between visualization modes
}

// Log entry for output
export interface LogEntry {
  time: string;
  type: "info" | "warning" | "error" | "success" | "running";
  message: string;
}
