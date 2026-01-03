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
    const { content, analysisType = "general", questions } = await req.json();

    if (!content) {
      throw new Error("content is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const analysisInstructions: Record<string, string> = {
      general: "Perform a general analysis identifying key themes, patterns, and insights.",
      sentiment: "Analyze the sentiment, tone, and emotional content. Identify positive, negative, and neutral elements.",
      structure: "Analyze the structure, organization, and flow of the content.",
      argument: "Analyze the arguments presented, identifying claims, evidence, and logical structure.",
      comparison: "Compare and contrast different elements, perspectives, or options mentioned.",
      swot: "Perform a SWOT analysis identifying Strengths, Weaknesses, Opportunities, and Threats.",
      stakeholder: "Identify stakeholders, their interests, and potential impacts.",
    };

    let userPrompt = `Analyze the following content:\n\n${content}`;
    
    if (questions && Array.isArray(questions) && questions.length > 0) {
      userPrompt += `\n\nSpecifically address these questions:\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`;
    }

    const systemPrompt = `You are an expert analyst. ${analysisInstructions[analysisType] || analysisInstructions.general}

Provide a structured analysis that:
- Identifies key elements and patterns
- Draws meaningful insights
- Supports conclusions with evidence from the content
- Highlights important considerations
- Notes any limitations or areas of uncertainty

Format your response clearly with sections and bullet points where appropriate.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 4096,
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
    const analysis = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysis,
        analysisType: analysisType,
        questionsAddressed: questions?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Analyze handler error:", error);
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
