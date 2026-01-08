import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

interface ToolDefinition {
  id: string;
  description: string;
  params: string;
  category: string;
}

interface FreeAgentRequest {
  prompt: string;
  model?: string;
  blackboard: Array<{ category: string; content: string; data?: unknown; tools?: string[] }>;
  sessionFiles: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>;
  previousToolResults?: Array<{ tool: string; success: boolean; result?: unknown; error?: string }>;
  iteration: number;
  scratchpad?: string;
  assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string };
  secretOverrides?: Record<string, { params?: Record<string, unknown>; headers?: Record<string, string> }>;
  configuredParams?: Array<{ tool: string; param: string }>;
  toolResultAttributes?: Record<string, { result: unknown; size: number }>;
  artifacts?: Array<{ id: string; type: string; title: string; content: string; description?: string }>;
  promptData?: {
    sections: Array<{
      id: string;
      type: string;
      title: string;
      content: string;
      order: number;
      editable: string;
      variables?: string[];
    }>;
    toolOverrides?: Record<string, { description?: string; disabled?: boolean }>;
    disabledTools?: string[];
    // Tool definitions passed from frontend (from toolsManifest.json)
    toolDefinitions?: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      parameters: Record<string, { type: string; required?: boolean; description?: string }>;
    }>;
  };
  advancedFeatures?: {
    selfAuthorEnabled?: boolean;
    spawnEnabled?: boolean;
    maxChildren?: number;
    childMaxIterations?: number;
  };
  toolInstances?: Array<{
    id: string;
    baseToolId: string;
    instanceName: string;
    fullToolId: string;
    label: string;
    description: string;
  }>;
}

// ============================================================================
// RESPONSE SCHEMA - Single Source of Truth for all providers
// ============================================================================

function getGrokResponseSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "free_agent_response",
      strict: true,
      schema: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "Your thought process for this iteration" },
          tool_calls: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tool: { type: "string" },
                params: { type: "object", additionalProperties: true }
              },
              required: ["tool", "params"],
              additionalProperties: false
            }
          },
          blackboard_entry: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["observation", "insight", "plan", "decision", "error"] },
              content: { type: "string" }
            },
            required: ["category", "content"],
            additionalProperties: false
          },
          status: { type: "string", enum: ["in_progress", "completed", "needs_assistance", "error"] },
          message_to_user: { type: "string" },
          artifacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text", "file", "image", "data"] },
                title: { type: "string" },
                content: { type: "string" },
                description: { type: "string" }
              },
              required: ["type", "title", "content"],
              additionalProperties: false
            }
          },
          final_report: {
            type: "object",
            properties: {
              summary: { type: "string" },
              tools_used: { type: "array", items: { type: "string" } },
              artifacts_created: { type: "array", items: { type: "string" } },
              key_findings: { type: "array", items: { type: "string" } }
            },
            required: ["summary", "tools_used", "artifacts_created", "key_findings"],
            additionalProperties: false
          }
        },
        required: ["reasoning", "tool_calls", "blackboard_entry", "status"],
        additionalProperties: false
      }
    }
  };
}

function getClaudeResponseTool() {
  return {
    name: "respond_with_actions",
    description: "Return your reasoning, tool calls, blackboard entry, and status. You MUST use this tool to respond.",
    input_schema: {
      type: "object",
      properties: {
        reasoning: { type: "string", description: "Your thought process for this iteration" },
        tool_calls: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tool: { type: "string" },
              params: { type: "object" }
            },
            required: ["tool", "params"]
          }
        },
        blackboard_entry: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["observation", "insight", "plan", "decision", "error"] },
            content: { type: "string" }
          },
          required: ["category", "content"]
        },
        status: { type: "string", enum: ["in_progress", "completed", "needs_assistance", "error"] },
        message_to_user: { type: "string" },
        artifacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["text", "file", "image", "data"] },
              title: { type: "string" },
              content: { type: "string" },
              description: { type: "string" }
            },
            required: ["type", "title", "content"]
          }
        },
        final_report: {
          type: "object",
          properties: {
            summary: { type: "string" },
            tools_used: { type: "array", items: { type: "string" } },
            artifacts_created: { type: "array", items: { type: "string" } },
            key_findings: { type: "array", items: { type: "string" } }
          },
          required: ["summary", "tools_used", "artifacts_created", "key_findings"]
        }
      },
      required: ["reasoning", "tool_calls", "blackboard_entry", "status"]
    }
  };
}

