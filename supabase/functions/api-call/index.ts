import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Filter out browser-specific headers that trigger CORS
function filterHeaders(headers: Record<string, string>): Record<string, string> {
  const blockedHeaders = [
    "origin",
    "referer",
    "host",
    "cookie",
    "connection",
    "cache-control",
    "pragma",
    "sec-fetch-site",
    "sec-fetch-mode",
    "sec-fetch-dest",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
  ];

  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    // Block specific headers and any Sec-* headers
    if (blockedHeaders.includes(lowerKey) || lowerKey.startsWith("sec-")) {
      continue;
    }

    // Allow safe headers and custom API keys
    filtered[key] = value;
  }

  return filtered;
}

// Get standard request headers
function getStandardHeaders(): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "User-Agent": "Albert-Server/1.0",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, method = "GET", headers = {}, body } = await req.json();

    if (!url) {
      throw new Error("URL parameter is required");
    }

    console.log(`Making ${method} request to:`, url);

    // Start with standard headers, then add filtered custom headers
    const standardHeaders = getStandardHeaders();
    const filteredHeaders = filterHeaders(headers);

    console.log("Filtered headers:", Object.keys(filteredHeaders));

    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...standardHeaders,
        ...filteredHeaders,
      },
      redirect: "follow",
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type");

    let data;
    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return new Response(
      JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        data,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in api-call function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
