import { useState, useCallback, useEffect } from "react";
import type { 
  SystemPromptTemplate, 
  PromptSection, 
  PromptCustomization,
  ExportedPromptTemplate,
  ToolOverride
} from "@/types/systemPrompt";

const STORAGE_KEY = "freeagent-prompt-customizations";

// Valid template section IDs - must match the set in freeAgentToolExecutor.ts
const VALID_TEMPLATE_SECTION_IDS = new Set([
  'identity', 'user_task', 'tools_list', 'session_files', 'configured_secrets', 
  'blackboard', 'scratchpad', 'previous_results', 'iteration_info',
  'memory_architecture', 'memory_persistence', 'correct_workflow', 'loop_problem', 
  'anti_loop_rules', 'loop_self_reflection', 'tool_execution_timing',
  'response_format', 'blackboard_mandatory', 'data_handling', 
  'workflow_summary', 'accessing_attributes', 'reference_resolution',
  'self_author', 'spawn_capabilities', 'artifacts_list'
]);

// Filter out invalid section overrides that don't correspond to valid sections or custom sections
function cleanupInvalidOverrides(
  customization: PromptCustomization
): PromptCustomization {
  const customSectionIds = new Set(customization.additionalSections?.map(s => s.id) || []);
  
  const cleanedOverrides: Record<string, string> = {};
  let removedCount = 0;
  
  for (const [sectionId, content] of Object.entries(customization.sectionOverrides || {})) {
    const isValidTemplate = VALID_TEMPLATE_SECTION_IDS.has(sectionId);
    const isCustom = customSectionIds.has(sectionId);
    
    if (isValidTemplate || isCustom) {
      cleanedOverrides[sectionId] = content;
    } else {
      removedCount++;
      console.log(`[PromptCustomization] Removed invalid section override: "${sectionId}"`);
    }
  }
  
  if (removedCount > 0) {
    console.log(`[PromptCustomization] Cleaned up ${removedCount} invalid section override(s)`);
  }
  
  return {
    ...customization,
    sectionOverrides: cleanedOverrides,
  };
}

interface UsePromptCustomizationReturn {
  // State
  customizations: PromptCustomization | null;
  hasCustomizations: boolean;
  customizedSectionIds: Set<string>;
  
  // Actions
  getEffectiveContent: (section: PromptSection) => string;
  isCustomized: (sectionId: string) => boolean;
  updateSection: (sectionId: string, content: string) => void;
  resetSection: (sectionId: string) => void;
  resetAll: () => void;
  
  // Custom sections
  addCustomSection: (section: Omit<PromptSection, 'id' | 'order'>) => string;
  updateCustomSection: (sectionId: string, updates: Partial<PromptSection>) => void;
  deleteCustomSection: (sectionId: string) => void;
  getCustomSections: () => PromptSection[];
  
  // Reordering
  getOrderOverride: (sectionId: string) => number | undefined;
  setOrderOverride: (sectionId: string, order: number) => void;
  moveSection: (sectionId: string, direction: 'up' | 'down', allSections: PromptSection[]) => void;
  getSortedSections: (templateSections: PromptSection[]) => PromptSection[];
  hasOrderChanges: boolean;
  resetOrder: () => void;
  
  // Tool overrides
  getEffectiveToolDescription: (toolId: string, originalDescription: string) => string;
  isToolCustomized: (toolId: string) => boolean;
  updateToolDescription: (toolId: string, description: string) => void;
  resetToolDescription: (toolId: string) => void;
  hasToolCustomizations: boolean;
  getToolOverrides: () => Record<string, ToolOverride>;
  
  // Section disabling
  isSectionDisabled: (sectionId: string) => boolean;
  toggleSectionDisabled: (sectionId: string) => void;
  getDisabledSections: () => string[];
  
  // Tool disabling
  isToolDisabled: (toolId: string) => boolean;
  toggleToolDisabled: (toolId: string) => void;
  getDisabledTools: () => string[];
  
  // Import/Export
  exportCustomizations: (template: SystemPromptTemplate) => ExportedPromptTemplate;
  importCustomizations: (data: ExportedPromptTemplate, currentTemplate: SystemPromptTemplate) => boolean;
  
  // Custom name
  getCustomName: () => string | undefined;
  setCustomName: (name: string) => void;
  