function getApiModelName(uiModel: string): string {
  const modelMap: Record<string, string> = {
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-3-pro-preview": "gemini-3-pro-preview",
    "gemini-3-flash-preview": "gemini-3-flash-preview",
    "claude-sonnet-4-5": "claude-sonnet-4-5",
    "claude-haiku-4-5": "claude-haiku-4-5",
    "claude-opus-4-5": "claude-opus-4-5",
    "grok-4-1-fast-reasoning": "grok-4-1-fast-reasoning",
    "grok-4-1-fast-non-reasoning": "grok-4-1-fast-non-reasoning",
    "grok-code-fast-1": "grok-code-fast-1",
  };
  return modelMap[uiModel] || uiModel;
}

function getProvider(model: string): "gemini" | "claude" | "grok" {
  if (model.startsWith("claude") || model.includes("claude")) return "claude";
  if (model.startsWith("grok") || model.includes("grok")) return "grok";
  return "gemini";
}

// ============================================================================
// REFERENCE RESOLUTION - Resolve placeholders in tool parameters
// ============================================================================

interface ResolverContext {
  scratchpad: string;
  blackboard: Array<{ category: string; content: string }>;
  toolResultAttributes: Record<string, { result: unknown; size: number }>;
  artifacts: Array<{ id: string; type: string; title: string; content: string; description?: string }>;
}

function resolveReferences(value: unknown, context: ResolverContext): unknown {
  if (typeof value === 'string') {
    return resolveStringReferences(value, context);
  }
  if (Array.isArray(value)) {
    return value.map(item => resolveReferences(item, context));
  }
  if (typeof value === 'object' && value !== null) {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveReferences(val, context);
    }
    return resolved;
  }
  return value;
}

function resolveStringReferences(str: string, ctx: ResolverContext): string {
  let result = str;
  
  result = result.replace(/\{\{scratchpad\}\}/gi, () => ctx.scratchpad || '');
  
  result = result.replace(/\{\{blackboard\}\}/gi, () => {
    if (!ctx.blackboard || ctx.blackboard.length === 0) return '[No blackboard entries]';
    return ctx.blackboard.map(e => `[${e.category.toUpperCase()}]: ${e.content}`).join('\n\n');
  });
  
  result = result.replace(/\{\{attributes\}\}/gi, () => {
    if (!ctx.toolResultAttributes || Object.keys(ctx.toolResultAttributes).length === 0) return '{}';
    const formatted: Record<string, unknown> = {};
    for (const [name, attr] of Object.entries(ctx.toolResultAttributes)) {
      formatted[name] = attr.result;
    }
    return JSON.stringify(formatted, null, 2);
  });
  
  result = result.replace(/\{\{attribute:([^}]+)\}\}/gi, (_, name) => {
    const trimmedName = name.trim();
    const attr = ctx.toolResultAttributes?.[trimmedName];
    if (attr) {
      return typeof attr.result === 'string' ? attr.result : JSON.stringify(attr.result, null, 2);
    }
    return `[Attribute '${trimmedName}' not found]`;
  });
  
  result = result.replace(/\{\{artifacts\}\}/gi, () => {
    if (!ctx.artifacts || ctx.artifacts.length === 0) return '[]';
    return JSON.stringify(ctx.artifacts.map(a => ({
      id: a.id, type: a.type, title: a.title, content: a.content, description: a.description,
    })), null, 2);
  });
  
  result = result.replace(/\{\{artifact:([^}]+)\}\}/gi, (_, id) => {
    const trimmedId = id.trim();
    const artifact = ctx.artifacts?.find(a => a.id === trimmedId || a.title === trimmedId);
    if (artifact) return artifact.content;
    return `[Artifact '${trimmedId}' not found]`;
  });
  
  return result;
}

// ============================================================================
// DYNAMIC TOOLS LIST BUILDER - Generates tool documentation from manifest
// ============================================================================

// Category display order and groupings
const CATEGORY_ORDER = [
  { key: "web", label: "Search & Web" },
  { key: "code", label: "GitHub" },
  { key: "document", label: "Document" },
  { key: "file", label: "File" },
  { key: "communication", label: "Communication" },
  { key: "interaction", label: "Interaction" },
  { key: "generation", label: "Generation" },
  { key: "api", label: "API" },
  { key: "database", label: "Database" },
  { key: "utility", label: "Utility" },
  { key: "memory", label: "Memory" },
  { key: "export", label: "Export" },
  { key: "advanced_self_author", label: "Self-Author (Advanced)" },
  { key: "advanced_spawn", label: "Spawn (Advanced)" },
];

