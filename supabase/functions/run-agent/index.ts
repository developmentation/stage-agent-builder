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
    const { systemPrompt, userPrompt, tools = [], model = "gemini-2.5-flash", maxOutputTokens = 16384 } = await req.json();
    
    // Validate model
    const validModels = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"];
    const selectedModel = validModels.includes(model) ? model : "gemini-2.5-flash";
    
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log("Running agent with system prompt:", systemPrompt.substring(0, 50));
    console.log("Tool instances:", tools);

    // Execute tools if any
    let toolResults = "";
    const toolOutputs: Array<{ toolId: string; output: any }> = [];
    
    for (const toolInstance of tools) {
      const { toolId, config } = toolInstance;
      console.log("Executing tool:", toolId, "with config:", config);
      
      try {
        if (toolId === 'google_search') {
          console.log("Calling google-search with query:", userPrompt);
          const searchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: userPrompt, 
              apiKey: config?.apiKey, 
              searchEngineId: config?.searchEngineId 
            }),
          });
          const searchData = await searchResponse.json();
          console.log("Tool Output [google_search]:", JSON.stringify(searchData, null, 2));
          toolOutputs.push({ toolId: 'google_search', output: searchData });
          toolResults += `\n\nGoogle Search Results: ${JSON.stringify(searchData)}`;
        } else if (toolId === 'weather') {
          if (config?.apiKey) {
            const weatherResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/weather`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ location: "New York", apiKey: config.apiKey }),
            });
            const weatherData = await weatherResponse.json();
            console.log("Tool Output [weather]:", JSON.stringify(weatherData, null, 2));
            toolOutputs.push({ toolId: 'weather', output: weatherData });
            toolResults += `\n\nWeather Data: ${JSON.stringify(weatherData)}`;
          }
        } else if (toolId === 'time') {
          const timeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: 'UTC' }),
          });
          const timeData = await timeResponse.json();
          console.log("Tool Output [time]:", JSON.stringify(timeData, null, 2));
          toolOutputs.push({ toolId: 'time', output: timeData });
          toolResults += `\n\nCurrent Time: ${JSON.stringify(timeData)}`;
        } else if (toolId === 'web_scrape') {
          if (config?.url) {
            const scrapeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/web-scrape`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: config.url }),
            });
            const scrapeData = await scrapeResponse.json();
            console.log("Tool Output [web_scrape]:", JSON.stringify(scrapeData, null, 2));
            toolOutputs.push({ toolId: 'web_scrape', output: scrapeData });
            toolResults += `\n\nWeb Scrape Results: ${JSON.stringify(scrapeData)}`;
          }
        } else if (toolId === 'api_call') {
          if (config?.url) {
            const headers = config.headers ? JSON.parse(config.headers) : {};
            const apiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/api-call`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                url: config.url, 
                method: config.method || 'GET',
                headers 
              }),
            });
            const apiData = await apiResponse.json();
            console.log("Tool Output [api_call]:", JSON.stringify(apiData, null, 2));
            toolOutputs.push({ toolId: 'api_call', output: apiData });
            toolResults += `\n\nAPI Call Results: ${JSON.stringify(apiData)}`;
          }
        }
      } catch (toolError) {
        console.error(`Error executing tool ${toolId}:`, toolError);
        const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error';
        console.log("Tool Output [" + toolId + "] ERROR:", errorMsg);
        toolOutputs.push({ toolId, output: { error: errorMsg } });
        toolResults += `\n\nTool ${toolId} Error: ${errorMsg}`;
      }
    }

    // Call Gemini API directly with selected model
    const finalPrompt = toolResults ? `${userPrompt}\n\nTool Results:${toolResults}` : userPrompt;
    
    console.log(`Using Gemini API with model: ${selectedModel}`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: `${systemPrompt}\n\n${finalPrompt}` }
              ]
            }
          ],
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: maxOutputTokens,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Log full response for debugging
    console.log("Full Gemini API response:", JSON.stringify(data, null, 2));
    
    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "No output generated";
    
    console.log("Agent output generated:", output.substring(0, 100));

    return new Response(JSON.stringify({ output, toolOutputs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in run-agent function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
