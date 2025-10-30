import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, numResults = 20, apiKey: userApiKey } = await req.json();

    if (!query) {
      throw new Error("Query parameter is required");
    }

    // Clamp numResults between 1 and 20 (Brave API limit per request)
    const count = Math.max(1, Math.min(20, Number(numResults) || 20));

    // Use provided key or fall back to environment secret
    const apiKey = userApiKey || Deno.env.get("BRAVE_API_KEY");

    if (!apiKey) {
      throw new Error("Brave API key is required (not configured in secrets or provided)");
    }

    console.log(`Performing Brave search for: "${query}" (${count} results)`);

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    
    console.log(`REQUEST URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Brave API error:", errorData);
      throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Map Brave results to match Google Search format for consistency
    const results = (data.web?.results || []).map((item: any) => ({
      title: item.title,
      url: item.url,
      description: item.description,
    }));

    console.log(`Returning ${results.length} search results`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in brave-search function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