function formatToolsList(
  toolOverrides?: Record<string, { description?: string; disabled?: boolean }>,
  disabledTools?: string[],
  advancedFeatures?: FreeAgentRequest['advancedFeatures'],
  toolInstances?: FreeAgentRequest['toolInstances'],
  toolDefinitions?: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    parameters: Record<string, { type: string; required?: boolean; description?: string }>;
  }>
): string {
  // Build disabled set from both sources
  const disabledSet = new Set(disabledTools || []);
  if (toolOverrides) {
    for (const [toolId, override] of Object.entries(toolOverrides)) {
      if (override.disabled) disabledSet.add(toolId);
    }
  }
  
  // Build tools list dynamically from toolDefinitions
  const allTools: ToolDefinition[] = [];
  
  if (toolDefinitions && toolDefinitions.length > 0) {
    for (const tool of toolDefinitions) {
      // Skip advanced tools if features not enabled
      if (tool.category === 'advanced_self_author' && !advancedFeatures?.selfAuthorEnabled) continue;
      if (tool.category === 'advanced_spawn' && !advancedFeatures?.spawnEnabled) continue;
      
      // Build params string from parameter definitions
      const params = Object.entries(tool.parameters || {})
        .map(([name, paramDef]) => {
          const required = paramDef.required ? '' : '?';
          return `${name}${required}`;
        })
        .join(', ');
      
      // Get description (with potential override)
      const desc = toolOverrides?.[tool.id]?.description || tool.description;
      
      allTools.push({
        id: tool.id,
        description: desc,
        params: params,
        category: tool.category,
      });
    }
    console.log(`[formatToolsList] Built ${allTools.length} tools from toolDefinitions`);
  } else {
    console.error('[formatToolsList] No toolDefinitions provided - prompt will have no tools!');
    return '\n## Available Tools\n\nERROR: No tool definitions provided. Check promptData.toolDefinitions.\n';
  }
  
  // Build instances map - tools with instances show instances instead of global
  const toolsWithInstances = new Set<string>();
  const instancesByBaseTool: Record<string, typeof toolInstances> = {};
  if (toolInstances && toolInstances.length > 0) {
    for (const instance of toolInstances) {
      toolsWithInstances.add(instance.baseToolId);
      if (!instancesByBaseTool[instance.baseToolId]) {
        instancesByBaseTool[instance.baseToolId] = [];
      }
      instancesByBaseTool[instance.baseToolId]!.push(instance);
    }
    console.log(`[formatToolsList] ${toolInstances.length} tool instances for ${toolsWithInstances.size} base tools`);
  }
  
  // Filter out disabled tools
  const enabledTools = allTools.filter(t => !disabledSet.has(t.id));
  
  if (disabledSet.size > 0) {
    console.log(`[formatToolsList] ${disabledSet.size} tools disabled:`, Array.from(disabledSet).join(', '));
  }
  
  // Group by category
  const byCategory: Record<string, ToolDefinition[]> = {};
  for (const tool of enabledTools) {
    const cat = tool.category || 'utility';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(tool);
  }
  
  // Build output in category order
  let output = `\n## Available Tools (${enabledTools.length} total)\n`;
  
  for (const { key, label } of CATEGORY_ORDER) {
    const tools = byCategory[key];
    if (!tools || tools.length === 0) continue;
    
    output += `\n### ${label}\n`;
    for (const tool of tools) {
      // Check if this tool has instances
      if (toolsWithInstances.has(tool.id)) {
        const instances = instancesByBaseTool[tool.id] || [];
        for (const inst of instances) {
          if (disabledSet.has(inst.fullToolId)) continue;
          output += `- **${inst.fullToolId}**: ${inst.description} (params: ${tool.params})\n`;
        }
      } else {
        output += `- **${tool.id}**: ${tool.description} (params: ${tool.params})\n`;
      }
    }
  }
  
  // Add saveAs documentation
  output += `
### Named Attribute Storage (saveAs)
Data-fetching tools support a "saveAs" parameter that AUTOMATICALLY saves results to a named attribute:

Example: { "tool": "web_scrape", "params": { "url": "...", "saveAs": "weather_data" } }

Benefits:
- Results saved AUTOMATICALLY - no need for write_scratchpad
- You receive a confirmation instead of full data (saves tokens!)
- Use {{name}} in scratchpad to reference the data
- Call read_attribute(["name"]) to retrieve specific attributes

RECOMMENDED: Use saveAs for ALL data-fetching operations.
`;
  
  return output;
}

// ============================================================================
// DYNAMIC SECTION FORMATTERS
// ============================================================================

