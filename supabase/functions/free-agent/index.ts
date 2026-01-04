import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

interface FreeAgentRequest {
  prompt: string;
  model?: string;
  blackboard: Array<{ category: string; content: string; data?: unknown }>;
  sessionFiles: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>;
  previousToolResults?: Array<{ tool: string; success: boolean; result?: unknown; error?: string }>;
  iteration: number;
  scratchpad?: string;
  assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string };
  // Secrets injection - values for tool parameters
  secretOverrides?: Record<string, { params?: Record<string, unknown>; headers?: Record<string, string> }>;
  // Configured params for LLM awareness (no values, just tool+param names)
  configuredParams?: Array<{ tool: string; param: string }>;
  // Named attributes for reference resolution (full data from saveAs)
  toolResultAttributes?: Record<string, { result: unknown; size: number }>;
  // Artifacts for reference resolution
  artifacts?: Array<{ id: string; type: string; title: string; content: string; description?: string }>;
  // Dynamic prompt data from frontend (Phase 2)
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
    toolOverrides?: Record<string, { description?: string }>;
  };
}

// ============================================================================
// RESPONSE SCHEMA - Single Source of Truth for all providers
// ============================================================================

// Get JSON Schema for Grok's response_format
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

// Get tool definition for Claude's tool_choice
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

// Map UI model names to actual API model identifiers
function getApiModelName(uiModel: string): string {
  const modelMap: Record<string, string> = {
    // Gemini models - exact names
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    "gemini-3-pro-preview": "gemini-3-pro-preview",
    "gemini-3-flash-preview": "gemini-3-flash-preview",
    // Claude models - exact names
    "claude-sonnet-4-5": "claude-sonnet-4-5",
    "claude-haiku-4-5": "claude-haiku-4-5",
    "claude-opus-4-5": "claude-opus-4-5",
    // Grok models - exact names
    "grok-4-1-fast-reasoning": "grok-4-1-fast-reasoning",
    "grok-4-1-fast-non-reasoning": "grok-4-1-fast-non-reasoning",
    "grok-code-fast-1": "grok-code-fast-1",
  };
  return modelMap[uiModel] || uiModel;
}

// Determine provider from model name
function getProvider(model: string): "gemini" | "claude" | "grok" {
  if (model.startsWith("claude") || model.includes("claude")) return "claude";
  if (model.startsWith("grok") || model.includes("grok")) return "grok";
  return "gemini"; // Default to Gemini
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

// Resolve reference placeholders in tool parameters
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
  
  // {{scratchpad}} -> full scratchpad content
  result = result.replace(/\{\{scratchpad\}\}/gi, () => ctx.scratchpad || '');
  
  // {{blackboard}} -> formatted blackboard entries
  result = result.replace(/\{\{blackboard\}\}/gi, () => {
    if (!ctx.blackboard || ctx.blackboard.length === 0) return '[No blackboard entries]';
    return ctx.blackboard
      .map(e => `[${e.category.toUpperCase()}]: ${e.content}`)
      .join('\n\n');
  });
  
  // {{attributes}} -> all attributes as JSON object
  result = result.replace(/\{\{attributes\}\}/gi, () => {
    if (!ctx.toolResultAttributes || Object.keys(ctx.toolResultAttributes).length === 0) return '{}';
    const formatted: Record<string, unknown> = {};
    for (const [name, attr] of Object.entries(ctx.toolResultAttributes)) {
      formatted[name] = attr.result;
    }
    return JSON.stringify(formatted, null, 2);
  });
  
  // {{attribute:name}} -> specific attribute content
  result = result.replace(/\{\{attribute:([^}]+)\}\}/gi, (_, name) => {
    const trimmedName = name.trim();
    const attr = ctx.toolResultAttributes?.[trimmedName];
    if (attr) {
      return typeof attr.result === 'string' ? attr.result : JSON.stringify(attr.result, null, 2);
    }
    return `[Attribute '${trimmedName}' not found]`;
  });
  
  // {{artifacts}} -> all artifacts as JSON array
  result = result.replace(/\{\{artifacts\}\}/gi, () => {
    if (!ctx.artifacts || ctx.artifacts.length === 0) return '[]';
    return JSON.stringify(ctx.artifacts.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      description: a.description,
    })), null, 2);
  });
  
  // {{artifact:id}} -> specific artifact content
  result = result.replace(/\{\{artifact:([^}]+)\}\}/gi, (_, id) => {
    const trimmedId = id.trim();
    const artifact = ctx.artifacts?.find(a => a.id === trimmedId || a.title === trimmedId);
    if (artifact) {
      return artifact.content;
    }
    return `[Artifact '${trimmedId}' not found]`;
  });
  
  return result;
}

