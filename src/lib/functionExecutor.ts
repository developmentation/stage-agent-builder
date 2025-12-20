import type { FunctionNode } from "@/types/workflow";
import type { FunctionExecutionResult, MemoryEntry } from "@/types/functions";
import { MarkdownProcessor } from "@/utils/markdownProcessor";

// Memory storage (in-memory for now, could be moved to localStorage or DB)
const memoryStore = new Map<string, MemoryEntry[]>();

export class FunctionExecutor {
  static async execute(
    functionNode: FunctionNode,
    input: string
  ): Promise<FunctionExecutionResult> {
    try {
      switch (functionNode.functionType) {
        case "string_contains":
          return this.executeStringContains(functionNode, input);
        
        case "string_concat":
          return this.executeStringConcat(functionNode, input);
        
        case "string_replace":
          return this.executeStringReplace(functionNode, input);
        
        case "string_split":
          return this.executeStringSplit(functionNode, input);
        
        case "is_json":
          return this.executeIsJSON(functionNode, input);
        
        case "is_empty":
          return this.executeIsEmpty(functionNode, input);
        
        case "is_url":
          return this.executeIsURL(functionNode, input);
        
        case "if_else":
          return this.executeIfElse(functionNode, input);
        
        case "memory":
          return this.executeMemory(functionNode, input);
        
        case "export_markdown":
          return this.executeExportMarkdown(functionNode, input);
        
        case "export_json":
          return this.executeExportJSON(functionNode, input);
        
        case "export_text":
          return this.executeExportText(functionNode, input);
        
        case "export_pdf":
          return await this.executeExportPDF(functionNode, input);
        
        case "export_word":
          return await this.executeExportWord(functionNode, input);
        
        case "extract_urls":
          return this.executeExtractURLs(functionNode, input);
        
        case "google_search":
          return await this.executeGoogleSearch(functionNode, input);
        
        case "brave_search":
          return await this.executeBraveSearch(functionNode, input);
        
        case "web_scrape":
          return await this.executeWebScrape(functionNode, input);
        
        case "api_call":
          return await this.executeAPICall(functionNode, input);
        
        case "parse_json":
          return this.executeParseJSON(functionNode, input);
        
      case "format_json":
        return this.executeFormatJSON(functionNode, input);
      
      case "content":
        return this.executeContent(functionNode, input);
      
      case "image_generation":
        return await this.executeImageGeneration(functionNode, input);
      
      case "text_to_speech":
        return await this.executeTextToSpeech(functionNode, input);
      
      case "send_email":
        return await this.executeSendEmail(functionNode, input);
      
      case "github_files":
        return await this.executeGitHubFiles(functionNode, input);
      
      case "logic_gate":
        return this.executeLogicGate(functionNode, input);
      
      default:
        return {
          success: false,
          outputs: {},
          error: `Unknown function type: ${functionNode.functionType}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      outputs: {},
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

  // String Operations
  private static executeStringContains(node: FunctionNode, input: string): FunctionExecutionResult {
    const searchText = node.config.searchText || "";
    const caseSensitive = node.config.caseSensitive || false;
    
    const haystack = caseSensitive ? input : input.toLowerCase();
    const needle = caseSensitive ? searchText : searchText.toLowerCase();
    
    const contains = haystack.includes(needle);
    
    return {
      success: true,
      outputs: contains 
        ? { "true": input, "false": "" }
        : { "true": "", "false": input },
    };
  }

  private static executeStringConcat(node: FunctionNode, input: string): FunctionExecutionResult {
    const separator = node.config.separator || " ";
    // For now, just return the input (will be enhanced when multiple inputs are supported)
    return {
      success: true,
      outputs: { output: input },
    };
  }

  private static executeStringReplace(node: FunctionNode, input: string): FunctionExecutionResult {
    const find = node.config.find || "";
    const replace = node.config.replace || "";
    
    const result = input.split(find).join(replace);
    
    return {
      success: true,
      outputs: { output: result },
    };
  }

  private static executeStringSplit(node: FunctionNode, input: string): FunctionExecutionResult {
    const delimiter = node.config.delimiter || ",";
    const parts = input.split(delimiter);
    const outputCount = node.outputCount || 1;
    
    // Create outputs for each port
    const outputs: Record<string, string> = {};
    for (let i = 1; i <= outputCount; i++) {
      const portName = `output_${i}`;
      outputs[portName] = parts[i - 1]?.trim() || "";
    }
    
    return {
      success: true,
      outputs,
    };
  }

  // Logic Functions
  private static executeIsJSON(node: FunctionNode, input: string): FunctionExecutionResult {
    try {
      JSON.parse(input);
      return {
        success: true,
        outputs: { "true": input, "false": "" },
      };
    } catch {
      return {
        success: true,
        outputs: { "true": "", "false": input },
      };
    }
  }

  private static executeIsEmpty(node: FunctionNode, input: string): FunctionExecutionResult {
    const isEmpty = input.trim() === "";
    return {
      success: true,
      outputs: isEmpty 
        ? { "true": input, "false": "" }
        : { "true": "", "false": input },
    };
  }

  private static executeIsURL(node: FunctionNode, input: string): FunctionExecutionResult {
    try {
      new URL(input.trim());
      return {
        success: true,
        outputs: { "true": input, "false": "" },
      };
    } catch {
      return {
        success: true,
        outputs: { "true": "", "false": input },
      };
    }
  }

  // Conditional
  private static executeIfElse(node: FunctionNode, input: string): FunctionExecutionResult {
    const condition = node.config.condition || "";
    
    // Simple condition evaluation (can be enhanced)
    const conditionMet = input.toLowerCase().includes(condition.toLowerCase());
    
    return {
      success: true,
      outputs: conditionMet
        ? { "true": input, "false": "" }
        : { "true": "", "false": input },
    };
  }

  // Memory
  private static executeMemory(node: FunctionNode, input: string): FunctionExecutionResult {
    const memoryKey = node.config.memoryKey || "default";
    const runId = Date.now().toString();
    
    const entry: MemoryEntry = {
      timestamp: Date.now(),
      input,
      output: input,
      runId,
    };
    
    if (!memoryStore.has(memoryKey)) {
      memoryStore.set(memoryKey, []);
    }
    
    memoryStore.get(memoryKey)!.push(entry);
    
    // Get all memory entries and concatenate them
    const allEntries = memoryStore.get(memoryKey)!;
    const concatenatedOutput = allEntries
      .map(e => e.output)
      .join("\n\n---\n\n");
    
    return {
      success: true,
      outputs: { output: concatenatedOutput },
    };
  }

  // Get memory entries for viewing
  static getMemoryEntries(memoryKey: string): MemoryEntry[] {
    return memoryStore.get(memoryKey) || [];
  }

  // Clear memory
  static clearMemory(memoryKey: string): void {
    memoryStore.delete(memoryKey);
  }

  // Export Functions
  private static executeExportMarkdown(node: FunctionNode, input: string): FunctionExecutionResult {
    const filename = node.config.filename || "export.md";
    
    // Trigger download
    const blob = new Blob([input], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      outputs: { output: `Exported to ${filename}` },
    };
  }

  private static executeExportJSON(node: FunctionNode, input: string): FunctionExecutionResult {
    const filename = node.config.filename || "export.json";
    const pretty = node.config.pretty !== false;
    
    let jsonContent: string;
    try {
      const parsed = JSON.parse(input);
      jsonContent = pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
    } catch {
      // If not valid JSON, wrap in quotes
      jsonContent = JSON.stringify(input);
    }
    
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      outputs: { output: `Exported to ${filename}` },
    };
  }

  private static executeExportText(node: FunctionNode, input: string): FunctionExecutionResult {
    const filename = node.config.filename || "export.txt";
    
    const blob = new Blob([input], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      outputs: { output: `Exported to ${filename}` },
    };
  }

  private static async executeExportPDF(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      const filename = node.config.filename || "export.pdf";
      const title = node.config.title || "Document";
      
      const processor = new MarkdownProcessor();
      const sections = [{ title: "Content", value: input }];
      const pdf = processor.generatePDF(title, sections);
      
      pdf.save(filename);
      
      return {
        success: true,
        outputs: { output: `Exported to ${filename}` },
      };
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: error instanceof Error ? error.message : "PDF export failed",
      };
    }
  }

  private static async executeExportWord(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      const filename = node.config.filename || "export.docx";
      const title = node.config.title || "Document";
      
      const processor = new MarkdownProcessor();
      const sections = [{ title: "Content", value: input }];
      const blob = await processor.generateWordDocument(title, sections);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return {
        success: true,
        outputs: { output: `Exported to ${filename}` },
      };
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: error instanceof Error ? error.message : "Word export failed",
      };
    }
  }

  // URL Operations
  private static executeExtractURLs(node: FunctionNode, input: string): FunctionExecutionResult {
    const unique = node.config.unique !== false;
    
    // URL regex pattern
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const matches = input.match(urlPattern) || [];
    
    const urls = unique ? [...new Set(matches)] : [...matches];
    
    return {
      success: true,
      outputs: { output: urls.join("\n") },
    };
  }

  // Data Transformation
  private static executeParseJSON(node: FunctionNode, input: string): FunctionExecutionResult {
    try {
      const parsed = JSON.parse(input);
      const extractPath = node.config.extractPath;
      
      let result = parsed;
      if (extractPath) {
        // Parse the full path including array notation
        // Split on dots but keep track of array brackets
        let currentResult = result;
        let path = extractPath;
        let isWildcardArray = false;
        
        while (path.length > 0) {
          // Check for array notation at the start of remaining path
          const arrayMatch = path.match(/^([^\.\[]+)\[(\d*)\](\.(.*))?$/);
          const propertyMatch = path.match(/^([^\.\[]+)(\.(.*))?$/);
          
          if (arrayMatch) {
            const [, arrayName, index, , remaining] = arrayMatch;
            
            // Access the array property
            currentResult = currentResult[arrayName];
            
            if (!Array.isArray(currentResult)) {
              throw new Error(`${arrayName} is not an array`);
            }
            
            // Handle wildcard [] - need to extract from all items
            if (index === '') {
              isWildcardArray = true;
              
              if (remaining) {
                // There's more path after the wildcard - extract that property from each item
                currentResult = currentResult.map(item => {
                  let value = item;
                  let subPath = remaining;
                  
                  // Process the remaining path for each array item
                  while (subPath.length > 0) {
                    const subArrayMatch = subPath.match(/^([^\.\[]+)\[(\d+)\](\.(.*))?$/);
                    const subPropertyMatch = subPath.match(/^([^\.\[]+)(\.(.*))?$/);
                    
                    if (subArrayMatch) {
                      const [, subArrayName, subIndex, , subRemaining] = subArrayMatch;
                      value = value?.[subArrayName]?.[parseInt(subIndex, 10)];
                      subPath = subRemaining || '';
                    } else if (subPropertyMatch) {
                      const [, propName, , subRemaining] = subPropertyMatch;
                      value = value?.[propName];
                      subPath = subRemaining || '';
                    } else {
                      break;
                    }
                  }
                  
                  return value;
                }).filter(v => v !== undefined && v !== null);
                
                // Convert objects to JSON strings, keep primitives as-is
                const formattedResults = currentResult.map(item => {
                  if (typeof item === 'object' && item !== null) {
                    return JSON.stringify(item);
                  }
                  return String(item);
                });
                
                // Return as comma-space delimited string
                return {
                  success: true,
                  outputs: { output: formattedResults.join(', ') },
                };
              } else {
                // No remaining path after wildcard - return the array as JSON
                return {
                  success: true,
                  outputs: { output: JSON.stringify(currentResult, null, 2) },
                };
              }
            } else {
              // Specific index
              const idx = parseInt(index, 10);
              if (idx < 0 || idx >= currentResult.length) {
                throw new Error(`Array index ${idx} out of bounds`);
              }
              currentResult = currentResult[idx];
            }
            
            path = remaining || '';
          } else if (propertyMatch) {
            const [, propName, , remaining] = propertyMatch;
            
            currentResult = currentResult[propName];
            
            if (currentResult === undefined) {
              throw new Error(`Path not found: ${propName}`);
            }
            
            path = remaining || '';
          } else {
            throw new Error(`Invalid path syntax: ${path}`);
          }
        }
        
        result = currentResult;
      }
      
      // If result is a string or primitive, return it directly
      if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
        return {
          success: true,
          outputs: { output: String(result) },
        };
      }
      
      return {
        success: true,
        outputs: { output: JSON.stringify(result, null, 2) },
      };
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: `Error: ${error instanceof Error ? error.message : "Invalid JSON"}`,
      };
    }
  }

  private static executeFormatJSON(node: FunctionNode, input: string): FunctionExecutionResult {
    try {
      const parsed = JSON.parse(input);
      const formatted = JSON.stringify(parsed, null, 2);
      
      return {
        success: true,
        outputs: { output: formatted },
      };
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: "Invalid JSON",
      };
    }
  }

  // Content Function
  private static executeContent(node: FunctionNode, input: string): FunctionExecutionResult {
    // Output the configured content + input value concatenated
    const content = node.config.content || "";
    const output = content + input;
    
    return {
      success: true,
      outputs: { output: output },
    };
  }

  // Image Generation (Nano Banana)
  private static async executeImageGeneration(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      // Use override prompt if provided, otherwise use input
      const prompt = node.config.overridePrompt || input;
      
      if (!prompt) {
        throw new Error("Image prompt is required (provide via connection or override)");
      }
      
      const model = node.config.model || "gemini-2.5-flash-image";
      
      console.log(`Generating image with model: ${model}, prompt: ${prompt.substring(0, 50)}...`);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-nano`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, model }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Image generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.imageUrl) {
        throw new Error("No image generated");
      }

      // Return both the image URL and metadata
      return {
        success: true,
        outputs: { output: data.imageUrl },
        imageOutput: data.imageUrl,
      };
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "Image generation failed",
      };
    }
  }

  // Text to Speech (ElevenLabs)
  private static async executeTextToSpeech(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      const voiceId = node.config.voiceId;
      
      if (!voiceId) {
        throw new Error("Voice ID is required - please select a voice");
      }
      
      const text = input;
      if (!text) {
        throw new Error("Text is required for speech generation");
      }
      
      const model = node.config.model || "eleven_multilingual_v2";
      
      console.log(`Generating speech with voice: ${voiceId}, model: ${model}`);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, voice_id: voiceId, model_id: model }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `TTS failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.audioContent) {
        throw new Error("No audio generated");
      }

      const audioUrl = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioContent}`;

      return {
        success: true,
        outputs: { output: audioUrl },
        audioOutput: audioUrl,
      };
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "TTS failed",
      };
    }
  }

  // Google Search
  private static async executeGoogleSearch(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      // Check for override query first, otherwise use input from connections
      const rawQuery = node.config.overrideQuery ? String(node.config.overrideQuery) : input;
      const searchQuery = rawQuery
        .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
        .replace(/\s+/g, ' ')       // Collapse multiple spaces
        .trim();                     // Trim leading/trailing
      
      if (!searchQuery) {
        throw new Error("Search query is required (provide via connection or override)");
      }
      
      // Get numResults config, default to 20, clamp between 1-1000
      const numResults = Math.max(1, Math.min(1000, Number(node.config.numResults) || 20));
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery, numResults }),
      });

      if (!response.ok) {
        throw new Error(`Google Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      const formattedResults = data.results
        .map((r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`)
        .join("\n\n");

      return {
        success: true,
        outputs: { output: formattedResults },
      };
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "Google Search failed",
      };
    }
  }

  // Brave Search
  private static async executeBraveSearch(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      // Check for override query first, otherwise use input from connections
      const rawQuery = node.config.overrideQuery ? String(node.config.overrideQuery) : input;
      const searchQuery = rawQuery
        .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
        .replace(/\s+/g, ' ')       // Collapse multiple spaces
        .trim();                     // Trim leading/trailing
      
      if (!searchQuery) {
        throw new Error("Search query is required (provide via connection or override)");
      }
      
      // Get numResults config, default to 20, clamp between 1-1000
      const numResults = Math.max(1, Math.min(1000, Number(node.config.numResults) || 20));
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brave-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery, numResults }),
      });

      if (!response.ok) {
        throw new Error(`Brave Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      const formattedResults = data.results
        .map((r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`)
        .join("\n\n");

      return {
        success: true,
        outputs: { output: formattedResults },
      };
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "Brave Search failed",
      };
    }
  }

  // Web Scraping (extracts URLs and scrapes each one)
  private static async executeWebScrape(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      // Extract and clean URLs from input
      const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
      const rawUrls = input.match(urlRegex) || [];
      
      // Clean URLs - remove trailing quotes, brackets, etc.
      const urls = rawUrls.map(url => 
        url.replace(/["')\]}>]+$/, '').trim()
      ).filter(url => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      });

      if (urls.length === 0) {
        return {
          success: false,
          outputs: { output: "" },
          error: "No valid URLs found in input",
        };
      }

      // Get returnHtml config option
      const returnHtml = node.config.returnHtml === true;
      
      // Get truncate config
      const truncateResults = node.config.truncateResults === true;
      const maxCharacters = truncateResults ? Math.max(1, Number(node.config.maxCharacters) || 5000) : undefined;

      // Helper function to scrape a single URL
      const scrapeUrl = async (url: string): Promise<{ url: string; result: string; success: boolean }> => {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-scrape`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url, returnHtml, maxCharacters }),
          });

          if (!response.ok) {
            return { 
              url, 
              result: `[Error scraping ${url}: ${response.statusText}]`, 
              success: false 
            };
          }

          const data = await response.json();
          
          // Return JSON output in a code block
          const result = `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
          
          return { 
            url, 
            result, 
            success: true 
          };
        } catch (error) {
          return { 
            url, 
            result: `[Error scraping ${url}: ${error}]`, 
            success: false 
          };
        }
      };

      // Helper function to retry failed URLs with exponential backoff
      const retryWithBackoff = async (url: string, attempt: number = 1): Promise<string> => {
        const maxRetries = 3;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Cap at 5 seconds
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const result = await scrapeUrl(url);
        
        if (!result.success && attempt < maxRetries) {
          console.log(`Retry attempt ${attempt} for ${url} after ${delay}ms delay`);
          return retryWithBackoff(url, attempt + 1);
        }
        
        return result.result;
      };

      // Phase 1: Try all URLs concurrently (fast)
      console.log(`Scraping ${urls.length} URLs concurrently...`);
      const initialResults = await Promise.all(urls.map(url => scrapeUrl(url)));
      
      // Phase 2: Identify failures and retry with backoff
      const failedUrls = initialResults
        .filter(r => !r.success)
        .map(r => r.url);
      
      if (failedUrls.length > 0) {
        console.log(`${failedUrls.length} URLs failed, retrying with backoff...`);
        
        // Retry failed URLs sequentially with exponential backoff
        const retryResults = await Promise.all(
          failedUrls.map(url => retryWithBackoff(url))
        );
        
        // Merge successful initial results with retry results
        const successfulResults = initialResults
          .filter(r => r.success)
          .map(r => r.result);
        
        const allResults = [...successfulResults, ...retryResults];
        const concatenatedOutput = allResults.join("\n\n---\n\n");
        
        return {
          success: true,
          outputs: { output: concatenatedOutput },
        };
      }
      
      // All succeeded on first try
      const concatenatedOutput = initialResults.map(r => r.result).join("\n\n---\n\n");
      
      return {
        success: true,
        outputs: { output: concatenatedOutput },
      };
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "Web scraping failed",
      };
    }
  }

  // API Call
  private static async executeAPICall(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      const url = node.config.url as string;
      if (!url) {
        throw new Error("API URL is required");
      }

      const method = (node.config.method as string) || "POST";
      const bearerToken = node.config.bearerToken as string;
      const headersConfig = node.config.headers as string;
      
      let headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add Bearer token if provided
      if (bearerToken) {
        headers["Authorization"] = `Bearer ${bearerToken}`;
      }

      // Add additional headers
      if (headersConfig) {
        try {
          const parsedHeaders = JSON.parse(headersConfig);
          headers = { ...headers, ...parsedHeaders };
        } catch (e) {
          console.warn("Invalid headers JSON, using defaults");
        }
      }

      // Prepare body for non-GET/HEAD requests
      let body = undefined;
      if (method !== "GET" && method !== "HEAD") {
        body = input;
      }

      // Call the api-call edge function to make the request
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          method,
          headers,
          body,
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge function call failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Check if the proxied API call was successful
      if (result.error) {
        throw new Error(`API call failed: ${result.error}`);
      }

      if (result.status && result.status >= 400) {
        const errorMsg = typeof result.data === 'string' 
          ? result.data 
          : JSON.stringify(result.data);
        throw new Error(`API call failed: ${result.status} ${result.statusText}\n${errorMsg}`);
      }

      // Format the response data
      let responseData;
      if (typeof result.data === 'string') {
        responseData = result.data;
      } else {
        responseData = JSON.stringify(result.data, null, 2);
      }

      return {
        success: true,
        outputs: { output: responseData },
      };
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "API call failed",
      };
    }
  }

  // Send Email (Resend)
  private static async executeSendEmail(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      const to = node.config.to as string;
      const subject = node.config.subject as string;
      const useHtml = node.config.useHtml === true;
      
      if (!to) {
        throw new Error("Recipient email is required");
      }
      
      if (!subject) {
        throw new Error("Email subject is required");
      }
      
      const body = input || "";
      if (!body) {
        throw new Error("Email body is required (provide via connection)");
      }
      
      console.log(`Sending email to: ${to}, subject: ${subject}`);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, subject, body, useHtml }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Email send failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Email sending failed");
      }

      return {
        success: true,
        outputs: { output: `Email sent successfully to ${to}` },
      };
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "Email send failed",
      };
    }
  }

  // GitHub Files
  private static async executeGitHubFiles(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      const repoUrl = node.config.repoUrl as string;
      
      if (!repoUrl) {
        throw new Error("Repository URL is required");
      }
      
      const branch = node.config.branch as string || undefined;
      const selectedPaths = node.config.selectedPaths as string[] || [];
      const outputMode = (node.config.outputMode as string) || "combined";
      
      if (selectedPaths.length === 0) {
        throw new Error("No files selected. Use the file selector to choose files.");
      }
      
      console.log(`Fetching ${selectedPaths.length} files from ${repoUrl}`);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl, branch, selectedPaths, outputMode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `GitHub fetch failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "GitHub fetch failed");
      }

      if (outputMode === "separate" && data.outputs) {
        // Return multiple outputs (one per file)
        // Map file paths to port names using the selectedPaths order for consistency
        const mappedOutputs: Record<string, string> = {};
        selectedPaths.forEach((path, index) => {
          mappedOutputs[`output_${index + 1}`] = data.outputs[path] || "";
        });
        return {
          success: true,
          outputs: mappedOutputs,
        };
      } else {
        // Return combined output
        return {
          success: true,
          outputs: { output: data.output || "" },
        };
      }
    } catch (error) {
      return {
        success: false,
        outputs: { output: "" },
        error: error instanceof Error ? error.message : "GitHub fetch failed",
      };
    }
  }

  // Logic Gate - Evaluates AND, OR, NAND, NOR logic across multiple inputs
  private static executeLogicGate(node: FunctionNode, input: string): FunctionExecutionResult {
    const gateType = (node.config.gateType as string) || "AND";
    const outputMode = (node.config.outputMode as string) || "single";
    const separator = node.config.separator !== undefined ? String(node.config.separator) : "\n";
    
    // Get input values from inputPorts - if no inputPorts defined, use the passed input
    const inputPorts = node.inputPorts || ["input_1", "input_2"];
    const inputValues = inputPorts.map(port => {
      const value = node.inputs?.[port];
      return value !== undefined && value !== null ? value : "";
    });
    
    // Check non-null status for each input (non-empty after trim)
    const nonNullStatus = inputValues.map(v => v !== null && v !== undefined && v.trim() !== "");
    const allNonNull = nonNullStatus.every(Boolean);
    const anyNonNull = nonNullStatus.some(Boolean);
    const allNull = nonNullStatus.every(v => !v);
    const anyNull = nonNullStatus.some(v => !v);
    
    // Evaluate gate logic
    let shouldProceed = false;
    switch (gateType.toUpperCase()) {
      case "AND":
        shouldProceed = allNonNull;
        break;
      case "OR":
        shouldProceed = anyNonNull;
        break;
      case "NAND":
        shouldProceed = allNull;
        break;
      case "NOR":
        shouldProceed = anyNull;
        break;
      default:
        shouldProceed = allNonNull; // Default to AND behavior
    }
    
    if (!shouldProceed) {
      // Gate blocked - return empty outputs
      if (outputMode === "matching") {
        const outputs: Record<string, string> = {};
        inputPorts.forEach((_, index) => {
          outputs[`output_${index + 1}`] = "";
        });
        return { success: true, outputs };
      }
      return { success: true, outputs: { output: "" } };
    }
    
    // Gate passed - generate outputs based on mode
    if (outputMode === "matching") {
      // Matching outputs - one per input, same values passing through
      const outputs: Record<string, string> = {};
      inputValues.forEach((value, index) => {
        outputs[`output_${index + 1}`] = value || "";
      });
      return { success: true, outputs };
    } else {
      // Single output - concatenate all non-empty inputs
      const concatenated = inputValues.filter(v => v && v.trim()).join(separator);
      return { success: true, outputs: { output: concatenated } };
    }
  }
}
