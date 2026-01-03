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

// Build system prompt for agent
function buildSystemPrompt(
  blackboard: Array<{ category: string; content: string }>,
  sessionFiles: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>,
  previousResults: Array<{ tool: string; result?: unknown }>,
  iteration: number,
  scratchpad: string,
  assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string }
) {
  // Add null safety for all parameters
  const safeBlackboard = blackboard || [];
  const safeSessionFiles = sessionFiles || [];
  const safePreviousResults = previousResults || [];
  const safeScratchpad = scratchpad || "";

  const toolsList = `
Available Tools:
- get_time: Get current date/time (params: timezone?)
- brave_search: Search the web (params: query, numResults?)
- google_search: Search via Google (params: query, numResults?)
- web_scrape: Scrape webpage content (params: url, maxCharacters?)
- read_github_repo: Get repo file tree (params: repoUrl, branch?)
- read_github_file: Read files from repo (params: repoUrl, selectedPaths, branch?)
- send_email: Send email via Resend (params: to, subject, body, useHtml?)
- image_generation: Generate image from prompt (params: prompt)
- get_call_api: Make GET request (params: url, headers?)
- post_call_api: Make POST request (params: url, headers?)
- write_blackboard: Write to your planning journal (params: category, content, data?)
- read_file: Read session file content (params: fileId)
- read_prompt: Read the original user prompt
- read_prompt_files: Get list of available files with metadata
- read_scratchpad: Read your data storage (for final summarization)
- write_scratchpad: SAVE DATA HERE immediately after search/read (params: content, mode?)
- request_assistance: Ask user for input (params: question, context?, inputType?, choices?)
- export_word: Create Word document (params: content, filename?)
- export_pdf: Create PDF document (params: content, filename?)
- execute_sql: Execute SQL on external database (params: connectionString, query, isWrite?)
- elevenlabs_tts: Text to speech (params: text, voiceId?, modelId?)
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

  const blackboardSection = safeBlackboard.length > 0
    ? `\n## YOUR BLACKBOARD (Planning Journal - Read this EVERY iteration!):\n${safeBlackboard.map(e => `[${e.category}] ${e.content}`).join('\n')}`
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
      const resultStr = JSON.stringify(r.result, null, 2);
      // Show full results up to 8KB per tool
      const display = resultStr.length > 8000 
        ? resultStr.slice(0, 8000) + '\n...[truncated - save to scratchpad NOW]'
        : resultStr;
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

  return `You are FreeAgent, an autonomous AI assistant. You accomplish tasks by using tools and tracking your progress.

${toolsList}
${filesSection}
${blackboardSection}
${scratchpadSection}
${resultsSection}${assistanceSection}

Current Iteration: ${iteration}

## MEMORY ARCHITECTURE - UNDERSTAND THIS:

### BLACKBOARD (shown above) = Your Planning Journal
- AUTOMATICALLY included every iteration - you see it above
- Track: current step, COMPLETED items list, NEXT action
- Write EVERY iteration using write_blackboard

### SCRATCHPAD = Data Storage (use read_scratchpad when ready to summarize)
- Store ACTUAL DATA: search results, file contents, analysis
- Only read when you need to compile final report

## ⚠️ THE LOOP PROBLEM - CRITICAL ⚠️
Tool results only stay visible for ONE iteration. If you search and don't save:
- Iteration 5: brave_search returns results - you see them in PREVIOUS ITERATION RESULTS
- Iteration 6: Results are GONE - you can't see them anymore
- You think "I should search again" - WRONG! You already did!

### CORRECT WORKFLOW FOR SEARCH TASKS:

Iteration 1:
- tool_calls: [{ tool: "brave_search", params: { query: "CES 2025" } }]
- blackboard_entry: { category: "plan", content: "Step 1: Searching for CES 2025" }

Iteration 2 (YOU WILL SEE search results in PREVIOUS ITERATION RESULTS above):
- READ the results shown above
- tool_calls: [{ tool: "write_scratchpad", params: { content: "## CES 2025 Search Results\\n\\n1. [actual result data]\\n2. [actual result data]..." } }]
- blackboard_entry: { category: "plan", content: "COMPLETED: Search. Data SAVED to scratchpad. NEXT: Send email." }

Iteration 3:
- Now scratchpad has the data, proceed to next task (email, summarize, etc.)

## ANTI-LOOP RULES:
1. Check PREVIOUS ITERATION RESULTS first - if you see data, SAVE IT, don't re-search
2. Check your blackboard COMPLETED list - don't redo completed steps
3. Never call the same search/read tool twice with the same parameters

## ⚠️ MANDATORY: write_blackboard EVERY ITERATION - NO EXCEPTIONS ⚠️
You MUST include write_blackboard as the FIRST tool_call in EVERY response. This includes:
- When requesting assistance (request_assistance)
- When completing tasks
- When encountering errors
- ALWAYS - no matter what

Example for request_assistance:
{
  "tool_calls": [
    { "tool": "write_blackboard", "params": { "category": "plan", "content": "Asking user for input: [your question]" } },
    { "tool": "request_assistance", "params": { "question": "...", "inputType": "text" } }
  ]
}

## Response Format
You MUST respond with valid JSON only. No markdown outside JSON:
{
  "reasoning": "Your thought process",
  "tool_calls": [{ "tool": "tool_name", "params": { ... } }],
  "blackboard_entry": { "category": "observation|insight|plan|decision|error", "content": "What you did/learned" },
  "status": "in_progress|completed|needs_assistance|error",
  "message_to_user": "Optional progress message",
  "artifacts": [{ "type": "text|file|image|data", "title": "Title", "content": "Content", "description": "Description" }],
  "final_report": { "summary": "...", "tools_used": [...], "artifacts_created": [...], "key_findings": [...] }
}

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
2. Make tool calls as needed
3. ALWAYS write important results to scratchpad immediately - SUMMARIZED, not raw
4. Update blackboard with your plan/progress
5. Set status to "completed" with final_report when done
6. Use artifacts for FINAL deliverables only`;
}