// Build system prompt for agent
function buildSystemPrompt(
  blackboard: Array<{ category: string; content: string }>,
  sessionFiles: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>,
  previousResults: Array<{ tool: string; result?: unknown; error?: string }>,
  iteration: number,
  scratchpad: string,
  assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string },
  configuredParams?: Array<{ tool: string; param: string }>
) {
  // Add null safety for all parameters
  const safeBlackboard = blackboard || [];
  const safeSessionFiles = sessionFiles || [];
  const safePreviousResults = previousResults || [];
  const safeScratchpad = scratchpad || "";

  const toolsList = `
Available Tools:

## Search & Web Tools
- brave_search: Search the web (params: query, numResults?, saveAs?)
- google_search: Search via Google (params: query, numResults?, saveAs?)
- web_scrape: Scrape webpage content (params: url, maxCharacters?, saveAs?)

## GitHub Tools
- read_github_repo: Get repo file tree (params: repoUrl, branch?, saveAs?)
- read_github_file: Read files from repo (params: repoUrl, selectedPaths, branch?, saveAs?)

## Document Tools
- pdf_info: Get PDF metadata and page count (params: fileData - base64 encoded PDF)
- pdf_extract_text: Extract text from PDF (params: fileData - base64 encoded PDF, pages?)
- ocr_image: Extract text from image via OCR (params: imageSource - base64, URL, or data URI)
- read_zip_contents: List files in ZIP archive (params: fileData - base64 encoded ZIP)
- read_zip_file: Read specific file from ZIP (params: fileData, entryPath)
- extract_zip_files: Extract files from ZIP (params: fileData, paths? - empty for all)

## Communication Tools
- send_email: Send email via Resend (params: to, subject, body, useHtml?)
- request_assistance: Ask user for input (params: question, context?, inputType?, choices?)

## Generation Tools
- image_generation: Generate image from prompt (params: prompt)
- elevenlabs_tts: Text to speech (params: text, voiceId?, modelId?)

## API Tools
- get_call_api: Make GET request (params: url, headers?, saveAs?)
- post_call_api: Make POST request (params: url, headers?, saveAs?)

## Database Tools
- read_database_schemas: Get database structure - tables, columns, types, constraints (params: connectionString, schemas?, saveAs?)
- execute_sql: Execute SQL on external PostgreSQL database (params: connectionString, query, isWrite?, params?, saveAs?). Multiple statements separated by semicolons are executed sequentially.

## Utility Tools
- get_time: Get current date/time (params: timezone?)
- get_weather: Get weather for a location (params: location, units? - "celsius" or "fahrenheit")

## Memory Tools
- write_blackboard: Write to your planning journal (params: category, content, data?)
- read_file: Read session file content (params: fileId)
- read_prompt: Read the original user prompt
- read_prompt_files: Get list of available files with metadata
- read_attribute: Read saved tool result attributes (params: names[] - empty array for list, specific names for content)
- read_scratchpad: Read your data storage. Handlebar syntax {{attribute_name}} will be substituted with attribute content.
- write_scratchpad: SAVE DATA HERE immediately after search/read (params: content, mode?)

## Export Tools
- export_word: Create Word document (params: content, filename?)
- export_pdf: Create PDF document (params: content, filename?)

## 🚀 NAMED TOOL RESULT ATTRIBUTES - USE saveAs TO SAVE TOKEN BUDGET!

Data-fetching tools support a "saveAs" parameter that AUTOMATICALLY saves results to a named attribute:

Example: { "tool": "web_scrape", "params": { "url": "...", "saveAs": "london_weather" } }

Benefits of using saveAs:
- Results are saved AUTOMATICALLY - no need to call write_scratchpad
- You receive a small confirmation instead of the full data (saves tokens!)
- Results appear as clickable nodes on the canvas
- Use {{london_weather}} in scratchpad to reference the data
- Call read_attribute(["london_weather"]) to retrieve specific attributes
- Call read_attribute([]) to list all saved attributes

RECOMMENDED: Use saveAs for ALL data-fetching operations (searches, scrapes, API calls, GitHub reads).
This is the most efficient way to store data without wasting tokens on large responses!
`;
// NOTE: read_blackboard removed - blackboard is ALWAYS shown above automatically

  // Include file content if available (for small text files)
  let filesSection = '\nNo session files provided.';
  if (safeSessionFiles.length > 0) {
    const filesList = safeSessionFiles.map(f => {
      let fileInfo = `- ${f.filename} (fileId: "${f.id}", type: ${f.mimeType}, size: ${f.size} bytes)`;
      if (f.content && f.size < 50000 && (f.mimeType.startsWith('text/') || f.mimeType.includes('json') || f.mimeType.includes('xml') || f.mimeType.includes('javascript') || f.mimeType.includes('typescript'))) {
        fileInfo += `\n  Content:\n\`\`\`\n${f.content}\n\`\`\``;
      }
      return fileInfo;
    }).join('\n');
    filesSection = `\nSession Files Available:\n${filesList}\n\nUse read_file with the exact fileId to read file contents.`;
  }

  // Check if there are any user interjections in the blackboard
  const hasUserInterjections = safeBlackboard.some(e => e.category === 'user_interjection');
  
  const blackboardSection = safeBlackboard.length > 0
    ? `\n## YOUR BLACKBOARD (Planning Journal - Read this EVERY iteration!):\n${safeBlackboard.map(e => `[${e.category}] ${e.content}`).join('\n')}${hasUserInterjections ? '\n\n⚠️ Pay special attention to any recent User Interjections (within the last 1-5 blackboard entries) and ensure your next actions are aligned with the user\'s further direction.' : ''}`
    : '\n## BLACKBOARD: Empty. Track your plan and completed items here.';

  // Scratchpad - only show preview if small, otherwise just size (saves context)
  let scratchpadSection: string;
  if (!safeScratchpad || !safeScratchpad.trim()) {
    scratchpadSection = '\n## YOUR SCRATCHPAD (Data Storage): Empty. Write actual DATA here (file contents, search results, analysis).';
  } else if (safeScratchpad.length < 500) {
    scratchpadSection = `\n## YOUR SCRATCHPAD (Data Storage - ${safeScratchpad.length} chars):\n\`\`\`\n${safeScratchpad}\n\`\`\``;
  } else {
    // Only show preview to save context - agent can use read_scratchpad for full content
    scratchpadSection = `\n## YOUR SCRATCHPAD: Contains ${safeScratchpad.length} chars of saved data. Use read_scratchpad to view full content.`;
  }

  // Make previous tool results VERY prominent so agent sees them
  let resultsSection = '';
  if (safePreviousResults.length > 0) {
    const formattedResults = safePreviousResults.map(r => {
      // Handle undefined, null, or error results gracefully
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
      
      // Safe length check with fallback
      const resultLength = resultStr?.length || 0;
      const display = resultLength > 250000 
        ? resultStr.slice(0, 250000) + '\n...[truncated at 250KB - use saveAs for large data]'
        : resultStr || 'No result';
        
      return `### Tool: ${r.tool}\n\`\`\`json\n${display}\n\`\`\``;
    }).join('\n\n');
    
    resultsSection = `

## ⚠️ PREVIOUS ITERATION TOOL RESULTS - READ THIS FIRST! ⚠️
These results will DISAPPEAR next iteration! You MUST save important data to scratchpad NOW.

${formattedResults}

ACTION REQUIRED: If you see search/read results above, call write_scratchpad with the actual data.
DO NOT call the same tool again - the results are RIGHT HERE.
`;
  }

  // Include user's assistance response if provided
  let assistanceSection = '';
  if (assistanceResponse && (assistanceResponse.response || assistanceResponse.selectedChoice)) {
    const userAnswer = assistanceResponse.response || assistanceResponse.selectedChoice;
    assistanceSection = `\n\n## User Response to Your Previous Question\nThe user answered: "${userAnswer}"\nYou MUST incorporate this answer. Do NOT ask the same question again.`;
  }

  // Build pre-configured parameters section
  let configuredParamsSection = '';
  if (configuredParams && configuredParams.length > 0) {
    // Group by tool
    const byTool: Record<string, string[]> = {};
    for (const cp of configuredParams) {
      if (!byTool[cp.tool]) byTool[cp.tool] = [];
      byTool[cp.tool].push(cp.param);
    }
    
    const paramsList = Object.entries(byTool)
      .map(([tool, params]) => `- ${tool}: ${params.join(', ')}`)
      .join('\n');
    
    configuredParamsSection = `
## 🔐 PRE-CONFIGURED TOOL PARAMETERS
The following tool parameters have been pre-configured by the user with secrets/credentials.
You do NOT need to provide values for these - they will be injected automatically at execution time:

${paramsList}

When using these tools, you may omit the configured parameters or pass null - the user's values will override.
`;
  }

  return `You are FreeAgent, an autonomous AI assistant. You accomplish tasks by using tools and tracking your progress.

${toolsList}
${filesSection}
${configuredParamsSection}${blackboardSection}
${scratchpadSection}
${resultsSection}${assistanceSection}

Current Iteration: ${iteration}

## MEMORY ARCHITECTURE - UNDERSTAND THIS:

### BLACKBOARD (shown above) = Your Planning Journal
- AUTOMATICALLY included every iteration - you see it above
- Track: current step, COMPLETED items list, NEXT action
- Write EVERY iteration with VERBOSE detail (see format below)

### SCRATCHPAD = Your Data Storage with References
- Contains YOUR SUMMARIES and notes (not raw JSON dumps!)
- May contain {{attribute_name}} references to saved raw data
- Use read_scratchpad to see your summaries and references
- Handlebars are NOT auto-expanded - they're just placeholders

### NAMED ATTRIBUTES = Full Raw Data Storage  
- When you use saveAs, full data is stored in attributes
- Reference appears as {{name}} in scratchpad
- Access via: read_attribute({ names: ["attr1", "attr2"] })
- Only access when you need to extract SPECIFIC information

## ✅ CORRECT WORKFLOW (Use saveAs!)

### Step 1: Fetch data with saveAs
\`\`\`json
{ "tool": "web_scrape", "params": { "url": "...", "saveAs": "weather_data" } }
\`\`\`

### Step 2: You receive confirmation
"Result saved to attribute 'weather_data' (5000 chars). NEXT: Call read_attribute..."

### Step 3: Read the attribute ONCE
\`\`\`json  
{ "tool": "read_attribute", "params": { "names": ["weather_data"] } }
\`\`\`

### Step 4: EXTRACT and SUMMARIZE to scratchpad
After seeing the raw data in PREVIOUS ITERATION RESULTS:
\`\`\`json
{ "tool": "write_scratchpad", "params": { "content": "## Weather Summary\\n- London: 15°C, Cloudy\\n- Paris: 18°C, Sunny\\n- New York: 22°C, Clear" } }
\`\`\`

### Step 5: Continue from YOUR SUMMARY
- Your scratchpad now has clean, readable data
- Don't re-read the raw attribute - work from your summary!

## ⚠️ THE LOOP PROBLEM - CRITICAL ⚠️
Tool results only stay visible for ONE iteration. If you don't save:
- Iteration 5: brave_search returns results
- Iteration 6: Results are GONE
- You think "I should search again" - WRONG!

**Solution**: Use saveAs, then read_attribute ONCE, then SUMMARIZE.

## ANTI-LOOP RULES:
1. Check PREVIOUS ITERATION RESULTS first - if you see data, EXTRACT key info and SUMMARIZE
2. Check your blackboard - have you already done this step?
3. Never call the same tool twice with same parameters
4. After read_attribute, ALWAYS write a summary - don't keep re-reading raw data

## 🔄 LOOP SELF-REFLECTION (MANDATORY BEFORE EACH ACTION)

Before proceeding with tool calls, ask yourself:
"Based on my blackboard entries and scratchpad, what is the likelihood I am stuck in a loop that I am unlikely to break free from?"

Signs you may be looping:
- Calling the same tool with identical or very similar parameters multiple times
- Blackboard entries show repetitive patterns (e.g., same step description appearing repeatedly)
- You keep re-reading the same data without making progress
- Previous iterations show the same reasoning pattern

If you detect a high likelihood of being stuck:
1. STOP and acknowledge it in your reasoning
2. Try a COMPLETELY DIFFERENT approach or tool
3. If truly stuck, set status to "needs_assistance" and ask the user for guidance

## TOOL EXECUTION TIMING (CRITICAL!)
All tools in your tool_calls array execute IN PARALLEL - they run at the same time!
This means:
- NEVER call write_scratchpad in the SAME iteration as data-fetching tools
- The data isn't available yet when write_scratchpad runs!

### ❌ WRONG (will fail - data not available yet):
\`\`\`json
{ "tool_calls": [
  { "tool": "web_scrape", "params": { "url": "...", "saveAs": "data" } },
  { "tool": "write_scratchpad", "params": { "content": "Results: {{data}}" } }
]}
\`\`\`

### ✅ CORRECT (fetch first, summarize next iteration):
Iteration 1: \`{ "tool_calls": [{ "tool": "web_scrape", "params": { "url": "...", "saveAs": "data" } }] }\`
Iteration 2: \`{ "tool_calls": [{ "tool": "read_attribute", "params": { "names": ["data"] } }] }\`  
Iteration 3: \`{ "tool_calls": [{ "tool": "write_scratchpad", "params": { "content": "## Summary\\n..." } }] }\`

## Response Format
You MUST respond with valid JSON only. No markdown outside JSON:
{
  "reasoning": "Your thought process",
  "tool_calls": [{ "tool": "tool_name", "params": { ... } }],
  "blackboard_entry": { "category": "observation|insight|plan|decision|error|question|artifact", "content": "What you did/learned" },
  "status": "in_progress|completed|needs_assistance|error",
  "message_to_user": "Optional progress message",
  "artifacts": [{ "type": "text|file|image|data", "title": "Title", "content": "Content", "description": "Description" }],
  "final_report": { "summary": "...", "tools_used": [...], "artifacts_created": [...], "key_findings": [...] }
}

## ⚠️⚠️⚠️ CRITICAL: blackboard_entry IS MANDATORY & MUST BE VERBOSE ⚠️⚠️⚠️

You MUST include a detailed "blackboard_entry" field in EVERY response. NO EXCEPTIONS.
This is your memory journal - track not just WHAT you did, but WHAT YOU LEARNED.

### BLACKBOARD ENTRY FORMAT - BE VERBOSE!

Your entries MUST include:
- **COMPLETED**: What task/step you finished
- **EXTRACTED/FOUND**: Key data points you discovered (summarize key findings here!)
- **NEXT**: Specific next action and WHY

### ❌ BAD EXAMPLES (too vague):
- "Step 3: Reading scratchpad to find dependencies"
- "Step 4: Checking the data"
- "Searching for weather information"

### ✅ GOOD EXAMPLES (detailed with findings):
- "Step 3: COMPLETED repo structure fetch. FOUND: 45 files total, package.json at root, src/ contains 12 React components. EXTRACTED key deps: react@18.3.1, typescript@5.x, lucide-react. NEXT: Check for CVEs in these specific versions."
- "Step 4: ANALYZED weather_data attribute. KEY DATA: London 15°C cloudy, Paris 18°C sunny, NYC 22°C clear. EXTRACTED: All cities above 10°C. NEXT: Format this into the email body."
- "Step 5: COMPLETED email draft. CONTENT: 3-paragraph summary covering weather, travel tips, packing list. NEXT: Send email to user."

### ALWAYS INCLUDE:
- Starting a task → "Step N: Starting [task]. PLAN: [specific steps]"
- After data fetch → "Step N: FETCHED [data]. KEY INFO: [extracted facts]. NEXT: [action]"
- After analysis → "Step N: ANALYZED [source]. FINDINGS: [insights]. EXTRACTED: [key data]. NEXT: [action]"
- Completing task → "COMPLETED: [task]. SUMMARY: [what was accomplished]. ARTIFACTS: [what was created]"
- Making observations → category: "observation", content: "[what you found]"
- Making decisions → category: "decision", content: "[what you decided and why]"

If you skip blackboard_entry, your response is INVALID and will cause problems.

## ⚠️ DATA HANDLING - CRITICAL FOR VALID JSON ⚠️

Your response MUST be valid JSON. When saving data to scratchpad:

1. **NEVER copy raw JSON verbatim** - Embedding complex JSON breaks your response
2. **SUMMARIZE for your next step** - Only save what you need to proceed
3. **Use plain text formatting** - Bullet points, numbered lists, simple text
4. **Keep it clean** - No special characters, no nested objects, no raw API responses

### WRONG (will break JSON parsing):
write_scratchpad content: {"treeData":[{"key":"src/index.ts","data":{"path":"src/index.ts"}}]}

### CORRECT (clean summary):
write_scratchpad content: "## GitHub Repo Analysis\\n\\nTotal files: 47\\nKey directories: src/, lib/, tests/\\n\\nFiles found:\\n- src/index.ts\\n- src/utils.ts\\n- package.json"

### Per-Tool Guidance:

**read_github_repo**: Save file count and paths as plain text list, NOT the tree JSON structure
**read_github_file**: Save relevant code snippets or key findings, NOT entire file contents verbatim
**brave_search / google_search**: Save titles, URLs, and key points as text - NOT raw API response objects
**web_scrape**: Extract and summarize relevant content - NOT the full scraped HTML/text dump
**API calls**: Extract the specific data fields you need - NOT the entire response object

REMEMBER: Your goal is to give yourself just enough information to complete the NEXT step. Keep it simple and clean.

## Workflow:
1. Check your scratchpad for existing findings before making tool calls
2. Make tool calls as needed - USE saveAs TO AUTO-SAVE DATA
3. If you used saveAs, call read_attribute(["attribute_name"]) when you need to see the data
4. If you didn't use saveAs, write results to scratchpad immediately - SUMMARIZED, not raw
5. ALWAYS include blackboard_entry to track your progress
6. Set status to "completed" with final_report when done
7. Use artifacts for FINAL deliverables only

## ⚠️ IMPORTANT: ACCESSING SAVED ATTRIBUTES

If you called a tool with saveAs (e.g., brave_search with saveAs: "weather_data"):
- The data is stored but you DON'T see it yet
- To access it: call read_attribute({ names: ["weather_data"] })
- The NEXT iteration will show you the full data in PREVIOUS ITERATION RESULTS
- THEN you can analyze it and proceed with your task`;
}

