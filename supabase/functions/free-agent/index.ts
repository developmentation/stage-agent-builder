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
- tool_calls: [{ tool: "write_scratchpad", params: { content: "## CES 2025 Search Results\n\n1. [actual result data]\n2. [actual result data]..." } }]
- blackboard_entry: { category: "plan", content: "COMPLETED: Search. Data SAVED to scratchpad. NEXT: Send email." }

Iteration 3:
- Now scratchpad has the data, proceed to next task (email, summarize, etc.)

## ANTI-LOOP RULES:
1. Check PREVIOUS ITERATION RESULTS first - if you see data, SAVE IT, don't re-search
2. Check your blackboard COMPLETED list - don't redo completed steps
3. Never call the same search/read tool twice with the same parameters

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

## Workflow:
1. Check your scratchpad for existing findings before making tool calls
2. Make tool calls as needed
3. ALWAYS write important results to scratchpad immediately WITH THE ACTUAL DATA
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

// Call the LLM
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  
  if (!GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY not configured" };
  }

  try {
    console.log(`Calling LLM model: ${model}`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
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
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LLM error:", errorText);
      return { success: false, error: `LLM Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return { success: false, error: "No response from LLM" };
    }

    console.log("LLM response received:", text.slice(0, 500));
    return { success: true, response: text };
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
  
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch (directError) {
    console.warn("Direct JSON parse failed:", directError instanceof Error ? directError.message : "Unknown");
  }
  
  // Try sanitizing control characters and parsing again
  try {
    const sanitized = sanitizeJsonString(text.trim());
    return JSON.parse(sanitized);
  } catch (sanitizeError) {
    console.warn("Sanitized JSON parse failed:", sanitizeError instanceof Error ? sanitizeError.message : "Unknown");
  }
  
  // Try to extract JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // Try sanitized version of extracted JSON
      try {
        const sanitizedMatch = sanitizeJsonString(match[0]);
        return JSON.parse(sanitizedMatch);
      } catch (extractError) {
        console.error("JSON extraction also failed. Response end:", text.slice(-300));
      }
    }
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

    console.log(`Free Agent iteration ${iteration}, prompt: ${(prompt || "").slice(0, 100)}...`);
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
