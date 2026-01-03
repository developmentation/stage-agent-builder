import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, style = "concise", maxLength, focus } = await req.json();

    if (!content) {
      throw new Error("content is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const styleInstructions: Record<string, string> = {
      concise: "Create a brief, focused summary capturing only the essential points. Be direct and avoid unnecessary detail.",
      detailed: "Create a comprehensive summary that covers all major points and important details. Maintain structure and flow.",
      bullets: "Create a bullet-point summary with clear, scannable points. Group related items together.",
      executive: "Create an executive summary suitable for decision-makers. Focus on key findings, implications, and recommendations.",
      technical: "Create a technical summary preserving important technical details, terminology, and specifications.",
    };

    const systemPrompt = `You are an expert summarizer. ${styleInstructions[style] || styleInstructions.concise}

${maxLength ? `Target length: approximately ${maxLength} words.` : ""}
${focus ? `Focus area: ${focus}` : ""}

Create a clear, accurate summary that:
- Captures the main ideas and key points
- Maintains factual accuracy
- Uses clear, accessible language
- Preserves important context`;

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
          { role: "user", content: `Please summarize the following content:\n\n${content}` },
        ],
        temperature: 0.3,
        max_tokens: maxLength ? Math.min(maxLength * 2, 4096) : 2048,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Payment required. Please add funds to your Lovable AI workspace.");
      }
      const error = await response.text();
      throw new Error(`AI API error: ${error}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "";

    // Count words in summary
    const wordCount = summary.split(/\s+/).filter((w: string) => w.length > 0).length;
    const originalWordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;

    return new Response(
      JSON.stringify({
        success: true,
        summary: summary,
        style: style,
        wordCount: wordCount,
        originalWordCount: originalWordCount,
        compressionRatio: (wordCount / originalWordCount * 100).toFixed(1) + "%",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Summarize handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
