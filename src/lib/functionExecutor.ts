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
        
        case "web_scrape":
          return await this.executeWebScrape(functionNode, input);
        
        case "api_call":
          return await this.executeAPICall(functionNode, input);
        
        case "parse_json":
          return this.executeParseJSON(functionNode, input);
        
        case "format_json":
          return this.executeFormatJSON(functionNode, input);
        
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
        ? { true: input, false: "" }
        : { true: "", false: input },
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
    const result = parts.join("\n");
    
    return {
      success: true,
      outputs: { output: result },
    };
  }

  // Logic Functions
  private static executeIsJSON(node: FunctionNode, input: string): FunctionExecutionResult {
    try {
      JSON.parse(input);
      return {
        success: true,
        outputs: { true: input, false: "" },
      };
    } catch {
      return {
        success: true,
        outputs: { true: "", false: input },
      };
    }
  }

  private static executeIsEmpty(node: FunctionNode, input: string): FunctionExecutionResult {
    const isEmpty = input.trim() === "";
    return {
      success: true,
      outputs: isEmpty 
        ? { true: input, false: "" }
        : { true: "", false: input },
    };
  }

  private static executeIsURL(node: FunctionNode, input: string): FunctionExecutionResult {
    try {
      new URL(input.trim());
      return {
        success: true,
        outputs: { true: input, false: "" },
      };
    } catch {
      return {
        success: true,
        outputs: { true: "", false: input },
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
        ? { true: input, false: "" }
        : { true: "", false: input },
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
                
                // Return as comma-space delimited string
                return {
                  success: true,
                  outputs: { output: currentResult.join(', ') },
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

  // Google Search
  private static async executeGoogleSearch(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: input }),
      });

      if (!response.ok) {
        throw new Error(`Google Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      const formattedResults = data.results
        .map((r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`)
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

  // Web Scraping (extracts URLs and scrapes each one)
  private static async executeWebScrape(node: FunctionNode, input: string): Promise<FunctionExecutionResult> {
    try {
      // Extract URLs from input
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = input.match(urlRegex) || [];

      if (urls.length === 0) {
        return {
          success: false,
          outputs: { output: "" },
          error: "No URLs found in input",
        };
      }

      // Scrape each URL
      const scrapePromises = urls.map(async (url) => {
        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-scrape`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url }),
          });

          if (!response.ok) {
            return `[Error scraping ${url}: ${response.statusText}]`;
          }

          const data = await response.json();
          return `=== ${data.title || url} ===\n${data.content}\n`;
        } catch (error) {
          return `[Error scraping ${url}: ${error}]`;
        }
      });

      const results = await Promise.all(scrapePromises);
      const concatenatedOutput = results.join("\n\n---\n\n");

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

      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (method !== "GET" && method !== "HEAD") {
        fetchOptions.body = input;
      }

      const response = await fetch(url, fetchOptions);
      const contentType = response.headers.get("content-type");
      
      let responseData;
      if (contentType?.includes("application/json")) {
        responseData = await response.json();
        responseData = JSON.stringify(responseData, null, 2);
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}\n${responseData}`);
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
}
