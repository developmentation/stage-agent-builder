import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HelpModal = ({ open, onOpenChange }: HelpModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Agent Builder Console Help</DialogTitle>
          <DialogDescription>
            A comprehensive guide to building AI agent workflows
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(85vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Overview */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Agent Builder Console (ABC) lets you create multi-stage AI workflows where agents and functions work together to process data, make decisions, and produce results.
              </p>
            </section>

            <Separator />

            {/* Stages */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Stages</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Your workflow is organized into <strong>Stages</strong>. Each stage can contain multiple agents and functions that run in parallel.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Add Stage:</strong> Click the "Add Stage" button to create a new stage in your workflow</li>
                <li><strong>Stage Order:</strong> Stages execute sequentially from top to bottom (Stage 1, then Stage 2, etc.)</li>
                <li><strong>Parallel Execution:</strong> All cards within the same stage run simultaneously</li>
              </ul>
            </section>

            <Separator />

            {/* Agents & Functions */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Agents & Functions</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Drag items from the Library panel onto stages to build your workflow:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Agents:</strong> AI-powered components that can reason, analyze, and generate content using various models (GPT-4, Claude, Gemini, etc.)</li>
                <li><strong>Functions:</strong> Pre-built utilities like web scraping, API calls, Google search, weather data, file parsing, and more</li>
                <li><strong>Excel Input:</strong> Special input source that loads data from Excel files for batch processing</li>
              </ul>
            </section>

            <Separator />

            {/* Placeholders */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Using Placeholders: {"{input}"} and {"{prompt}"}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Use placeholders in your agent prompts and function parameters to reference data:
              </p>
              
              <div className="space-y-4">
                <div className="bg-muted p-3 rounded-md">
                  <h4 className="font-semibold text-sm mb-2">{"{input}"}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                    <li><strong>Stage 1:</strong> Contains the original user input or trigger text</li>
                    <li><strong>Later Stages:</strong> Contains the concatenated outputs from all connected cards in previous stages</li>
                  </ul>
                </div>

                <div className="bg-muted p-3 rounded-md">
                  <h4 className="font-semibold text-sm mb-2">{"{prompt}"}</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                    <li><strong>All Stages:</strong> Always contains the original input from Stage 1</li>
                    <li><strong>Use Case:</strong> Access the initial user input even in later stages when {"{input}"} has been replaced with previous outputs</li>
                  </ul>
                </div>

                <div className="bg-accent/50 p-3 rounded-md border border-border">
                  <h4 className="font-semibold text-sm mb-2">Example:</h4>
                  <p className="text-xs text-muted-foreground font-mono mb-2">Stage 1 prompt: "Summarize this: {"{input}"}"</p>
                  <p className="text-xs text-muted-foreground font-mono mb-2">Stage 2 prompt: "Translate to French: {"{input}"}"</p>
                  <p className="text-xs text-muted-foreground font-mono">Stage 3 prompt: "Compare the original ({"{prompt}"}) with translation ({"{input}"})"</p>
                </div>
              </div>
            </section>

            <Separator />

            {/* Linking Cards */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Linking Cards</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Connect cards between stages to pass data through your workflow:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Click Output:</strong> Click the circular connection point on the right edge of a source card</li>
                <li><strong>Click Input:</strong> Click the connection point on the left edge of a target card in the next stage</li>
                <li><strong>Data Flow:</strong> Connected cards pass their output as input to downstream cards</li>
                <li><strong>Multiple Connections:</strong> A card can receive input from multiple sources (outputs are concatenated)</li>
                <li><strong>Delete Links:</strong> Click on a connection line and press Delete to remove it</li>
              </ul>
            </section>

            <Separator />

            {/* Properties Panel */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Properties Panel</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Click any card to view and edit its properties:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Agents:</strong> Configure name, system prompt, and user prompt template</li>
                <li><strong>Functions:</strong> Set required parameters based on the function type (URLs, search text, separators, etc.)</li>
                <li><strong>Output Preview:</strong> View the execution results after running the workflow or individual agents/functions</li>
                <li><strong>Real-time Updates:</strong> Changes are saved automatically as you type</li>
              </ul>
            </section>

            <Separator />

            {/* Toolbar Actions */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Toolbar Actions</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Add Stage:</strong> Create a new stage in your workflow</li>
                <li><strong>Load:</strong> Import a previously saved workflow from a JSON file</li>
                <li><strong>Save:</strong> Export your current workflow as a JSON file for backup or sharing</li>
                <li><strong>Clear:</strong> Remove all stages and reset the workflow to start fresh</li>
                <li><strong>Run Workflow:</strong> Execute your complete workflow from Stage 1 through to the end</li>
              </ul>
            </section>

            <Separator />

            {/* Running Workflows */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Running Workflows</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Execute your workflow to see results:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Provide Input:</strong> Enter your initial input text in the dialog that appears</li>
                <li><strong>Sequential Execution:</strong> Stages run one after another, waiting for all cards in a stage to complete before moving to the next</li>
                <li><strong>Output Log:</strong> View real-time execution progress and results in the output panel at the bottom</li>
                <li><strong>Card Outputs:</strong> Click any card after execution to view its specific output in the Properties panel</li>
              </ul>
            </section>

            <Separator />

            {/* Excel Integration */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Excel & File Upload</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Extract text from files and add them to your input:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li><strong>Upload Button:</strong> Click "Upload Files" in the Input/Trigger section to select files</li>
                <li><strong>Supported Formats:</strong> Supports text files, PDFs, Word docs (.docx), Excel (.xlsx, .xls), code files, and more</li>
                <li><strong>Excel Files:</strong> When uploading Excel files, a selector appears to choose specific sheets and rows</li>
                <li><strong>Text Extraction:</strong> Extracted content is automatically added to the Input/Trigger field for use with {"{input}"} or {"{prompt}"}</li>
              </ul>
            </section>

            <Separator />

            {/* Tips */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Tips & Best Practices</h3>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Start simple with 1-2 stages and test before adding complexity</li>
                <li>Use descriptive names for agents to track their purpose</li>
                <li>Test individual agents by clicking "Test Agent" in the properties panel</li>
                <li>Save your workflows frequently to avoid losing work</li>
                <li>Use parallel execution (multiple cards in one stage) for independent tasks</li>
                <li>Chain stages for sequential processing (summarize → analyze → report)</li>
                <li>Monitor the output log to debug issues during execution</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