// ============================================================================
// DYNAMIC SYSTEM PROMPT BUILDER - Uses sections from frontend
// ============================================================================

// Format tools list with optional custom descriptions
function formatToolsList(toolOverrides?: Record<string, { description?: string }>): string {
  const tools = [
    { id: "brave_search", defaultDesc: "Search the web", params: "query, numResults?, saveAs?" },
    { id: "google_search", defaultDesc: "Search via Google", params: "query, numResults?, saveAs?" },
    { id: "web_scrape", defaultDesc: "Scrape webpage content", params: "url, maxCharacters?, saveAs?" },
    { id: "read_github_repo", defaultDesc: "Get repo file tree", params: "repoUrl, branch?, saveAs?" },
    { id: "read_github_file", defaultDesc: "Read files from repo", params: "repoUrl, selectedPaths, branch?, saveAs?" },
    { id: "pdf_info", defaultDesc: "Get PDF metadata and page count", params: "fileData - base64 encoded PDF" },
    { id: "pdf_extract_text", defaultDesc: "Extract text from PDF", params: "fileData - base64 encoded PDF, pages?" },
    { id: "ocr_image", defaultDesc: "Extract text from image via OCR", params: "imageSource - base64, URL, or data URI" },
    { id: "read_zip_contents", defaultDesc: "List files in ZIP archive", params: "fileData - base64 encoded ZIP" },
    { id: "read_zip_file", defaultDesc: "Read specific file from ZIP", params: "fileData, entryPath" },
    { id: "extract_zip_files", defaultDesc: "Extract files from ZIP", params: "fileData, paths? - empty for all" },
    { id: "send_email", defaultDesc: "Send email via Resend", params: "to, subject, body, useHtml?" },
    { id: "request_assistance", defaultDesc: "Ask user for input", params: "question, context?, inputType?, choices?" },
    { id: "image_generation", defaultDesc: "Generate image from prompt", params: "prompt" },
    { id: "elevenlabs_tts", defaultDesc: "Text to speech", params: "text, voiceId?, modelId?" },
    { id: "get_call_api", defaultDesc: "Make GET request", params: "url, headers?, saveAs?" },
    { id: "post_call_api", defaultDesc: "Make POST request", params: "url, headers?, saveAs?" },
    { id: "read_database_schemas", defaultDesc: "Get database structure - tables, columns, types, constraints", params: "connectionString, schemas?, saveAs?" },
    { id: "execute_sql", defaultDesc: "Execute SQL on external PostgreSQL database", params: "connectionString, query, isWrite?, params?, saveAs?" },
    { id: "get_time", defaultDesc: "Get current date/time", params: "timezone?" },
    { id: "get_weather", defaultDesc: "Get weather for a location", params: "location, units? - celsius or fahrenheit" },
    { id: "write_blackboard", defaultDesc: "Write to your planning journal", params: "category, content, data?" },
    { id: "read_file", defaultDesc: "Read session file content", params: "fileId" },
    { id: "read_prompt", defaultDesc: "Read the original user prompt", params: "" },
    { id: "read_prompt_files", defaultDesc: "Get list of available files with metadata", params: "" },
    { id: "read_attribute", defaultDesc: "Read saved tool result attributes", params: "names[] - empty array for list, specific names for content" },
    { id: "read_scratchpad", defaultDesc: "Read your data storage", params: "" },
    { id: "write_scratchpad", defaultDesc: "SAVE DATA HERE immediately after search/read", params: "content, mode?" },
    { id: "export_word", defaultDesc: "Create Word document", params: "content, filename?" },
    { id: "export_pdf", defaultDesc: "Create PDF document", params: "content, filename?" },
  ];
  
  // Group by category
  const categories: Record<string, typeof tools> = {
    "Search & Web": tools.filter(t => ["brave_search", "google_search", "web_scrape"].includes(t.id)),
    "GitHub": tools.filter(t => ["read_github_repo", "read_github_file"].includes(t.id)),
    "Document": tools.filter(t => ["pdf_info", "pdf_extract_text", "ocr_image", "read_zip_contents", "read_zip_file", "extract_zip_files"].includes(t.id)),
    "Communication": tools.filter(t => ["send_email", "request_assistance"].includes(t.id)),
    "Generation": tools.filter(t => ["image_generation", "elevenlabs_tts"].includes(t.id)),
    "API": tools.filter(t => ["get_call_api", "post_call_api"].includes(t.id)),
    "Database": tools.filter(t => ["read_database_schemas", "execute_sql"].includes(t.id)),
    "Utility": tools.filter(t => ["get_time", "get_weather"].includes(t.id)),
    "Memory": tools.filter(t => ["write_blackboard", "read_file", "read_prompt", "read_prompt_files", "read_attribute", "read_scratchpad", "write_scratchpad"].includes(t.id)),
    "Export": tools.filter(t => ["export_word", "export_pdf"].includes(t.id)),
  };
  
  let output = "Available Tools:\n\n";
  
  for (const [category, categoryTools] of Object.entries(categories)) {
    if (categoryTools.length === 0) continue;
    output += `## ${category} Tools\n`;
    for (const tool of categoryTools) {
      const desc = toolOverrides?.[tool.id]?.description || tool.defaultDesc;
      output += `- ${tool.id}: ${desc} (params: ${tool.params})\n`;
    }
    output += "\n";
  }
  
  // Add the saveAs explanation
  output += `## 🚀 NAMED TOOL RESULT ATTRIBUTES - USE saveAs TO SAVE TOKEN BUDGET!

Data-fetching tools support a "saveAs" parameter that AUTOMATICALLY saves results to a named attribute:

Example: { "tool": "web_scrape", "params": { "url": "...", "saveAs": "london_weather" } }

Benefits of using saveAs:
- Results are saved AUTOMATICALLY - no need to call write_scratchpad
- You receive a small confirmation instead of the full data (saves tokens!)
- Results appear as clickable nodes on the canvas
- Use {{london_weather}} in scratchpad to reference the data
- Call read_attribute(["london_weather"]) to retrieve specific attributes
- Call read_attribute([]) to list all saved attributes

RECOMMENDED: Use saveAs for ALL data-fetching operations (searches, scrapes, API calls, GitHub reads).
This is the most efficient way to store data without wasting tokens on large responses!
`;
  
  return output;
}

