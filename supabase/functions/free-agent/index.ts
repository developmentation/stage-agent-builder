import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FreeAgentRequest {
  sessionId?: string;
  prompt?: string;
  model?: string;
  maxIterations?: number;
  sessionFiles?: Array<{ id: string; filename: string; mimeType: string; size: number; content?: string }>;
  assistanceResponse?: { response?: string; fileId?: string; selectedChoice?: string };
}

// Load tools manifest
async function loadToolsManifest() {
  // Tools manifest is embedded for edge function
  return {
    "get_time": { edge_function: "time" },
    "brave_search": { edge_function: "brave-search" },
    "web_scrape": { edge_function: "web-scrape" },
    "read_github_repo": { edge_function: "github-fetch" },
    "read_github_file": { edge_function: "github-fetch" },
    "send_email": { edge_function: "send-email" },
    "image_generation": { edge_function: "run-nano" },
    "get_call_api": { edge_function: "api-call" },
    "post_call_api": { edge_function: "api-call" },
    "read_blackboard": { frontend_handler: true },
    "write_blackboard": { frontend_handler: true },
    "read_file": { frontend_handler: true },
    "request_assistance": { frontend_handler: true },
    "export_word": { frontend_handler: true },
    "export_pdf": { frontend_handler: true },
  };
}

// Build system prompt for agent
function buildSystemPrompt(
  blackboard: any[],
  sessionFiles: any[],
  previousResults: any[],
  iteration: number
) {
  const toolsList = `
Available Tools:
- get_time: Get current date/time
- brave_search: Search the web (params: query, numResults)
- web_scrape: Scrape webpage content (params: url, maxCharacters)
- read_github_repo: Get repo file tree (params: repoUrl, branch)
- read_github_file: Read files from repo (params: repoUrl, selectedPaths, branch)
- send_email: Send email via Resend (params: to, subject, body, useHtml)
- image_generation: Generate image from prompt (params: prompt)
- get_call_api: Make GET request (params: url, headers)
- post_call_api: Make POST request (params: url, headers, body)
- read_blackboard: Read your memory entries (params: filter)
- write_blackboard: Write to your memory (params: category, content, data)
- read_file: Read session file (params: fileId)
- request_assistance: Ask user for input (params: question, context, inputType, choices)
- export_word: Create Word document (params: content, filename)
- export_pdf: Create PDF document (params: content, filename)
`;

  const filesSection = sessionFiles.length > 0
    ? `\nSession Files (use read_file with fileId):\n${sessionFiles.map(f => `- ${f.filename} (id: ${f.id}, type: ${f.mime_type}, size: ${f.size})`).join('\n')}`
    : '\nNo session files provided.';

  const blackboardSection = blackboard.length > 0
    ? `\nYour Blackboard Memory:\n${blackboard.map(e => `[${e.category}] ${e.content}`).join('\n')}`
    : '\nBlackboard is empty. This is the first iteration.';

  const resultsSection = previousResults.length > 0
    ? `\nPrevious Tool Results:\n${JSON.stringify(previousResults, null, 2)}`
    : '';

  return `You are FreeAgent, an autonomous AI assistant. You accomplish tasks by using tools and tracking your progress on a blackboard.

${toolsList}
${filesSection}
${blackboardSection}
${resultsSection}

Current Iteration: ${iteration}

## Response Format
You MUST respond with valid JSON only. No markdown, no explanation outside JSON:
{
  "reasoning": "Your chain-of-thought about what to do next",
  "tool_calls": [{ "tool": "tool_name", "params": { ... } }],
  "blackboard_entry": { "category": "observation|insight|question|decision|plan|artifact|error", "content": "What you learned" },
  "status": "in_progress|completed|needs_assistance|error",
  "message_to_user": "Optional progress message",
  "artifacts": [{ "type": "text|file|image|data", "title": "Title", "content": "Content", "description": "Description" }],
  "final_report": { "summary": "...", "tools_used": [...], "artifacts_created": [...], "key_findings": [...] }
}

Rules:
1. ALWAYS write a blackboard_entry each iteration
2. Set status to "completed" when task is done, include final_report
3. Use request_assistance when you need user input
4. Can call up to 5 tools per iteration
5. Artifacts appear on the user's canvas`;
}

