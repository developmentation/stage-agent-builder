// Free Agent Tool Executor - Handles frontend-side tool execution
import { supabase } from "@/integrations/supabase/client";
import { MarkdownProcessor } from "@/utils/markdownProcessor";
import type { 
  BlackboardEntry, 
  FreeAgentArtifact, 
  SessionFile,
  AssistanceRequest,
  ToolResultAttribute,
  AdvancedFeatures,
  ChildSpec,
} from "@/types/freeAgent";
import type { PromptCustomization } from "@/types/systemPrompt";

// Spawn callback for creating child agents
export interface SpawnRequest {
  children: ChildSpec[];
  completionThreshold?: number;
  parentBlackboard: BlackboardEntry[];
  parentScratchpad: string;
  parentAttributes: Record<string, ToolResultAttribute>;
}

export interface ToolExecutionContext {
  sessionId: string;
  prompt: string;
  scratchpad: string;
  blackboard: BlackboardEntry[];
  sessionFiles: SessionFile[];
  toolResultAttributes?: Record<string, ToolResultAttribute>;
  artifacts?: FreeAgentArtifact[];
  onArtifactCreated: (artifact: FreeAgentArtifact) => void;
  onBlackboardUpdate: (entry: BlackboardEntry) => void;
  onScratchpadUpdate: (content: string) => void;
  onAssistanceNeeded: (request: AssistanceRequest) => void;
  // Advanced features
  advancedFeatures?: AdvancedFeatures;
  // Self-author: prompt customization interface
  promptCustomization?: PromptCustomization;
  // Self-author: callback to notify UI when prompt is modified
  onPromptCustomizationChange?: () => void;
  // Self-author: callback to update in-memory ref immediately (so read_self gets fresh data)
  onPromptCustomizationUpdate?: (newCustomization: PromptCustomization) => void;
  // Spawn: callback to create child agents
  onSpawnChildren?: (request: SpawnRequest) => void;
}

interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Execute a frontend-handled tool
export async function executeFrontendTool(
  tool: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  switch (tool) {
    case "read_blackboard":
      return executeReadBlackboard(params, context);
    case "write_blackboard":
      return executeWriteBlackboard(params, context);
    case "read_file":
      return executeReadFile(params, context);
    case "request_assistance":
      return executeRequestAssistance(params, context);
    case "export_word":
      return executeExportWord(params, context);
    case "export_pdf":
      return executeExportPdf(params, context);
    case "read_scratchpad":
      return executeReadScratchpad(context);
    case "write_scratchpad":
      return executeWriteScratchpad(params, context);
    case "read_prompt":
      return executeReadPrompt(context);
    case "read_prompt_files":
      return executeReadPromptFiles(context);
    case "read_attribute":
      return executeReadAttribute(params, context);
    case "read_artifact":
      return executeReadArtifact(params, context);
    // Advanced: Self-Author tools
    case "read_self":
      return executeReadSelf(params, context);
    case "write_self":
      return executeWriteSelf(params, context);
    // Advanced: Spawn tools
    case "spawn":
      return executeSpawn(params, context);
    default:
      return { success: false, error: `Unknown frontend tool: ${tool}` };
  }
}

// Read blackboard entries (from local state)
async function executeReadBlackboard(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    let entries = context.blackboard;
    
    if (params.filter) {
      entries = entries.filter(e => e.category === params.filter);
    }
    
    return {
      success: true,
      result: entries.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        category: e.category,
        content: e.content,
        data: e.data,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to read blackboard" };
  }
}

// Write to blackboard (local state - callback updates React state)
async function executeWriteBlackboard(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const entry: BlackboardEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category: params.category as BlackboardEntry["category"],
      content: params.content as string,
      data: params.data as Record<string, unknown> | undefined,
      iteration: 0,
    };

    context.onBlackboardUpdate(entry);

    return {
      success: true,
      result: { id: entry.id, timestamp: entry.timestamp, success: true },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to write blackboard" };
  }
}