// Format session files section
function formatSessionFiles(files: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>): string {
  if (!files || files.length === 0) {
    return '\nNo session files provided.';
  }
  
  const filesList = files.map(f => {
    let fileInfo = `- ${f.filename} (fileId: "${f.id}", type: ${f.mimeType}, size: ${f.size} bytes)`;
    if (f.content && f.size < 50000 && (f.mimeType.startsWith('text/') || f.mimeType.includes('json') || f.mimeType.includes('xml') || f.mimeType.includes('javascript') || f.mimeType.includes('typescript'))) {
      fileInfo += `\n  Content:\n\`\`\`\n${f.content}\n\`\`\``;
    }
    return fileInfo;
  }).join('\n');
  
  return `\nSession Files Available:\n${filesList}\n\nUse read_file with the exact fileId to read file contents.`;
}

// Format configured params section
function formatConfiguredParams(configuredParams?: Array<{ tool: string; param: string }>): string {
  if (!configuredParams || configuredParams.length === 0) {
    return '';
  }
  
  const byTool: Record<string, string[]> = {};
  for (const cp of configuredParams) {
    if (!byTool[cp.tool]) byTool[cp.tool] = [];
    byTool[cp.tool].push(cp.param);
  }
  
  const paramsList = Object.entries(byTool)
    .map(([tool, params]) => `- ${tool}: ${params.join(', ')}`)
    .join('\n');
  
  return `
## 🔐 PRE-CONFIGURED TOOL PARAMETERS
The following tool parameters have been pre-configured by the user with secrets/credentials.
You do NOT need to provide values for these - they will be injected automatically at execution time:

${paramsList}

When using these tools, you may omit the configured parameters or pass null - the user's values will override.
`;
}

