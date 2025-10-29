import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as pdfjsLib from "npm:pdfjs-dist@5.4.296";

// Configure PDF.js worker for Deno using npm: specifier
pdfjsLib.GlobalWorkerOptions.workerSrc = "npm:pdfjs-dist@5.4.296/build/pdf.worker.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rotating User-Agents to avoid detection
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

const getRandomUserAgent = () => {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

// Modern browser headers with Client Hints
const getModernHeaders = () => ({
  "User-Agent": getRandomUserAgent(),
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "DNT": "1",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Sec-CH-UA": '"Not_A Brand";v="8", "Chromium";v="120"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
  "Cache-Control": "max-age=0",
});

// Smart fetch with retry logic
const smartFetch = async (url: string, retryCount = 0): Promise<Response> => {
  const maxRetries = 3;
  
  let headers: Record<string, string>;
  if (retryCount === 0) {
    headers = getModernHeaders();
  } else if (retryCount === 1) {
    headers = {
      "User-Agent": getRandomUserAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    };
  } else {
    headers = {
      "User-Agent": getRandomUserAgent(),
      "Accept": "*/*",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok && retryCount < maxRetries) {
      console.log(`Retry ${retryCount + 1} for ${url} with fallback headers`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
      return smartFetch(url, retryCount + 1);
    }

    return response;
  } catch (error) {
    if (retryCount < maxRetries) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.log(`Retry ${retryCount + 1} for ${url} due to error: ${errorMessage}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return smartFetch(url, retryCount + 1);
    }
    throw error;
  }
};

// Helper function to detect PDF URLs
const isPdfUrl = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  return urlLower.endsWith('.pdf') || urlLower.includes('.pdf?');
};

// Helper function to extract text from PDF
const extractPdfText = async (arrayBuffer: ArrayBuffer): Promise<{ content: string; pageCount: number }> => {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent({
      includeMarkedContent: true
    });
    
    if (i > 1) {
      fullText += `\n\n--- Page ${i} ---\n\n`;
    }
    
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ')
      .trim();
    
    if (pageText) {
      fullText += pageText;
    }
  }
  
  return {
    content: fullText.trim(),
    pageCount: pdf.numPages
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, returnHtml } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Scraping URL: ${url}, returnHtml: ${returnHtml}`);

    // Capture access timestamp
    const accessedAt = new Date().toISOString();

    // Check if URL is a PDF
    const isPdf = isPdfUrl(url);
    
    if (isPdf) {
      console.log(`Detected PDF URL: ${url}`);
      
      // Fetch PDF as binary
      const response = await smartFetch(url);
      
      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch PDF: ${response.statusText}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify Content-Type
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('pdf')) {
        console.log(`Warning: Expected PDF but got content-type: ${contentType}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      try {
        const { content, pageCount } = await extractPdfText(arrayBuffer);
        
        // Extract filename from URL for title
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];
        const title = filename || "PDF Document";
        
        console.log(`Successfully extracted text from PDF: ${pageCount} pages, ${content.length} characters`);
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title,
            content,
            contentLength: content.length,
            pageCount,
            isPdf: true,
            accessedAt
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (pdfError) {
        console.error(`Error parsing PDF:`, pdfError);
        return new Response(
          JSON.stringify({
            error: `Failed to parse PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Use smart fetch with retry logic for non-PDF URLs
    const response = await smartFetch(url);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${response.statusText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "No title found";

    let content: string;
    
    if (returnHtml) {
      // Return raw HTML
      content = html;
      console.log(`Successfully scraped ${url}: ${content.length} characters (HTML)`);
    } else {
      // Simple HTML parsing - extract text content
      // Remove script and style tags
      let textContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ") // Remove HTML tags
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      // Limit to first 5000 characters
      textContent = textContent.substring(0, 5000);
      content = textContent;
      console.log(`Successfully scraped ${url}: ${content.length} characters (text)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        url,
        title,
        content,
        contentLength: content.length,
        accessedAt
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in web-scrape function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
