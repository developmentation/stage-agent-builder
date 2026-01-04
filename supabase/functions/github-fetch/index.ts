import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubFetchRequest {
  repoUrl: string;
  branch?: string;
  selectedPaths?: string[];
  outputMode?: "combined" | "separate";
}

interface TreeItem {
  name: string;
  path: string;
  download_url: string;
  html_url: string;
  size: number;
  sha: string;
  type: "file" | "directory";
}

const getHeaders = () => {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "AgentBuilderConsole/1.0",
  };

  const token = Deno.env.get("GITHUB_TOKEN");
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }

  return headers;
};

// Parse GitHub URL to extract owner and repo
const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/\?#]+)/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ""),
      };
    }
  }

  return null;
};

// Get default branch for repo
const getDefaultBranch = async (owner: string, repo: string): Promise<string> => {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch repository info: ${response.statusText}`);
  }

  const data = await response.json();
  return data.default_branch;
};

// Fetch repository tree structure
const fetchRepoContents = async (
  owner: string,
  repo: string,
  branch: string
): Promise<TreeItem[]> => {
  // Get the branch's commit SHA
  const refResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    { headers: getHeaders() }
  );

  if (!refResponse.ok) {
    throw new Error(`Failed to fetch branch ref: ${refResponse.statusText}`);
  }

  const refData = await refResponse.json();
  const commitSha = refData.object.sha;

  // Get the full tree in one request
  const treeResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`,
    { headers: getHeaders() }
  );

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch tree: ${treeResponse.statusText}`);
  }

  const treeData = await treeResponse.json();

  if (treeData.truncated) {
    console.warn("Repository tree was truncated due to size. Some files may be missing.");
  }

  // Transform and return only what we need
  return treeData.tree
    .filter((item: any) => item.type === "blob" || item.type === "tree")
    .map((item: any) => ({
      name: item.path.split("/").pop(),
      path: item.path,
      download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`,
      html_url: `https://github.com/${owner}/${repo}/blob/${branch}/${item.path}`,
      size: item.size || 0,
      sha: item.sha,
      type: item.type === "blob" ? "file" : "directory",
    }));
};

