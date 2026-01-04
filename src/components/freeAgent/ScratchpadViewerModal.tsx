// Scratchpad Viewer Modal - Full screen view of scratchpad content
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface ScratchpadViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  label?: string;
}

export function ScratchpadViewerModal({ open, onOpenChange, content, label }: ScratchpadViewerModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="flex flex-col p-0 gap-0"
        style={{ 
          width: 'calc(100vw - 100px)', 
          height: 'calc(100vh - 100px)',
          maxWidth: 'calc(100vw - 100px)',
          maxHeight: 'calc(100vh - 100px)',
        }}
      >
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-amber-700 dark:text-amber-300">
              {label || 'Scratchpad'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="markdown" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 w-fit shrink-0">
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
          </TabsList>

          <TabsContent value="markdown" className="flex-1 min-h-0 m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                {content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-muted-foreground italic">No content</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="flex-1 min-h-0 m-0 p-0">
            <ScrollArea className="h-full">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words">
                {content || 'No content'}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
