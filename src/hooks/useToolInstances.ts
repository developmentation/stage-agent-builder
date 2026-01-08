// Tool Instances Hook - Manages tool instances with unique configurations
import { useState, useCallback } from 'react';
import type { ToolInstance, ToolInstanceConfig } from '@/types/toolInstance';

const STORAGE_KEY = 'free_agent_tool_instances';
const CONFIG_VERSION = '1.0';

// Load config from sessionStorage
function loadFromStorage(): ToolInstanceConfig {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === CONFIG_VERSION) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load tool instances:', e);
  }
  return { version: CONFIG_VERSION, instances: [] };
}

// Save config to sessionStorage
function saveToStorage(config: ToolInstanceConfig): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save tool instances:', e);
  }
}

export interface ToolInstancesManager {
  instances: ToolInstance[];
  addInstance: (baseToolId: string, instanceName: string, label: string, description: string) => ToolInstance | null;
  updateInstance: (id: string, updates: Partial<Pick<ToolInstance, 'label' | 'description' | 'instanceName'>>) => void;
  deleteInstance: (id: string) => void;
  getInstancesForTool: (baseToolId: string) => ToolInstance[];
  getInstanceByFullId: (fullToolId: string) => ToolInstance | undefined;
  hasInstances: (baseToolId: string) => boolean;
  parseToolId: (toolId: string) => { baseToolId: string; instanceName: string | null };
  exportConfig: () => ToolInstanceConfig;
  importConfig: (config: ToolInstanceConfig) => void;
  clearAll: () => void;
}

export function useToolInstances(): ToolInstancesManager {
  const [config, setConfig] = useState<ToolInstanceConfig>(loadFromStorage);

  const saveConfig = useCallback((newConfig: ToolInstanceConfig) => {
    setConfig(newConfig);
    saveToStorage(newConfig);
  }, []);

  // Add a new instance
  const addInstance = useCallback((
    baseToolId: string,
    instanceName: string,
    label: string,
    description: string
  ): ToolInstance | null => {
    // Validate instanceName format (alphanumeric + underscore)
    const sanitizedName = instanceName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!sanitizedName) return null;

    const fullToolId = `${baseToolId}:${sanitizedName}`;

    // Check for duplicate
    if (config.instances.some(i => i.fullToolId === fullToolId)) {
      console.error(`Instance ${fullToolId} already exists`);
      return null;
    }

    const newInstance: ToolInstance = {
      id: crypto.randomUUID(),
      baseToolId,
      instanceName: sanitizedName,
      fullToolId,
      label,
      description,
      createdAt: new Date().toISOString(),
    };

    const newConfig = {
      ...config,
      instances: [...config.instances, newInstance],
    };
    saveConfig(newConfig);
    return newInstance;
  }, [config, saveConfig]);

  // Update an instance
  const updateInstance = useCallback((
    id: string,
    updates: Partial<Pick<ToolInstance, 'label' | 'description' | 'instanceName'>>
  ) => {
    const newConfig = {
      ...config,
      instances: config.instances.map(instance => {
        if (instance.id !== id) return instance;

        let updatedInstance = { ...instance, ...updates };

        // If instanceName changed, update fullToolId
        if (updates.instanceName) {
          const sanitizedName = updates.instanceName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
          updatedInstance.instanceName = sanitizedName;
          updatedInstance.fullToolId = `${instance.baseToolId}:${sanitizedName}`;
        }

        return updatedInstance;
      }),
    };
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Delete an instance
  const deleteInstance = useCallback((id: string) => {
    const newConfig = {
      ...config,
      instances: config.instances.filter(i => i.id !== id),
    };
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Get all instances for a specific base tool
  const getInstancesForTool = useCallback((baseToolId: string): ToolInstance[] => {
    return config.instances.filter(i => i.baseToolId === baseToolId);
  }, [config]);

  // Get instance by full tool ID (e.g., "execute_sql:policies_database")
  const getInstanceByFullId = useCallback((fullToolId: string): ToolInstance | undefined => {
    return config.instances.find(i => i.fullToolId === fullToolId);
  }, [config]);

  // Check if a tool has any instances
  const hasInstances = useCallback((baseToolId: string): boolean => {
    return config.instances.some(i => i.baseToolId === baseToolId);
  }, [config]);

  // Parse a tool ID into base and instance parts
  const parseToolId = useCallback((toolId: string): { baseToolId: string; instanceName: string | null } => {
    if (toolId.includes(':')) {
      const [baseToolId, instanceName] = toolId.split(':');
      return { baseToolId, instanceName };
    }
    return { baseToolId: toolId, instanceName: null };
  }, []);

  // Export configuration
  const exportConfig = useCallback((): ToolInstanceConfig => {
    return { ...config };
  }, [config]);

  // Import configuration
  const importConfig = useCallback((newConfig: ToolInstanceConfig) => {
    saveConfig(newConfig);
  }, [saveConfig]);

  // Clear all instances
  const clearAll = useCallback(() => {
    saveConfig({ version: CONFIG_VERSION, instances: [] });
  }, [saveConfig]);

  return {
    instances: config.instances,
    addInstance,
    updateInstance,
    deleteInstance,
    getInstancesForTool,
    getInstanceByFullId,
    hasInstances,
    parseToolId,
    exportConfig,
    importConfig,
    clearAll,
  };
}
