// Hook for managing secrets and tool parameter mappings
// Secrets are stored in sessionStorage for session-only persistence

import { useState, useCallback, useEffect } from 'react';
import type {
  Secret,
  ToolParameterMapping,
  ToolHeaderMapping,
  CustomHeader,
  SecretsConfig,
  SecretsConfigExport,
  SecretOverrides,
} from '@/types/secrets';

const STORAGE_KEY = 'free_agent_secrets';

function generateId(): string {
  return crypto.randomUUID();
}

function loadFromStorage(): SecretsConfig {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load secrets from sessionStorage:', e);
  }
  return {
    version: '1.0',
    secrets: [],
    mappings: [],
    headerMappings: [],
  };
}

function saveToStorage(config: SecretsConfig): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save secrets to sessionStorage:', e);
  }
}

export function useSecretsManager() {
  const [config, setConfig] = useState<SecretsConfig>(loadFromStorage);

  // Persist to sessionStorage on changes
  useEffect(() => {
    saveToStorage(config);
  }, [config]);

  // === Secret CRUD ===
  
  const addSecret = useCallback((name: string, key: string, value: string, type: 'static' | 'oauth' = 'static') => {
    const newSecret: Secret = {
      id: generateId(),
      name,
      key,
      value,
      type,
      createdAt: new Date().toISOString(),
    };
    setConfig(prev => ({
      ...prev,
      secrets: [...prev.secrets, newSecret],
    }));
    return newSecret;
  }, []);

  const updateSecret = useCallback((id: string, updates: Partial<Omit<Secret, 'id' | 'createdAt'>>) => {
    setConfig(prev => ({
      ...prev,
      secrets: prev.secrets.map(s => 
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  const deleteSecret = useCallback((id: string) => {
    setConfig(prev => {
      const secret = prev.secrets.find(s => s.id === id);
      if (!secret) return prev;
      
      // Also remove any mappings that reference this secret
      return {
        ...prev,
        secrets: prev.secrets.filter(s => s.id !== id),
        mappings: prev.mappings.filter(m => m.secretKey !== secret.key),
        headerMappings: prev.headerMappings.map(hm => ({
          ...hm,
          headers: hm.headers.filter(h => h.secretKey !== secret.key),
        })).filter(hm => hm.headers.length > 0),
      };
    });
  }, []);

  const getSecretByKey = useCallback((key: string): Secret | undefined => {
    return config.secrets.find(s => s.key === key);
  }, [config.secrets]);

  const getSecretValue = useCallback((key: string): string | undefined => {
    return config.secrets.find(s => s.key === key)?.value;
  }, [config.secrets]);

  // === Parameter Mapping CRUD ===

  const addMapping = useCallback((toolId: string, parameterPath: string, secretKey: string, mergeMode: 'replace' | 'merge' = 'replace') => {
    // Check if mapping already exists
    const existing = config.mappings.find(m => m.toolId === toolId && m.parameterPath === parameterPath);
    if (existing) {
      // Update existing
      setConfig(prev => ({
        ...prev,
        mappings: prev.mappings.map(m =>
          m.id === existing.id ? { ...m, secretKey, mergeMode } : m
        ),
      }));
      return existing;
    }
    
    const newMapping: ToolParameterMapping = {
      id: generateId(),
      toolId,
      parameterPath,
      secretKey,
      mergeMode,
    };
    setConfig(prev => ({
      ...prev,
      mappings: [...prev.mappings, newMapping],
    }));
    return newMapping;
  }, [config.mappings]);

  const deleteMapping = useCallback((id: string) => {
    setConfig(prev => ({
      ...prev,
      mappings: prev.mappings.filter(m => m.id !== id),
    }));
  }, []);

  const getMappingsForTool = useCallback((toolId: string): ToolParameterMapping[] => {
    return config.mappings.filter(m => m.toolId === toolId);
  }, [config.mappings]);

  // === Header Mapping CRUD ===

  const addHeaderMapping = useCallback((toolId: string, headerName: string, secretKey: string) => {
    setConfig(prev => {
      const existing = prev.headerMappings.find(hm => hm.toolId === toolId);
      const newHeader: CustomHeader = {
        id: generateId(),
        name: headerName,
        secretKey,
      };
      
      if (existing) {
        // Check if header already exists
        const headerExists = existing.headers.some(h => h.name === headerName);
        if (headerExists) {
          // Update existing header
          return {
            ...prev,
            headerMappings: prev.headerMappings.map(hm =>
              hm.toolId === toolId
                ? {
                    ...hm,
                    headers: hm.headers.map(h =>
                      h.name === headerName ? { ...h, secretKey } : h
                    ),
                  }
                : hm
            ),
          };
        }
        // Add new header to existing tool
        return {
          ...prev,
          headerMappings: prev.headerMappings.map(hm =>
            hm.toolId === toolId
              ? { ...hm, headers: [...hm.headers, newHeader] }
              : hm
          ),
        };
      }
      
      // Create new tool header mapping
      const newToolMapping: ToolHeaderMapping = {
        id: generateId(),
        toolId,
        headers: [newHeader],
      };
      return {
        ...prev,
        headerMappings: [...prev.headerMappings, newToolMapping],
      };
    });
  }, []);

  const deleteHeaderMapping = useCallback((toolId: string, headerId: string) => {
    setConfig(prev => ({
      ...prev,
      headerMappings: prev.headerMappings.map(hm =>
        hm.toolId === toolId
          ? { ...hm, headers: hm.headers.filter(h => h.id !== headerId) }
          : hm
      ).filter(hm => hm.headers.length > 0),
    }));
  }, []);

  const getHeadersForTool = useCallback((toolId: string): CustomHeader[] => {
    return config.headerMappings.find(hm => hm.toolId === toolId)?.headers || [];
  }, [config.headerMappings]);

  // === Computed Overrides for Tool Execution ===

  const getSecretOverrides = useCallback((): SecretOverrides => {
    const overrides: SecretOverrides = {};
    
    // Process parameter mappings
    for (const mapping of config.mappings) {
      const secretValue = getSecretValue(mapping.secretKey);
      if (!secretValue) continue;
      
      if (!overrides[mapping.toolId]) {
        overrides[mapping.toolId] = { params: {}, headers: {} };
      }
      
      // Handle nested paths like "headers.Authorization"
      const pathParts = mapping.parameterPath.split('.');
      if (pathParts.length === 1) {
        overrides[mapping.toolId].params![pathParts[0]] = secretValue;
      } else {
        // Build nested structure
        let current: Record<string, unknown> = overrides[mapping.toolId].params!;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!current[pathParts[i]]) {
            current[pathParts[i]] = {};
          }
          current = current[pathParts[i]] as Record<string, unknown>;
        }
        current[pathParts[pathParts.length - 1]] = secretValue;
      }
    }
    
    // Process header mappings
    for (const headerMapping of config.headerMappings) {
      if (!overrides[headerMapping.toolId]) {
        overrides[headerMapping.toolId] = { params: {}, headers: {} };
      }
      
      for (const header of headerMapping.headers) {
        const secretValue = getSecretValue(header.secretKey);
        if (secretValue) {
          overrides[headerMapping.toolId].headers![header.name] = secretValue;
        }
      }
    }
    
    return overrides;
  }, [config.mappings, config.headerMappings, getSecretValue]);

  // Get list of configured tool params for LLM prompt (no values)
  const getConfiguredToolParams = useCallback((): Array<{ tool: string; param: string }> => {
    const result: Array<{ tool: string; param: string }> = [];
    
    for (const mapping of config.mappings) {
      result.push({ tool: mapping.toolId, param: mapping.parameterPath });
    }
    
    for (const headerMapping of config.headerMappings) {
      for (const header of headerMapping.headers) {
        result.push({ tool: headerMapping.toolId, param: `headers.${header.name}` });
      }
    }
    
    return result;
  }, [config.mappings, config.headerMappings]);

  // === Import/Export ===

  const exportConfig = useCallback((): SecretsConfigExport => {
    return {
      version: config.version,
      exportedAt: new Date().toISOString(),
      secrets: config.secrets.map(s => ({
        key: s.key,
        name: s.name,
        type: s.type,
      })),
      mappings: config.mappings,
      headerMappings: config.headerMappings,
    };
  }, [config]);

  const importConfig = useCallback((exported: SecretsConfigExport, secretValues: Record<string, string>) => {
    const newSecrets: Secret[] = exported.secrets.map(s => ({
      id: generateId(),
      name: s.name,
      key: s.key,
      value: secretValues[s.key] || '',
      type: s.type,
      createdAt: new Date().toISOString(),
    }));
    
    setConfig({
      version: exported.version,
      secrets: newSecrets,
      mappings: exported.mappings.map(m => ({ ...m, id: generateId() })),
      headerMappings: exported.headerMappings.map(hm => ({
        ...hm,
        id: generateId(),
        headers: hm.headers.map(h => ({ ...h, id: generateId() })),
      })),
    });
  }, []);

  const parseEnvFile = useCallback((envContent: string): Array<{ key: string; value: string }> => {
    const lines = envContent.split('\n');
    const result: Array<{ key: string; value: string }> = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (key) {
        result.push({ key, value });
      }
    }
    
    return result;
  }, []);

  const importFromEnv = useCallback((envContent: string) => {
    const parsed = parseEnvFile(envContent);
    for (const { key, value } of parsed) {
      // Create or update secret
      const existing = config.secrets.find(s => s.key === key);
      if (existing) {
        updateSecret(existing.id, { value });
      } else {
        addSecret(key, key, value);
      }
    }
  }, [config.secrets, parseEnvFile, updateSecret, addSecret]);

  const clearAll = useCallback(() => {
    setConfig({
      version: '1.0',
      secrets: [],
      mappings: [],
      headerMappings: [],
    });
  }, []);

  return {
    // State
    secrets: config.secrets,
    mappings: config.mappings,
    headerMappings: config.headerMappings,
    
    // Secret operations
    addSecret,
    updateSecret,
    deleteSecret,
    getSecretByKey,
    getSecretValue,
    
    // Mapping operations
    addMapping,
    deleteMapping,
    getMappingsForTool,
    
    // Header operations
    addHeaderMapping,
    deleteHeaderMapping,
    getHeadersForTool,
    
    // Computed
    getSecretOverrides,
    getConfiguredToolParams,
    
    // Import/Export
    exportConfig,
    importConfig,
    parseEnvFile,
    importFromEnv,
    clearAll,
  };
}

export type SecretsManager = ReturnType<typeof useSecretsManager>;
