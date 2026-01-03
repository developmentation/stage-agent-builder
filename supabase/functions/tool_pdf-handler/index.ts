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
    const { action, fileData, pages, dpi = 150 } = await req.json();

    if (!fileData) {
      throw new Error("fileData is required (base64 encoded PDF file)");
    }

    let result: any;

    switch (action) {
      case "info":
        // Get PDF info - page count, etc.
        // This is a simplified implementation - full PDF parsing would require a proper library
        result = await getPdfInfo(fileData);
        break;

      case "rasterize":
        // Convert PDF pages to images
        // Note: Full PDF rasterization requires external services or complex libraries
        // This implementation provides a structured response for frontend handling
        result = await rasterizePdf(fileData, pages, dpi);
        break;

      case "extract_text":
        // Extract text from PDF
        result = await extractPdfText(fileData, pages);
        break;

      default:
        throw new Error(`Unknown action: ${action}. Use 'info', 'rasterize', or 'extract_text'`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("PDF handler error:", error);
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

async function getPdfInfo(fileData: string): Promise<any> {
  // Decode base64
  const binaryString = atob(fileData);
  
  // Check PDF signature
  if (!binaryString.startsWith("%PDF")) {
    throw new Error("Invalid PDF file - missing PDF header");
  }

  // Simple page count estimation by counting "/Type /Page" occurrences
  // This is approximate - proper parsing requires a PDF library
  const pageMatches = binaryString.match(/\/Type\s*\/Page[^s]/g);
  const estimatedPages = pageMatches ? pageMatches.length : 1;

  // Extract PDF version
  const versionMatch = binaryString.match(/%PDF-(\d+\.\d+)/);
  const version = versionMatch ? versionMatch[1] : "unknown";

  return {
    success: true,
    version: version,
    estimatedPageCount: estimatedPages,
    sizeBytes: binaryString.length,
    hasEncryption: binaryString.includes("/Encrypt"),
  };
}

async function rasterizePdf(
  fileData: string,
  pages: number[] | null,
  dpi: number
): Promise<any> {
  // Full PDF rasterization requires external services (like pdf.js in browser or ImageMagick)
  // This implementation indicates the operation should be done client-side with pdf.js
  
  const info = await getPdfInfo(fileData);
  
  // Determine which pages to process
  const pageList = pages && pages.length > 0 
    ? pages 
    : Array.from({ length: info.estimatedPageCount }, (_, i) => i + 1);

  return {
    success: true,
    message: "PDF rasterization should be performed client-side using pdf.js for better performance",
    requestedPages: pageList,
    requestedDpi: dpi,
    estimatedTotalPages: info.estimatedPageCount,
    clientSideRequired: true,
    // Return the file data so client can process it
    fileData: fileData,
  };
}

async function extractPdfText(
  fileData: string,
  pages: number[] | null
): Promise<any> {
  // Basic text extraction - looks for text streams in PDF
  // Full extraction requires a proper PDF parsing library
  
  const binaryString = atob(fileData);
  
  // Simple extraction of visible text patterns
  // This is very basic and won't handle all PDFs correctly
  const textMatches: string[] = [];
  
  // Look for text in parentheses (PDF text objects)
  const textRegex = /\(([^)]+)\)/g;
  let match;
  while ((match = textRegex.exec(binaryString)) !== null) {
    const text = match[1];
    // Filter out binary/control characters
    if (/^[\x20-\x7E\s]+$/.test(text) && text.length > 1) {
      textMatches.push(text);
    }
  }

  // Also look for hex-encoded text
  const hexTextRegex = /<([0-9A-Fa-f]+)>/g;
  while ((match = hexTextRegex.exec(binaryString)) !== null) {
    try {
      const hex = match[1];
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) {
        const charCode = parseInt(hex.substr(i, 2), 16);
        if (charCode >= 32 && charCode <= 126) {
          decoded += String.fromCharCode(charCode);
        }
      }
      if (decoded.length > 1) {
        textMatches.push(decoded);
      }
    } catch (e) {
      // Ignore hex decode errors
    }
  }

  const extractedText = textMatches.join(" ").replace(/\s+/g, " ").trim();

  return {
    success: true,
    extractedText: extractedText.substring(0, 50000), // Limit output size
    textLength: extractedText.length,
    note: "Basic extraction - for complex PDFs, use client-side pdf.js or external OCR service",
    fullExtractionRecommended: extractedText.length < 100,
  };
}