function formatSessionFiles(files: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>): string {
  if (!files || files.length === 0) {
    return '\n## Session Files: None provided.';
  }
  
  const filesList = files.map(f => {
    let fileInfo = `- ${f.filename} (fileId: "${f.id}", type: ${f.mimeType}, size: ${f.size} bytes)`;
    if (f.content && f.size < 50000 && (f.mimeType.startsWith('text/') || f.mimeType.includes('json') || f.mimeType.includes('xml') || f.mimeType.includes('javascript') || f.mimeType.includes('typescript'))) {
      fileInfo += `\n  Content:\n\`\`\`\n${f.content}\n\`\`\``;
    }
    return fileInfo;
  }).join('\n');
  
  return `\n## Session Files Available:\n${filesList}\n\nUse read_file with the exact fileId to read file contents.`;
}

function formatConfiguredParams(configuredParams?: Array<{ tool: string; param: string }>): string {
  if (!configuredParams || configuredParams.length === 0) return '';
  
  const byTool: Record<string, string[]> = {};
  for (const cp of configuredParams) {
    if (!byTool[cp.tool]) byTool[cp.tool] = [];
    byTool[cp.tool].push(cp.param);
  }
  
  const paramsList = Object.entries(byTool)
    .map(([tool, params]) => `- ${tool}: ${params.join(', ')}`)
    .join('\n');
  
  return `
## Pre-Configured Tool Parameters
The following parameters have been pre-configured with secrets/credentials.
You do NOT need to provide values for these - they will be injected automatically:

${paramsList}
`;
}

function formatBlackboard(blackboard: Array<{ category: string; content: string; tools?: string[] }>): string {
  if (!blackboard || blackboard.length === 0) {
    return '\n## BLACKBOARD: Empty. Track your plan and completed items here.';
  }
  
  const formatEntry = (e: { category: string; content: string; tools?: string[] }, index: number): string => {
    const toolsSuffix = e.tools?.length ? ` | Tools: [${e.tools.join(', ')}]` : '';
    return `[#${index} ${e.category}]${toolsSuffix} ${e.content}`;
  };
  
  // Tiered display: Last (1), Recent (3 prior), Older (rest)
  if (blackboard.length <= 4) {
    return `\n## YOUR BLACKBOARD (Planning Journal):\n${blackboard.map((e, i) => formatEntry(e, i + 1)).join('\n\n')}`;
  }
  
  const olderEntries = blackboard.slice(0, -4);
  const recentEntries = blackboard.slice(-4, -1);
  const lastEntry = blackboard[blackboard.length - 1];
  const lastIdx = blackboard.length;
  
  let section = '\n## YOUR BLACKBOARD (Planning Journal - Read this EVERY iteration!):\n';
  
  // Older entries (summarized)
  if (olderEntries.length > 0) {
    section += `\n### Older (${olderEntries.length} entries - summarized):\n`;
    for (let i = 0; i < olderEntries.length; i++) {
      const e = olderEntries[i];
      const preview = e.content.length > 150 ? e.content.slice(0, 150) + '...' : e.content;
      section += `[#${i + 1} ${e.category}] ${preview}\n\n`;
    }
  }
  
  // Recent entries (full)
  section += `\n### Recent:\n`;
  for (let i = 0; i < recentEntries.length; i++) {
    section += `${formatEntry(recentEntries[i], olderEntries.length + i + 1)}\n\n`;
  }
  
  // Last entry (full, highlighted)
  section += `\n### Last (MOST RECENT - READ CAREFULLY):\n${formatEntry(lastEntry, lastIdx)}\n`;
  
  return section;
}

function formatScratchpad(scratchpad: string): string {
  if (!scratchpad || scratchpad.trim() === '') {
    return '\n## YOUR SCRATCHPAD: Empty. Use write_scratchpad to save analysis and findings.';
  }
  
  const truncated = scratchpad.length > 10000 
    ? scratchpad.slice(0, 10000) + `\n...[Truncated - ${scratchpad.length} total chars. Use read_scratchpad for full content.]`
    : scratchpad;
  
  return `\n## YOUR SCRATCHPAD (${scratchpad.length} chars):\n${truncated}`;
}

function formatArtifactsList(artifacts: Array<{ id: string; type: string; title: string; content: string; description?: string }>): string {
  if (!artifacts || artifacts.length === 0) {
    return '\n## YOUR ARTIFACTS: None created yet. Use the artifacts field in your response to create deliverables.';
  }
  
  const list = artifacts.map((a, i) => {
    const preview = a.content.length > 200 ? a.content.slice(0, 200) + '...' : a.content;
    return `${i + 1}. **${a.title}** (${a.type}, ${a.content.length} chars)\n   ID: ${a.id}\n   ${a.description || 'No description'}\n   Preview: ${preview}`;
  }).join('\n\n');
  
  return `\n## YOUR CREATED ARTIFACTS (${artifacts.length} total):\n${list}`;
}

