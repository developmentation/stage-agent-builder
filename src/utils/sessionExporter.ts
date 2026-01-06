// Session Exporter - Export Free Agent session as ZIP file
import JSZip from "jszip";
import type {
  FreeAgentSession,
  FreeAgentArtifact,
  ToolResultAttribute,
  BlackboardEntry,
} from "@/types/freeAgent";

interface PromptSection {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
  editable: string;
  variables?: string[];
}

interface ExportOptions {
  session: FreeAgentSession;
  promptSections?: PromptSection[];
}

// Sanitize filename for filesystem compatibility
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

// Get appropriate file extension for artifact
function getExtensionForArtifact(artifact: FreeAgentArtifact): string {
  if (artifact.mimeType) {
    const mimeMap: Record<string, string> = {
      "application/json": ".json",
      "text/html": ".html",
      "text/css": ".css",
      "text/javascript": ".js",
      "text/typescript": ".ts",
      "text/markdown": ".md",
      "text/plain": ".txt",
      "application/xml": ".xml",
      "text/csv": ".csv",
      "application/pdf": ".pdf",
    };
    if (mimeMap[artifact.mimeType]) {
      return mimeMap[artifact.mimeType];
    }
  }
  
  // Detect from content
  const content = artifact.content || "";
  if (content.startsWith("{") || content.startsWith("[")) {
    try {
      JSON.parse(content);
      return ".json";
    } catch {
      // Not valid JSON
    }
  }
  if (content.includes("<!DOCTYPE") || content.includes("<html")) {
    return ".html";
  }
  if (content.includes("```markdown") || content.includes("# ")) {
    return ".md";
  }
  
  return ".txt";
}

// Format blackboard as human-readable text
function formatBlackboardAsText(entries: BlackboardEntry[]): string {
  if (entries.length === 0) {
    return "# Blackboard\n\n(Empty)";
  }
  
  let text = "# Blackboard Log\n\n";
  
  for (const entry of entries) {
    text += `## [#${entry.iteration}] ${entry.category.toUpperCase()}\n`;
    text += `**Time:** ${entry.timestamp}\n`;
    if (entry.tools && entry.tools.length > 0) {
      text += `**Tools:** ${entry.tools.join(", ")}\n`;
    }
    text += `\n${entry.content}\n`;
    if (entry.data && Object.keys(entry.data).length > 0) {
      text += `\n**Data:**\n\`\`\`json\n${JSON.stringify(entry.data, null, 2)}\n\`\`\`\n`;
    }
    text += "\n---\n\n";
  }
  
  return text;
}

// Generate README content
function generateReadme(session: FreeAgentSession): string {
  const duration = session.endTime
    ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
    : 0;
  
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  
  return `# Free Agent Session Export
  
## Session Information
- **Session ID:** ${session.id}
- **Status:** ${session.status}
- **Model:** ${session.model}
- **Iterations:** ${session.currentIteration} / ${session.maxIterations}
- **Started:** ${session.startTime}
- **Ended:** ${session.endTime || "N/A"}
- **Duration:** ${minutes}m ${seconds}s

## Original Task
${session.prompt}

## Folder Structure

- \`prompt/\` - Original task and system prompt sections
  - \`original_task.txt\` - The user's task description
  - \`prompt_sections.json\` - All system prompt sections with customizations

- \`blackboard/\` - Agent's working memory log
  - \`entries.json\` - All blackboard entries as JSON
  - \`blackboard_log.txt\` - Human-readable formatted blackboard

- \`scratchpad/\` - Agent's working notes
  - \`scratchpad.md\` - Full scratchpad content

- \`artifacts/\` - Deliverables created by the agent
  - Individual artifact files (ready to use)
  - \`artifacts_index.json\` - Metadata about all artifacts

- \`attributes/\` - Named data saved from tool executions
  - Individual attribute files with tool results
  - \`attributes_index.json\` - Index of all attributes

- \`session/\` - Session metadata and execution history
  - \`metadata.json\` - Session configuration and stats
  - \`tool_calls.json\` - Complete tool call history
  - \`final_report.json\` - Final report (if available)

## Statistics
- Total Tool Calls: ${session.toolCalls.length}
- Artifacts Created: ${session.artifacts.length}
- Named Attributes: ${Object.keys(session.toolResultAttributes).length}
- Blackboard Entries: ${session.blackboard.length}
- Scratchpad Size: ${session.scratchpad?.length || 0} characters
`;
}