// Detect potential loops by checking for repeated content in recent entries
function detectPotentialLoop(entries: Array<{ category: string; content: string }>): boolean {
  if (entries.length < 3) return false;
  
  const recentEntries = entries.slice(-5);
  // Normalize content for comparison (trim, lowercase, remove step numbers)
  const normalizedContents = recentEntries.map(e => 
    e.content.trim().toLowerCase().replace(/step\s*\d+:?/gi, '').trim()
  );
  
  // Count duplicates
  const contentCounts = new Map<string, number>();
  for (const content of normalizedContents) {
    contentCounts.set(content, (contentCounts.get(content) || 0) + 1);
  }
  
  // If any content appears 3+ times in last 5 entries, we're likely looping
  return Array.from(contentCounts.values()).some(count => count >= 3);
}

// Format blackboard section with iteration prefixes for loop detection
function formatBlackboard(entries: Array<{ category: string; content: string; iteration?: number }>): string {
  if (!entries || entries.length === 0) {
    return '\n## BLACKBOARD: Empty. Track your plan and completed items here.';
  }
  
  const hasUserInterjections = entries.some(e => e.category === 'user_interjection');
  const interjectionNote = hasUserInterjections 
    ? '\n\n⚠️ Pay special attention to any recent User Interjections (within the last 1-5 blackboard entries) and ensure your next actions are aligned with the user\'s further direction.' 
    : '';
  
  // Check for potential loop
  const potentialLoop = detectPotentialLoop(entries);
  const loopWarning = potentialLoop 
    ? '\n\n⚠️⚠️⚠️ LOOP WARNING: Your recent blackboard entries show REPETITIVE PATTERNS! Check if your last tool call SUCCEEDED in PREVIOUS ITERATION RESULTS before repeating it. If it succeeded, MOVE ON to the next step!\n'
    : '';
  
  // Prefix each entry with iteration number for loop detection
  const formattedEntries = entries.map(e => {
    const iterPrefix = e.iteration !== undefined ? `#${e.iteration} ` : '';
    return `[${iterPrefix}${e.category}] ${e.content}`;
  }).join('\n');
  
  return `\n## YOUR BLACKBOARD (Planning Journal - Read this EVERY iteration!):${loopWarning}\n${formattedEntries}${interjectionNote}`;
}

