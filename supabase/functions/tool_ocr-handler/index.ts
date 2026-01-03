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
    const { imageSource, language = "en" } = await req.json();

    if (!imageSource) {
      throw new Error("imageSource is required (base64 data, URL, or file ID)");
    }

    // Get the image data
    let imageData: string;
    let mimeType: string;

    if (imageSource.startsWith("data:")) {
      // Data URI
      const match = imageSource.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URI format");
      }
      mimeType = match[1];
      imageData = match[2];
    } else if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
      // URL - fetch the image
      const response = await fetch(imageSource);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      mimeType = response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    } else {
      // Assume it's already base64 data
      imageData = imageSource;
      mimeType = "image/png"; // Default assumption
    }

    // Use Google Cloud Vision API if available, otherwise use Gemini for OCR
    const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    let result: any;

    if (GOOGLE_VISION_API_KEY) {
      // Use Google Cloud Vision API
      result = await performGoogleVisionOCR(imageData, GOOGLE_VISION_API_KEY, language);
    } else if (GEMINI_API_KEY) {
      // Use Gemini for OCR (vision capabilities)
      result = await performGeminiOCR(imageData, mimeType, GEMINI_API_KEY);
    } else {
      throw new Error("No OCR service configured. Set GOOGLE_VISION_API_KEY or GEMINI_API_KEY");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("OCR handler error:", error);
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

async function performGoogleVisionOCR(
  imageData: string,
  apiKey: string,
  language: string
): Promise<any> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: imageData,
            },
            features: [
              {
                type: "TEXT_DETECTION",
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: [language],
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Vision API error: ${error}`);
  }

  const data = await response.json();
  const textAnnotations = data.responses?.[0]?.textAnnotations;

  if (!textAnnotations || textAnnotations.length === 0) {
    return {
      success: true,
      text: "",
      confidence: 0,
      language: language,
      words: [],
      message: "No text detected in image",
    };
  }

  // First annotation contains the full text
  const fullText = textAnnotations[0]?.description || "";
  const detectedLanguage = textAnnotations[0]?.locale || language;

  // Get word-level annotations
  const words = textAnnotations.slice(1).map((annotation: any) => ({
    text: annotation.description,
    boundingBox: annotation.boundingPoly?.vertices,
  }));

  return {
    success: true,
    text: fullText,
    confidence: 0.95, // Google Vision doesn't always return confidence
    language: detectedLanguage,
    words: words,
    wordCount: words.length,
  };
}

async function performGeminiOCR(
  imageData: string,
  mimeType: string,
  apiKey: string
): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Extract all text from this image. Return ONLY the extracted text, nothing else. Preserve the original formatting and line breaks as much as possible.",
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    success: true,
    text: text.trim(),
    confidence: 0.85, // Estimated confidence for Gemini OCR
    language: "detected",
    method: "gemini-vision",
    note: "Text extracted using Gemini vision model",
  };
}