// Read session file (from local state)
async function executeReadFile(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const fileId = params.fileId as string;
    const file = context.sessionFiles.find(f => f.id === fileId);

    if (!file) {
      return { success: false, error: `File not found: ${fileId}` };
    }

    return {
      success: true,
      result: {
        filename: file.filename,
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to read file" };
  }
}

// Request assistance from user
async function executeRequestAssistance(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const request: AssistanceRequest = {
    id: crypto.randomUUID(),
    question: params.question as string,
    context: params.context as string | undefined,
    inputType: (params.inputType as AssistanceRequest["inputType"]) || "text",
    choices: params.choices as string[] | undefined,
    requestedAt: new Date().toISOString(),
  };

  context.onAssistanceNeeded(request);

  return {
    success: true,
    result: { awaiting_response: true, request_id: request.id },
  };
}

// Read scratchpad content - NO handlebar expansion (use read_attribute for full data)
async function executeReadScratchpad(
  context: ToolExecutionContext
): Promise<ToolResult> {
  const content = context.scratchpad || "";
  
  // List available attributes so agent knows what it can access via read_attribute
  const attributes = context.toolResultAttributes || {};
  const availableAttributes = Object.keys(attributes).map(name => ({
    name,
    tool: attributes[name].tool,
    size: attributes[name].size,
  }));
  
  console.log(`[Scratchpad Read] Content length: ${content.length} chars (no expansion)`);
  console.log(`[Scratchpad Read] Available attributes for read_attribute: ${availableAttributes.map(a => a.name).join(', ') || 'none'}`);
  
  return {
    success: true,
    result: {
      content: content,
      note: "Handlebar references like {{name}} are attribute placeholders. Use read_attribute({ names: ['name'] }) to fetch full data, then SUMMARIZE findings in scratchpad.",
      available_attributes: availableAttributes,
    },
  };
}

// Write to scratchpad
async function executeWriteScratchpad(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const content = params.content as string;
    const contentLength = content?.length || 0;
    const preview = content?.slice(0, 100) || '';
    console.log(`[Scratchpad Write] Content length: ${contentLength} chars`);
    console.log(`[Scratchpad Write] Preview: ${preview}...`);
    
    const mode = (params.mode as string) || "append";
    
    const newContent = mode === "append" 
      ? (context.scratchpad || "") + (context.scratchpad ? "\n\n" : "") + content 
      : content;
    
    context.onScratchpadUpdate(newContent);

    return {
      success: true,
      result: { success: true, length: newContent.length },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to write scratchpad" };
  }
}

// Read original prompt
async function executeReadPrompt(
  context: ToolExecutionContext
): Promise<ToolResult> {
  return {
    success: true,
    result: context.prompt,
  };
}

// Read prompt files metadata
async function executeReadPromptFiles(
  context: ToolExecutionContext
): Promise<ToolResult> {
  return {
    success: true,
    result: context.sessionFiles.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      size: f.size,
    })),
  };
}

