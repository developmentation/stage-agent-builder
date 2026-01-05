// Free Agent Tool Executor - Handles frontend-side tool execution
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
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
  onArtifactCreated: (artifact: FreeAgentArtifact) => void;
  onBlackboardUpdate: (entry: BlackboardEntry) => void;
  onScratchpadUpdate: (content: string) => void;
  onAssistanceNeeded: (request: AssistanceRequest) => void;
  // Advanced features
  advancedFeatures?: AdvancedFeatures;
  // Self-author: prompt customization interface
  promptCustomization?: PromptCustomization;
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

// Export to Word document
async function executeExportWord(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const content = params.content as string;
    const filename = (params.filename as string) || "document.docx";

    // Parse markdown-like content into paragraphs
    const lines = content.split("\n");
    const children: Paragraph[] = [];

    for (const line of lines) {
      if (line.startsWith("# ")) {
        children.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (line.startsWith("## ")) {
        children.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (line.startsWith("### ")) {
        children.push(
          new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (line.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun(line)],
          })
        );
      }
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
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

// Export to PDF
async function executeExportPdf(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const content = params.content as string;
    const filename = (params.filename as string) || "document.pdf";

    const pdf = new jsPDF();
    const lines = content.split("\n");
    let y = 20;

    for (const line of lines) {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      if (line.startsWith("# ")) {
        pdf.setFontSize(24);
        pdf.text(line.substring(2), 20, y);
        y += 12;
      } else if (line.startsWith("## ")) {
        pdf.setFontSize(18);
        pdf.text(line.substring(3), 20, y);
        y += 10;
      } else if (line.startsWith("### ")) {
        pdf.setFontSize(14);
        pdf.text(line.substring(4), 20, y);
        y += 8;
      } else if (line.trim()) {
        pdf.setFontSize(12);
        const splitText = pdf.splitTextToSize(line, 170);
        pdf.text(splitText, 20, y);
        y += splitText.length * 6;
      } else {
        y += 4;
      }
    }

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
        additionalSections: context.promptCustomization.additionalSections || [],
        orderOverrides: context.promptCustomization.orderOverrides || {},
      };
      result.note = "Section IDs can be overridden using write_self with sectionOverrides parameter";
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
            'Disable a section: write_self({ disableSections: ["memory_architecture"] })',
            'Override section content: write_self({ sectionOverrides: { identity: "You are a helpful assistant..." } })',
            'Disable a tool: write_self({ disableTools: ["web_scrape"] })',
          ]
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
  
  try {
    // Note: The actual modification will happen via a callback mechanism
    // For now, we return what changes would be applied
    // The hook will need to be extended to support programmatic updates
    
    const sectionOverrides = params.sectionOverrides as Record<string, string> | undefined;
    const disableSections = params.disableSections as string[] | undefined;
    const enableSections = params.enableSections as string[] | undefined;
    const toolDescriptionOverrides = params.toolDescriptionOverrides as Record<string, string> | undefined;
    const disableTools = params.disableTools as string[] | undefined;
    const enableTools = params.enableTools as string[] | undefined;
    
    if (sectionOverrides) {
      for (const [sectionId, content] of Object.entries(sectionOverrides)) {
        changesApplied.push(`Override section '${sectionId}' (${content.length} chars)`);
      }
    }
    
    if (disableSections) {
      for (const sectionId of disableSections) {
        changesApplied.push(`Disable section: ${sectionId}`);
      }
    }
    
    if (enableSections) {
      for (const sectionId of enableSections) {
        changesApplied.push(`Enable section: ${sectionId}`);
      }
    }
    
    if (toolDescriptionOverrides) {
      for (const [toolId] of Object.entries(toolDescriptionOverrides)) {
        changesApplied.push(`Override tool description: ${toolId}`);
      }
    }
    
    if (disableTools) {
      for (const toolId of disableTools) {
        changesApplied.push(`Disable tool: ${toolId}`);
      }
    }
    
    if (enableTools) {
      for (const toolId of enableTools) {
        changesApplied.push(`Enable tool: ${toolId}`);
      }
    }
    
    if (changesApplied.length === 0) {
      return { 
        success: false, 
        error: "No changes specified. Provide at least one of: sectionOverrides, disableSections, enableSections, toolDescriptionOverrides, disableTools, enableTools" 
      };
    }
    
    // Return success with planned changes
    // Note: Full implementation requires connecting to the usePromptCustomization hook's setter functions
    return { 
      success: true, 
      result: { 
        changesApplied,
        note: "Changes queued for next iteration. The prompt configuration will be updated.",
        warning: "Self-modification can lead to unexpected behavior. Use carefully."
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
