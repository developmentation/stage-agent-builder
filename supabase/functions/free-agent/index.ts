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
- read_blackboard: Read your memory entries (params: filter?)
- write_blackboard: Write to your memory (params: category, content, data?)
- read_file: Read session file content (params: fileId)
- read_prompt: Read the original user prompt
- read_prompt_files: Get list of available files with metadata
- read_scratchpad: Read your working scratchpad content
- write_scratchpad: Write to your scratchpad (params: content, mode?) - USE THIS TO SAVE DATA!
- request_assistance: Ask user for input (params: question, context?, inputType?, choices?)
- export_word: Create Word document (params: content, filename?)
- export_pdf: Create PDF document (params: content, filename?)
- execute_sql: Execute SQL on external database (params: connectionString, query, isWrite?)
- elevenlabs_tts: Text to speech (params: text, voiceId?, modelId?)
`;

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
    ? `\nYour Blackboard (Planning & Tracking):\n${blackboard.map(e => `[${e.category}] ${e.content}`).join('\n')}`
    : '\nBlackboard is empty. Use it to track your plan and progress.';

  // Scratchpad is the PERSISTENT memory - show it prominently (no truncation)
  const scratchpadSection = scratchpad && scratchpad.trim()
    ? `\n## YOUR SCRATCHPAD (Persistent Memory - Contains Your Accumulated Findings):\n\`\`\`\n${scratchpad}\n\`\`\``
    : '\n## YOUR SCRATCHPAD: Empty. Write your findings here to persist them!';

  const resultsSection = previousResults.length > 0
    ? `\n## PREVIOUS ITERATION'S TOOL RESULTS (Only available THIS iteration - save important data to scratchpad!):\n${JSON.stringify(previousResults, null, 2)}`
    : '';

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

## CRITICAL MEMORY RULES - MANDATORY:
1. **Tool results are EPHEMERAL** - they only exist for ONE iteration then disappear FOREVER
2. **EVERY tool call that returns data MUST be followed by write_scratchpad IN THE SAME RESPONSE**
   - Pattern: [tool_call, write_scratchpad] - both in the same tool_calls array
   - Do NOT say "I will save to scratchpad next iteration" - data will be LOST
3. **Before re-reading a file or re-fetching data**, CHECK your scratchpad first - it may already be there
4. **Scratchpad is your PERSISTENT memory** - anything you want to remember MUST be written there
5. **Blackboard is for PLANNING ONLY** - use it to track what you've done and what's next
6. If you find yourself reading the same file twice, STOP and check your scratchpad
7. **ALL tool calls requested in a single response will be executed** - do not deprioritize or defer any

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
3. ALWAYS write important results to scratchpad immediately
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
            maxOutputTokens: 8192,
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

// Parse agent response
function parseAgentResponse(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
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
