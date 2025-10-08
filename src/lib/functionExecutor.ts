import type { FunctionNode } from "@/types/workflow";
import type { FunctionExecutionResult, MemoryEntry } from "@/types/functions";

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
        
        case "extract_urls":
          return this.executeExtractURLs(functionNode, input);
        
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
    
    return {
      success: true,
      outputs: { output: input },
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
        const paths = extractPath.split(".");
        for (const path of paths) {
          result = result[path];
        }
      }
      
      return {
        success: true,
        outputs: { output: JSON.stringify(result, null, 2) },
      };
    } catch (error) {
      return {
        success: false,
        outputs: {},
        error: "Invalid JSON",
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
}
