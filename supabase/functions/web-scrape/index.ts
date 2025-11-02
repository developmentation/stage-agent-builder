import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Adaptive throttling - only throttle domains that have shown issues
const domainIssues = new Map<string, { lastError: number; errorType: string; count: number }>();
const domainLastRequest = new Map<string, number>();
const THROTTLE_WINDOW = 60000; // Reset throttling after 60s of no errors
const BASE_DELAY = 1000; // 1 second base delay for problematic domains

// Government domains that may have SSL issues but are trusted
const trustedGovernmentDomains = [
  'tpsgc-pwgsc.gc.ca',
  'gc.ca',
  'gov.ab.ca',
  'alberta.ca',
  'servicealberta.ca',
  'servicealberta.gov.ab.ca',
  'gov.bc.ca',
];

// Helper to get domain from URL
const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

// Helper to check if domain is trusted
const isTrustedDomain = (url: string): boolean => {
  const hostname = getDomain(url);
  return trustedGovernmentDomains.some(trusted => hostname.includes(trusted));
};

// Mark domain as having issues
const markDomainIssue = (domain: string, errorType: string) => {
  const existing = domainIssues.get(domain);
  if (existing) {
    domainIssues.set(domain, {
      lastError: Date.now(),
      errorType,
      count: existing.count + 1
    });
  } else {
    domainIssues.set(domain, {
      lastError: Date.now(),
      errorType,
      count: 1
    });
  }
  console.log(`Marked ${domain} as problematic (${errorType}), count: ${domainIssues.get(domain)?.count}`);
};

// Check if domain needs throttling
const shouldThrottleDomain = (domain: string): { throttle: boolean; delay: number } => {
  const issue = domainIssues.get(domain);
  
  if (!issue) {
    return { throttle: false, delay: 0 };
  }
  
  // Reset if issue is old
  if (Date.now() - issue.lastError > THROTTLE_WINDOW) {
    domainIssues.delete(domain);
    return { throttle: false, delay: 0 };
  }
  
  // Calculate delay based on error count (exponential backoff)
  const delay = Math.min(BASE_DELAY * Math.pow(2, issue.count - 1), 10000); // Max 10s
  return { throttle: true, delay };
};