// Format scratchpad section
function formatScratchpad(content: string): string {
  if (!content || !content.trim()) {
    return '\n## YOUR SCRATCHPAD (Data Storage): Empty. Write actual DATA here (file contents, search results, analysis).';
  }
  
  if (content.length < 500) {
    return `\n## YOUR SCRATCHPAD (Data Storage - ${content.length} chars):\n\`\`\`\n${content}\n\`\`\``;
  }
  
  return `\n## YOUR SCRATCHPAD: Contains ${content.length} chars of saved data. Use read_scratchpad to view full content.`;
}

// Format previous results section
function formatPreviousResults(results: Array<{ tool: string; result?: unknown; error?: string }>): string {
  if (!results || results.length === 0) {
    return '';
  }
  
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
    
    const resultLength = resultStr?.length || 0;
    const display = resultLength > 250000 
      ? resultStr.slice(0, 250000) + '\n...[truncated at 250KB - use saveAs for large data]'
      : resultStr || 'No result';
      
    return `### Tool: ${r.tool}\n\`\`\`json\n${display}\n\`\`\``;
  }).join('\n\n');
  
  return `

## ⚠️ PREVIOUS ITERATION TOOL RESULTS - READ THIS FIRST! ⚠️
These results will DISAPPEAR next iteration! You MUST save important data to scratchpad NOW.

${formattedResults}

ACTION REQUIRED: If you see search/read results above, call write_scratchpad with the actual data.
DO NOT call the same tool again - the results are RIGHT HERE.
`;
}

// Format assistance response section
function formatAssistanceResponse(assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string }): string {
  if (!assistanceResponse || (!assistanceResponse.response && !assistanceResponse.selectedChoice)) {
    return '';
  }
  
  const userAnswer = assistanceResponse.response || assistanceResponse.selectedChoice;
  return `\n\n## User Response to Your Previous Question\nThe user answered: "${userAnswer}"\nYou MUST incorporate this answer. Do NOT ask the same question again.`;
}

