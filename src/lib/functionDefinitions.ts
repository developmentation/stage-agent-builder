import { 
  Type, 
  Link2, 
  GitBranch, 
  Database, 
  FileDown, 
  Globe,
  AlignLeft,
  CheckCircle2,
  FileJson,
  Filter,
  Split,
  Merge,
  ExternalLink,
  Zap,
  FileText
} from "lucide-react";
import type { FunctionDefinition } from "@/types/functions";

export const functionDefinitions: FunctionDefinition[] = [
  // String Operations
  {
    id: "string_contains",
    name: "String Contains",
    description: "Check if text contains a substring. Outputs 'true' or 'false' port.",
    category: "string",
    icon: Filter,
    color: "bg-blue-500/10 text-blue-500",
    inputs: {
      label: "Text input",
      description: "The text to search in",
    },
    outputs: ["true", "false"],
    configSchema: {
      searchText: {
        type: "string",
        label: "Search Text",
        description: "Text to search for",
        required: true,
        placeholder: "Enter text to search for",
      },
      caseSensitive: {
        type: "boolean",
        label: "Case Sensitive",
        description: "Whether the search should be case sensitive",
        default: false,
      },
    },
  },
  {
    id: "string_concat",
    name: "Concatenate",
    description: "Join multiple text inputs together",
    category: "string",
    icon: Merge,
    color: "bg-blue-500/10 text-blue-500",
    inputs: {
      label: "Text input",
      description: "Text to concatenate",
    },
    outputs: ["output"],
    configSchema: {
      separator: {
        type: "string",
        label: "Separator",
        description: "Text to insert between inputs",
        default: " ",
        placeholder: "e.g., ', ' or '\\n'",
      },
    },
  },
  {
    id: "string_replace",
    name: "Replace",
    description: "Replace text with another text",
    category: "string",
    icon: Type,
    color: "bg-blue-500/10 text-blue-500",
    inputs: {
      label: "Text input",
      description: "The text to modify",
    },
    outputs: ["output"],
    configSchema: {
      find: {
        type: "string",
        label: "Find",
        description: "Text to find",
        required: true,
        placeholder: "Text to find",
      },
      replace: {
        type: "string",
        label: "Replace With",
        description: "Replacement text",
        required: true,
        placeholder: "Replacement text",
      },
    },
  },
  {
    id: "string_split",
    name: "Split",
    description: "Split text into multiple parts",
    category: "string",
    icon: Split,
    color: "bg-blue-500/10 text-blue-500",
    inputs: {
      label: "Text input",
      description: "Text to split",
    },
    outputs: ["output"],
    configSchema: {
      delimiter: {
        type: "string",
        label: "Delimiter",
        description: "Character(s) to split on",
        default: ",",
        placeholder: "e.g., ',' or '\\n'",
      },
    },
  },

  // Logic Functions
  {
    id: "is_json",
    name: "Is JSON",
    description: "Check if input is valid JSON. Outputs 'true' or 'false' port.",
    category: "logic",
    icon: CheckCircle2,
    color: "bg-purple-500/10 text-purple-500",
    inputs: {
      label: "Text input",
      description: "Text to validate as JSON",
    },
    outputs: ["true", "false"],
  },
  {
    id: "is_empty",
    name: "Is Empty",
    description: "Check if input is empty or whitespace only",
    category: "logic",
    icon: CheckCircle2,
    color: "bg-purple-500/10 text-purple-500",
    inputs: {
      label: "Text input",
      description: "Text to check",
    },
    outputs: ["true", "false"],
  },
  {
    id: "is_url",
    name: "Is URL",
    description: "Check if input is a valid URL",
    category: "logic",
    icon: CheckCircle2,
    color: "bg-purple-500/10 text-purple-500",
    inputs: {
      label: "Text input",
      description: "Text to validate as URL",
    },
    outputs: ["true", "false"],
  },

  // Conditional
  {
    id: "if_else",
    name: "If/Else",
    description: "Route data based on a condition",
    category: "conditional",
    icon: GitBranch,
    color: "bg-amber-500/10 text-amber-500",
    inputs: {
      label: "Input",
      description: "Data to route",
    },
    outputs: ["true", "false"],
    configSchema: {
      condition: {
        type: "string",
        label: "Condition",
        description: "Condition to evaluate (contains, equals, etc.)",
        required: true,
        placeholder: "e.g., 'contains success'",
      },
    },
  },

  // Memory
  {
    id: "memory",
    name: "Memory",
    description: "Store outputs across multiple workflow runs",
    category: "memory",
    icon: Database,
    color: "bg-green-500/10 text-green-500",
    inputs: {
      label: "Data input",
      description: "Data to store in memory",
    },
    outputs: ["output"],
    configSchema: {
      memoryKey: {
        type: "string",
        label: "Memory Key",
        description: "Unique identifier for this memory store",
        required: true,
        placeholder: "e.g., 'research_results'",
      },
    },
  },

  // Export Functions
  {
    id: "export_markdown",
    name: "Export to Markdown",
    description: "Export output as a .md file",
    category: "export",
    icon: FileDown,
    color: "bg-orange-500/10 text-orange-500",
    inputs: {
      label: "Content",
      description: "Content to export",
    },
    outputs: ["output"],
    configSchema: {
      filename: {
        type: "string",
        label: "Filename",
        description: "Name for the exported file",
        default: "export.md",
        placeholder: "filename.md",
      },
    },
  },
  {
    id: "export_json",
    name: "Export to JSON",
    description: "Export output as a .json file",
    category: "export",
    icon: FileJson,
    color: "bg-orange-500/10 text-orange-500",
    inputs: {
      label: "Content",
      description: "Content to export",
    },
    outputs: ["output"],
    configSchema: {
      filename: {
        type: "string",
        label: "Filename",
        description: "Name for the exported file",
        default: "export.json",
        placeholder: "filename.json",
      },
      pretty: {
        type: "boolean",
        label: "Pretty Print",
        description: "Format JSON with indentation",
        default: true,
      },
    },
  },
  {
    id: "export_text",
    name: "Export to Text",
    description: "Export output as a .txt file",
    category: "export",
    icon: FileDown,
    color: "bg-orange-500/10 text-orange-500",
    inputs: {
      label: "Content",
      description: "Content to export",
    },
    outputs: ["output"],
    configSchema: {
      filename: {
        type: "string",
        label: "Filename",
        description: "Name for the exported file",
        default: "export.txt",
        placeholder: "filename.txt",
      },
    },
  },
  {
    id: "export_pdf",
    name: "Export to PDF",
    description: "Export output as a formatted PDF file",
    category: "export",
    icon: FileDown,
    color: "bg-orange-500/10 text-orange-500",
    inputs: {
      label: "Content",
      description: "Markdown content to export as PDF",
    },
    outputs: ["output"],
    configSchema: {
      filename: {
        type: "string",
        label: "Filename",
        description: "Name for the exported PDF file",
        default: "export.pdf",
        placeholder: "filename.pdf",
      },
      title: {
        type: "string",
        label: "Document Title",
        description: "Title for the PDF document",
        default: "Document",
        placeholder: "My Document",
      },
    },
  },
  {
    id: "export_word",
    name: "Export to Word",
    description: "Export output as a formatted Word document (.docx)",
    category: "export",
    icon: FileDown,
    color: "bg-orange-500/10 text-orange-500",
    inputs: {
      label: "Content",
      description: "Markdown content to export as Word document",
    },
    outputs: ["output"],
    configSchema: {
      filename: {
        type: "string",
        label: "Filename",
        description: "Name for the exported Word file",
        default: "export.docx",
        placeholder: "filename.docx",
      },
      title: {
        type: "string",
        label: "Document Title",
        description: "Title for the Word document",
        default: "Document",
        placeholder: "My Document",
      },
    },
  },

  // URL Operations
  {
    id: "extract_urls",
    name: "Extract URLs",
    description: "Extract all URLs from text for web scraping",
    category: "url",
    icon: Globe,
    color: "bg-cyan-500/10 text-cyan-500",
    inputs: {
      label: "Text input",
      description: "Text containing URLs",
    },
    outputs: ["output"],
    configSchema: {
      unique: {
        type: "boolean",
        label: "Unique URLs Only",
        description: "Remove duplicate URLs",
        default: true,
      },
    },
  },

  // Data Transformation
  {
    id: "parse_json",
    name: "Parse JSON",
    description: "Parse JSON string into readable format",
    category: "data",
    icon: FileJson,
    color: "bg-indigo-500/10 text-indigo-500",
    inputs: {
      label: "JSON input",
      description: "JSON string to parse",
    },
    outputs: ["output"],
    configSchema: {
      extractPath: {
        type: "string",
        label: "Extract Path",
        description: "JSON path to extract (e.g., 'data.results')",
        placeholder: "Optional: data.items",
      },
    },
  },
  {
    id: "format_json",
    name: "Format JSON",
    description: "Format JSON with proper indentation",
    category: "data",
    icon: AlignLeft,
    color: "bg-indigo-500/10 text-indigo-500",
    inputs: {
      label: "JSON input",
      description: "JSON to format",
    },
    outputs: ["output"],
  },
  {
    id: "google_search",
    name: "Google Search",
    description: "Perform a Google search and return top results",
    category: "url",
    icon: Globe,
    color: "bg-sky-500/10 text-sky-500",
    inputs: {
      label: "Search query",
      description: "The search query to execute",
    },
    outputs: ["output"],
    configSchema: {
      overrideQuery: {
        type: "string",
        label: "Override Search Query",
        description: "Optional: Override input with this search query",
        required: false,
        placeholder: "Enter search query to override input",
      },
      numResults: {
        type: "number",
        label: "Number of Results",
        description: "Number of search results to return (1-1000)",
        default: 20,
        required: false,
        placeholder: "20",
      },
    },
  },
  {
    id: "brave_search",
    name: "Brave Search",
    description: "Perform a Brave search and return top results",
    category: "url",
    icon: Globe,
    color: "bg-orange-500/10 text-orange-500",
    inputs: {
      label: "Search query",
      description: "The search query to execute",
    },
    outputs: ["output"],
    configSchema: {
      overrideQuery: {
        type: "string",
        label: "Override Search Query",
        description: "Optional: Override input with this search query",
        required: false,
        placeholder: "Enter search query to override input",
      },
      numResults: {
        type: "number",
        label: "Number of Results",
        description: "Number of search results to return (1-20)",
        default: 20,
        required: false,
        placeholder: "20",
      },
    },
  },
  {
    id: "web_scrape",
    name: "Web Scrape",
    description: "Extract URLs from input and scrape each one, concatenating results",
    category: "url",
    icon: ExternalLink,
    color: "bg-teal-500/10 text-teal-500",
    inputs: {
      label: "Text with URLs",
      description: "Text containing URLs to scrape",
    },
    outputs: ["output"],
    configSchema: {
      returnHtml: {
        type: "boolean",
        label: "Return HTML",
        description: "Return raw HTML instead of extracted text",
        default: false,
      },
      truncateResults: {
        type: "boolean",
        label: "Truncate Results",
        description: "Limit the character length of scraped content",
        default: false,
      },
      maxCharacters: {
        type: "number",
        label: "Max Characters",
        description: "Maximum characters per result (applies to web pages, PDFs, and DOCX)",
        default: 5000,
        required: false,
        placeholder: "5000",
      },
    },
  },
  {
    id: "api_call",
    name: "API Call",
    description: "Make an HTTP API call with the input as the body",
    category: "url",
    icon: Zap,
    color: "bg-yellow-500/10 text-yellow-500",
    inputs: {
      label: "Request body",
      description: "Data to send in the API call",
    },
    outputs: ["output"],
    configSchema: {
      url: {
        type: "string",
        label: "API URL",
        description: "The URL to call",
        required: true,
        placeholder: "https://api.example.com/endpoint",
      },
      method: {
        type: "string",
        label: "HTTP Method",
        description: "HTTP method (GET, POST, PUT, DELETE)",
        default: "POST",
        placeholder: "POST",
      },
      bearerToken: {
        type: "string",
        label: "Bearer Token",
        description: "JWT or API token for Authorization header",
        placeholder: "your-token-here",
      },
      headers: {
        type: "json",
        label: "Additional Headers (JSON)",
        description: "Additional HTTP headers as JSON object",
        placeholder: '{"X-Custom-Header": "value"}',
      },
    },
  },
  {
    id: "content",
    name: "Content",
    description: "Add static content manually or via file upload at any workflow stage",
    category: "data",
    icon: FileText,
    color: "bg-blue-500/10 text-blue-500",
    inputs: {
      label: "Optional Input",
      description: "Optional input from connections (displayed but not used in output)"
    },
    outputs: ["output"],
    configSchema: {
      content: {
        type: "string",
        label: "Content",
        description: "Static content to output (can be manually entered or uploaded from files)",
        placeholder: "Enter your content here or upload files...",
      },
    },
  },
];

// Helper to get function by ID
export const getFunctionById = (id: string): FunctionDefinition | undefined => {
  return functionDefinitions.find((f) => f.id === id);
};

// Helper to get functions by category
export const getFunctionsByCategory = (category: string): FunctionDefinition[] => {
  return functionDefinitions.filter((f) => f.category === category);
};