export async function exportSessionToZip(options: ExportOptions): Promise<Blob> {
  const { session, promptSections } = options;
  const zip = new JSZip();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const rootFolder = zip.folder(`session_${timestamp}`)!;

  // 1. Prompt folder
  const promptFolder = rootFolder.folder("prompt")!;
  promptFolder.file("original_task.txt", session.prompt);
  if (promptSections && promptSections.length > 0) {
    promptFolder.file("prompt_sections.json", JSON.stringify(promptSections, null, 2));
  }

  // 2. Blackboard folder
  const blackboardFolder = rootFolder.folder("blackboard")!;
  blackboardFolder.file("entries.json", JSON.stringify(session.blackboard, null, 2));
  blackboardFolder.file("blackboard_log.txt", formatBlackboardAsText(session.blackboard));

  // 3. Scratchpad folder
  const scratchpadFolder = rootFolder.folder("scratchpad")!;
  scratchpadFolder.file("scratchpad.md", session.scratchpad || "# Scratchpad\n\n(Empty)");

  // 4. Artifacts folder - each as separate usable file
  const artifactsFolder = rootFolder.folder("artifacts")!;
  for (const artifact of session.artifacts) {
    const safeFilename = sanitizeFilename(artifact.title);
    const extension = getExtensionForArtifact(artifact);
    artifactsFolder.file(`${safeFilename}${extension}`, artifact.content);
  }
  artifactsFolder.file(
    "artifacts_index.json",
    JSON.stringify(
      session.artifacts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        mimeType: a.mimeType,
        size: a.size,
        createdAt: a.createdAt,
        iteration: a.iteration,
      })),
      null,
      2
    )
  );

  // 5. Attributes folder
  const attributesFolder = rootFolder.folder("attributes")!;
  for (const [name, attr] of Object.entries(session.toolResultAttributes)) {
    const attrContent = typeof attr.result === "string" 
      ? attr.result 
      : JSON.stringify(attr.result, null, 2);
    attributesFolder.file(`${sanitizeFilename(name)}.json`, attrContent);
  }
  attributesFolder.file(
    "attributes_index.json",
    JSON.stringify(
      Object.entries(session.toolResultAttributes).map(([name, attr]) => ({
        name,
        tool: attr.tool,
        size: attr.size,
        createdAt: attr.createdAt,
        iteration: attr.iteration,
      })),
      null,
      2
    )
  );

  // 6. Session folder
  const sessionFolder = rootFolder.folder("session")!;
  sessionFolder.file(
    "metadata.json",
    JSON.stringify(
      {
        id: session.id,
        model: session.model,
        maxIterations: session.maxIterations,
        completedIterations: session.currentIteration,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        totalToolCalls: session.toolCalls.length,
        totalArtifacts: session.artifacts.length,
        totalAttributes: Object.keys(session.toolResultAttributes).length,
        totalBlackboardEntries: session.blackboard.length,
        scratchpadLength: session.scratchpad?.length || 0,
      },
      null,
      2
    )
  );
  sessionFolder.file("tool_calls.json", JSON.stringify(session.toolCalls, null, 2));
  if (session.finalReport) {
    sessionFolder.file("final_report.json", JSON.stringify(session.finalReport, null, 2));
  }

  // 7. README
  rootFolder.file("README.txt", generateReadme(session));

  return await zip.generateAsync({ type: "blob" });
}
