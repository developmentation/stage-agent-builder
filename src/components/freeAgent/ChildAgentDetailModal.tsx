// Child Agent Detail Modal - View individual child agent execution details
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChildSession } from "@/types/freeAgent";
import { GitBranch, Clock, CheckCircle, XCircle, Loader2, FileText, Wrench, MessageSquare, Database, FileOutput, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RawViewer } from "./RawViewer";

interface ChildAgentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  child: ChildSession | null;
}

export function ChildAgentDetailModal({ isOpen, onClose, child }: ChildAgentDetailModalProps) {
  if (!child) return null;

  const getStatusBadge = () => {
    switch (child.status) {
      case "running":
        return <Badge className="bg-amber-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case "paused":
        return <Badge className="bg-orange-500">Paused</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[calc(100%-50px)] h-[calc(100vh-100px)] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-amber-500" />
            <DialogTitle className="text-lg">{child.name}</DialogTitle>
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Started: {formatTimestamp(child.startTime)}
            </span>
            {child.endTime && (
              <span>Ended: {formatTimestamp(child.endTime)}</span>
            )}
            <span>Iterations: {child.currentIteration}/{child.maxIterations}</span>
          </div>
        </DialogHeader>

        <Tabs defaultValue="task" className="flex-1 flex flex-col overflow-hidden">
          <div className="mx-6 mt-4 overflow-x-auto">
            <TabsList className="justify-start inline-flex min-w-max gap-1">
              <TabsTrigger value="task" className="gap-1.5">
                <MessageSquare className="w-4 h-4" />
                Task
              </TabsTrigger>
              <TabsTrigger value="blackboard" className="gap-1.5">
                <FileText className="w-4 h-4" />
                Blackboard ({child.blackboard.length})
              </TabsTrigger>
              <TabsTrigger value="tools" className="gap-1.5">
                <Wrench className="w-4 h-4" />
                Tool Calls ({child.toolCalls.length})
              </TabsTrigger>
              <TabsTrigger value="scratchpad" className="gap-1.5">
                <FileText className="w-4 h-4" />
                Scratchpad
              </TabsTrigger>
              <TabsTrigger value="attributes" className="gap-1.5">
                <Database className="w-4 h-4" />
                Attributes ({Object.keys(child.toolResultAttributes || {}).length})
              </TabsTrigger>
              <TabsTrigger value="artifacts" className="gap-1.5">
                <FileOutput className="w-4 h-4" />
                Artifacts ({child.artifacts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="raw" className="gap-1.5">
                <Code className="w-4 h-4" />
                Raw ({child.rawData?.length || 0})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden px-6 pb-6">
            {/* Task Tab */}
            <TabsContent value="task" className="h-full m-0 mt-4">
              <ScrollArea className="h-full overflow-x-hidden">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Assigned Task</h3>
                    <div className="p-4 bg-muted rounded-lg overflow-hidden">
                      <p className="whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{child.task}</p>
                    </div>
                  </div>
                  
                  {child.error && (
                    <div>
                      <h3 className="font-semibold text-red-500 mb-2">Error</h3>
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-500 whitespace-pre-wrap">{child.error}</p>
                      </div>
                    </div>
                  )}

                  {child.promptModifications.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Prompt Modifications</h3>
                      <div className="space-y-2">
                        {child.promptModifications.map((mod, idx) => (
                          <div key={idx} className="p-3 bg-muted rounded text-sm overflow-hidden">
                            <Badge variant="outline" className="mb-1">{mod.type}</Badge>
                            {mod.sectionId && <span className="text-muted-foreground ml-2">Section: {mod.sectionId}</span>}
                            {mod.content && (
                              <p className="mt-2 text-muted-foreground whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{mod.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Blackboard Tab */}
            <TabsContent value="blackboard" className="h-full m-0 mt-4">
              <ScrollArea className="h-full">
                {child.blackboard.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No blackboard entries yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {child.blackboard.map((entry, idx) => (
                      <div key={entry.id || idx} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline">{entry.category}</Badge>
                          {entry.tools && entry.tools.length > 0 && (
                            <span className="text-xs text-amber-500">
                              Tools: [{entry.tools.join(', ')}]
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Iteration {entry.iteration} • {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Tool Calls Tab */}
            <TabsContent value="tools" className="h-full m-0 mt-4">
              <ScrollArea className="h-full">
                {child.toolCalls.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No tool calls executed yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {child.toolCalls.map((tc, idx) => (
                      <div key={tc.id || idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{tc.tool}</span>
                            <Badge 
                              variant={tc.status === 'completed' ? 'default' : tc.status === 'error' ? 'destructive' : 'secondary'}
                              className={tc.status === 'completed' ? 'bg-green-500' : ''}
                            >
                              {tc.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Iteration {tc.iteration}
                          </span>
                        </div>
                        
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="text-muted-foreground">Parameters:</span>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                              {JSON.stringify(tc.params, null, 2)}
                            </pre>
                          </div>
                          
                          {tc.result && (
                            <div>
                              <span className="text-muted-foreground">Result:</span>
                              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
                                {typeof tc.result === 'string' 
                                  ? tc.result
                                  : JSON.stringify(tc.result, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {tc.error && (
                            <div className="text-red-500">
                              <span>Error:</span>
                              <p className="mt-1">{tc.error}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Scratchpad Tab */}
            <TabsContent value="scratchpad" className="h-full m-0 mt-4">
              <ScrollArea className="h-full">
                {!child.scratchpad ? (
                  <div className="text-center text-muted-foreground py-8">
                    No scratchpad content
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {child.scratchpad}
                    </ReactMarkdown>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Attributes Tab */}
            <TabsContent value="attributes" className="h-full m-0 mt-4">
              <ScrollArea className="h-full">
                {!child.toolResultAttributes || Object.keys(child.toolResultAttributes).length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No named attributes saved
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(child.toolResultAttributes).map(([name, attr]) => (
                      <div key={attr.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{name}</span>
                            <Badge variant="outline">{attr.tool}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {attr.size} chars • Iteration {attr.iteration}
                          </span>
                        </div>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
                          {attr.resultString}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Artifacts Tab */}
            <TabsContent value="artifacts" className="h-full m-0 mt-4">
              <ScrollArea className="h-full">
                {!child.artifacts || child.artifacts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No artifacts created
                  </div>
                ) : (
                  <div className="space-y-3">
                    {child.artifacts.map((artifact) => (
                      <div key={artifact.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <FileOutput className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{artifact.title}</span>
                            <Badge variant="outline">{artifact.type}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {artifact.content.length} chars • Iteration {artifact.iteration}
                          </span>
                        </div>
                        {artifact.description && (
                          <p className="text-sm text-muted-foreground mb-2">{artifact.description}</p>
                        )}
                        <pre className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>
                          {artifact.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Raw Data Tab */}
            <TabsContent value="raw" className="h-full m-0 mt-4">
              <RawViewer rawData={child.rawData || []} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
