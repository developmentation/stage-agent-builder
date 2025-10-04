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
    const { systemPrompt, userPrompt, tools = [], toolConfigs = {} } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Running agent with system prompt:", systemPrompt.substring(0, 50));
    console.log("Tools attached:", tools);

    // Execute tools if any
    let toolResults = "";
    for (const toolId of tools) {
      console.log("Executing tool:", toolId);
      
      try {
        if (toolId === 'google_search') {
          const config = toolConfigs[toolId];
          if (config?.apiKey && config?.searchEngineId) {
            const searchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: userPrompt, apiKey: config.apiKey, searchEngineId: config.searchEngineId }),
            });
            const searchData = await searchResponse.json();
            toolResults += `\n\nGoogle Search Results: ${JSON.stringify(searchData)}`;
          }
        } else if (toolId === 'weather') {
          const config = toolConfigs[toolId];
          if (config?.apiKey) {
            const weatherResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/weather`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ location: "New York", apiKey: config.apiKey }),
            });
            const weatherData = await weatherResponse.json();
            toolResults += `\n\nWeather Data: ${JSON.stringify(weatherData)}`;
          }
        } else if (toolId === 'time') {
          const timeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: 'UTC' }),
          });
          const timeData = await timeResponse.json();
          toolResults += `\n\nCurrent Time: ${JSON.stringify(timeData)}`;
        } else if (toolId === 'web_scrape') {
          const config = toolConfigs[toolId];
          if (config?.url) {
            const scrapeResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/web-scrape`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: config.url }),
            });
            const scrapeData = await scrapeResponse.json();
            toolResults += `\n\nWeb Scrape Results: ${JSON.stringify(scrapeData)}`;
          }
        } else if (toolId === 'api_call') {
          const config = toolConfigs[toolId];
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
            toolResults += `\n\nAPI Call Results: ${JSON.stringify(apiData)}`;
          }
        }
      } catch (toolError) {
        console.error(`Error executing tool ${toolId}:`, toolError);
        toolResults += `\n\nTool ${toolId} Error: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`;
      }
    }

    // Call Lovable AI
    const finalPrompt = toolResults ? `${userPrompt}\n\nTool Results:${toolResults}` : userPrompt;
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: finalPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limits exceeded, please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Payment required, please add funds to your Lovable AI workspace.");
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const output = data.choices?.[0]?.message?.content || "No output generated";
    
    console.log("Agent output generated:", output.substring(0, 100));

    return new Response(JSON.stringify({ output }), {
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
