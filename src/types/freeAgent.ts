// Free Agent Types - Autonomous agent execution types

export type BlackboardCategory = 
  | 'observation' 
  | 'insight' 
  | 'question' 
  | 'decision' 
  | 'plan' 
  | 'artifact' 
  | 'error';

export type FreeAgentStatus = 
  | 'idle' 
  | 'running' 
  | 'paused' 
  | 'needs_assistance' 
  | 'completed' 
  | 'error';

export type ToolStatus = 
  | 'pending' 
  | 'executing' 
  | 'completed' 
  | 'error';

export type ArtifactType = 
  | 'text' 
  | 'file' 
  | 'image' 
  | 'data';

export type AssistanceInputType = 
  | 'text' 
  | 'file' 
  | 'choice';

// Blackboard entry for agent memory
export interface BlackboardEntry {
  id: string;
  timestamp: string;
  category: BlackboardCategory;
  content: string;
  data?: Record<string, unknown>;
  iteration: number;
}

// Tool call tracking
export interface ToolCall {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  error?: string;
  startTime: string;
  endTime?: string;
  iteration: number;
}

// Artifact created by agent
export interface FreeAgentArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  description?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  iteration: number;
}

// User-provided file in session
export interface SessionFile {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  content?: string; // Base64 for binary, text for text files
  uploadedAt: string;
}

// Assistance request when agent needs user input
export interface AssistanceRequest {
  id: string;
  question: string;
  context?: string;
  inputType: AssistanceInputType;
  choices?: string[];
  response?: string;
  fileId?: string;
  selectedChoice?: string;
  requestedAt: string;
  respondedAt?: string;
}

// Agent message in conversation
export interface FreeAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  artifacts?: FreeAgentArtifact[];
  iteration?: number;
}

// Raw iteration data for debugging
export interface RawIterationData {
  iteration: number;
  timestamp: string;
  input: {
    systemPrompt: string;
    model: string;
    scratchpadLength: number;
    blackboardEntries: number;
    previousResultsCount: number;
  };
  output: {
    rawLLMResponse: string;
    parsedResponse: unknown;
  };
}

// Final report when task completes
export interface FinalReport {
  summary: string;
  toolsUsed: string[];
  artifactsCreated: Array<{
    title: string;
    description: string;
    artifactId: string;
  }>;
  keyFindings: string[];
  recommendations?: string[];
  totalIterations: number;
  totalTime: number; // milliseconds
}

// Main session state
export interface FreeAgentSession {
  id: string;
  status: FreeAgentStatus;
  prompt: string;
  model: string;
  maxIterations: number;
  currentIteration: number;
  
  // Memory
  blackboard: BlackboardEntry[];
  scratchpad: string; // Agent's working output area
  
  // Execution tracking
  toolCalls: ToolCall[];
  artifacts: FreeAgentArtifact[];
  messages: FreeAgentMessage[];
  
  // User input
  sessionFiles: SessionFile[];
  assistanceRequest?: AssistanceRequest;
  
  // Completion
  finalReport?: FinalReport;
  
  // Timestamps
  startTime: string;
  endTime?: string;
  lastActivityTime: string;
  
  // Error tracking
  error?: string;
  
  // Debug data for Raw viewer
  rawData: RawIterationData[];
}

// Tool definition from manifest
export interface ToolDefinition {
  name: string;
  description: string;
  edge_function?: string;
  frontend_handler?: boolean;
  icon: string;
  category: string;
  parameters: Record<string, ToolParameter>;
  returns: {
    type: string;
    properties?: string[] | Record<string, unknown>;
    items?: Record<string, unknown>;
  };
}

export interface ToolParameter {
  type: string;
  required?: boolean;
  default?: unknown;
  description: string;
  enum?: string[];
  items?: string | Record<string, unknown>;
}

export interface ToolsManifest {
  version: string;
  description: string;
  tools: Record<string, ToolDefinition>;
  categories: Record<string, {
    name: string;
    description: string;
    color: string;
  }>;
}

// Agent response from LLM
export interface AgentResponse {
  reasoning: string;
  tool_calls: Array<{
    tool: string;
    params: Record<string, unknown>;
  }>;
  blackboard_entry: {
    category: BlackboardCategory;
    content: string;
    data?: Record<string, unknown>;
  };
  status: 'in_progress' | 'completed' | 'needs_assistance' | 'error';
  message_to_user?: string;
  artifacts?: Array<{
    type: ArtifactType;
    title: string;
    content: string;
    description?: string;
  }>;
  final_report?: {
    summary: string;
    tools_used: string[];
    artifacts_created: Array<{
      title: string;
      description: string;
    }>;
    key_findings: string[];
    recommendations?: string[];
  };
}

// Canvas node types for visualization
export interface FreeAgentNodeData {
  type: 'agent' | 'tool' | 'artifact' | 'file' | 'scratchpad' | 'prompt' | 'promptFile';
  label: string;
  status: 'idle' | 'thinking' | 'active' | 'success' | 'error' | 'reading';
  icon?: string;
  category?: string;
  toolId?: string;
  artifactId?: string;
  fileId?: string;
  iteration?: number;
  reasoning?: string;
  artifactType?: ArtifactType;
  mimeType?: string;
  content?: string; // For scratchpad/prompt content
  filename?: string; // For promptFile nodes
  size?: number; // For promptFile nodes
  isWriting?: boolean; // For scratchpad animation
  onContentChange?: (content: string) => void; // For scratchpad updates
}

// Canvas edge for connections
export interface FreeAgentEdgeData {
  animated: boolean;
  sourceStatus: string;
  targetStatus: string;
}