// Read tool result attributes
async function executeReadAttribute(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const names = (params.names as string[]) || [];
  const attributes = context.toolResultAttributes || {};
  
  if (names.length === 0) {
    // Return metadata for all attributes
    const metadata = Object.entries(attributes).map(([name, attr]) => ({
      name,
      tool: attr.tool,
      size: attr.size,
      iteration: attr.iteration,
      createdAt: attr.createdAt,
    }));
    console.log(`[Read Attribute] Returning metadata for ${metadata.length} attributes`);
    return { success: true, result: { attributes: metadata, count: metadata.length } };
  }
  
  // Return full content for requested attributes
  const results: Record<string, unknown> = {};
  console.log(`[Read Attribute] Requested attributes: ${names.join(', ')}`);
  console.log(`[Read Attribute] Available attributes: ${Object.keys(attributes).join(', ') || 'none'}`);
  
  for (const name of names) {
    if (attributes[name]) {
      // Safely serialize to ensure no circular references
      try {
        const serialized = JSON.parse(JSON.stringify(attributes[name].result));
        results[name] = serialized;
        console.log(`[Read Attribute] Found '${name}': ${JSON.stringify(serialized).length} chars`);
      } catch (e) {
        results[name] = `[Error serializing attribute '${name}': ${e instanceof Error ? e.message : 'Unknown error'}]`;
        console.error(`[Read Attribute] Serialization error for ${name}:`, e);
      }
    } else {
      results[name] = `Attribute '${name}' not found`;
      console.log(`[Read Attribute] NOT FOUND: '${name}'`);
    }
  }
  
  const totalSize = JSON.stringify(results).length;
  console.log(`[Read Attribute] Retrieved ${names.length} attributes, total result size: ${totalSize} chars`);
  return { success: true, result: results };
}

// Read artifacts created in session
async function executeReadArtifact(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const ids = (params.ids as string[]) || [];
  const allArtifacts = context.artifacts || [];
  
  if (ids.length === 0) {
    // Return metadata for all artifacts
    const metadata = allArtifacts.map(a => ({
      id: a.id,
      title: a.title,
      type: a.type,
      description: a.description,
      contentLength: a.content.length,
      createdAt: a.createdAt,
      iteration: a.iteration,
    }));
    console.log(`[Read Artifact] Returning metadata for ${metadata.length} artifacts`);
    return { success: true, result: { artifacts: metadata, count: metadata.length } };
  }
  
  // Find specific artifacts by ID or title
  const found: Record<string, unknown> = {};
  console.log(`[Read Artifact] Requested artifacts: ${ids.join(', ')}`);
  console.log(`[Read Artifact] Available artifacts: ${allArtifacts.map(a => a.title).join(', ') || 'none'}`);
  
  for (const idOrTitle of ids) {
    const artifact = allArtifacts.find(
      a => a.id === idOrTitle || a.title.toLowerCase() === idOrTitle.toLowerCase()
    );
    if (artifact) {
      found[artifact.title] = {
        id: artifact.id,
        type: artifact.type,
        content: artifact.content,
        description: artifact.description,
        createdAt: artifact.createdAt,
      };
      console.log(`[Read Artifact] Found '${artifact.title}': ${artifact.content.length} chars`);
    } else {
      found[idOrTitle] = { error: `Artifact '${idOrTitle}' not found` };
      console.log(`[Read Artifact] NOT FOUND: '${idOrTitle}'`);
    }
  }
  
  return { success: true, result: { artifacts: found, count: Object.keys(found).length } };
}

// Export to Word document using MarkdownProcessor for proper formatting
async function executeExportWord(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const content = params.content as string;
    const filename = (params.filename as string) || "document.docx";
    const title = (params.title as string) || "Document";

    const processor = new MarkdownProcessor();
    const sections = [{ title: "Content", value: content }];
    const blob = await processor.generateWordDocument(title, sections);
    const base64 = await blobToBase64(blob);

    const artifact: FreeAgentArtifact = {
      id: crypto.randomUUID(),
      type: "file",
      title: filename,
      content: base64,
      description: "Word document",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: blob.size,
      createdAt: new Date().toISOString(),
      iteration: 0,
    };

    context.onArtifactCreated(artifact);

    return {
      success: true,
      result: { filename, artifactId: artifact.id, size: blob.size },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to export Word" };
  }
}