// Build system prompt dynamically from sections
function buildSystemPromptDynamic(
  blackboard: Array<{ category: string; content: string; iteration?: number }>,
  sessionFiles: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>,
  previousResults: Array<{ tool: string; result?: unknown; error?: string }>,
  iteration: number,
  scratchpad: string,
  assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string },
  configuredParams?: Array<{ tool: string; param: string }>,
  promptData?: FreeAgentRequest['promptData']
): string {
  // REQUIRE promptData - no hardcoded fallback
  if (!promptData || !promptData.sections || promptData.sections.length === 0) {
    throw new Error('promptData is required - dynamic system prompt must be provided from frontend');
  }
  
  // Build runtime variable map
  const runtimeVars: Record<string, string> = {
    '{{TOOLS_LIST}}': formatToolsList(promptData.toolOverrides),
    '{{SESSION_FILES}}': formatSessionFiles(sessionFiles),
    '{{CONFIGURED_PARAMS}}': formatConfiguredParams(configuredParams),
    '{{BLACKBOARD_CONTENT}}': formatBlackboard(blackboard),
    '{{SCRATCHPAD_CONTENT}}': formatScratchpad(scratchpad),
    '{{PREVIOUS_RESULTS}}': formatPreviousResults(previousResults),
    '{{CURRENT_ITERATION}}': String(iteration),
    '{{ASSISTANCE_RESPONSE}}': formatAssistanceResponse(assistanceResponse),
  };
  
  // Sort sections by order
  const sortedSections = [...promptData.sections].sort((a, b) => a.order - b.order);
  
  // Log identity section for debugging
  const identitySection = sortedSections.find(s => s.id === 'identity');
  if (identitySection) {
    console.log(`[DynamicPrompt] Identity section content (first 200 chars): ${identitySection.content.substring(0, 200)}`);
  }
  
  // Build prompt by iterating through sections
  let prompt = '';
  for (const section of sortedSections) {
    let content = section.content;
    
    // Replace runtime variables
    for (const [variable, value] of Object.entries(runtimeVars)) {
      content = content.split(variable).join(value);
    }
    
    // Skip empty dynamic sections (e.g., no previous results, no assistance response)
    if (section.type === 'dynamic' && !content.trim()) continue;
    
    prompt += content + '\n\n';
  }
  
  return prompt.trim();
}

