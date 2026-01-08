// Types for Tool Instancing - allows creating multiple instances of tools with unique configurations

export interface ToolInstance {
  id: string;                    // UUID
  baseToolId: string;            // e.g., "execute_sql"
  instanceName: string;          // e.g., "policies_database"
  fullToolId: string;            // e.g., "execute_sql:policies_database"
  label: string;                 // Display label, e.g., "Policy Database"
  description: string;           // Instance-specific description
  createdAt: string;
}

export interface ToolInstanceConfig {
  version: string;
  instances: ToolInstance[];
}

// Default empty config
export const DEFAULT_TOOL_INSTANCE_CONFIG: ToolInstanceConfig = {
  version: '1.0',
  instances: [],
};
