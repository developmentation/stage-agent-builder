// System Prompt Builder - Prepares prompt data from template + customizations
import type { PromptSection, ToolOverride } from "@/types/systemPrompt";

// Structure for tool definitions sent to edge function
export interface ToolDefinitionPayload {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Record<string, { type: string; required?: boolean; description?: string }>;
}

// Structure sent to edge function
export interface PromptDataSection {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
  editable: string;
  variables?: string[];
}

export interface PromptDataPayload {
  sections: PromptDataSection[];
  toolOverrides: Record<string, ToolOverride>;
  disabledTools: string[];
  toolDefinitions: ToolDefinitionPayload[];
}

// Interface for the template loaded from JSON
interface SystemPromptTemplateJSON {
  id: string;
  name: string;
  version: string;
  description: string;
  sections: PromptSection[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseSchemas?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: any[];
  metadata?: Record<string, unknown>;
}

// Interface for tool manifest loaded from JSON
interface ToolsManifestJSON {
  version: string;
  description: string;
  tools: Record<string, {
    name: string;
    description: string;
    category: string | string[];
    parameters: Record<string, { type: string; required?: boolean; description?: string }>;
  }>;
  categories: Record<string, { name: string; description: string; color: string }>;
}

// Interface for customization methods (subset of usePromptCustomization return)
export interface PromptCustomizationMethods {
  getSortedSections: (templateSections: PromptSection[]) => PromptSection[];
  getEffectiveContent: (section: PromptSection) => string;
  getToolOverrides: () => Record<string, ToolOverride>;
  getDisabledSections: () => string[];
  getDisabledTools: () => string[];
}

// Cache for loaded template and tools manifest
let templateCache: SystemPromptTemplateJSON | null = null;
let toolsManifestCache: ToolsManifestJSON | null = null;

/**
 * Load the system prompt template from JSON file
 */
export async function loadSystemPromptTemplate(): Promise<SystemPromptTemplateJSON> {
  if (templateCache) {
    return templateCache;
  }
  
  const response = await fetch('/data/systemPromptTemplate.json');
  if (!response.ok) {
    throw new Error(`Failed to load system prompt template: ${response.status}`);
  }
  
  templateCache = await response.json();
  return templateCache!;
}

/**
 * Load the tools manifest from JSON file
 */
export async function loadToolsManifest(): Promise<ToolsManifestJSON> {
  if (toolsManifestCache) {
    return toolsManifestCache;
  }
  
  const response = await fetch('/data/toolsManifest.json');
  if (!response.ok) {
    throw new Error(`Failed to load tools manifest: ${response.status}`);
  }
  
  toolsManifestCache = await response.json();
  return toolsManifestCache!;
}

/**
 * Clear the template and manifest caches (useful for testing or hot reloading)
 */
export function clearTemplateCache(): void {
  templateCache = null;
  toolsManifestCache = null;
}

/**
 * Build tool definitions array from the manifest
 */
function buildToolDefinitions(manifest: ToolsManifestJSON): ToolDefinitionPayload[] {
  const definitions: ToolDefinitionPayload[] = [];
  
  for (const [toolId, tool] of Object.entries(manifest.tools)) {
    // For tools with multiple categories, use the first one
    const category = Array.isArray(tool.category) ? tool.category[0] : tool.category;
    
    definitions.push({
      id: toolId,
      name: tool.name,
      description: tool.description,
      category,
      parameters: tool.parameters,
    });
  }
  
  console.log(`[PromptBuilder] Built ${definitions.length} tool definitions from manifest`);
  return definitions;
}

/**
 * Build the prompt data payload to send to the edge function
 * 
 * This function:
 * 1. Loads the template from JSON
 * 2. Loads the tools manifest from JSON
 * 3. Applies customizations (section overrides, custom sections, order changes)
 * 4. Returns the structured data for the edge function to build the final prompt
 */
export async function buildPromptData(
  customization: PromptCustomizationMethods
): Promise<PromptDataPayload> {
  // Load the base template and tools manifest in parallel
  const [template, toolsManifest] = await Promise.all([
    loadSystemPromptTemplate(),
    loadToolsManifest(),
  ]);
  
  // Get sorted sections (includes custom sections and respects order overrides)
  const sortedSections = customization.getSortedSections(template.sections);
  
  // Filter out disabled sections
  const disabledSectionIds = new Set(customization.getDisabledSections());
  const activeSections = sortedSections.filter(s => !disabledSectionIds.has(s.id));
  
  // Apply content overrides to each section
  const sectionsWithOverrides: PromptDataSection[] = activeSections.map((section, index) => {
    const effectiveContent = customization.getEffectiveContent(section);
    const isCustomized = effectiveContent !== section.content;
    
    // Log customized sections for debugging
    if (isCustomized) {
      console.log(`[PromptBuilder] Section "${section.id}" is customized. Preview:`, 
        effectiveContent.substring(0, 100) + (effectiveContent.length > 100 ? '...' : ''));
    }
    
    return {
      id: section.id,
      type: section.type,
      title: section.title,
      content: effectiveContent,
      order: section.order ?? index,
      editable: section.editable,
      variables: section.variables,
    };
  });
  
  // Get tool description overrides
  const toolOverrides = customization.getToolOverrides();
  
  // Get disabled tools
  const disabledTools = customization.getDisabledTools();
  
  // Build tool definitions from manifest
  const toolDefinitions = buildToolDefinitions(toolsManifest);
  
  console.log(`[PromptBuilder] Built ${sectionsWithOverrides.length} sections (${disabledSectionIds.size} disabled), ` +
    `${toolDefinitions.length} tools, ${Object.keys(toolOverrides).length} tool overrides, ${disabledTools.length} disabled tools`);
  
  return {
    sections: sectionsWithOverrides,
    toolOverrides,
    disabledTools,
    toolDefinitions,
  };
}

/**
 * Build prompt data with default customizations (no overrides)
 * Useful when customization hook isn't available
 */
export async function buildDefaultPromptData(): Promise<PromptDataPayload> {
  const [template, toolsManifest] = await Promise.all([
    loadSystemPromptTemplate(),
    loadToolsManifest(),
  ]);
  
  // Return sections as-is with no overrides
  const sections: PromptDataSection[] = template.sections
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      content: section.content,
      order: section.order ?? index,
      editable: section.editable,
      variables: section.variables,
    }));
  
  // Build tool definitions from manifest
  const toolDefinitions = buildToolDefinitions(toolsManifest);
  
  return {
    sections,
    toolOverrides: {},
    disabledTools: [],
    toolDefinitions,
  };
}