// Execute a single tool call
async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const toolMap: Record<string, string> = {
    get_time: "time",
    brave_search: "brave-search",
    web_scrape: "web-scrape",
    read_github_repo: "github-fetch",
    read_github_file: "github-fetch",
    send_email: "send-email",
    image_generation: "run-nano",
    get_call_api: "api-call",
    post_call_api: "api-call",
  };

  const edgeFunction = toolMap[toolName];
  
  if (!edgeFunction) {
    // Frontend handler tools - return placeholder for frontend to handle
    return {
      success: true,
      result: { frontend_handler: true, tool: toolName, params } as Record<string, unknown>
    };
  }

  try {
    // Map params to edge function expected format
    let body = params;
    
    if (toolName === "get_call_api") {
      body = { ...params, method: "GET" };
    } else if (toolName === "post_call_api") {
      body = { ...params, method: "POST" };
    } else if (toolName === "image_generation") {
      body = { prompt: params.prompt, model: params.model || "gemini-2.5-flash-image" };
    }

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
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const result = await response.json();
    return { success: true, result };
  } catch (error) {
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
      return { success: false, error: `LLM Error ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return { success: false, error: "No response from LLM" };
    }

    return { success: true, response: text };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "LLM call failed" };
  }
}

// Parse agent response
function parseAgentResponse(text: string): any {
  try {
    return JSON.parse(text.trim());
  } catch {
    // Try to extract JSON from response
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
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { 
      sessionId: existingSessionId, 
      prompt, 
      model = "gemini-2.5-flash",
      maxIterations = 50,
      sessionFiles = [],
      assistanceResponse
    }: FreeAgentRequest = await req.json();

    let sessionId = existingSessionId;
    let currentIteration = 0;

    // Create new session or resume existing
    if (!sessionId && prompt) {
      const { data: session, error: sessionError } = await supabase
        .from("free_agent_sessions")
        .insert({
          prompt,
          model,
          max_iterations: maxIterations,
          status: "running",
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      sessionId = session.id;

      // Store session files
      if (sessionFiles.length > 0) {
        await supabase.from("free_agent_session_files").insert(
          sessionFiles.map(f => ({
            session_id: sessionId,
            filename: f.filename,
            mime_type: f.mimeType,
            size: f.size,
            content: f.content,
          }))
        );
      }

      // Log initial user message
      await supabase.from("free_agent_messages").insert({
        session_id: sessionId,
        role: "user",
        content: prompt,
        iteration: 0,
      });

      console.log(`Created new session: ${sessionId}`);
    } else if (sessionId) {
      // Get existing session
      const { data: session, error } = await supabase
        .from("free_agent_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) throw error;
      currentIteration = session.current_iteration;

      // Handle assistance response
      if (assistanceResponse) {
        await supabase.from("free_agent_messages").insert({
          session_id: sessionId,
          role: "user",
          content: assistanceResponse.response || JSON.stringify(assistanceResponse),
          iteration: currentIteration,
        });
      }
    } else {
      throw new Error("Either sessionId or prompt is required");
    }

    // Get session data
    const { data: session } = await supabase
      .from("free_agent_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    // Get blackboard entries
    const { data: blackboard } = await supabase
      .from("free_agent_blackboard")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    // Get session files
    const { data: files } = await supabase
      .from("free_agent_session_files")
      .select("id, filename, mime_type, size")
      .eq("session_id", sessionId);

    // Get recent tool results
    const { data: recentToolCalls } = await supabase
      .from("free_agent_tool_calls")
      .select("*")
      .eq("session_id", sessionId)
      .eq("iteration", currentIteration)
      .eq("status", "completed");

    // Build prompt and call LLM
    const systemPrompt = buildSystemPrompt(
      blackboard || [],
      files || [],
      recentToolCalls?.map(t => ({ tool: t.tool_name, result: t.result })) || [],
      currentIteration + 1
    );

    const llmResult = await callLLM(systemPrompt, session.prompt, session.model);

    if (!llmResult.success) {
      throw new Error(llmResult.error);
    }

    const agentResponse = parseAgentResponse(llmResult.response!);

    if (!agentResponse) {
      throw new Error("Failed to parse agent response");
    }

    // Update iteration
    currentIteration++;
    await supabase
      .from("free_agent_sessions")
      .update({ current_iteration: currentIteration })
      .eq("id", sessionId);

    // Write blackboard entry
    if (agentResponse.blackboard_entry) {
      await supabase.from("free_agent_blackboard").insert({
        session_id: sessionId,
        category: agentResponse.blackboard_entry.category,
        content: agentResponse.blackboard_entry.content,
        data: agentResponse.blackboard_entry.data,
        iteration: currentIteration,
      });
    }

    // Log assistant message
    await supabase.from("free_agent_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: agentResponse.reasoning || "",
      tool_calls: agentResponse.tool_calls,
      artifacts: agentResponse.artifacts,
      iteration: currentIteration,
    });

    // Execute tool calls
    const toolResults: any[] = [];
    const frontendHandlers: any[] = [];

    for (const toolCall of agentResponse.tool_calls || []) {
      // Log tool call
      const { data: toolRecord } = await supabase
        .from("free_agent_tool_calls")
        .insert({
          session_id: sessionId,
          tool_name: toolCall.tool,
          params: toolCall.params,
          status: "executing",
          iteration: currentIteration,
        })
        .select()
        .single();

      const result = await executeTool(
        toolCall.tool,
        toolCall.params as Record<string, unknown>,
        supabaseUrl,
        supabaseKey
      );

      if ((result.result as Record<string, unknown>)?.frontend_handler) {
        frontendHandlers.push({
          id: toolRecord?.id,
          tool: toolCall.tool,
          params: toolCall.params,
        });
      } else {
        // Update tool call record
        await supabase
          .from("free_agent_tool_calls")
          .update({
            status: result.success ? "completed" : "error",
            result: result.result,
            error: result.error,
            completed_at: new Date().toISOString(),
          })
          .eq("id", toolRecord?.id);

        toolResults.push({
          tool: toolCall.tool,
          success: result.success,
          result: result.result,
          error: result.error,
        });
      }
    }

    // Create artifacts
    for (const artifact of agentResponse.artifacts || []) {
      await supabase.from("free_agent_artifacts").insert({
        session_id: sessionId,
        artifact_type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        description: artifact.description,
        iteration: currentIteration,
      });
    }

    // Update session status
    if (agentResponse.status === "completed") {
      await supabase
        .from("free_agent_sessions")
        .update({
          status: "completed",
          final_report: agentResponse.final_report,
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } else if (agentResponse.status === "needs_assistance") {
      await supabase
        .from("free_agent_sessions")
        .update({ status: "paused" })
        .eq("id", sessionId);
    } else if (agentResponse.status === "error") {
      await supabase
        .from("free_agent_sessions")
        .update({ status: "error", error: agentResponse.reasoning })
        .eq("id", sessionId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        iteration: currentIteration,
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
