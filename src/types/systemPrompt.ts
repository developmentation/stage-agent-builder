// System Prompt Template Types for Free Agent
// Supports Phase 1 (view-only), Phase 2 (section editing), and Phase 3 (full template control)

export type PromptSectionType = 
  | 'identity'           // Agent name/role
  | 'tools'              // Available tools list
  | 'memory'             // Memory architecture instructions
  | 'workflow'           // Correct workflow patterns
  | 'anti_loop'          // Loop prevention rules
  | 'response_format'    // JSON response schema
  | 'data_handling'      // Data handling guidelines
  | 'execution'          // Tool execution timing
  | 'dynamic'            // Dynamic content (blackboard, files, etc.)
  | 'custom';            // User-added sections

export type EditableStatus = 'readonly' | 'editable' | 'dynamic';

export interface PromptSection {
  id: string;
  title: string;
  type: PromptSectionType;
  content: string;
  editable: EditableStatus;
  description?: string;
  order: number;
  // For future conditional logic
  conditions?: PromptCondition[];
  // For variable substitution
  variables?: string[];
}

export interface PromptCondition {
  variable: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'exists';
  value?: string;
  thenContent?: string;
  elseContent?: string;
}

export interface ResponseSchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
  properties?: ResponseSchemaField[];
}

export interface ResponseSchema {
  provider: 'gemini' | 'claude' | 'grok';
  name: string;
  description: string;
  fields: ResponseSchemaField[];
  rawSchema: string; // The actual JSON schema as string for viewing/editing
}

export interface ToolDefinitionTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  params: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  edgeFunctionMapping?: string;
  frontendHandled?: boolean;
}

export interface SystemPromptTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  
  // Core sections
  sections: PromptSection[];
  
  // Response schemas for each provider
  responseSchemas: ResponseSchema[];
  
  // Tool definitions (for future tool editing)
  tools: ToolDefinitionTemplate[];
  
  // Metadata
  metadata: {
    author?: string;
    tags?: string[];
    notes?: string;
    toolOverrides?: Record<string, { description?: string }>;
  };
}

// Variables that get substituted at runtime
export interface PromptVariables {
  TOOLS_LIST: string;
  BLACKBOARD_CONTENT: string;
  SCRATCHPAD_CONTENT: string;
  SESSION_FILES: string;
  PREVIOUS_RESULTS: string;
  CURRENT_ITERATION: number;
  ASSISTANCE_RESPONSE?: string;
  USER_PROMPT: string;
}

// Export/Import format
export interface ExportedPromptTemplate {
  formatVersion: '1.0';
  exportedAt: string;
  template: SystemPromptTemplate;
  customizations?: {
    customName?: string;
    disabledSections: string[];
    disabledTools: string[];
  };
}

// Tool override for custom descriptions
export interface ToolOverride {
  description?: string;
  disabled?: boolean;
}

// User customization overlay (Phase 2+)
export interface PromptCustomization {
  templateId: string;
  customName?: string; // User's custom name for this configuration
  sectionOverrides: Record<string, string>; // sectionId -> customContent
  disabledSections: string[]; // sectionIds to skip
  additionalSections: PromptSection[]; // User-added sections
  orderOverrides?: Record<string, number>; // sectionId -> custom order
  toolOverrides?: Record<string, ToolOverride>; // toolId -> customizations
}

// Tool manifest types
export interface ToolParameter {
  type: string;
  required: boolean;
  description: string;
  default?: string | number | boolean;
  enum?: string[];
  items?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  icon: string;
  category: string | string[]; // Can have multiple categories
  parameters: Record<string, ToolParameter>;
  returns: {
    type: string;
    properties?: string[] | Record<string, unknown>;
    items?: Record<string, unknown>;
    description?: string;
  };
  edge_function?: string;
  frontend_handler?: boolean;
}

export interface ToolCategory {
  name: string;
  description: string;
  color: string;
}

export interface ToolsManifest {
  version: string;
  description: string;
  tools: Record<string, ToolDefinition>;
  categories: Record<string, ToolCategory>;
}