// Adaptive throttle - only delays if domain has shown issues
const adaptiveThrottle = async (domain: string): Promise<void> => {
  const { throttle, delay } = shouldThrottleDomain(domain);
  
  if (!throttle) {
    return; // No throttling needed
  }
  
  const lastRequest = domainLastRequest.get(domain) || 0;
  const timeSinceLastRequest = Date.now() - lastRequest;
  
  if (timeSinceLastRequest < delay) {
    const waitTime = delay - timeSinceLastRequest;
    console.log(`Adaptive throttling ${domain}, waiting ${waitTime}ms due to previous issues`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  domainLastRequest.set(domain, Date.now());
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

// Smart fetch with retry logic and adaptive throttling
const smartFetch = async (
  url: string, 
  retryCount = 0,
  options: { returnHtml?: boolean; maxCharacters?: number } = {}
): Promise<Response> => {
  const maxRetries = 3;
  const domain = getDomain(url);
  
  // Apply adaptive throttle before request
  await adaptiveThrottle(domain);
  
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

    // Add delay for retries
    if (retryCount > 0) {
      const delay = 2000 * Math.pow(2, retryCount - 1); // 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const fetchOptions: RequestInit = {
      headers,
      redirect: "follow",
      signal: controller.signal,
    };

    const response = await fetch(url, fetchOptions);

    clearTimeout(timeout);

    // Handle rate limiting - mark domain and retry
    if (response.status === 429) {
      markDomainIssue(domain, 'rate_limit');
      
      if (retryCount < maxRetries) {
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        console.log(`Rate limited (429) for ${url}, waiting ${waitTime}ms before retry ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return smartFetch(url, retryCount + 1, options);
      }
    }

    if (!response.ok && retryCount < maxRetries) {
      console.log(`Retry ${retryCount + 1} for ${url} with fallback headers (status: ${response.status})`);
      return smartFetch(url, retryCount + 1, options);
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for SSL/certificate errors on trusted domains
    if (errorMessage.includes("certificate") || errorMessage.includes("UnknownIssuer") || errorMessage.includes("TLS")) {
      console.log(`SSL/Certificate error for ${url}: ${errorMessage}`);
      
      if (isTrustedDomain(url) && retryCount === 0) {
        console.log(`Retrying trusted government domain ${domain} with relaxed SSL validation`);
        return smartFetch(url, retryCount + 1, options);
      }
      
      throw new Error(`SSL_CERT_ERROR: ${errorMessage}`);
    }
    
    // Check for connection reset errors - mark domain and retry
    if (errorMessage.includes("Connection reset by peer") || errorMessage.includes("os error 104")) {
      markDomainIssue(domain, 'connection_reset');
      console.log(`Connection reset error for ${url}: ${errorMessage}`);
      
      if (retryCount < maxRetries) {
        const delay = 3000 * Math.pow(2, retryCount); // 3s, 6s, 12s
        console.log(`Connection reset, waiting ${delay}ms before retry ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return smartFetch(url, retryCount + 1, options);
      }
      
      throw new Error(`CONNECTION_RESET: ${errorMessage}`);
    }
    
    // Check for network/connection errors
    if (errorMessage.includes("http2") || errorMessage.includes("stream error") || errorMessage.includes("SendRequest")) {
      console.log(`Network/HTTP2 error for ${url}: ${errorMessage}`);
      throw new Error(`NETWORK_ERROR: ${errorMessage}`);
    }
    
    if (retryCount < maxRetries) {
      console.log(`Retry ${retryCount + 1} for ${url} due to error: ${errorMessage}`);
      return smartFetch(url, retryCount + 1, options);
    }
    throw error;
  }
};

// Helper function to detect PDF URLs
const isPdfUrl = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  return urlLower.endsWith('.pdf') || urlLower.includes('.pdf?');
};

// Helper function to detect DOCX URLs
const isDocxUrl = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  return urlLower.endsWith('.docx') || urlLower.includes('.docx?');
};

// Helper function to check if URL is an unsupported file type
const isUnsupportedFileType = (url: string): { isUnsupported: boolean; fileType: string; extension: string } => {
  const urlLower = url.toLowerCase();
  const urlPath = urlLower.split('?')[0];
  const parts = urlPath.split('.');
  const extension = parts.length > 1 ? parts[parts.length - 1] : '';
  
  // Old Word format - unsupported
  if (extension === 'doc') {
    return { isUnsupported: true, fileType: 'Microsoft Word Document (DOC)', extension: 'doc' };
  }
  
  // Other Office formats - unsupported
  if (['xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
    return { isUnsupported: true, fileType: 'Microsoft Office Document', extension };
  }
  
  // Archive formats - unsupported
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return { isUnsupported: true, fileType: 'Archive File', extension };
  }
  
  // Image formats - unsupported
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(extension)) {
    return { isUnsupported: true, fileType: 'Image File', extension };
  }
  
  // Video/Audio formats - unsupported
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mp3', 'wav', 'ogg', 'm4a'].includes(extension)) {
    return { isUnsupported: true, fileType: 'Media File', extension };
  }
  
  // Executable/Binary formats - unsupported
  if (['exe', 'dll', 'so', 'dylib', 'bin'].includes(extension)) {
    return { isUnsupported: true, fileType: 'Binary/Executable File', extension };
  }
  
  return { isUnsupported: false, fileType: '', extension };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, returnHtml, maxCharacters } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Scraping URL: ${url}, returnHtml: ${returnHtml}`);

    // Capture access timestamp
    const accessedAt = new Date().toISOString();

    // Check if file type is unsupported
    const unsupportedCheck = isUnsupportedFileType(url);
    
    if (unsupportedCheck.isUnsupported) {
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1].split('?')[0];
      const ext = unsupportedCheck.extension.toUpperCase();
      
      console.log(`Detected unsupported file type: ${ext} - ${url}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          url,
          title: `Unsupported File: ${filename}`,
          content: `${unsupportedCheck.fileType} (${ext}): ${filename}\n\nDirect link: ${url}\n\nThis file type cannot be automatically processed from a URL.\n\nSupported formats for web scraping:\n- Web pages (HTML)\n- PDF documents\n- DOCX documents\n- Text-based files\n\nFor other file types, please download manually and upload directly if the format is supported.`,
          contentLength: 0,
          fileType: unsupportedCheck.fileType,
          extension: unsupportedCheck.extension,
          accessedAt,
          unsupportedFormat: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if URL is a DOCX
    const isDocx = isDocxUrl(url);
    
    // Check if URL is a PDF
    const isPdf = isPdfUrl(url);
    
    // Fetch the URL once for both PDF and non-PDF
    let response;
    try {
      response = await smartFetch(url, 0, { returnHtml, maxCharacters });
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
      
      // Handle connection reset errors
      if (errorMessage.startsWith("CONNECTION_RESET:")) {
        console.log(`Connection reset error for ${url}`);
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Connection Reset: ${domain}`,
            content: `The server at ${domain} reset the connection while trying to access this resource.\n\nDirect link: ${url}\n\nThis typically means:\n- The server is actively blocking automated access\n- The server is experiencing technical issues\n- The resource is temporarily unavailable\n- Rate limiting or security measures are in place\n\nSuggestions:\n1. Try accessing the URL directly in your browser: ${url}\n2. Wait a few minutes and try again\n3. If this is a file, try downloading it manually and uploading it directly\n4. Contact the website administrator if the issue persists`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            connectionReset: true,
            statusCode: 502
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
      
      // Handle redirect responses (3xx) that weren't followed
      if (response.status >= 300 && response.status < 400) {
        console.log(`Redirect response ${response.status} for ${url}`);
        const redirectLocation = response.headers.get('location');
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Redirect: ${domain}`,
            content: `This URL redirects to another location${redirectLocation ? `: ${redirectLocation}` : ''}.\n\nOriginal URL: ${url}\n\nThe content could not be retrieved automatically. Please try:\n1. Visiting the URL directly in your browser\n2. Using the final destination URL if known\n3. Checking if the resource has moved permanently`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            redirect: true,
            statusCode: response.status
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
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
      
      // Handle 503, 502, 504 gracefully - return success with warning message so workflow continues
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        const statusText = response.status === 503 ? 'Service Unavailable' : 
                          response.status === 502 ? 'Bad Gateway' : 'Gateway Timeout';
        console.log(`${response.status} ${statusText} for ${url} - server is temporarily unavailable`);
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title: `Service Unavailable: ${domain}`,
            content: `The website at ${url} is temporarily unavailable (${response.status} ${statusText}).\n\nThis typically means:\n- The server is overloaded or down for maintenance\n- There are temporary network issues\n- The service is experiencing high traffic\n\nThe content could not be retrieved at this time. Please try again later.`,
            contentLength: 0,
            accessedAt: new Date().toISOString(),
            serviceUnavailable: true,
            statusCode: response.status
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
        
        // Apply character limit based on config or default to 100k to avoid memory issues
        const charLimit = maxCharacters || 100000;
        const content = text.substring(0, charLimit);
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
            truncated: text.length > charLimit,
            originalLength: text.length
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

    if (isDocx) {
      console.log(`Detected DOCX URL: ${url}`);
      
      const docxBuffer = new Uint8Array(await response.arrayBuffer());
      
      try {
        console.log(`Attempting to extract text from DOCX using mammoth...`);
        
        // Dynamic import of mammoth
        const mammoth = await import("https://esm.sh/mammoth@1.11.0");
        
        const result = await mammoth.extractRawText({ arrayBuffer: docxBuffer.buffer });
        let content = result.value.trim();
        const originalLength = content.length;
        
        // Apply character limit if specified
        if (maxCharacters && content.length > maxCharacters) {
          content = content.substring(0, maxCharacters);
        }
        
        console.log(`Successfully extracted DOCX text: ${content.length} characters`);
        
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];
        const title = filename || "DOCX Document";
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title,
            content,
            contentLength: content.length,
            isDocx: true,
            accessedAt,
            truncated: maxCharacters && originalLength > maxCharacters,
            originalLength
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error(`DOCX extraction failed:`, error);
        
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1].split('?')[0];
        const title = filename || "DOCX Document";
        
        return new Response(
          JSON.stringify({
            success: true,
            url,
            title,
            content: `DOCX Document: ${filename}\n\nText extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease download the DOCX directly from: ${url}`,
            contentLength: 0,
            isDocx: true,
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
    let originalLength: number;
    
    if (returnHtml) {
      // Return raw HTML
      originalLength = html.length;
      content = maxCharacters && html.length > maxCharacters 
        ? html.substring(0, maxCharacters) 
        : html;
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

      originalLength = textContent.length;
      // Apply character limit (default 5000 if not specified)
      const charLimit = maxCharacters || 5000;
      textContent = textContent.substring(0, charLimit);
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
        accessedAt,
        truncated: maxCharacters && originalLength > maxCharacters,
        originalLength
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
