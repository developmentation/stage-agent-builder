import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, fileData, entryPath, paths } = await req.json();

    if (!fileData) {
      throw new Error("fileData is required (base64 encoded ZIP file)");
    }

    // Decode base64 file data
    const binaryString = atob(fileData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/zip" });

    // Create ZIP reader
    const zipReader = new zip.ZipReader(new zip.BlobReader(blob));
    const entries = await zipReader.getEntries();

    let result: any;

    switch (action) {
      case "list":
        // List all files in the ZIP
        result = entries.map((entry: any) => ({
          path: entry.filename,
          size: entry.uncompressedSize,
          isDirectory: entry.directory,
          compressedSize: entry.compressedSize,
          lastModified: entry.lastModDate?.toISOString(),
        }));
        break;

      case "read":
        // Read a specific file from the ZIP
        if (!entryPath) {
          throw new Error("entryPath is required for read action");
        }
        const targetEntry = entries.find((e: any) => e.filename === entryPath);
        if (!targetEntry) {
          throw new Error(`File not found in ZIP: ${entryPath}`);
        }
        if (targetEntry.directory) {
          throw new Error(`Cannot read directory: ${entryPath}`);
        }

        if (!targetEntry.getData) {
          throw new Error(`Cannot read file data: ${entryPath}`);
        }

        const writer = new zip.TextWriter();
        const content = await targetEntry.getData(writer);
        
        // Determine mime type from extension
        const ext = entryPath.split(".").pop()?.toLowerCase() || "";
        const mimeTypes: Record<string, string> = {
          txt: "text/plain",
          json: "application/json",
          js: "text/javascript",
          ts: "text/typescript",
          html: "text/html",
          css: "text/css",
          md: "text/markdown",
          xml: "text/xml",
          csv: "text/csv",
          py: "text/x-python",
          java: "text/x-java",
          c: "text/x-c",
          cpp: "text/x-c++",
          h: "text/x-c",
          rs: "text/x-rust",
          go: "text/x-go",
          rb: "text/x-ruby",
          php: "text/x-php",
          sql: "text/x-sql",
          yaml: "text/yaml",
          yml: "text/yaml",
        };

        result = {
          path: entryPath,
          content: content,
          size: targetEntry.uncompressedSize,
          mimeType: mimeTypes[ext] || "application/octet-stream",
        };
        break;

      case "extract":
        // Extract specified or all files
        const pathsToExtract = paths && paths.length > 0 ? paths : null;
        const extracted: any[] = [];

        for (const entry of entries) {
          if (entry.directory) continue;
          if (pathsToExtract && !pathsToExtract.includes(entry.filename)) continue;
          if (!entry.getData) continue;

          try {
            const writer = new zip.BlobWriter();
            const blob = await entry.getData(writer);
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = btoa(
              String.fromCharCode(...new Uint8Array(arrayBuffer))
            );

            extracted.push({
              path: entry.filename,
              data: base64,
              size: entry.uncompressedSize,
              mimeType: getMimeType(entry.filename),
            });
          } catch (e) {
            console.error(`Error extracting ${entry.filename}:`, e);
          }
        }

        result = extracted;
        break;

      default:
        throw new Error(`Unknown action: ${action}. Use 'list', 'read', or 'extract'`);
    }

    await zipReader.close();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("ZIP handler error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    txt: "text/plain",
    json: "application/json",
    js: "text/javascript",
    ts: "text/typescript",
    html: "text/html",
    css: "text/css",
    md: "text/markdown",
    xml: "text/xml",
    csv: "text/csv",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
