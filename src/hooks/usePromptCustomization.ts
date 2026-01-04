import { useState, useCallback, useEffect } from "react";
import type { 
  SystemPromptTemplate, 
  PromptSection, 
  PromptCustomization,
  ExportedPromptTemplate 
} from "@/types/systemPrompt";

const STORAGE_KEY = "freeagent-prompt-customizations";

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
  
  // Import/Export
  exportCustomizations: (template: SystemPromptTemplate) => ExportedPromptTemplate;
  importCustomizations: (data: ExportedPromptTemplate, currentTemplate: SystemPromptTemplate) => boolean;
  
  // Persistence
  saveToStorage: () => void;
  loadFromStorage: () => void;
}

export function usePromptCustomization(templateId: string): UsePromptCustomizationReturn {
  const [customizations, setCustomizations] = useState<PromptCustomization | null>(null);
  
  // Load from localStorage on mount
  useEffect(() => {
    loadFromStorage();
  }, [templateId]);
  
  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, PromptCustomization>;
        if (parsed[templateId]) {
          setCustomizations(parsed[templateId]);
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
      
      if (customizations && Object.keys(customizations.sectionOverrides).length > 0) {
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
  
  const hasCustomizations = customizedSectionIds.size > 0;
  
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
      
      if (Object.keys(rest).length === 0) {
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
  
  const exportCustomizations = useCallback((template: SystemPromptTemplate): ExportedPromptTemplate => {
    // Apply customizations to template for export
    const exportedTemplate: SystemPromptTemplate = {
      ...template,
      isDefault: false,
      updatedAt: new Date().toISOString(),
      sections: template.sections.map((section) => ({
        ...section,
        content: getEffectiveContent(section),
      })),
      metadata: {
        ...template.metadata,
        notes: `Customized export from ${template.name}`,
      },
    };
    
    return {
      formatVersion: "1.0",
      exportedAt: new Date().toISOString(),
      template: exportedTemplate,
    };
  }, [getEffectiveContent]);
  
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
      
      // Compare imported sections with current template
      for (const importedSection of importedTemplate.sections) {
        const currentSection = currentTemplate.sections.find(s => s.id === importedSection.id);
        
        if (currentSection && 
            currentSection.editable === 'editable' && 
            importedSection.content !== currentSection.content) {
          newOverrides[importedSection.id] = importedSection.content;
        }
      }
      
      if (Object.keys(newOverrides).length > 0) {
        setCustomizations({
          templateId,
          sectionOverrides: newOverrides,
          disabledSections: [],
          additionalSections: [],
        });
      }
      
      return true;
    } catch (err) {
      console.error("Failed to import customizations:", err);
      return false;
    }
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
    exportCustomizations,
    importCustomizations,
    saveToStorage,
    loadFromStorage,
  };
}