// Execute a single tool call against edge functions
async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  supabaseUrl: string,
  supabaseKey: string,
  secretOverrides?: Record<string, { params?: Record<string, unknown>; headers?: Record<string, string> }>
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

  const edgeFunction = toolMap[toolName];
  
  if (!edgeFunction) {
    // Frontend handler tools - return marker for frontend to handle
    return {
      success: true,
      result: { frontend_handler: true, tool: toolName, params }
    };
  }

  try {
    let body = { ...params };
    
    // Apply secret overrides for this tool (merge with user-defined values taking precedence)
    const toolSecrets = secretOverrides?.[toolName];
    if (toolSecrets?.params) {
      // Deep merge params with secret values overriding LLM values
      for (const [key, value] of Object.entries(toolSecrets.params)) {
        if (typeof value === 'object' && value !== null && typeof body[key] === 'object' && body[key] !== null) {
          // Merge objects (like headers)
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
    
    // Apply user-defined headers to the body for tools that support them
    if (toolSecrets?.headers && Object.keys(toolSecrets.headers).length > 0) {
      const existingHeaders = (body.headers as Record<string, string>) || {};
      body.headers = { ...existingHeaders, ...toolSecrets.headers };
    }

    console.log(`Executing tool ${toolName} via ${edgeFunction}:`, JSON.stringify(body).slice(0, 500));

    // Add x-source header for github-fetch to return compact response
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

// Call the LLM - Multi-provider support
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  const provider = getProvider(model);
  const apiModel = getApiModelName(model);
  
  console.log(`Calling LLM - Provider: ${provider}, UI Model: ${model}, API Model: ${apiModel}`);

  try {
    let response: Response;
    
    if (provider === "gemini") {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        return { success: false, error: "GEMINI_API_KEY not configured" };
      }

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\nUser Task: ${userPrompt}` }] }
            ],
            generationConfig: {
              maxOutputTokens: 16384,
              temperature: 0.7,
              responseMimeType: "application/json", // Gemini JSON mode
            },
          }),
        }
      );
    } else if (provider === "claude") {
      const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
      if (!ANTHROPIC_API_KEY) {
        return { success: false, error: "ANTHROPIC_API_KEY not configured" };
      }

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
      if (!XAI_API_KEY) {
        return { success: false, error: "XAI_API_KEY not configured" };
      }

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
      return { success: false, error: `Unknown provider for model: ${model}` };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM error (${provider}):`, errorText);
      return { success: false, error: `LLM Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    let responseText: string;

    // Parse provider-specific response format
    if (provider === "gemini") {
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (provider === "claude") {
      // Claude with tool_choice returns structured data in tool_use block
      const toolUseBlock = data.content?.find((block: { type: string }) => block.type === "tool_use");
      if (toolUseBlock?.input) {
        // Already structured - stringify for consistent handling downstream
        responseText = JSON.stringify(toolUseBlock.input);
      } else {
        // Fallback to text content
        const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
        responseText = textBlock?.text || "";
      }
    } else if (provider === "grok") {
      responseText = data.choices?.[0]?.message?.content || "";
    } else {
      responseText = "";
    }

    if (!responseText) {
      return { success: false, error: "No response from LLM" };
    }

    console.log(`LLM response received (${provider}):`, responseText.slice(0, 500));
    return { success: true, response: responseText };
  } catch (error) {
    console.error("LLM call failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "LLM call failed" };
  }
}

// Sanitize JSON string by escaping control characters that break parsing
function sanitizeJsonString(text: string): string {
  // Replace unescaped control characters inside strings
  // This handles the "Bad control character in string literal" error
  return text.replace(/[\x00-\x1F]/g, (char) => {
    // Map common control characters to their escaped versions
    const escapeMap: Record<string, string> = {
      '\n': '\\n',
      '\r': '\\r',
      '\t': '\\t',
      '\b': '\\b',
      '\f': '\\f',
    };
    return escapeMap[char] || `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}

// Parse agent response with better error handling
function parseAgentResponse(text: string): unknown {
  console.log("Raw LLM response length:", text.length);
  
  let parsed: Record<string, unknown> | null = null;
  
  // Try direct parse first
  try {
    parsed = JSON.parse(text.trim());
  } catch (directError) {
    console.warn("Direct JSON parse failed:", directError instanceof Error ? directError.message : "Unknown");
  }
  
  // Try sanitizing control characters and parsing again
  if (!parsed) {
    try {
      const sanitized = sanitizeJsonString(text.trim());
      parsed = JSON.parse(sanitized);
    } catch (sanitizeError) {
      console.warn("Sanitized JSON parse failed:", sanitizeError instanceof Error ? sanitizeError.message : "Unknown");
    }
  }
  
  // Try to extract JSON object
  if (!parsed) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // Try sanitized version of extracted JSON
        try {
          const sanitizedMatch = sanitizeJsonString(match[0]);
          parsed = JSON.parse(sanitizedMatch);
        } catch (extractError) {
          console.error("JSON extraction also failed. Response end:", text.slice(-300));
        }
      }
    }
  }
  
  // If we got a parsed object, fix any stringified fields
  if (parsed) {
    // Fix tool_calls if it's a string
    if (typeof parsed.tool_calls === "string") {
      try {
        parsed.tool_calls = JSON.parse(parsed.tool_calls);
      } catch {
        console.warn("Failed to parse stringified tool_calls");
        parsed.tool_calls = [];
      }
    }
    
    // Fix blackboard_entry if it's a string
    if (typeof parsed.blackboard_entry === "string") {
      try {
        parsed.blackboard_entry = JSON.parse(parsed.blackboard_entry);
      } catch {
        console.warn("Failed to parse stringified blackboard_entry");
        parsed.blackboard_entry = null;
      }
    }
    
    // Fix final_report if it's a string
    if (typeof parsed.final_report === "string") {
      try {
        parsed.final_report = JSON.parse(parsed.final_report);
      } catch {
        console.warn("Failed to parse stringified final_report");
        parsed.final_report = null;
      }
    }
    
    // Fix artifacts if it's a string
    if (typeof parsed.artifacts === "string") {
      try {
        parsed.artifacts = JSON.parse(parsed.artifacts);
      } catch {
        console.warn("Failed to parse stringified artifacts");
        parsed.artifacts = [];
      }
    }
    
    return parsed;
  }
  
  // Log details for debugging truncation
  console.error("Failed to parse LLM response. Preview:", text.slice(0, 500));
  console.error("Response ends with:", text.slice(-200));
  
  // Try to salvage at least the reasoning for user feedback
  const reasoningMatch = text.match(/"reasoning"\s*:\s*"([^"]+)"/);
  if (reasoningMatch) {
    console.log("Salvaged reasoning:", reasoningMatch[1].slice(0, 200));
    return {
      reasoning: reasoningMatch[1],
      status: "error",
      message_to_user: "Response parsing failed, but I was thinking: " + reasoningMatch[1].slice(0, 200),
    };
  }
  
  return null;
}

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
    } = request || {};

    // Build resolver context for reference resolution in tool params
    const resolverContext: ResolverContext = {
      scratchpad: scratchpad || "",
      blackboard: blackboard || [],
      toolResultAttributes: toolResultAttributes || {},
      artifacts: artifacts || [],
    };

    console.log(`Free Agent iteration ${iteration}, model: ${model}, prompt: ${(prompt || "").slice(0, 100)}...`);
    console.log(`Scratchpad length: ${(scratchpad || "").length} chars`);
    console.log(`Previous tool results count: ${(previousToolResults || []).length}`);
    if (previousToolResults && previousToolResults.length > 0) {
      console.log(`Previous tool results tools: ${previousToolResults.map((t: { tool: string }) => t.tool).join(', ')}`);
      // Log each result's size for debugging
      previousToolResults.forEach((t: { tool: string; result?: unknown; error?: string }, idx: number) => {
        const resultSize = t.result ? JSON.stringify(t.result).length : 0;
        const hasError = !!t.error;
        console.log(`  [${idx}] ${t.tool}: result=${resultSize} chars, hasError=${hasError}`);
      });
    }
    if (assistanceResponse) {
      console.log(`User assistance response: ${JSON.stringify(assistanceResponse)}`);
    }

    // Build prompt dynamically from frontend sections (or fall back to hardcoded for backward compat)
    let systemPrompt: string;
    if (promptData && promptData.sections && promptData.sections.length > 0) {
      console.log(`Using dynamic system prompt with ${promptData.sections.length} sections`);
      systemPrompt = buildSystemPromptDynamic(
        blackboard,
        sessionFiles,
        previousToolResults.map(t => ({ tool: t.tool, result: t.result, error: t.error })),
        iteration,
        scratchpad,
        assistanceResponse,
        configuredParams,
        promptData
      );
    } else {
      console.log(`Using legacy hardcoded system prompt (no promptData provided)`);
      systemPrompt = buildSystemPrompt(
        blackboard,
        sessionFiles,
        previousToolResults.map(t => ({ tool: t.tool, result: t.result, error: t.error })),
        iteration,
        scratchpad,
        assistanceResponse,
        configuredParams
      );
    }

    const llmResult = await callLLM(systemPrompt, prompt, model);

    if (!llmResult.success) {
      // Return error with debug info - HTTP 200 so frontend can read the body
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
      // PARSING FAILED - return the raw response for debugging with HTTP 200
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
            scratchpadLength: (scratchpad || "").length,
            blackboardEntries: (blackboard || []).length,
            previousResultsCount: (previousToolResults || []).length,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute tool calls with reference resolution
    const toolResults: Array<{ tool: string; success: boolean; result?: unknown; error?: string }> = [];
    const frontendHandlers: Array<{ tool: string; params: Record<string, unknown> }> = [];

    for (const toolCall of agentResponse.tool_calls || []) {
      // Resolve references in params (backup resolution - frontend already does this, but edge function has scratchpad/blackboard)
      const resolvedParams = resolveReferences(toolCall.params, resolverContext) as Record<string, unknown>;
      
      // Log if references were resolved
      if (JSON.stringify(resolvedParams) !== JSON.stringify(toolCall.params)) {
        console.log(`[Reference Resolution] ${toolCall.tool}: params were resolved from placeholders`);
      }
      
      const result = await executeTool(
        toolCall.tool,
        resolvedParams, // Use resolved params
        supabaseUrl,
        supabaseKey,
        secretOverrides
      );

      if ((result.result as Record<string, unknown>)?.frontend_handler) {
        frontendHandlers.push({
          tool: toolCall.tool,
          params: resolvedParams, // Pass resolved params to frontend
        });
      } else {
        toolResults.push({
          tool: toolCall.tool,
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
        // Debug data for Raw viewer
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