  // Persistence
  saveToStorage: () => void;
  loadFromStorage: () => void;
}

export function usePromptCustomization(templateId: string): UsePromptCustomizationReturn {
  // Initialize synchronously from localStorage to avoid race conditions
  const [customizations, setCustomizations] = useState<PromptCustomization | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, PromptCustomization>;
        const templateCustomizations = parsed[templateId] || null;
        if (templateCustomizations) {
          // Clean up any invalid overrides on load
          const cleaned = cleanupInvalidOverrides(templateCustomizations);
          console.log(`[PromptCustomization] Loaded ${Object.keys(cleaned.sectionOverrides || {}).length} section overrides for template "${templateId}"`);
          return cleaned;
        }
      }
    } catch (err) {
      console.error("Failed to load prompt customizations:", err);
    }
    return null;
  });
  
  // Reload if templateId changes (not on initial mount since we loaded synchronously)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, PromptCustomization>;
        const templateCustomizations = parsed[templateId] || null;
        // Clean up any invalid overrides on load
        setCustomizations(templateCustomizations ? cleanupInvalidOverrides(templateCustomizations) : null);
      }
    } catch (err) {
      console.error("Failed to load prompt customizations:", err);
    }
  }, [templateId]);
  
  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, PromptCustomization>;
        if (parsed[templateId]) {
          // Clean up any invalid overrides on load
          setCustomizations(cleanupInvalidOverrides(parsed[templateId]));
        }
      }
    } catch (err) {
      console.error("Failed to load prompt customizations:", err);
    }
  }, [templateId]);
  
  const saveToStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const all = stored ? JSON.parse(stored) : {};
      
      const hasContent = customizations && (
        Object.keys(customizations.sectionOverrides).length > 0 ||
        customizations.additionalSections.length > 0 ||
        Object.keys(customizations.orderOverrides || {}).length > 0 ||
        Object.keys(customizations.toolOverrides || {}).length > 0 ||
        (customizations.disabledSections?.length || 0) > 0 ||
        !!customizations.customName
      );
      
      if (hasContent) {
        all[templateId] = customizations;
      } else {
        delete all[templateId];
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      console.error("Failed to save prompt customizations:", err);
    }
  }, [templateId, customizations]);
  
  // Auto-save when customizations change
  useEffect(() => {
    if (customizations !== null) {
      saveToStorage();
    }
  }, [customizations, saveToStorage]);
  
  const customizedSectionIds = new Set(
    customizations ? Object.keys(customizations.sectionOverrides) : []
  );
  
  const hasCustomizations = customizedSectionIds.size > 0 || 
    (customizations?.additionalSections?.length || 0) > 0 ||
    (customizations?.disabledSections?.length || 0) > 0;
  
  const hasOrderChanges = Object.keys(customizations?.orderOverrides || {}).length > 0;
  
  const hasToolCustomizations = Object.keys(customizations?.toolOverrides || {}).length > 0;
  
  const isCustomized = useCallback((sectionId: string): boolean => {
    return customizedSectionIds.has(sectionId);
  }, [customizedSectionIds]);
  
  const getEffectiveContent = useCallback((section: PromptSection): string => {
    if (customizations?.sectionOverrides[section.id]) {
      return customizations.sectionOverrides[section.id];
    }
    return section.content;
  }, [customizations]);
  
  const updateSection = useCallback((sectionId: string, content: string) => {
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
      };
      
      return {
        ...current,
        sectionOverrides: {
          ...current.sectionOverrides,
          [sectionId]: content,
        },
      };
    });
  }, [templateId]);
  
  const resetSection = useCallback((sectionId: string) => {
    setCustomizations((prev) => {
      if (!prev) return null;
      
      const { [sectionId]: _, ...rest } = prev.sectionOverrides;
      
      const hasContent = Object.keys(rest).length > 0 || 
        prev.additionalSections.length > 0 ||
        Object.keys(prev.orderOverrides || {}).length > 0;
      
      if (!hasContent) {
        return null;
      }
      
      return {
        ...prev,
        sectionOverrides: rest,
      };
    });
  }, []);
  
  const resetAll = useCallback(() => {
    setCustomizations(null);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const all = JSON.parse(stored);
        delete all[templateId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
    } catch (err) {
      console.error("Failed to reset customizations:", err);
    }
  }, [templateId]);
  
  // Custom sections management
  const addCustomSection = useCallback((section: Omit<PromptSection, 'id' | 'order'>): string => {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
      };
      
      // Find the highest order among existing custom sections
      const maxOrder = current.additionalSections.reduce(
        (max, s) => Math.max(max, s.order), 
        999 // Start custom sections at 1000+
      );
      
      const newSection: PromptSection = {
        ...section,
        id,
        order: maxOrder + 1,
        type: 'custom',
        editable: 'editable',
      };
      
      return {
        ...current,
        additionalSections: [...current.additionalSections, newSection],
      };
    });
    
    return id;
  }, [templateId]);
  
  const updateCustomSection = useCallback((sectionId: string, updates: Partial<PromptSection>) => {
    setCustomizations((prev) => {
      if (!prev) return prev;
      
      return {
        ...prev,
        additionalSections: prev.additionalSections.map((section) =>
          section.id === sectionId ? { ...section, ...updates } : section
        ),
      };
    });
  }, []);
  
  const deleteCustomSection = useCallback((sectionId: string) => {
    setCustomizations((prev) => {
      if (!prev) return prev;
      
      const newAdditional = prev.additionalSections.filter((s) => s.id !== sectionId);
      const { [sectionId]: _, ...restOverrides } = prev.sectionOverrides;
      const { [sectionId]: __, ...restOrder } = prev.orderOverrides || {};
      
      const hasContent = Object.keys(restOverrides).length > 0 || 
        newAdditional.length > 0 ||
        Object.keys(restOrder).length > 0;
      
      if (!hasContent) {
        return null;
      }
      
      return {
        ...prev,
        additionalSections: newAdditional,
        sectionOverrides: restOverrides,
        orderOverrides: restOrder,
      };
    });
  }, []);
  
  const getCustomSections = useCallback((): PromptSection[] => {
    return customizations?.additionalSections || [];
  }, [customizations]);
  
  // Order management
  const getOrderOverride = useCallback((sectionId: string): number | undefined => {
    return customizations?.orderOverrides?.[sectionId];
  }, [customizations]);
  
  const setOrderOverride = useCallback((sectionId: string, order: number) => {
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
      };
      
      return {
        ...current,
        orderOverrides: {
          ...(current.orderOverrides || {}),
          [sectionId]: order,
        },
      };
    });
  }, [templateId]);
  
  const getSortedSections = useCallback((templateSections: PromptSection[]): PromptSection[] => {
    // Merge template sections with custom sections
    const allSections = [
      ...templateSections,
      ...(customizations?.additionalSections || []),
    ];
    
    // Apply order overrides
    const sectionsWithOrder = allSections.map((section) => ({
      ...section,
      order: customizations?.orderOverrides?.[section.id] ?? section.order,
    }));
    
    return sectionsWithOrder.sort((a, b) => a.order - b.order);
  }, [customizations]);
  
  const moveSection = useCallback((
    sectionId: string, 
    direction: 'up' | 'down', 
    allSections: PromptSection[]
  ) => {
    const sorted = getSortedSections(allSections);
    const currentIndex = sorted.findIndex((s) => s.id === sectionId);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sorted.length - 1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentSection = sorted[currentIndex];
    const targetSection = sorted[targetIndex];
    
    // Swap order values
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
      };
      
      const currentOrder = current.orderOverrides?.[currentSection.id] ?? currentSection.order;
      const targetOrder = current.orderOverrides?.[targetSection.id] ?? targetSection.order;
      
      // If orders are the same, create distinct values
      let newCurrentOrder = targetOrder;
      let newTargetOrder = currentOrder;
      
      if (currentOrder === targetOrder) {
        newCurrentOrder = direction === 'up' ? currentOrder - 0.5 : currentOrder + 0.5;
        newTargetOrder = currentOrder;
      }
      
      return {
        ...current,
        orderOverrides: {
          ...(current.orderOverrides || {}),
          [currentSection.id]: newCurrentOrder,
          [targetSection.id]: newTargetOrder,
        },
      };
    });
  }, [templateId, getSortedSections]);
  
  const resetOrder = useCallback(() => {
    setCustomizations((prev) => {
      if (!prev) return prev;
      
      const hasContent = Object.keys(prev.sectionOverrides).length > 0 || 
        prev.additionalSections.length > 0 ||
        Object.keys(prev.toolOverrides || {}).length > 0;
      
      if (!hasContent) {
        return null;
      }
      
      return {
        ...prev,
        orderOverrides: {},
      };
    });
  }, []);
  
  // Tool override functions
  const getEffectiveToolDescription = useCallback((toolId: string, originalDescription: string): string => {
    return customizations?.toolOverrides?.[toolId]?.description ?? originalDescription;
  }, [customizations]);
  
  const isToolCustomized = useCallback((toolId: string): boolean => {
    return !!customizations?.toolOverrides?.[toolId]?.description;
  }, [customizations]);
  
  const updateToolDescription = useCallback((toolId: string, description: string) => {
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
        toolOverrides: {},
      };
      
      return {
        ...current,
        toolOverrides: {
          ...(current.toolOverrides || {}),
          [toolId]: { description },
        },
      };
    });
  }, [templateId]);
  
  const resetToolDescription = useCallback((toolId: string) => {
    setCustomizations((prev) => {
      if (!prev) return prev;
      
      const { [toolId]: _, ...restTools } = prev.toolOverrides || {};
      
      const hasContent = Object.keys(prev.sectionOverrides).length > 0 || 
        prev.additionalSections.length > 0 ||
        Object.keys(prev.orderOverrides || {}).length > 0 ||
        Object.keys(restTools).length > 0;
      
      if (!hasContent) {
        return null;
      }
      
      return {
        ...prev,
        toolOverrides: restTools,
      };
    });
  }, []);
  
  const getToolOverrides = useCallback(() => {
    return customizations?.toolOverrides || {};
  }, [customizations]);
  
  // Section disabling
  const isSectionDisabled = useCallback((sectionId: string): boolean => {
    return customizations?.disabledSections?.includes(sectionId) || false;
  }, [customizations]);
  
  const toggleSectionDisabled = useCallback((sectionId: string) => {
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
        toolOverrides: {},
      };
      
      const isCurrentlyDisabled = current.disabledSections?.includes(sectionId) || false;
      const newDisabledSections = isCurrentlyDisabled
        ? (current.disabledSections || []).filter(id => id !== sectionId)
        : [...(current.disabledSections || []), sectionId];
      
      return {
        ...current,
        disabledSections: newDisabledSections,
      };
    });
  }, [templateId]);
  
  const getDisabledSections = useCallback((): string[] => {
    return customizations?.disabledSections || [];
  }, [customizations]);
  
  // Tool disabling
  const isToolDisabled = useCallback((toolId: string): boolean => {
    return customizations?.toolOverrides?.[toolId]?.disabled || false;
  }, [customizations]);
  
  const toggleToolDisabled = useCallback((toolId: string) => {
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
        toolOverrides: {},
      };
      
      const currentOverride = current.toolOverrides?.[toolId] || {};
      const isCurrentlyDisabled = currentOverride.disabled || false;
      
      return {
        ...current,
        toolOverrides: {
          ...(current.toolOverrides || {}),
          [toolId]: {
            ...currentOverride,
            disabled: !isCurrentlyDisabled,
          },
        },
      };
    });
  }, [templateId]);
  
  const getDisabledTools = useCallback((): string[] => {
    if (!customizations?.toolOverrides) return [];
    return Object.entries(customizations.toolOverrides)
      .filter(([_, override]) => override.disabled)
      .map(([toolId]) => toolId);
  }, [customizations]);
  
  const exportCustomizations = useCallback((template: SystemPromptTemplate): ExportedPromptTemplate => {
    const allSections = getSortedSections(template.sections);
    
    // Get disabled tools list
    const disabledTools = Object.entries(customizations?.toolOverrides || {})
      .filter(([_, override]) => override.disabled)
      .map(([toolId]) => toolId);
    
    // Apply customizations to template for export
    const exportedTemplate: SystemPromptTemplate = {
      ...template,
      name: customizations?.customName || template.name,
      isDefault: false,
      updatedAt: new Date().toISOString(),
      sections: allSections.map((section) => ({
        ...section,
        content: getEffectiveContent(section),
      })),
      metadata: {
        ...template.metadata,
        notes: `Customized export from ${template.name}`,
        toolOverrides: customizations?.toolOverrides,
      },
    };
    
    return {
      formatVersion: "1.0",
      exportedAt: new Date().toISOString(),
      template: exportedTemplate,
      customizations: {
        customName: customizations?.customName,
        disabledSections: customizations?.disabledSections || [],
        disabledTools,
      },
    };
  }, [getEffectiveContent, getSortedSections, customizations]);
  
  const importCustomizations = useCallback((
    data: ExportedPromptTemplate, 
    currentTemplate: SystemPromptTemplate
  ): boolean => {
    try {
      if (data.formatVersion !== "1.0") {
        console.error("Unsupported format version:", data.formatVersion);
        return false;
      }
      
      const importedTemplate = data.template;
      const newOverrides: Record<string, string> = {};
      const newOrderOverrides: Record<string, number> = {};
      const newCustomSections: PromptSection[] = [];
      
      // Compare imported sections with current template
      for (const importedSection of importedTemplate.sections) {
        const currentSection = currentTemplate.sections.find(s => s.id === importedSection.id);
        
        if (currentSection) {
          // Existing section - check for content changes
          if (currentSection.editable === 'editable' && 
              importedSection.content !== currentSection.content) {
            newOverrides[importedSection.id] = importedSection.content;
          }
          // Check for order changes
          if (importedSection.order !== currentSection.order) {
            newOrderOverrides[importedSection.id] = importedSection.order;
          }
        } else if (importedSection.type === 'custom') {
          // Custom section from import
          newCustomSections.push(importedSection);
        }
      }
      
      // Import tool overrides from metadata
      const importedToolOverrides = (importedTemplate.metadata as { toolOverrides?: Record<string, { description?: string; disabled?: boolean }> })?.toolOverrides || {};
      
      // Import disabled sections and tools from customizations block
      const importedDisabledSections = data.customizations?.disabledSections || [];
      const importedDisabledTools = data.customizations?.disabledTools || [];
      const importedCustomName = data.customizations?.customName;
      
      // Merge disabled tools into tool overrides
      const mergedToolOverrides = { ...importedToolOverrides };
      for (const toolId of importedDisabledTools) {
        mergedToolOverrides[toolId] = {
          ...mergedToolOverrides[toolId],
          disabled: true,
        };
      }
      
      const hasContent = Object.keys(newOverrides).length > 0 || 
        newCustomSections.length > 0 ||
        Object.keys(newOrderOverrides).length > 0 ||
        Object.keys(mergedToolOverrides).length > 0 ||
        importedDisabledSections.length > 0 ||
        !!importedCustomName;
      
      if (hasContent) {
        setCustomizations({
          templateId,
          customName: importedCustomName,
          sectionOverrides: newOverrides,
          disabledSections: importedDisabledSections,
          additionalSections: newCustomSections,
          orderOverrides: newOrderOverrides,
          toolOverrides: mergedToolOverrides,
        });
      }
      
      return true;
    } catch (err) {
      console.error("Failed to import customizations:", err);
      return false;
    }
  }, [templateId]);
  
  const getCustomName = useCallback((): string | undefined => {
    return customizations?.customName;
  }, [customizations]);
  
  const setCustomName = useCallback((name: string) => {
    setCustomizations((prev) => {
      const current = prev || {
        templateId,
        sectionOverrides: {},
        disabledSections: [],
        additionalSections: [],
        orderOverrides: {},
      };
      
      return {
        ...current,
        customName: name.trim() || undefined,
      };
    });
  }, [templateId]);
  
  return {
    customizations,
    hasCustomizations,
    customizedSectionIds,
    getEffectiveContent,
    isCustomized,
    updateSection,
    resetSection,
    resetAll,
    addCustomSection,
    updateCustomSection,
    deleteCustomSection,
    getCustomSections,
    getOrderOverride,
    setOrderOverride,
    moveSection,
    getSortedSections,
    hasOrderChanges,
    resetOrder,
    getEffectiveToolDescription,
    isToolCustomized,
    updateToolDescription,
    resetToolDescription,
    hasToolCustomizations,
    getToolOverrides,
    isSectionDisabled,
    toggleSectionDisabled,
    getDisabledSections,
    isToolDisabled,
    toggleToolDisabled,
    getDisabledTools,
    exportCustomizations,
    importCustomizations,
    getCustomName,
    setCustomName,
    saveToStorage,
    loadFromStorage,
  };
}
