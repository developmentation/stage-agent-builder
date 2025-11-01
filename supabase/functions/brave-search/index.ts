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

    // Brave API limits: count max 20, offset max 9 (total 200 results)
    const requestedResults = Math.max(1, Math.min(200, Number(numResults) || 20));

    // Use provided key or fall back to environment secret
    const apiKey = userApiKey || Deno.env.get("BRAVE_API_KEY");

    if (!apiKey) {
      throw new Error("Brave API key is required (not configured in secrets or provided)");
    }

    console.log(`Performing Brave search for: "${query}" (${requestedResults} results)`);

    // Calculate number of pages needed (20 results per page, offset 0-9 for max 10 pages)
    const numPages = Math.min(10, Math.ceil(requestedResults / 20));

    // Fetch all pages
    const fetchAllPages = async () => {
      const allResults: any[] = [];

      for (let pageOffset = 0; pageOffset < numPages; pageOffset++) {
        const resultsPerPage = Math.min(20, requestedResults - allResults.length);

        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${resultsPerPage}&offset=${pageOffset}`;
        console.log(`Fetching page ${pageOffset + 1}/${numPages} (offset=${pageOffset}, count=${resultsPerPage})`);
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
            console.warn(`Error fetching page ${pageOffset + 1}:`, errorData);
            continue;
          }

          const data = await response.json();
          
          console.log(`Page ${pageOffset + 1} returned ${data.web?.results?.length || 0} results`);
          
          if (data.web?.results) {
            allResults.push(...data.web.results);
            console.log(`Total accumulated results so far: ${allResults.length}`);
          }
        } catch (error) {
          console.error(`Error fetching page ${pageOffset + 1}:`, error);
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
