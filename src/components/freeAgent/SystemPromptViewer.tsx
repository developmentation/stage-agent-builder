import React, { useState, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronDown, 
  ChevronRight, 
  Lock, 
  Pencil, 
  RefreshCw,
  Download,
  Upload,
  Eye,
  Code,
  FileJson,
  Cpu,
  Brain,
  Shield,
  Workflow,
  AlertTriangle,
  Database,
  Settings
} from "lucide-react";
import type { SystemPromptTemplate, PromptSection, ResponseSchema } from "@/types/systemPrompt";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SystemPromptViewerProps {
  onClose?: () => void;
}

// Icon mapping for section types
const sectionIcons: Record<string, React.ReactNode> = {
  identity: <Cpu className="h-4 w-4" />,
  tools: <Settings className="h-4 w-4" />,
  memory: <Brain className="h-4 w-4" />,
  workflow: <Workflow className="h-4 w-4" />,
  anti_loop: <Shield className="h-4 w-4" />,
  response_format: <FileJson className="h-4 w-4" />,
  data_handling: <Database className="h-4 w-4" />,
  execution: <AlertTriangle className="h-4 w-4" />,
  dynamic: <RefreshCw className="h-4 w-4" />,
  custom: <Pencil className="h-4 w-4" />,
};

// Color mapping for editable status
const editableColors: Record<string, string> = {
  readonly: "bg-muted text-muted-foreground",
  editable: "bg-primary/10 text-primary border-primary/30",
  dynamic: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
};

const editableLabels: Record<string, string> = {
  readonly: "System",
  editable: "Customizable",
  dynamic: "Runtime",
};

function SectionCard({ section, isExpanded, onToggle }: { 
  section: PromptSection; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const icon = sectionIcons[section.type] || <FileJson className="h-4 w-4" />;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={`border rounded-lg mb-2 overflow-hidden transition-colors ${
        section.editable === 'editable' ? 'border-primary/30 bg-primary/5' : 
        section.editable === 'dynamic' ? 'border-amber-500/30 bg-amber-500/5' : 
        'border-border bg-card'
      }`}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left">
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
            <span className="text-muted-foreground">{icon}</span>
            <span className="flex-1 font-medium text-sm">{section.title}</span>
            <Badge variant="outline" className={`text-xs ${editableColors[section.editable]}`}>
              {section.editable === 'readonly' && <Lock className="h-3 w-3 mr-1" />}
              {section.editable === 'editable' && <Pencil className="h-3 w-3 mr-1" />}
              {section.editable === 'dynamic' && <RefreshCw className="h-3 w-3 mr-1" />}
              {editableLabels[section.editable]}
            </Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-border/50">
            {section.description && (
              <p className="text-xs text-muted-foreground mt-3 mb-2 italic">
                {section.description}
              </p>
            )}
            {section.variables && section.variables.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {section.variables.map((v, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-mono">
                    {v}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2 text-sm bg-muted/30 rounded-md p-3 overflow-x-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-background prose-pre:border prose-pre:border-border prose-code:text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ResponseSchemaCard({ schema }: { schema: ResponseSchema }) {
  const [showRaw, setShowRaw] = useState(false);
  
  const providerColors: Record<string, string> = {
    gemini: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    claude: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    grok: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  
  return (
    <div className="border border-border rounded-lg mb-3 overflow-hidden bg-card">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <Badge className={providerColors[schema.provider]}>
            {schema.provider.charAt(0).toUpperCase() + schema.provider.slice(1)}
          </Badge>
          <span className="font-medium text-sm">{schema.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRaw(!showRaw)}
          className="h-7 text-xs"
        >
          {showRaw ? <Eye className="h-3 w-3 mr-1" /> : <Code className="h-3 w-3 mr-1" />}
          {showRaw ? "Preview" : "Raw JSON"}
        </Button>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-3">{schema.description}</p>
        {showRaw ? (
          <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-80 font-mono">
            {schema.rawSchema}
          </pre>
        ) : (
          <div className="text-sm bg-muted/30 rounded-md p-3">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {`\`\`\`json\n${schema.rawSchema}\n\`\`\``}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SystemPromptViewer({ onClose }: SystemPromptViewerProps) {
  const [template, setTemplate] = useState<SystemPromptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"sections" | "schemas" | "tools">("sections");
  
  // Load template
  useEffect(() => {
    fetch("/data/systemPromptTemplate.json")
      .then((res) => res.json())
      .then((data: SystemPromptTemplate) => {
        setTemplate(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load system prompt template:", err);
        setLoading(false);
      });
  }, []);
  
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);
  
  const expandAll = useCallback(() => {
    if (template) {
      setExpandedSections(new Set(template.sections.map((s) => s.id)));
    }
  }, [template]);
  
  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);
  
  const handleExport = useCallback(() => {
    if (!template) return;
    const exportData = {
      formatVersion: "1.0",
      exportedAt: new Date().toISOString(),
      template,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freeagent-prompt-${template.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [template]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!template) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Failed to load system prompt template
      </div>
    );
  }
  
  // Group sections by type for better organization
  const sectionsByType = template.sections.reduce((acc, section) => {
    const type = section.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(section);
    return acc;
  }, {} as Record<string, PromptSection[]>);
  
  const sortedSections = [...template.sections].sort((a, b) => a.order - b.order);
  
  // Count by editable status
  const editableCounts = {
    editable: template.sections.filter(s => s.editable === 'editable').length,
    readonly: template.sections.filter(s => s.editable === 'readonly').length,
    dynamic: template.sections.filter(s => s.editable === 'dynamic').length,
  };
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <p className="text-xs text-muted-foreground">
              v{template.version} • {template.sections.length} sections
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm" disabled className="h-8" title="Coming in Phase 2">
              <Upload className="h-3 w-3 mr-1" />
              Import
            </Button>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`${editableColors.editable} text-xs`}>
              <Pencil className="h-3 w-3 mr-1" />
              Customizable ({editableCounts.editable})
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`${editableColors.readonly} text-xs`}>
              <Lock className="h-3 w-3 mr-1" />
              System ({editableCounts.readonly})
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`${editableColors.dynamic} text-xs`}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Runtime ({editableCounts.dynamic})
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 mb-2 shrink-0">
          <TabsTrigger value="sections" className="flex-1">
            <FileJson className="h-3 w-3 mr-1" />
            Sections
          </TabsTrigger>
          <TabsTrigger value="schemas" className="flex-1">
            <Code className="h-3 w-3 mr-1" />
            Response Schemas
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex-1">
            <Settings className="h-3 w-3 mr-1" />
            Tools
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="sections" className="flex-1 overflow-hidden m-0 p-0">
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs">
              Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs">
              Collapse All
            </Button>
          </div>
          <ScrollArea className="flex-1 h-[calc(100%-40px)]">
            <div className="p-4">
              {sortedSections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="schemas" className="flex-1 overflow-hidden m-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Response schemas define how the LLM must structure its responses. Each provider uses a different mechanism to enforce JSON structure.
              </p>
              {template.responseSchemas.map((schema, i) => (
                <ResponseSchemaCard key={i} schema={schema} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="tools" className="flex-1 overflow-hidden m-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-medium text-muted-foreground mb-2">Tool Definitions</h3>
                <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
                  Tool definitions are currently loaded from the tools manifest. 
                  Future versions will allow viewing and customizing tool descriptions here.
                </p>
                <Button variant="outline" size="sm" className="mt-4" disabled>
                  Coming in Phase 2
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