function formatPreviousResults(results: Array<{ tool: string; result?: unknown; error?: string }>): string {
  if (!results || results.length === 0) return '';
  
  const formattedResults = results.map(r => {
    let resultStr: string;
    if (r.result === undefined || r.result === null) {
      resultStr = r.error ? `Error: ${r.error}` : "No result returned";
    } else {
      try {
        resultStr = JSON.stringify(r.result, null, 2);
      } catch (e) {
        resultStr = `[Unable to serialize result: ${e instanceof Error ? e.message : 'Unknown error'}]`;
      }
    }
    
    const display = resultStr.length > 250000 
      ? resultStr.slice(0, 250000) + '\n...[truncated at 250KB - use saveAs for large data]'
      : resultStr;
      
    return `### Tool: ${r.tool}\n\`\`\`json\n${display}\n\`\`\``;
  }).join('\n\n');
  
  return `

## PREVIOUS ITERATION TOOL RESULTS - READ THIS FIRST!
These results will DISAPPEAR next iteration! You MUST save important data to scratchpad NOW.

${formattedResults}

ACTION REQUIRED: If you see search/read results above, call write_scratchpad with the actual data.
DO NOT call the same tool again - the results are RIGHT HERE.
`;
}

function formatAssistanceResponse(assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string }): string {
  if (!assistanceResponse || (!assistanceResponse.response && !assistanceResponse.selectedChoice)) return '';
  const userAnswer = assistanceResponse.response || assistanceResponse.selectedChoice;
  return `\n\n## User Response to Your Previous Question\nThe user answered: "${userAnswer}"\nYou MUST incorporate this answer. Do NOT ask the same question again.`;
}

