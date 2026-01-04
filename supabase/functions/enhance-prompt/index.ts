import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { 
      systemPrompt, 
      userPrompt, 
      model = "gemini-2.5-flash",
      maxOutputTokens = 8192
    } = await req.json();

    console.log(`Enhance prompt request - Model: ${model}`);
    console.log(`System prompt length: ${systemPrompt?.length || 0}`);
    console.log(`User prompt length: ${userPrompt?.length || 0}`);

    // Determine which API to use based on model prefix
    const isGemini = model.startsWith("gemini");
    const isClaude = model.startsWith("claude");
    const isGrok = model.startsWith("grok");

    let apiResponse: Response;

    if (isGemini) {
      // Use Gemini API
      const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
      if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const geminiModel = model.includes("3-pro") ? "gemini-2.5-pro-preview-06-05" :
                          model.includes("3-flash") ? "gemini-2.5-flash-preview-05-20" :
                          model.includes("lite") ? "gemini-2.5-flash-lite-preview-06-17" :
                          "gemini-2.5-flash-preview-05-20";

      apiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: userPrompt }] }
            ],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              maxOutputTokens,
              temperature: 0.7,
            },
          }),
        }
      );
    } else if (isClaude) {
      // Use Anthropic API
      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
      if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
      }

      const claudeModel = model.includes("opus") ? "claude-sonnet-4-5-20250514" :
                          model.includes("haiku") ? "claude-3-5-haiku-20241022" :
                          "claude-sonnet-4-5-20250514";

      apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: maxOutputTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          stream: true,
        }),
      });
    } else if (isGrok) {
      // Use xAI API
      const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
      if (!XAI_API_KEY) {
        throw new Error('XAI_API_KEY is not configured');
      }

      const grokModel = model.includes("code") ? "grok-3-fast" :
                        model.includes("reasoning") ? "grok-3-mini-fast" :
                        "grok-3-fast";

      apiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${XAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: grokModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxOutputTokens,
          stream: true,
        }),
      });
    } else {
      throw new Error(`Unsupported model: ${model}`);
    }

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('API error:', errorText);
      throw new Error(`API error: ${apiResponse.status} - ${errorText}`);
    }

    // Stream the response with unified SSE format
    const stream = new ReadableStream({
      async start(controller) {
        const reader = apiResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              const doneData = JSON.stringify({ type: 'done' });
              controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
              
              if (trimmedLine.startsWith('data: ')) {
                const jsonStr = trimmedLine.slice(6);
                try {
                  const parsed = JSON.parse(jsonStr);
                  let content = '';

                  // Extract content based on provider format
                  if (isGemini) {
                    content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  } else if (isClaude) {
                    if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                      content = parsed.delta.text || '';
                    }
                  } else if (isGrok) {
                    content = parsed.choices?.[0]?.delta?.content || '';
                  }
                  
                  if (content) {
                    const deltaData = JSON.stringify({ type: 'delta', text: content });
                    controller.enqueue(encoder.encode(`data: ${deltaData}\n\n`));
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream processing error:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorData = JSON.stringify({ type: 'error', error: errorMessage });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
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
    console.error('Error in enhance-prompt function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
