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
    const { query, numResults = 20, apiKey: userApiKey, searchEngineId: userSearchEngineId } = await req.json();

    if (!query) {
      throw new Error("Query parameter is required");
    }

    // Clamp numResults between 1 and 1000
    const requestedResults = Math.max(1, Math.min(1000, Number(numResults) || 20));

    // Use provided keys or fall back to environment secrets
    const apiKey = userApiKey || Deno.env.get("GOOGLE_SEARCH_API");
    const searchEngineId = userSearchEngineId || Deno.env.get("GOOGLE_SEARCH_ENGINE");

    if (!apiKey) {
      throw new Error("Google Search API key is required (not configured in secrets or provided)");
    }

    if (!searchEngineId) {
      throw new Error("Google Search Engine ID is required (not configured in secrets or provided)");
    }

    console.log(`Performing Google search for: "${query}" (${requestedResults} results)`);

    // Calculate number of pages needed (10 results per page)
    const numPages = Math.ceil(requestedResults / 10);

    // Start background task to fetch all pages
    const fetchAllPages = async () => {
      const allItems: any[] = [];

      for (let page = 0; page < numPages; page++) {
        const startIndex = page * 10 + 1;
        const resultsPerPage = Math.min(10, requestedResults - page * 10);

        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&start=${startIndex}&num=${resultsPerPage}`;
        console.log(`Fetching results ${startIndex}-${startIndex + resultsPerPage - 1} (page ${page + 1}/${numPages})`);
        console.log(`REQUEST URL: ${url}`);
        try {
          const response = await fetch(url);
          const data = await response.json();

          if (!response.ok) {
            console.warn(`Error fetching page ${page + 1}:`, data.error?.message);
            continue;
          }

          if (data.items) {
            allItems.push(...data.items);
          }
        } catch (error) {
          console.error(`Error fetching page ${page + 1}:`, error);
        }
      }

      return allItems;
    };

    // Execute the fetch in background and wait for completion
    const allItems = await fetchAllPages();

    const results = allItems.map((item: any) => ({
      title: item.title,
      url: item.link,
      description: item.snippet,
    }));

    console.log(`Returning ${results.length} search results`);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in google-search function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
