import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

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
  "Referer": "https://www.google.com/", // Add referer to appear more legitimate
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
    
    // Fetch the URL once for both PDF and non-PDF
    const response = await smartFetch(url);

    if (!response.ok) {
      const domain = new URL(url).hostname;
      
      // Handle 403 gracefully - return success with warning message so workflow continues
      if (response.status === 403) {
        console.log(`403 Forbidden for ${url} - site is blocking automated access`);
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Access Restricted: ${domain}`,
            content: `This website (${domain}) is blocking automated access. The content could not be retrieved automatically.\n\nTo access this content, please visit the URL directly: ${url}\n\nSome academic publishers and websites have anti-bot protection that prevents automated scraping.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            blocked: true,
            statusCode: 403
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Handle 404 gracefully - return success with warning message so workflow continues
      if (response.status === 404) {
        console.log(`404 Not Found for ${url} - page does not exist`);
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Page Not Found: ${domain}`,
            content: `The requested page could not be found at ${url}.\n\nThe URL may be incorrect, the page may have been moved or deleted, or the content may no longer be available.\n\nPlease verify the URL or try searching for the content on ${domain}.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            notFound: true,
            statusCode: 404
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // For other errors, return error response
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${response.statusText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isPdf) {
      console.log(`Detected PDF URL: ${url}`);
      
      const pdfBuffer = new Uint8Array(await response.arrayBuffer());
      
      // Check PDF size - skip processing if too large (> 5MB to avoid CPU limits)
      const maxPdfSize = 5 * 1024 * 1024; // 5MB
      if (pdfBuffer.length > maxPdfSize) {
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];
        const title = filename || "PDF Document";
        
        console.log(`PDF too large (${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB), skipping extraction`);
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title,
            content: `PDF Document: ${filename}\n\nPDF is too large for text extraction (${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB). Please download directly from: ${url}`,
            contentLength: 0,
            isPdf: true,
            accessedAt,
            skipped: true
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      try {
        console.log(`Attempting to extract text from PDF using unpdf...`);
        
        // Add timeout for PDF extraction to prevent CPU exhaustion
        const extractionTimeout = 20000; // 20 seconds max for PDF extraction
        const extractionPromise = (async () => {
          const pdf = await getDocumentProxy(pdfBuffer);
          const { text, totalPages } = await extractText(pdf, { mergePages: true });
          return { text, totalPages };
        })();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF extraction timeout')), extractionTimeout)
        );
        
        const { text, totalPages } = await Promise.race([extractionPromise, timeoutPromise]) as { text: string, totalPages: number };
        
        // Limit content to 100k characters to avoid memory issues
        const content = text.substring(0, 100000);
        const pageCount = totalPages;
        
        console.log(`Successfully extracted PDF text: ${pageCount} pages, ${content.length} characters`);
        
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];
        const title = filename || "PDF Document";
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title,
            content,
            contentLength: content.length,
            pageCount,
            isPdf: true,
            accessedAt,
            truncated: text.length > 100000
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error(`PDF extraction failed:`, error);
        
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];
        const title = filename || "PDF Document";
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title,
            content: `PDF Document: ${filename}\n\nText extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease download the PDF directly from: ${url}`,
            contentLength: 0,
            isPdf: true,
            accessedAt,
            error: error instanceof Error ? error.message : 'Unknown error'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
