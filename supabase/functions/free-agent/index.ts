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
- write_scratchpad: SAVE DATA HERE - your permanent data storage (params: content, mode?)
- request_assistance: Ask user for input (params: question, context?, inputType?, choices?)
- export_word: Create Word document (params: content, filename?)
- export_pdf: Create PDF document (params: content, filename?)
- execute_sql: Execute SQL on external database (params: connectionString, query, isWrite?)
- elevenlabs_tts: Text to speech (params: text, voiceId?, modelId?)
`;
// NOTE: read_blackboard and read_scratchpad removed - both are ALWAYS shown in full above

  // Include file content if available (for small text files)
  let filesSection = '\nNo session files provided.';
  if (sessionFiles.length > 0) {
    const filesList = sessionFiles.map(f => {
      let fileInfo = `- ${f.filename} (fileId: "${f.id}", type: ${f.mimeType}, size: ${f.size} bytes)`;
      if (f.content && f.size < 50000 && (f.mimeType.startsWith('text/') || f.mimeType.includes('json') || f.mimeType.includes('xml') || f.mimeType.includes('javascript') || f.mimeType.includes('typescript'))) {
        fileInfo += `\n  Content:\n\`\`\`\n${f.content}\n\`\`\``;
      }
      return fileInfo;
    }).join('\n');
    filesSection = `\nSession Files Available:\n${filesList}\n\nUse read_file with the exact fileId to read file contents.`;
  }

  const blackboardSection = blackboard.length > 0
    ? `\n## YOUR BLACKBOARD (Planning Journal - Read this EVERY iteration!):\n${blackboard.map(e => `[${e.category}] ${e.content}`).join('\n')}`
    : '\n## BLACKBOARD: Empty. Track your plan and completed items here.';

  // Scratchpad - ALWAYS show full content, never truncate (agent needs this data)
  let scratchpadSection: string;
  if (!scratchpad || !scratchpad.trim()) {
    scratchpadSection = '\n## YOUR SCRATCHPAD (Data Storage): Empty. Use write_scratchpad to save important data here.';
  } else {
    // Always show FULL scratchpad - max 50KB to stay within context limits
    const displayContent = scratchpad.length > 50000 
      ? scratchpad.slice(-50000) + "\n\n[...older content truncated, showing last 50KB...]"
      : scratchpad;
    scratchpadSection = `\n## YOUR SCRATCHPAD (Data Storage - ${scratchpad.length} chars):\n\`\`\`\n${displayContent}\n\`\`\`\nThis is YOUR saved data. You do NOT need to call any tool to read it - it's right here above.`;
  }

  // Make previous tool results VERY prominent so agent sees them
  let resultsSection = '';
  if (previousResults.length > 0) {
    const formattedResults = previousResults.map(r => {
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

## MEMORY ARCHITECTURE - READ THIS:

### BLACKBOARD (shown above) = Your Planning Journal
- You can SEE it above - no tool needed to read it
- Track: current step, what's COMPLETED, what's NEXT
- Write EVERY iteration using write_blackboard

### SCRATCHPAD (shown above) = Your Data Storage  
- You can SEE it above - no tool needed to read it
- Store ACTUAL DATA here: search results, file contents, analysis
- Use write_scratchpad to save data

## ⚠️ CRITICAL ANTI-LOOP RULES ⚠️
Tool results only stay in PREVIOUS ITERATION RESULTS for ONE iteration. After that, they're gone.

### THE LOOP PROBLEM:
- Iteration 5: brave_search returns results - you see them in PREVIOUS ITERATION RESULTS
- Iteration 6: Results are GONE from that section
- You think "I should search again" - WRONG! You already did!

### HOW TO AVOID LOOPS:
1. When you see data in PREVIOUS ITERATION RESULTS: SAVE IT to scratchpad using write_scratchpad
2. Once saved, the data is in YOUR SCRATCHPAD section above - you can see it there
3. Check YOUR SCRATCHPAD above before deciding to search/read again
4. Check YOUR BLACKBOARD above - if a step is marked COMPLETED, don't redo it

### CORRECT WORKFLOW:
Iteration 1: Call brave_search → blackboard: "Searching for X"
Iteration 2: See results in PREVIOUS ITERATION RESULTS → call write_scratchpad with the data → blackboard: "COMPLETED: Search. Data saved."
Iteration 3: See data in YOUR SCRATCHPAD above → proceed to next task (email, summarize, etc.)

### NEVER DO THIS:
- Never call brave_search/google_search for the same query twice
- Never loop calling the same tool repeatedly
- Never ignore the COMPLETED entries in your blackboard

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
1. Check YOUR SCRATCHPAD above for existing data before making any tool calls
2. Check YOUR BLACKBOARD above for completed steps - don't repeat them
3. If you need new data: make ONE tool call
4. Next iteration: SAVE the results to scratchpad using write_scratchpad
5. Update blackboard with "COMPLETED: [step]"
6. When task is done: set status to "completed" with final_report`;
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

// Parse agent response with better error handling
function parseAgentResponse(text: string): unknown {
  console.log("Raw LLM response length:", text.length);
  
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch (directError) {
    console.warn("Direct JSON parse failed:", directError instanceof Error ? directError.message : "Unknown");
  }
  
  // Try to extract JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (extractError) {
      console.error("JSON extraction also failed. Response end:", text.slice(-300));
    }
  }
  
  // Log details for debugging truncation
  console.error("Failed to parse LLM response. Preview:", text.slice(0, 500));
  console.error("Response ends with:", text.slice(-200));
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const request: FreeAgentRequest = await req.json();
    const {
      prompt,
      model = "gemini-2.5-flash",
      blackboard = [],
      sessionFiles = [],
      previousToolResults = [],
      iteration = 1,
      scratchpad = "",
      assistanceResponse,
    } = request;

    console.log(`Free Agent iteration ${iteration}, prompt: ${prompt.slice(0, 100)}...`);
    console.log(`Scratchpad length: ${scratchpad.length} chars`);
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
      throw new Error(llmResult.error);
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
      throw new Error("Failed to parse agent response");
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
          systemPrompt: systemPrompt,
          rawLLMResponse: llmResult.response || "",
          model: model,
          scratchpadLength: scratchpad.length,
          blackboardEntries: blackboard.length,
          previousResultsCount: previousToolResults.length,
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
