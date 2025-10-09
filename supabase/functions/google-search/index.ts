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
    const { query, apiKey: userApiKey, searchEngineId: userSearchEngineId } = await req.json();
    
    if (!query) {
      throw new Error("Query parameter is required");
    }
    
    // Use provided keys or fall back to environment secrets
    const apiKey = userApiKey || Deno.env.get("GOOGLE_SEARCH_API");
    const searchEngineId = userSearchEngineId || Deno.env.get("GOOGLE_SEARCH_ENGINE");
    
    if (!apiKey) {
      throw new Error("Google Search API key is required (not configured in secrets or provided)");
    }

    if (!searchEngineId) {
      throw new Error("Google Search Engine ID is required (not configured in secrets or provided)");
    }

    console.log("Performing Google search for:", query);

    // Fetch first 10 results
    const url1 = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&start=1&num=10`;
    console.log("Fetching results 1-10");
    
    const response1 = await fetch(url1);
    const data1 = await response1.json();
    
    if (!response1.ok) {
      throw new Error(data1.error?.message || "Google Search API error");
    }

    // Fetch next 10 results (pagination)
    const url2 = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&start=11&num=10`;
    console.log("Fetching results 11-20");
    
    const response2 = await fetch(url2);
    const data2 = await response2.json();
    
    if (!response2.ok) {
      console.warn("Error fetching second page:", data2.error?.message);
    }

    // Combine results from both pages
    const allItems = [
      ...(data1.items || []),
      ...(data2.items || [])
    ];

    const results = allItems.map((item: any) => ({
      title: item.title,
      url: item.link,
      description: item.snippet,
    }));

    console.log(`Returning ${results.length} search results`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in google-search function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
