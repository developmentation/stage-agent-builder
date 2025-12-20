import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Folder, File, ChevronRight, ChevronDown, Github } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TreeNode {
  key: string;
  label: string;
  data: {
    path: string;
    type: "file" | "directory";
    size?: number;
  };
  children?: TreeNode[];
  leaf?: boolean;
}

interface GitHubTreeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoUrl: string;
  branch?: string;
  selectedPaths: string[];
  onSelectPaths: (paths: string[]) => void;
}

export const GitHubTreeModal = ({
  open,
  onOpenChange,
  repoUrl,
  branch,
  selectedPaths,
  onSelectPaths,
}: GitHubTreeModalProps) => {
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedPaths));
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string; branch: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && repoUrl) {
      fetchTree();
    }
  }, [open, repoUrl, branch]);

  useEffect(() => {
    setLocalSelected(new Set(selectedPaths));
  }, [selectedPaths]);

  const fetchTree = async () => {
    if (!repoUrl) {
      setError("Repository URL is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github-fetch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl, branch }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch repository: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch repository");
      }

      setTreeData(data.treeData || []);
      setRepoInfo(data.repository);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch repository";
      setError(message);
      toast({
        title: "Error fetching repository",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelected = (path: string, isDirectory: boolean, children?: TreeNode[]) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      
      if (isDirectory && children) {
        // Get all file paths under this directory
        const getAllFilePaths = (nodes: TreeNode[]): string[] => {
          return nodes.flatMap((node) => {
            if (node.leaf || node.data.type === "file") {
              return [node.data.path];
            } else if (node.children) {
              return getAllFilePaths(node.children);
            }
            return [];
          });
        };
        
        const filePaths = getAllFilePaths(children);
        const allSelected = filePaths.every((p) => next.has(p));
        
        if (allSelected) {
          filePaths.forEach((p) => next.delete(p));
        } else {
          filePaths.forEach((p) => next.add(p));
        }
      } else {
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
      }
      
      return next;
    });
  };

  const isDirectoryPartiallySelected = (children: TreeNode[]): boolean => {
    const getAllFilePaths = (nodes: TreeNode[]): string[] => {
      return nodes.flatMap((node) => {
        if (node.leaf || node.data.type === "file") {
          return [node.data.path];
        } else if (node.children) {
          return getAllFilePaths(node.children);
        }
        return [];
      });
    };
    
    const filePaths = getAllFilePaths(children);
    const selectedCount = filePaths.filter((p) => localSelected.has(p)).length;
    return selectedCount > 0 && selectedCount < filePaths.length;
  };

  const isDirectoryFullySelected = (children: TreeNode[]): boolean => {
    const getAllFilePaths = (nodes: TreeNode[]): string[] => {
      return nodes.flatMap((node) => {
        if (node.leaf || node.data.type === "file") {
          return [node.data.path];
        } else if (node.children) {
          return getAllFilePaths(node.children);
        }
        return [];
      });
    };
    
    const filePaths = getAllFilePaths(children);
    return filePaths.length > 0 && filePaths.every((p) => localSelected.has(p));
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isFile = node.leaf || node.data.type === "file";
    const isExpanded = expandedKeys.has(node.key);
    const isSelected = isFile ? localSelected.has(node.data.path) : false;
    const isPartial = !isFile && node.children && isDirectoryPartiallySelected(node.children);
    const isFullySelected = !isFile && node.children && isDirectoryFullySelected(node.children);

    return (
      <div key={node.key}>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {!isFile && (
            <button
              onClick={() => toggleExpanded(node.key)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          
          <Checkbox
            checked={isFile ? isSelected : isFullySelected}
            className={isPartial ? "data-[state=checked]:bg-primary/50" : ""}
            onCheckedChange={() => toggleSelected(node.data.path, !isFile, node.children)}
          />
          
          {isFile ? (
            <File className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 text-yellow-500" />
          )}
          
          <span className="flex-1 truncate">{node.label}</span>
          
          {isFile && node.data.size && (
            <span className="text-xs text-muted-foreground">
              {node.data.size > 1024 
                ? `${(node.data.size / 1024).toFixed(1)}KB` 
                : `${node.data.size}B`}
            </span>
          )}
        </div>
        
        {!isFile && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleSave = () => {
    onSelectPaths(Array.from(localSelected));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Select Files from Repository
          </DialogTitle>
          <DialogDescription>
            {repoInfo 
              ? `${repoInfo.owner}/${repoInfo.repo} (${repoInfo.branch})`
              : "Loading repository..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchTree}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{localSelected.size} file(s) selected</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocalSelected(new Set())}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="flex-1 border rounded-md">
                <div className="p-2">
                  {treeData.map((node) => renderTreeNode(node))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !!error}>
            Save Selection ({localSelected.size} files)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
