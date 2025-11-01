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

    // Clamp numResults between 1 and 1000
    const requestedResults = Math.max(1, Math.min(1000, Number(numResults) || 20));

    // Use provided key or fall back to environment secret
    const apiKey = userApiKey || Deno.env.get("BRAVE_API_KEY");

    if (!apiKey) {
      throw new Error("Brave API key is required (not configured in secrets or provided)");
    }

    console.log(`Performing Brave search for: "${query}" (${requestedResults} results)`);

    // Calculate number of pages needed (20 results per page - Brave API limit)
    const numPages = Math.ceil(requestedResults / 20);

    // Fetch all pages
    const fetchAllPages = async () => {
      const allResults: any[] = [];

      for (let page = 0; page < numPages; page++) {
        const offset = page * 20;
        const resultsPerPage = Math.min(20, requestedResults - page * 20);

        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${resultsPerPage}&offset=${offset}`;
        console.log(`Fetching results ${offset + 1}-${offset + resultsPerPage} (page ${page + 1}/${numPages})`);
        console.log(`REQUEST URL: ${url}`);
        
        try {
          const response = await fetch(url, {
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": apiKey,
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn(`Error fetching page ${page + 1}:`, errorData);
            continue;
          }

          const data = await response.json();
          
          if (data.web?.results) {
            allResults.push(...data.web.results);
          }
        } catch (error) {
          console.error(`Error fetching page ${page + 1}:`, error);
        }
      }

      return allResults;
    };

    // Execute the fetch and wait for completion
    const allItems = await fetchAllPages();

    // Map Brave results to match Google Search format for consistency
    const results = allItems.map((item: any) => ({
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
