// Types for the Secrets Manager feature - manages sensitive credentials for tool execution

export type SecretType = 'static' | 'oauth';

export interface Secret {
  id: string;
  name: string;           // User-friendly name (e.g., "GitHub PAT")
  key: string;            // Reference key (e.g., "GITHUB_TOKEN")
  value: string;          // The actual secret value
  type: SecretType;       // static for manual entry, oauth for future SSO tokens
  createdAt: string;
  expiresAt?: string;     // For future OAuth tokens
}

export interface ToolParameterMapping {
  id: string;
  toolId: string;         // e.g., "read_github_repo"
  parameterPath: string;  // e.g., "headers.Authorization" or "connectionString"
  secretKey: string;      // References Secret.key
  mergeMode: 'replace' | 'merge';  // For object params like headers
}

export interface CustomHeader {
  id: string;
  name: string;           // Header name (e.g., "Authorization", "X-API-Key")
  secretKey: string;      // References Secret.key for the value
}

export interface ToolHeaderMapping {
  id: string;
  toolId: string;         // e.g., "get_call_api"
  headers: CustomHeader[];
}

export interface SecretsConfig {
  version: string;
  secrets: Secret[];
  mappings: ToolParameterMapping[];
  headerMappings: ToolHeaderMapping[];
}

// For export - excludes secret values
export interface SecretsConfigExport {
  version: string;
  exportedAt: string;
  secrets: Array<{
    key: string;
    name: string;
    type: SecretType;
  }>;
  mappings: ToolParameterMapping[];
  headerMappings: ToolHeaderMapping[];
}

// Computed overrides to pass to tool execution
export interface SecretOverrides {
  [toolId: string]: {
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
}
