import { LucideIcon } from "lucide-react";

// Function category for organization
export type FunctionCategory = 
  | "string"
  | "logic" 
  | "conditional"
  | "memory"
  | "export"
  | "url"
  | "data";

// Configuration schema for functions
export interface FunctionConfigSchema {
  [key: string]: {
    type: "string" | "number" | "boolean" | "json";
    label: string;
    description?: string;
    required?: boolean;
    default?: any;
    placeholder?: string;
  };
}

// Function definition
export interface FunctionDefinition {
  id: string;
  name: string;
  description: string;
  category: FunctionCategory;
  icon: LucideIcon;
  color: string; // Tailwind color class for visual differentiation
  inputs: {
    label: string;
    description: string;
  };
  outputs: string[]; // Array of output port names (e.g., ["output"] or ["true", "false"])
  configSchema?: FunctionConfigSchema;
}

// Execution result from a function
export interface FunctionExecutionResult {
  success: boolean;
  outputs: Record<string, string>; // Map of output port name to value
  error?: string;
}

// Memory store for Memory function
export interface MemoryEntry {
  timestamp: number;
  input: string;
  output: string;
  runId: string;
}
