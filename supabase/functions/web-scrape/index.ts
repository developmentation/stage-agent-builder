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

    // Add exponential backoff delay before retry attempts
    if (retryCount > 0) {
      const delay = 2000 * Math.pow(2, retryCount - 1); // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok && retryCount < maxRetries) {
      console.log(`Retry ${retryCount + 1} for ${url} with fallback headers (status: ${response.status})`);
      return smartFetch(url, retryCount + 1);
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for SSL/certificate errors
    if (errorMessage.includes("certificate") || errorMessage.includes("UnknownIssuer") || errorMessage.includes("TLS")) {
      console.log(`SSL/Certificate error for ${url}: ${errorMessage}`);
      throw new Error(`SSL_CERT_ERROR: ${errorMessage}`);
    }
    
    // Check for network/connection errors
    if (errorMessage.includes("http2") || errorMessage.includes("stream error") || errorMessage.includes("SendRequest")) {
      console.log(`Network/HTTP2 error for ${url}: ${errorMessage}`);
      throw new Error(`NETWORK_ERROR: ${errorMessage}`);
    }
    
    if (retryCount < maxRetries) {
      console.log(`Retry ${retryCount + 1} for ${url} due to error: ${errorMessage}`);
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

// Helper function to detect DOC/DOCX URLs
const isDocUrl = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  return urlLower.endsWith('.doc') || urlLower.includes('.doc?') || 
         urlLower.endsWith('.docx') || urlLower.includes('.docx?');
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

    // Check if URL is a DOC/DOCX file
    if (isDocUrl(url)) {
      const domain = new URL(url).hostname;
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1].split('?')[0];
      const fileType = filename.toLowerCase().endsWith('.docx') ? 'DOCX' : 'DOC';
      
      console.log(`Detected ${fileType} file: ${url} - not supported for web scraping`);
      
      return new Response(
        JSON.stringify({
          success: true,
          url,
          title: `${fileType} Document: ${filename}`,
          content: `Microsoft Word Document (${fileType}): ${filename}\n\nDirect download link: ${url}\n\nNote: ${fileType} files cannot be automatically extracted from URLs. To process this document:\n1. Download the file from the link above\n2. Upload it directly using the file upload feature in your workflow\n\nThe file upload feature supports extracting text from both DOC and DOCX files.`,
          contentLength: 0,
          isDoc: true,
          fileType,
          accessedAt,
          unsupportedFormat: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if URL is a PDF
    const isPdf = isPdfUrl(url);
    
    // Fetch the URL once for both PDF and non-PDF
    let response;
    try {
      response = await smartFetch(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const domain = new URL(url).hostname;
      
      // Handle SSL certificate errors
      if (errorMessage.startsWith("SSL_CERT_ERROR:")) {
        console.log(`SSL Certificate error for ${url}`);
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `SSL Certificate Error: ${domain}`,
            content: `This website (${domain}) has an SSL certificate issue that prevents automated access.\n\nError: ${errorMessage.replace("SSL_CERT_ERROR: ", "")}\n\nTo access this content, please visit the URL directly in your browser: ${url}\n\nThis is often caused by expired certificates, self-signed certificates, or certificate authority issues.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            sslError: true,
            statusCode: 526
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Handle network errors
      if (errorMessage.startsWith("NETWORK_ERROR:")) {
        console.log(`Network error for ${url}`);
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Network Connection Error: ${domain}`,
            content: `A network connection error occurred while trying to reach ${domain}.\n\nError: ${errorMessage.replace("NETWORK_ERROR: ", "")}\n\nThis may be a temporary issue. Please try again later or visit the URL directly: ${url}\n\nThis can be caused by server configuration issues, network problems, or HTTP/2 protocol errors.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            networkError: true,
            statusCode: 502
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // For other errors, rethrow
      throw error;
    }

    if (!response.ok) {
      const domain = new URL(url).hostname;
      
      // Handle SSL/Certificate errors gracefully
      if ((response as any).sslError) {
        console.log(`SSL Certificate error for ${url}`);
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `SSL Certificate Error: ${domain}`,
            content: `This website (${domain}) has an SSL certificate issue that prevents automated access.\n\nError: ${(response as any).errorMessage}\n\nTo access this content, please visit the URL directly in your browser: ${url}\n\nThis is often caused by expired certificates, self-signed certificates, or certificate authority issues.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            sslError: true,
            statusCode: 526
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Handle network/HTTP2 errors gracefully
      if ((response as any).networkError) {
        console.log(`Network error for ${url}`);
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Network Connection Error: ${domain}`,
            content: `A network connection error occurred while trying to reach ${domain}.\n\nError: ${(response as any).errorMessage}\n\nThis may be a temporary issue. Please try again later or visit the URL directly: ${url}\n\nThis can be caused by server configuration issues, network problems, or HTTP/2 protocol errors.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            networkError: true,
            statusCode: 502
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Handle 429 Rate Limiting gracefully
      if (response.status === 429) {
        console.log(`429 Rate Limited for ${url} - too many requests`);
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Rate Limited: ${domain}`,
            content: `The website (${domain}) is rate limiting automated requests. Too many requests were made in a short period.\n\nTo access this content, please:\n1. Wait a few minutes before trying again\n2. Visit the URL directly: ${url}\n3. Reduce the number of simultaneous requests to this domain\n\nMost websites limit automated access to prevent server overload.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            rateLimited: true,
            statusCode: 429
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
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