// Execute a single tool call against edge functions
async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  supabaseUrl: string,
  supabaseKey: string
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
    elevenlabs_tts: "elevenlabs-tts",
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
    let body = params;
    
    if (toolName === "get_call_api") {
      body = { ...params, method: "GET" };
    } else if (toolName === "post_call_api") {
      body = { ...params, method: "POST" };
    } else if (toolName === "image_generation") {
      body = { prompt: params.prompt, model: params.model || "gemini-2.5-flash-image" };
    }

    console.log(`Executing tool ${toolName} via ${edgeFunction}:`, JSON.stringify(body));

    const response = await fetch(`${supabaseUrl}/functions/v1/${edgeFunction}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
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
    } = request || {};

    console.log(`Free Agent iteration ${iteration}, model: ${model}, prompt: ${(prompt || "").slice(0, 100)}...`);
    console.log(`Scratchpad length: ${(scratchpad || "").length} chars`);
    if (assistanceResponse) {
      console.log(`User assistance response: ${JSON.stringify(assistanceResponse)}`);
    }

    // Build prompt and call LLM - include scratchpad for persistent memory
    const systemPrompt = buildSystemPrompt(
      blackboard,
      sessionFiles,
      previousToolResults.map(t => ({ tool: t.tool, result: t.result })),
      iteration,
      scratchpad,
      assistanceResponse
    );

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

    // Execute tool calls
    const toolResults: Array<{ tool: string; success: boolean; result?: unknown; error?: string }> = [];
    const frontendHandlers: Array<{ tool: string; params: Record<string, unknown> }> = [];

    for (const toolCall of agentResponse.tool_calls || []) {
      const result = await executeTool(
        toolCall.tool,
        toolCall.params,
        supabaseUrl,
        supabaseKey
      );

      if ((result.result as Record<string, unknown>)?.frontend_handler) {
        frontendHandlers.push({
          tool: toolCall.tool,
          params: toolCall.params,
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