// Download file content
const downloadFile = async (fileInfo: TreeItem): Promise<{ path: string; content: string; success: boolean; error?: string }> => {
  try {
    const response = await fetch(fileInfo.download_url, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      return {
        path: fileInfo.path,
        content: "",
        success: false,
        error: `Failed to fetch ${fileInfo.path}: ${response.statusText}`,
      };
    }

    const content = await response.text();
    return {
      path: fileInfo.path,
      content,
      success: true,
    };
  } catch (error) {
    return {
      path: fileInfo.path,
      content: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Format file size for display
const formatSize = (bytes: number): string => {
  if (bytes === 0) return "0B";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

// Create compact response for LLM consumption (no nested tree, just flat list)
const createCompactResponse = (
  files: TreeItem[],
  owner: string,
  repo: string,
  branch: string
) => {
  const fileItems = files.filter(f => f.type === "file");
  const dirItems = files.filter(f => f.type === "directory");
  
  // Create a simple flat list of file paths with sizes
  const fileList = fileItems.map(f => ({ path: f.path, size: f.size }));
  
  return {
    success: true,
    mode: "tree",
    repository: { owner, repo, branch },
    totalFiles: fileItems.length,
    totalDirectories: dirItems.length,
    files: fileList,
  };
};

// Create tree structure for UI (still needed for frontend tree selection modal)
const createTreeStructure = (files: TreeItem[]) => {
  const root: any[] = [];
  const dirMap = new Map<string, any>();

  // First pass: Create all directories
  files.forEach((file) => {
    const pathParts = file.path.split("/");
    let currentPath = "";

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!dirMap.has(currentPath)) {
        const dirNode = {
          key: currentPath,
          label: part,
          data: {
            path: currentPath,
            type: "directory",
          },
          children: [],
        };

        dirMap.set(currentPath, dirNode);

        if (!parentPath) {
          root.push(dirNode);
        } else {
          const parentDir = dirMap.get(parentPath);
          if (parentDir) {
            parentDir.children.push(dirNode);
          }
        }
      }
    }
  });

  // Second pass: Add files to their directories
  files.filter(f => f.type === "file").forEach((file) => {
    const pathParts = file.path.split("/");
    const fileName = pathParts.pop();
    const parentPath = pathParts.join("/");

    const fileNode = {
      key: file.path,
      label: fileName,
      data: {
        ...file,
        type: "file",
      },
      leaf: true,
    };

    if (!parentPath) {
      root.push(fileNode);
    } else {
      const parentDir = dirMap.get(parentPath);
      if (parentDir) {
        parentDir.children.push(fileNode);
      }
    }
  });

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: any[]): any[] => {
    nodes.sort((a, b) => {
      if ((a.children && !b.children) || (!a.children && b.children)) {
        return a.children ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });

    nodes.forEach((node) => {
      if (node.children) {
        sortNodes(node.children);
      }
    });

    return nodes;
  };

  return sortNodes(root);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { repoUrl, branch: requestedBranch, selectedPaths, outputMode = "combined" }: GitHubFetchRequest = await req.json();

    if (!repoUrl) {
      throw new Error("Repository URL is required");
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      throw new Error("Invalid GitHub URL format. Use: github.com/owner/repo or owner/repo");
    }

    const { owner, repo } = parsed;
    console.log(`Fetching repository: ${owner}/${repo}`);

    // Get the default branch if none specified
    const branch = requestedBranch || await getDefaultBranch(owner, repo);
    console.log(`Using branch: ${branch}`);

    // Fetch all files
    const files = await fetchRepoContents(owner, repo, branch);
    console.log(`Fetched ${files.length} items from repository`);

    // If no specific paths requested, return compact structure for LLM
    // Check if this is from edge function (agent) or frontend (tree modal)
    const isFromAgent = req.headers.get("x-source") === "agent";
    
    if (!selectedPaths || selectedPaths.length === 0) {
      if (isFromAgent) {
        // Return compact response for LLM consumption
        const compactResponse = createCompactResponse(files, owner, repo, branch);
        return new Response(
          JSON.stringify(compactResponse),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        // Return full tree structure for frontend UI selection
        const treeData = createTreeStructure(files);
        return new Response(
          JSON.stringify({
            success: true,
            mode: "tree",
            repository: { owner, repo, branch },
            treeData,
            totalFiles: files.filter(f => f.type === "file").length,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Filter to only selected files
    const selectedFiles = files.filter(f => 
      f.type === "file" && selectedPaths.includes(f.path)
    );

    if (selectedFiles.length === 0) {
      throw new Error("No valid files found in selected paths");
    }

    console.log(`Downloading ${selectedFiles.length} selected files`);

    // Download all selected files in parallel (batched)
    const BATCH_SIZE = 5;
    const results: { path: string; content: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
      const batch = selectedFiles.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(f => downloadFile(f)));
      results.push(...batchResults);

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < selectedFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const successfulFiles = results.filter(r => r.success);
    const failedFiles = results.filter(r => !r.success);

    if (failedFiles.length > 0) {
      console.warn(`Failed to download ${failedFiles.length} files:`, failedFiles.map(f => f.path));
    }

    if (outputMode === "separate") {
      // Return each file separately
      const outputs: Record<string, string> = {};
      successfulFiles.forEach(f => {
        outputs[f.path] = f.content;
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "separate",
          repository: { owner, repo, branch },
          outputs,
          totalFiles: successfulFiles.length,
          failedFiles: failedFiles.map(f => ({ path: f.path, error: f.error })),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Combine all files with headers
      const combined = successfulFiles
        .map(f => `## File: ${f.path}\n\n\`\`\`\n${f.content}\n\`\`\``)
        .join("\n\n---\n\n");

      return new Response(
        JSON.stringify({
          success: true,
          mode: "combined",
          repository: { owner, repo, branch },
          output: combined,
          totalFiles: successfulFiles.length,
          failedFiles: failedFiles.map(f => ({ path: f.path, error: f.error })),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Error in github-fetch function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
