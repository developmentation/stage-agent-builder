import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { systemPrompt, userPrompt, tools = [], model, maxOutputTokens } = await req.json();
    
    console.log("Received request:", { model, maxOutputTokens, toolsCount: tools.length });

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    // Execute tools first
    const toolResults: any[] = [];
    if (tools && tools.length > 0) {
      console.log(`Executing ${tools.length} tools...`);
      
      for (const tool of tools) {
        try {
          console.log(`Executing tool: ${tool.toolId}`);
          const toolConfig = tool.config || {};
          
          let result;
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          
          if (tool.toolId === 'google_search') {
            const response = await fetch(`${supabaseUrl}/functions/v1/google-search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: toolConfig.query || '' })
            });
            result = await response.json();
          } else if (tool.toolId === 'weather') {
            const response = await fetch(`${supabaseUrl}/functions/v1/weather`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ location: toolConfig.location || '' })
            });
            result = await response.json();
          } else if (tool.toolId === 'time') {
            const response = await fetch(`${supabaseUrl}/functions/v1/time`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({})
            });
            result = await response.json();
          } else if (tool.toolId === 'web_scrape') {
            const response = await fetch(`${supabaseUrl}/functions/v1/web-scrape`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: toolConfig.url || '' })
            });
            result = await response.json();
          } else if (tool.toolId === 'api_call') {
            const response = await fetch(`${supabaseUrl}/functions/v1/api-call`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: toolConfig.url || '',
                method: toolConfig.method || 'GET',
                headers: toolConfig.headers || {},
                body: toolConfig.body
              })
            });
            result = await response.json();
          }
          
          console.log(`Tool ${tool.toolId} result:`, result);
          toolResults.push({
            toolId: tool.toolId,
            output: result
          });
        } catch (error) {
          console.error(`Error executing tool ${tool.toolId}:`, error);
          toolResults.push({
            toolId: tool.toolId,
            output: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
        }
      }
    }

    // Prepare the final prompt with tool results
    let finalPrompt = userPrompt;
    if (toolResults.length > 0) {
      const toolResultsText = toolResults.map(tr => 
        `Tool: ${tr.toolId}\nResult: ${JSON.stringify(tr.output, null, 2)}`
      ).join('\n\n');
      finalPrompt = `${userPrompt}\n\n--- Tool Results ---\n${toolResultsText}`;
    }

    console.log("Calling Anthropic API with model:", model);

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send tool outputs first if any
        if (toolResults.length > 0) {
          const toolMessage = JSON.stringify({
            type: 'tools',
            toolOutputs: toolResults
          });
          controller.enqueue(encoder.encode(`data: ${toolMessage}\n\n`));
        }

        try {
          // Stream the response from Anthropic using fetch API
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "anthropic-version": "2023-06-01",
              "x-api-key": anthropicApiKey,
            },
            body: JSON.stringify({
              model: model,
              max_tokens: maxOutputTokens,
              system: systemPrompt,
              messages: [{
                role: "user",
                content: finalPrompt
              }],
              stream: true,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          
          if (!reader) {
            throw new Error("No response body reader available");
          }

          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                
                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                    const deltaMessage = JSON.stringify({
                      type: 'delta',
                      text: parsed.delta.text
                    });
                    controller.enqueue(encoder.encode(`data: ${deltaMessage}\n\n`));
                  } else if (parsed.type === "message_stop") {
                    // Message is complete
                    const completeMessage = JSON.stringify({
                      type: 'complete'
                    });
                    controller.enqueue(encoder.encode(`data: ${completeMessage}\n\n`));
                  } else if (parsed.type === "error") {
                    const errorMessage = JSON.stringify({
                      type: 'error',
                      error: parsed.error?.message || "Unknown error"
                    });
                    controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
                  }
                } catch (e) {
                  console.error("Error parsing SSE line:", e);
                }
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('Error in Anthropic stream:', error);
          const errorMessage = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          controller.enqueue(encoder.encode(`data: ${errorMessage}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in run-agent-anthropic:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