// ============================================================================
// DYNAMIC SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPromptDynamic(
  blackboard: Array<{ category: string; content: string; iteration?: number }>,
  sessionFiles: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>,
  previousResults: Array<{ tool: string; result?: unknown; error?: string }>,
  iteration: number,
  scratchpad: string,
  artifacts: Array<{ id: string; type: string; title: string; content: string; description?: string }>,
  assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string },
  configuredParams?: Array<{ tool: string; param: string }>,
  promptData?: FreeAgentRequest['promptData'],
  advancedFeatures?: FreeAgentRequest['advancedFeatures'],
  toolInstances?: FreeAgentRequest['toolInstances']
): string {
  if (!promptData || !promptData.sections || promptData.sections.length === 0) {
    throw new Error('promptData is required - dynamic system prompt must be provided from frontend');
  }
  
  // Build runtime variable map
  const runtimeVars: Record<string, string> = {
    '{{TOOLS_LIST}}': formatToolsList(promptData.toolOverrides, promptData.disabledTools, advancedFeatures, toolInstances, promptData.toolDefinitions),
    '{{SESSION_FILES}}': formatSessionFiles(sessionFiles),
    '{{CONFIGURED_PARAMS}}': formatConfiguredParams(configuredParams),
    '{{BLACKBOARD_CONTENT}}': formatBlackboard(blackboard),
    '{{SCRATCHPAD_CONTENT}}': formatScratchpad(scratchpad),
    '{{PREVIOUS_RESULTS}}': formatPreviousResults(previousResults),
    '{{CURRENT_ITERATION}}': String(iteration),
    '{{ARTIFACTS_LIST}}': formatArtifactsList(artifacts),
    '{{ASSISTANCE_RESPONSE}}': formatAssistanceResponse(assistanceResponse),
    '{{USER_TASK}}': '', // Empty for parent - task comes from user message; for children, section is substituted
    '{{SELF_AUTHOR}}': advancedFeatures?.selfAuthorEnabled ? `
## Self-Author Capabilities

You have access to self-modification tools:

- **read_self**: Introspect your own system prompt configuration
  - Returns: sections, tool overrides, disabled items
  - Use to understand your current behavior

- **write_self**: Modify your own configuration
  - Can: Override section content, enable/disable sections, change tool descriptions
  - Changes take effect in the NEXT iteration
  - Use sparingly and carefully

### Valid Section IDs for sectionOverrides:
identity, memory_architecture, correct_workflow, loop_problem, anti_loop_rules, loop_self_reflection, 
tool_execution_timing, response_format, blackboard_mandatory, data_handling, workflow_summary, 
accessing_attributes, reference_resolution

### Creating NEW Sections:
Use addSections (NOT sectionOverrides):
{ "tool": "write_self", "params": { "addSections": [{ "title": "My Persona", "content": "..." }] } }
` : '',
    '{{SPAWN}}': advancedFeatures?.spawnEnabled ? `
## Spawn Capabilities

You can create up to ${advancedFeatures.maxChildren || 5} child agents for parallel work:

- **spawn**: Create child agents with specific tasks
  - Each child gets up to ${advancedFeatures.childMaxIterations || 20} iterations
  - Children share your attributes but have separate blackboards
  - Results merge to your blackboard when they complete

Example:
{
  "tool": "spawn",
  "params": {
    "children": [
      { "name": "researcher_1", "task": "Research topic A" },
      { "name": "researcher_2", "task": "Research topic B" }
    ]
  }
}
` : '',
  };
  
  // Sort sections by order
  const sortedSections = [...promptData.sections].sort((a, b) => a.order - b.order);
  
  // Log identity section for debugging
  const identitySection = sortedSections.find(s => s.id === 'identity');
  if (identitySection) {
    console.log(`[DynamicPrompt] Identity: ${identitySection.content.substring(0, 200)}`);
  }
  
  // Build prompt
  let prompt = '';
  for (const section of sortedSections) {
    let content = section.content;
    
    // Replace runtime variables
    for (const [variable, value] of Object.entries(runtimeVars)) {
      content = content.split(variable).join(value);
    }
    
    // Skip empty dynamic sections (no previous results, no assistance response, etc.)
    if (section.type === 'dynamic' && !content.trim()) continue;
    
    // Skip advanced sections with empty content (self_author/spawn when not enabled)
    if (section.type === 'advanced' && !content.trim()) continue;
    
    // Wrap each section with XML metadata tags for agent introspection
    prompt += `<prompt-section id="${section.id}" editable="${section.editable}" type="${section.type}">\n${content}\n</prompt-section>\n\n`;
  }
  
  return prompt.trim();
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  supabaseUrl: string,
  supabaseKey: string,
  secretOverrides?: Record<string, { params?: Record<string, unknown>; headers?: Record<string, string> }>,
  validToolNames?: Set<string>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const toolMap: Record<string, string> = {
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
    get_weather: "tool_weather",
    read_zip_contents: "tool_zip-handler",
    read_zip_file: "tool_zip-handler",
    extract_zip_files: "tool_zip-handler",
    pdf_info: "tool_pdf-handler",
    pdf_extract_text: "tool_pdf-handler",
    ocr_image: "tool_ocr-handler",
    pronghorn_post: "pronghorn-post",
  };

  // Parse tool instance format: "baseTool:instanceName"
  let baseToolName = toolName;
  let secretLookupKey = toolName;
  if (toolName.includes(':')) {
    const parts = toolName.split(':');
    baseToolName = parts[0];
    secretLookupKey = toolName;
    console.log(`[Tool Instance] Using base tool "${baseToolName}" with secrets from "${secretLookupKey}"`);
  }

  const edgeFunction = toolMap[baseToolName];
  
  if (!edgeFunction) {
    // Check if it's a valid frontend-handled tool from the manifest
    if (validToolNames && validToolNames.has(baseToolName)) {
      return { success: true, result: { frontend_handler: true, tool: toolName, params } };
    }
    // Unknown tool - not in manifest at all
    return { 
      success: false, 
      error: `Unknown tool "${toolName}". This tool does not exist.`
    };
  }

  try {
    let body = { ...params };
    
    const instanceSecrets = secretOverrides?.[secretLookupKey];
    const baseSecrets = secretOverrides?.[baseToolName];
    const toolSecrets = instanceSecrets || baseSecrets;
    
    if (toolSecrets?.params) {
      for (const [key, value] of Object.entries(toolSecrets.params)) {
        if (typeof value === 'object' && value !== null && typeof body[key] === 'object' && body[key] !== null) {
          body[key] = { ...(body[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
        } else {
          body[key] = value;
        }
      }
    }
    
    if (toolName === "get_call_api") {
      body = { ...body, method: "GET" };
    } else if (toolName === "post_call_api") {
      body = { ...body, method: "POST" };
    } else if (toolName === "image_generation") {
      body = { prompt: body.prompt, model: body.model || "gemini-2.5-flash-image" };
    } else if (toolName === "read_database_schemas") {
      body = { ...body, action: "schemas" };
    }
    
    if (toolSecrets?.headers && Object.keys(toolSecrets.headers).length > 0) {
      const existingHeaders = (body.headers as Record<string, string>) || {};
      body.headers = { ...existingHeaders, ...toolSecrets.headers };
    }

    console.log(`Executing tool ${toolName} via ${edgeFunction}:`, JSON.stringify(body).slice(0, 500));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseKey}`,
    };
    if (toolName === "read_github_repo") {
      headers["x-source"] = "agent";
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/${edgeFunction}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Tool ${toolName} failed:`, errorText);
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log(`Tool ${toolName} completed successfully`);
    return { success: true, result };
  } catch (error) {
    console.error(`Tool ${toolName} error:`, error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================================================
// LLM CALLING
// ============================================================================

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  const provider = getProvider(model);
  const apiModel = getApiModelName(model);
  
  console.log(`Calling LLM - Provider: ${provider}, Model: ${apiModel}`);

  try {
    let response: Response;
    
    if (provider === "gemini") {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) return { success: false, error: "GEMINI_API_KEY not configured" };

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser Task: ${userPrompt}` }] }],
            generationConfig: {
              maxOutputTokens: 16384,
              temperature: 0.7,
              responseMimeType: "application/json",
            },
          }),
        }
      );
    } else if (provider === "claude") {
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) return { success: false, error: "ANTHROPIC_API_KEY not configured" };

      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: apiModel,
          max_tokens: 16384,
          system: systemPrompt,
          messages: [{ role: "user", content: `User Task: ${userPrompt}` }],
          tools: [getClaudeResponseTool()],
          tool_choice: { type: "tool", name: "respond_with_actions" },
        }),
      });
    } else if (provider === "grok") {
      const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
      if (!XAI_API_KEY) return { success: false, error: "XAI_API_KEY not configured" };

      response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: apiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `User Task: ${userPrompt}` }
          ],
          max_tokens: 16384,
          temperature: 0.7,
          response_format: getGrokResponseSchema(),
        }),
      });
    } else {
      return { success: false, error: `Unknown provider: ${provider}` };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM API error (${response.status}):`, errorText.slice(0, 500));
      return { success: false, error: `LLM API error: ${response.status}` };
    }

    const data = await response.json();
    
    // Extract response based on provider
    let responseText: string;
    if (provider === "gemini") {
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (provider === "claude") {
      const toolBlock = data.content?.find((b: { type: string }) => b.type === "tool_use");
      if (toolBlock?.input) {
        responseText = JSON.stringify(toolBlock.input);
      } else {
        const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
        responseText = textBlock?.text || "";
      }
    } else {
      responseText = data.choices?.[0]?.message?.content || "";
    }

    console.log(`LLM response length: ${responseText.length} chars`);
    return { success: true, response: responseText };
  } catch (error) {
    console.error("LLM call error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

function sanitizeJsonString(str: string): string {
  return str.replace(/[\x00-\x1F\x7F]/g, (char) => {
    if (char === '\n' || char === '\r' || char === '\t') return char;
    return '';
  });
}

function parseAgentResponse(text: string): unknown {
  if (!text) return null;
  
  let parsed = null;
  
  // Try direct parse
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    // Continue to other methods
  }
  
  // Try sanitized parse
  if (!parsed) {
    try {
      const sanitized = sanitizeJsonString(text.trim());
      parsed = JSON.parse(sanitized);
    } catch {
      // Continue
    }
  }
  
  // Try to extract JSON object
  if (!parsed) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        try {
          const sanitizedMatch = sanitizeJsonString(match[0]);
          parsed = JSON.parse(sanitizedMatch);
        } catch {
          console.error("JSON extraction failed. Response end:", text.slice(-300));
        }
      }
    }
  }
  
  // Fix stringified fields
  if (parsed) {
    if (typeof parsed.tool_calls === "string") {
      try { parsed.tool_calls = JSON.parse(parsed.tool_calls); } catch { parsed.tool_calls = []; }
    }
    if (typeof parsed.blackboard_entry === "string") {
      try { parsed.blackboard_entry = JSON.parse(parsed.blackboard_entry); } catch { parsed.blackboard_entry = null; }
    }
    if (typeof parsed.final_report === "string") {
      try { parsed.final_report = JSON.parse(parsed.final_report); } catch { parsed.final_report = null; }
    }
    if (typeof parsed.artifacts === "string") {
      try { parsed.artifacts = JSON.parse(parsed.artifacts); } catch { parsed.artifacts = []; }
    }
    return parsed;
  }
  
  console.error("Failed to parse LLM response. Preview:", text.slice(0, 500));
  
  // Try to salvage reasoning
  const reasoningMatch = text.match(/"reasoning"\s*:\s*"([^"]+)"/);
  if (reasoningMatch) {
    return {
      reasoning: reasoningMatch[1],
      status: "error",
      message_to_user: "Response parsing failed, but I was thinking: " + reasoningMatch[1].slice(0, 200),
    };
  }
  
  return null;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const request: FreeAgentRequest = await req.json() || {};
    const {
      prompt = "",
      model = "gemini-2.5-flash",
      blackboard = [],
      sessionFiles = [],
      previousToolResults = [],
      iteration = 1,
      scratchpad = "",
      assistanceResponse,
      secretOverrides,
      configuredParams,
      toolResultAttributes = {},
      artifacts = [],
      promptData,
      advancedFeatures,
      toolInstances,
    } = request || {};

    // Build resolver context
    const resolverContext: ResolverContext = {
      scratchpad: scratchpad || "",
      blackboard: blackboard || [],
      toolResultAttributes: toolResultAttributes || {},
      artifacts: artifacts || [],
    };

    console.log(`Free Agent iteration ${iteration}, model: ${model}, prompt: ${(prompt || "").slice(0, 100)}...`);
    console.log(`Scratchpad length: ${(scratchpad || "").length} chars`);
    console.log(`Previous tool results count: ${(previousToolResults || []).length}`);

    // REQUIRE promptData - no legacy fallback
    if (!promptData || !promptData.sections || promptData.sections.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "promptData is required. The legacy hardcoded prompt has been removed.",
          debug: { prompt, model, iteration },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Using dynamic system prompt with ${promptData.sections.length} sections`);
    const systemPrompt = buildSystemPromptDynamic(
      blackboard,
      sessionFiles,
      previousToolResults.map(t => ({ tool: t.tool, result: t.result, error: t.error })),
      iteration,
      scratchpad,
      artifacts || [],
      assistanceResponse,
      configuredParams,
      promptData,
      advancedFeatures,
      toolInstances
    );

    const llmResult = await callLLM(systemPrompt, prompt, model);

    if (!llmResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: llmResult.error,
          debug: {
            systemPrompt,
            userPrompt: prompt,
            fullPromptSent: `${systemPrompt}\n\nUser Task: ${prompt}`,
            rawLLMResponse: "",
            model,
            scratchpadLength: (scratchpad || "").length,
            blackboardEntries: (blackboard || []).length,
            previousResultsCount: (previousToolResults || []).length,
          },
          parseError: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentResponse = parseAgentResponse(llmResult.response!) as {
      reasoning?: string;
      tool_calls?: ToolCall[];
      blackboard_entry?: { category: string; content: string; data?: unknown };
      status?: string;
      message_to_user?: string;
      artifacts?: Array<{ type: string; title: string; content: string; description: string }>;
      final_report?: unknown;
    };

    if (!agentResponse) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse agent response",
          parseError: {
            rawResponse: llmResult.response,
            responseLength: llmResult.response?.length || 0,
            preview: llmResult.response?.slice(0, 500),
            ending: llmResult.response?.slice(-300),
          },
          debug: {
            systemPrompt,
            userPrompt: prompt,
            fullPromptSent: `${systemPrompt}\n\nUser Task: ${prompt}`,
            rawLLMResponse: llmResult.response || "",
            model,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute tool calls with reference resolution
    const toolResults: Array<{ tool: string; params?: Record<string, unknown>; success: boolean; result?: unknown; error?: string }> = [];
    const frontendHandlers: Array<{ tool: string; params: Record<string, unknown> }> = [];

    // Build valid tool names from the manifest
    const validToolNames = new Set(
      (promptData.toolDefinitions || []).map((t: { id?: string; name?: string }) => t.id || t.name).filter((n): n is string => !!n)
    );

    for (const toolCall of agentResponse.tool_calls || []) {
      const resolvedParams = resolveReferences(toolCall.params, resolverContext) as Record<string, unknown>;
      
      if (JSON.stringify(resolvedParams) !== JSON.stringify(toolCall.params)) {
        console.log(`[Reference Resolution] ${toolCall.tool}: params were resolved from placeholders`);
      }
      
      const result = await executeTool(toolCall.tool, resolvedParams, supabaseUrl, supabaseKey, secretOverrides, validToolNames);

      if ((result.result as Record<string, unknown>)?.frontend_handler) {
        frontendHandlers.push({ tool: toolCall.tool, params: resolvedParams });
      } else {
        toolResults.push({
          tool: toolCall.tool,
          params: resolvedParams,
          success: result.success,
          result: result.result,
          error: result.error,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        iteration,
        response: agentResponse,
        toolResults,
        frontendHandlers,
        status: agentResponse.status,
        debug: {
          systemPrompt,
          userPrompt: prompt,
          fullPromptSent: `${systemPrompt}\n\nUser Task: ${prompt}`,
          rawLLMResponse: llmResult.response || "",
          model,
          scratchpadLength: (scratchpad || "").length,
          blackboardEntries: (blackboard || []).length,
          previousResultsCount: (previousToolResults || []).length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Free Agent error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