// Export to PDF using MarkdownProcessor for proper formatting
async function executeExportPdf(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const content = params.content as string;
    const filename = (params.filename as string) || "document.pdf";
    const title = (params.title as string) || "Document";

    const processor = new MarkdownProcessor();
    const sections = [{ title: "Content", value: content }];
    const pdf = processor.generatePDF(title, sections);
    
    const blob = pdf.output("blob");
    const base64 = await blobToBase64(blob);

    const artifact: FreeAgentArtifact = {
      id: crypto.randomUUID(),
      type: "file",
      title: filename,
      content: base64,
      description: "PDF document",
      mimeType: "application/pdf",
      size: blob.size,
      createdAt: new Date().toISOString(),
      iteration: 0,
    };

    context.onArtifactCreated(artifact);

    return {
      success: true,
      result: { filename, artifactId: artifact.id, size: blob.size },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to export PDF" };
  }
}

// Helper to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(",")[1] || base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Execute edge function tool via Supabase
export async function executeEdgeFunctionTool(
  tool: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  const toolToFunction: Record<string, string> = {
    get_time: "time",
    brave_search: "brave-search",
    google_search: "google-search",
    web_scrape: "web-scrape",
    read_github_repo: "github-fetch",
    read_github_file: "github-fetch",
    send_email: "send-email",
    image_generation: "run-nano",
    get_call_api: "api-call",
    post_call_api: "api-call",
    execute_sql: "external-db",
    read_database_schemas: "external-db",
    elevenlabs_tts: "elevenlabs-tts",
    // Weather
    get_weather: "tool_weather",
    // ZIP tools
    read_zip_contents: "tool_zip-handler",
    read_zip_file: "tool_zip-handler",
    extract_zip_files: "tool_zip-handler",
    // PDF tools
    pdf_info: "tool_pdf-handler",
    pdf_extract_text: "tool_pdf-handler",
    // OCR
    ocr_image: "tool_ocr-handler",
  };

  const functionName = toolToFunction[tool];
  
  if (!functionName) {
    return { success: false, error: `Unknown edge function tool: ${tool}` };
  }

  try {
    // Prepare params for specific tools
    let body = params;
    
    if (tool === "get_call_api") {
      body = { ...params, method: "GET" };
    } else if (tool === "post_call_api") {
      body = { ...params, method: "POST" };
    } else if (tool === "image_generation") {
      body = { prompt: params.prompt, model: params.model || "gemini-2.5-flash-image" };
    } else if (tool === "read_database_schemas") {
      body = { ...params, action: "schemas" };
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, result: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Edge function call failed" };
  }
}

// ============================================================================
// ADVANCED TOOLS: Self-Author
// ============================================================================

// Read the agent's own prompt configuration
async function executeReadSelf(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  if (!context.advancedFeatures?.selfAuthorEnabled) {
    return { 
      success: false, 
      error: "Self-Author feature is not enabled. Enable it in the Advanced tab before using read_self." 
    };
  }
  
  if (!context.promptCustomization) {
    return { 
      success: false, 
      error: "Prompt customization context not available" 
    };
  }
  
  const include = (params.include as string) || "all";
  const result: Record<string, unknown> = {};
  
  try {
    if (include === "all" || include === "sections") {
      // Return section information with current state
      result.sections = {
        sectionOverrides: context.promptCustomization.sectionOverrides || {},
        disabledSections: context.promptCustomization.disabledSections || [],
        additionalSections: (context.promptCustomization.additionalSections || []).map(s => ({
          id: s.id,
          title: s.title,
          contentLength: s.content?.length || 0,
        })),
        orderOverrides: context.promptCustomization.orderOverrides || {},
      };
      // Include list of valid template section IDs for reference
      result.validSectionIds = Array.from(VALID_TEMPLATE_SECTION_IDS);
      result.customSectionIds = (context.promptCustomization.additionalSections || []).map(s => s.id);
    }
    
    if (include === "all" || include === "tools") {
      result.tools = {
        toolOverrides: context.promptCustomization.toolOverrides || {},
        disabledToolsList: Object.entries(context.promptCustomization.toolOverrides || {})
          .filter(([_, override]) => override.disabled)
          .map(([toolId]) => toolId),
      };
    }
    
    return { 
      success: true, 
      result: {
        ...result,
        usage: {
          tip: "Use write_self to modify your configuration. Changes take effect next iteration.",
          examples: [
            'Override EXISTING section: write_self({ sectionOverrides: { identity: "You are a helpful assistant..." } })',
            'Add NEW custom section: write_self({ addSections: [{ title: "My Rules", content: "..." }] })',
            'Delete custom section: write_self({ deleteSections: ["custom_section_id"] })',
            'Disable a section: write_self({ disableSections: ["memory_architecture"] })',
            'Disable a tool: write_self({ disableTools: ["web_scrape"] })',
          ],
          important: "sectionOverrides only works for existing sections. Use addSections to create NEW sections."
        }
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to read self configuration" 
    };
  }
}

// Valid template section IDs that can be overridden
const VALID_TEMPLATE_SECTION_IDS = new Set([
  'identity', 'user_task', 'tools_list', 'session_files', 'configured_secrets', 
  'blackboard', 'scratchpad', 'previous_results', 'iteration_info',
  'memory_architecture', 'memory_persistence', 'correct_workflow', 'loop_problem', 
  'anti_loop_rules', 'loop_self_reflection', 'tool_execution_timing',
  'response_format', 'blackboard_mandatory', 'data_handling', 
  'workflow_summary', 'accessing_attributes', 'reference_resolution',
  'self_author', 'spawn_capabilities', 'artifacts_list'
]);

// Write/modify the agent's own prompt configuration
async function executeWriteSelf(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  if (!context.advancedFeatures?.selfAuthorEnabled) {
    return { 
      success: false, 
      error: "Self-Author feature is not enabled. Enable it in the Advanced tab before using write_self." 
    };
  }
  
  if (!context.promptCustomization) {
    return { 
      success: false, 
      error: "Prompt customization context not available" 
    };
  }
  
  const changesApplied: string[] = [];
  const warnings: string[] = [];
  
  try {
    const sectionOverrides = params.sectionOverrides as Record<string, string> | undefined;
    const disableSections = params.disableSections as string[] | undefined;
    const enableSections = params.enableSections as string[] | undefined;
    const toolDescriptionOverrides = params.toolDescriptionOverrides as Record<string, string> | undefined;
    const disableTools = params.disableTools as string[] | undefined;
    const enableTools = params.enableTools as string[] | undefined;
    // New parameters for adding/deleting custom sections
    const addSections = params.addSections as Array<{
      id?: string;
      title: string;
      content: string;
    }> | undefined;
    const deleteSections = params.deleteSections as string[] | undefined;
    
    // Build the updated customization - explicitly preserve all arrays/objects
    const currentCustomization = context.promptCustomization || {
      templateId: 'default',
      sectionOverrides: {},
      disabledSections: [],
      additionalSections: [],
      orderOverrides: {},
      toolOverrides: {},
    };
    
    const updatedCustomization: PromptCustomization = {
      ...currentCustomization,
      sectionOverrides: { ...currentCustomization.sectionOverrides },
      disabledSections: [...(currentCustomization.disabledSections || [])],
      additionalSections: [...(currentCustomization.additionalSections || [])], // Explicit copy
      orderOverrides: { ...(currentCustomization.orderOverrides || {}) },        // Explicit copy
      toolOverrides: { ...currentCustomization.toolOverrides },
    };
    
    // Delete custom sections first (before adding new ones)
    if (deleteSections) {
      for (const sectionId of deleteSections) {
        const index = updatedCustomization.additionalSections.findIndex(s => s.id === sectionId);
        if (index !== -1) {
          const section = updatedCustomization.additionalSections[index];
          updatedCustomization.additionalSections.splice(index, 1);
          changesApplied.push(`Deleted custom section: ${section.title} (${sectionId})`);
        } else {
          warnings.push(`Section '${sectionId}' not found in custom sections - cannot delete`);
        }
        // Also remove from sectionOverrides if it exists there
        if (updatedCustomization.sectionOverrides[sectionId]) {
          delete updatedCustomization.sectionOverrides[sectionId];
        }
      }
    }
    
    // Add new custom sections
    if (addSections) {
      for (const section of addSections) {
        if (!section.title || !section.content) {
          warnings.push(`Skipped section: missing title or content`);
          continue;
        }
        const newId = section.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Check if ID already exists
        const existsInTemplate = VALID_TEMPLATE_SECTION_IDS.has(newId);
        const existsInCustom = updatedCustomization.additionalSections.some(s => s.id === newId);
        
        if (existsInTemplate || existsInCustom) {
          warnings.push(`Section ID '${newId}' already exists - use sectionOverrides to modify it`);
          continue;
        }
        
        const maxOrder = updatedCustomization.additionalSections.reduce(
          (max, s) => Math.max(max, s.order), 999
        );
        updatedCustomization.additionalSections.push({
          id: newId,
          title: section.title,
          type: 'custom',
          editable: 'editable',
          order: maxOrder + 1,
          content: section.content,
        });
        changesApplied.push(`Added custom section '${section.title}' (${newId}, ${section.content.length} chars)`);
      }
    }
    
    // Apply section content overrides
    if (sectionOverrides) {
      for (const [sectionId, content] of Object.entries(sectionOverrides)) {
        // Check if it's a valid template section
        const isValidTemplate = VALID_TEMPLATE_SECTION_IDS.has(sectionId);
        // Check if it's a custom section
        const isCustom = updatedCustomization.additionalSections.some(s => s.id === sectionId);
        
        if (!isValidTemplate && !isCustom) {
          warnings.push(`Section '${sectionId}' does not exist - use addSections to create it first. Valid sections: ${Array.from(VALID_TEMPLATE_SECTION_IDS).slice(0, 5).join(', ')}...`);
          continue; // Skip saving invalid sections to prevent phantom entries
        }
        
        updatedCustomization.sectionOverrides[sectionId] = content;
        changesApplied.push(`Override section '${sectionId}' (${content.length} chars)`);
      }
    }
    
    // Disable sections
    if (disableSections) {
      for (const sectionId of disableSections) {
        if (!updatedCustomization.disabledSections.includes(sectionId)) {
          updatedCustomization.disabledSections.push(sectionId);
        }
        changesApplied.push(`Disable section: ${sectionId}`);
      }
    }
    
    // Enable sections (remove from disabled list)
    if (enableSections) {
      for (const sectionId of enableSections) {
        updatedCustomization.disabledSections = updatedCustomization.disabledSections.filter(id => id !== sectionId);
        changesApplied.push(`Enable section: ${sectionId}`);
      }
    }
    
    // Apply tool description overrides
    if (toolDescriptionOverrides) {
      for (const [toolId, description] of Object.entries(toolDescriptionOverrides)) {
        updatedCustomization.toolOverrides[toolId] = {
          ...updatedCustomization.toolOverrides[toolId],
          description,
        };
        changesApplied.push(`Override tool description: ${toolId}`);
      }
    }
    
    // Disable tools
    if (disableTools) {
      for (const toolId of disableTools) {
        updatedCustomization.toolOverrides[toolId] = {
          ...updatedCustomization.toolOverrides[toolId],
          disabled: true,
        };
        changesApplied.push(`Disable tool: ${toolId}`);
      }
    }
    
    // Enable tools
    if (enableTools) {
      for (const toolId of enableTools) {
        if (updatedCustomization.toolOverrides[toolId]) {
          updatedCustomization.toolOverrides[toolId] = {
            ...updatedCustomization.toolOverrides[toolId],
            disabled: false,
          };
        }
        changesApplied.push(`Enable tool: ${toolId}`);
      }
    }
    
    if (changesApplied.length === 0) {
      return { 
        success: false, 
        error: "No changes specified. Provide at least one of: sectionOverrides, disableSections, enableSections, toolDescriptionOverrides, disableTools, enableTools, addSections, deleteSections" 
      };
    }
    
    // Persist to localStorage
    try {
      const STORAGE_KEY = "freeagent-prompt-customizations";
      const stored = localStorage.getItem(STORAGE_KEY);
      const all = stored ? JSON.parse(stored) : {};
      all[updatedCustomization.templateId] = updatedCustomization;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      console.log('[write_self] Saved customizations to localStorage:', changesApplied);
      
      // Update in-memory ref immediately so read_self gets fresh data in the same session
      if (context.onPromptCustomizationUpdate) {
        context.onPromptCustomizationUpdate(updatedCustomization);
        console.log('[write_self] Updated promptCustomizationRef for immediate read_self access');
      }
      
      // Notify UI to reload customizations
      if (context.onPromptCustomizationChange) {
        context.onPromptCustomizationChange();
      }
    } catch (storageError) {
      console.error('[write_self] Failed to persist to localStorage:', storageError);
    }
    
    return { 
      success: true, 
      result: { 
        changesApplied,
        warnings: warnings.length > 0 ? warnings : undefined,
        validSectionIds: Array.from(VALID_TEMPLATE_SECTION_IDS),
        customSections: updatedCustomization.additionalSections.map(s => s.id),
        note: "Changes saved and will take effect in the next iteration.",
        tip: "To add new sections, use addSections: [{ title: 'My Section', content: '...' }]"
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to write self configuration" 
    };
  }
}

// ============================================================================
// ADVANCED TOOLS: Spawn
// ============================================================================

// Spawn child agent instances
async function executeSpawn(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  if (!context.advancedFeatures?.spawnEnabled) {
    return { 
      success: false, 
      error: "Spawn feature is not enabled. Enable it in the Advanced tab before using spawn." 
    };
  }
  
  if (!context.onSpawnChildren) {
    return { 
      success: false, 
      error: "Spawn callback not configured. This is an internal error." 
    };
  }
  
  const childSpecs = params.children as ChildSpec[] | undefined;
  const completionThreshold = params.completionThreshold as number | undefined;
  
  if (!childSpecs || !Array.isArray(childSpecs) || childSpecs.length === 0) {
    return { 
      success: false, 
      error: "No children specified. Provide an array of child specifications with 'name' and 'task'." 
    };
  }
  
  // Validate child specifications
  const names: string[] = [];
  for (const child of childSpecs) {
    if (!child.name || typeof child.name !== 'string') {
      return { success: false, error: "Each child must have a 'name' string" };
    }
    if (!child.task || typeof child.task !== 'string') {
      return { success: false, error: "Each child must have a 'task' string" };
    }
    if (names.includes(child.name)) {
      return { success: false, error: `Duplicate child name: ${child.name}. Names must be unique.` };
    }
    names.push(child.name);
  }
  
  // Check limits
  const maxChildren = context.advancedFeatures.maxChildren || 5;
  if (childSpecs.length > maxChildren) {
    return { 
      success: false, 
      error: `Too many children (${childSpecs.length}). Maximum allowed: ${maxChildren}` 
    };
  }
  
  // Trigger spawn via callback
  context.onSpawnChildren({
    children: childSpecs.map(child => ({
      ...child,
      maxIterations: child.maxIterations || context.advancedFeatures!.childMaxIterations || 20,
    })),
    completionThreshold,
    parentBlackboard: context.blackboard,
    parentScratchpad: context.scratchpad,
    parentAttributes: context.toolResultAttributes || {},
  });
  
  return {
    success: true,
    result: {
      spawned: childSpecs.length,
      childNames: names,
      message: `Spawned ${childSpecs.length} child agent(s): ${names.join(', ')}. Entering orchestrate mode - execution will pause until children complete.`,
      completionThreshold: completionThreshold || 'all',
    }
  };
}
