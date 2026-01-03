// Free Agent Tool Executor - Handles frontend-side tool execution
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { 
  BlackboardEntry, 
  FreeAgentArtifact, 
  SessionFile,
  AssistanceRequest 
} from "@/types/freeAgent";

interface ToolExecutionContext {
  sessionId: string;
  blackboard: BlackboardEntry[];
  sessionFiles: SessionFile[];
  onArtifactCreated: (artifact: FreeAgentArtifact) => void;
  onBlackboardUpdate: (entry: BlackboardEntry) => void;
  onAssistanceNeeded: (request: AssistanceRequest) => void;
}

interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

// Execute a frontend-handled tool
export async function executeFrontendTool(
  tool: string,
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  switch (tool) {
    case "read_blackboard":
      return executeReadBlackboard(params, context);
    case "write_blackboard":
      return executeWriteBlackboard(params, context);
    case "read_file":
      return executeReadFile(params, context);
    case "request_assistance":
      return executeRequestAssistance(params, context);
    case "export_word":
      return executeExportWord(params, context);
    case "export_pdf":
      return executeExportPdf(params, context);
    default:
      return { success: false, error: `Unknown frontend tool: ${tool}` };
  }
}

// Read blackboard entries (from local state)
async function executeReadBlackboard(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    let entries = context.blackboard;
    
    if (params.filter) {
      entries = entries.filter(e => e.category === params.filter);
    }
    
    return {
      success: true,
      result: entries.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        category: e.category,
        content: e.content,
        data: e.data,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to read blackboard" };
  }
}

// Write to blackboard (local state - callback updates React state)
async function executeWriteBlackboard(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const entry: BlackboardEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category: params.category as BlackboardEntry["category"],
      content: params.content as string,
      data: params.data as Record<string, unknown> | undefined,
      iteration: 0,
    };

    context.onBlackboardUpdate(entry);

    return {
      success: true,
      result: { id: entry.id, timestamp: entry.timestamp, success: true },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to write blackboard" };
  }
}

// Read session file (from local state)
async function executeReadFile(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const fileId = params.fileId as string;
    const file = context.sessionFiles.find(f => f.id === fileId);

    if (!file) {
      return { success: false, error: `File not found: ${fileId}` };
    }

    return {
      success: true,
      result: {
        filename: file.filename,
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to read file" };
  }
}

// Request assistance from user
async function executeRequestAssistance(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const request: AssistanceRequest = {
    id: crypto.randomUUID(),
    question: params.question as string,
    context: params.context as string | undefined,
    inputType: (params.inputType as AssistanceRequest["inputType"]) || "text",
    choices: params.choices as string[] | undefined,
    requestedAt: new Date().toISOString(),
  };

  context.onAssistanceNeeded(request);

  return {
    success: true,
    result: { awaiting_response: true, request_id: request.id },
  };
}

// Export to Word document
async function executeExportWord(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const content = params.content as string;
    const filename = (params.filename as string) || "document.docx";

    // Parse markdown-like content into paragraphs
    const lines = content.split("\n");
    const children: Paragraph[] = [];

    for (const line of lines) {
      if (line.startsWith("# ")) {
        children.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
          })
        );
      } else if (line.startsWith("## ")) {
        children.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
          })
        );
      } else if (line.startsWith("### ")) {
        children.push(
          new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3,
          })
        );
      } else if (line.trim()) {
        children.push(
          new Paragraph({
            children: [new TextRun(line)],
          })
        );
      }
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const base64 = await blobToBase64(blob);

    const artifact: FreeAgentArtifact = {
      id: crypto.randomUUID(),
      type: "file",
      title: filename,
      content: base64,
      description: "Word document",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: blob.size,
      createdAt: new Date().toISOString(),
      iteration: 0,
    };

    context.onArtifactCreated(artifact);

    return {
      success: true,
      result: { filename, artifactId: artifact.id, size: blob.size },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to export Word" };
  }
}

// Export to PDF
async function executeExportPdf(
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  try {
    const content = params.content as string;
    const filename = (params.filename as string) || "document.pdf";

    const pdf = new jsPDF();
    const lines = content.split("\n");
    let y = 20;

    for (const line of lines) {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      if (line.startsWith("# ")) {
        pdf.setFontSize(24);
        pdf.text(line.substring(2), 20, y);
        y += 12;
      } else if (line.startsWith("## ")) {
        pdf.setFontSize(18);
        pdf.text(line.substring(3), 20, y);
        y += 10;
      } else if (line.startsWith("### ")) {
        pdf.setFontSize(14);
        pdf.text(line.substring(4), 20, y);
        y += 8;
      } else if (line.trim()) {
        pdf.setFontSize(12);
        const splitText = pdf.splitTextToSize(line, 170);
        pdf.text(splitText, 20, y);
        y += splitText.length * 6;
      } else {
        y += 4;
      }
    }

    const blob = pdf.output("blob");
    const base64 = await blobToBase64(blob);

    const artifact: FreeAgentArtifact = {
      id: crypto.randomUUID(),
      type: "file",
      title: filename,
      content: base64,
      description: "PDF document",
      mimeType: "application/pdf",
      size: blob.size,
      createdAt: new Date().toISOString(),
      iteration: 0,
    };

    context.onArtifactCreated(artifact);

    return {
      success: true,
      result: { filename, artifactId: artifact.id, size: blob.size },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to export PDF" };
  }
}

// Helper to convert blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(",")[1] || base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Execute edge function tool via Supabase
export async function executeEdgeFunctionTool(
  tool: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  const toolToFunction: Record<string, string> = {
    get_time: "time",
    brave_search: "brave-search",
    google_search: "google-search",
    web_scrape: "web-scrape",
    read_github_repo: "github-fetch",
    read_github_file: "github-fetch",
    send_email: "send-email",
    image_generation: "run-nano",
    get_call_api: "api-call",
    post_call_api: "api-call",
    execute_sql: "external-db",
    elevenlabs_tts: "elevenlabs-tts",
  };

  const functionName = toolToFunction[tool];
  
  if (!functionName) {
    return { success: false, error: `Unknown edge function tool: ${tool}` };
  }

  try {
    // Prepare params for specific tools
    let body = params;
    
    if (tool === "get_call_api") {
      body = { ...params, method: "GET" };
    } else if (tool === "post_call_api") {
      body = { ...params, method: "POST" };
    } else if (tool === "image_generation") {
      body = { prompt: params.prompt, model: params.model || "gemini-2.5-flash-image" };
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, result: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Edge function call failed" };
  }
}
