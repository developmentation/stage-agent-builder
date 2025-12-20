import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PronghornItem {
  type: "text" | "image" | "binary";
  content: string;
  title?: string;
  fileName?: string;
  contentType?: string;
}

interface RequestBody {
  projectId: string;
  token: string;
  items: PronghornItem[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, token, items } = await req.json() as RequestBody;

    if (!projectId) {
      return new Response(
        JSON.stringify({ success: false, error: "Project ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Items array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Posting ${items.length} items to Pronghorn project ${projectId}`);

    // Make the request to Pronghorn API
    const response = await fetch("https://api.pronghorn.red/functions/v1/ingest-artifacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-Id": projectId,
        "X-Share-Token": token,
      },
      body: JSON.stringify({ items }),
    });

    const responseText = await response.text();
    let data;
    
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("Failed to parse Pronghorn response:", responseText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Pronghorn API returned invalid response: ${responseText.substring(0, 200)}` 
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      console.error("Pronghorn API error:", data);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.error || data.message || `Pronghorn API error: ${response.status}` 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Pronghorn response:", data);

    return new Response(
      JSON.stringify({
        success: true,
        message: data.message || `Sent ${items.length} items`,
        itemsReceived: data.itemsReceived,
        itemsCreated: data.itemsCreated,
        itemsFailed: data.itemsFailed,
        processingTimeMs: data.processingTimeMs,
        results: data.results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pronghorn post error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
