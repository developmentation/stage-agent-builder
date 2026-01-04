import React, { useState, useEffect, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
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
  Settings,
  RotateCcw,
  Save,
  X,
  Check,
  Undo2,
  Plus,
  ChevronUp,
  Trash2,
  GripVertical
} from "lucide-react";
import type { SystemPromptTemplate, PromptSection, ResponseSchema, ExportedPromptTemplate } from "@/types/systemPrompt";
import { usePromptCustomization } from "@/hooks/usePromptCustomization";
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

interface SectionCardProps {
  section: PromptSection;
  isExpanded: boolean;
  onToggle: () => void;
  isCustomized: boolean;
  effectiveContent: string;
  onSave: (content: string) => void;
  onReset: () => void;
  isCustomSection?: boolean;
  onDelete?: () => void;
  onUpdateTitle?: (title: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function SectionCard({ 
  section, 
  isExpanded, 
  onToggle, 
  isCustomized,
  effectiveContent,
  onSave,
  onReset,
  isCustomSection,
  onDelete,
  onUpdateTitle,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}: SectionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(effectiveContent);
  const [editTitle, setEditTitle] = useState(section.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const icon = sectionIcons[section.type] || <FileJson className="h-4 w-4" />;
  const canEdit = section.editable === 'editable';
  
  // Sync edit content when effective content changes (e.g., on reset)
  useEffect(() => {
    if (!isEditing) {
      setEditContent(effectiveContent);
    }
  }, [effectiveContent, isEditing]);
  
  useEffect(() => {
    if (!isEditingTitle) {
      setEditTitle(section.title);
    }
  }, [section.title, isEditingTitle]);
  
  const handleStartEdit = useCallback(() => {
    setEditContent(effectiveContent);
    setIsEditing(true);
  }, [effectiveContent]);
  
  const handleSave = useCallback(() => {
    onSave(editContent);
    setIsEditing(false);
    toast.success(`Saved changes to "${section.title}"`);
  }, [editContent, onSave, section.title]);
  
  const handleCancel = useCallback(() => {
    setEditContent(effectiveContent);
    setIsEditing(false);
  }, [effectiveContent]);
  
  const handleReset = useCallback(() => {
    onReset();
    setEditContent(section.content);
    setIsEditing(false);
    toast.success(`Reset "${section.title}" to default`);
  }, [onReset, section.content, section.title]);
  
  const handleTitleSave = useCallback(() => {
    if (onUpdateTitle && editTitle.trim()) {
      onUpdateTitle(editTitle.trim());
      setIsEditingTitle(false);
      toast.success("Section title updated");
    }
  }, [editTitle, onUpdateTitle]);
  
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={`border rounded-lg mb-2 overflow-hidden transition-colors ${
        isCustomSection ? 'border-purple-500/50 bg-purple-500/5' :
        isCustomized ? 'border-green-500/50 bg-green-500/5' :
        section.editable === 'editable' ? 'border-primary/30 bg-primary/5' : 
        section.editable === 'dynamic' ? 'border-amber-500/30 bg-amber-500/5' : 
        'border-border bg-card'
      }`}>
        <div className="flex items-center">
          {/* Reorder buttons */}
          <div className="flex flex-col px-1 py-2 border-r border-border/50">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0" 
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={isFirst}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <GripVertical className="h-3 w-3 mx-auto text-muted-foreground/50" />
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0" 
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={isLast}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          
          <CollapsibleTrigger asChild>
            <button className="flex-1 px-3 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left">
              <span className="text-muted-foreground">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <span className="text-muted-foreground">{icon}</span>
              <span className="flex-1 font-medium text-sm">{section.title}</span>
              {isCustomSection && (
                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
                  <Plus className="h-3 w-3 mr-1" />
                  Custom
                </Badge>
              )}
              {isCustomized && !isCustomSection && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                  <Check className="h-3 w-3 mr-1" />
                  Modified
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs ${editableColors[section.editable]}`}>
                {section.editable === 'readonly' && <Lock className="h-3 w-3 mr-1" />}
                {section.editable === 'editable' && <Pencil className="h-3 w-3 mr-1" />}
                {section.editable === 'dynamic' && <RefreshCw className="h-3 w-3 mr-1" />}
                {editableLabels[section.editable]}
              </Badge>
            </button>
          </CollapsibleTrigger>
          
          {/* Delete button for custom sections */}
          {isCustomSection && onDelete && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 mr-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-border/50">
            {/* Editable title for custom sections */}
            {isCustomSection && (
              <div className="mt-3 mb-2">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-7 text-sm"
                      placeholder="Section title..."
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={handleTitleSave}>
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsEditingTitle(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit Title
                  </Button>
                )}
              </div>
            )}
            
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
            
            {/* Edit controls for editable sections */}
            {canEdit && !isEditing && (
              <div className="flex items-center gap-2 mt-3 mb-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleStartEdit}
                  className="h-7 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {isCustomized && !isCustomSection && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleReset}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    <Undo2 className="h-3 w-3 mr-1" />
                    Reset to Default
                  </Button>
                )}
              </div>
            )}
            
            {/* Editing mode */}
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[200px] font-mono text-sm resize-y"
                  placeholder="Enter section content..."
                />
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleSave}
                    className="h-7 text-xs"
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCancel}
                    className="h-7 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  {isCustomized && !isCustomSection && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleReset}
                      className="h-7 text-xs text-muted-foreground"
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm bg-muted/30 rounded-md p-3 overflow-x-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-background prose-pre:border prose-pre:border-border prose-code:text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {effectiveContent}
                  </ReactMarkdown>
                </div>
              </div>
            )}
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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    hasCustomizations,
    customizedSectionIds,
    getEffectiveContent,
    isCustomized,
    updateSection,
    resetSection,
    resetAll,
    exportCustomizations,
    importCustomizations,
    addCustomSection,
    updateCustomSection,
    deleteCustomSection,
    getCustomSections,
    moveSection,
    getSortedSections,
    hasOrderChanges,
    resetOrder,
  } = usePromptCustomization(template?.id || "default");
  
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
      const allSections = getSortedSections(template.sections);
      setExpandedSections(new Set(allSections.map((s) => s.id)));
    }
  }, [template, getSortedSections]);
  
  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);
  
  const handleExport = useCallback(() => {
    if (!template) return;
    const exportData = exportCustomizations(template);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freeagent-prompt-${template.version}-custom.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template exported successfully");
  }, [template, exportCustomizations]);
  
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  const handleImportFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !template) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ExportedPromptTemplate;
        
        if (importCustomizations(data, template)) {
          toast.success(`Imported customizations from "${data.template.name}"`);
        } else {
          toast.error("Failed to import template");
        }
      } catch (err) {
        console.error("Import error:", err);
        toast.error("Invalid template file");
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = "";
  }, [template, importCustomizations]);
  
  const handleResetAll = useCallback(() => {
    resetAll();
    setResetDialogOpen(false);
    toast.success("All customizations have been reset to defaults");
  }, [resetAll]);
  
  const handleAddSection = useCallback(() => {
    if (!newSectionTitle.trim()) {
      toast.error("Section title is required");
      return;
    }
    
    const id = addCustomSection({
      title: newSectionTitle.trim(),
      content: newSectionContent || "Enter your custom instructions here...",
      type: 'custom',
      editable: 'editable',
      description: newSectionDescription || undefined,
    });
    
    setAddSectionDialogOpen(false);
    setNewSectionTitle("");
    setNewSectionContent("");
    setNewSectionDescription("");
    setExpandedSections((prev) => new Set([...prev, id]));
    toast.success(`Added custom section "${newSectionTitle}"`);
  }, [newSectionTitle, newSectionContent, newSectionDescription, addCustomSection]);
  
  const handleDeleteSection = useCallback((sectionId: string) => {
    deleteCustomSection(sectionId);
    setDeleteConfirmId(null);
    toast.success("Custom section deleted");
  }, [deleteCustomSection]);
  
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
  
  const sortedSections = getSortedSections(template.sections);
  const customSections = getCustomSections();
  const customSectionIds = new Set(customSections.map(s => s.id));
  
  // Count by editable status
  const editableCounts = {
    editable: template.sections.filter(s => s.editable === 'editable').length,
    readonly: template.sections.filter(s => s.editable === 'readonly').length,
    dynamic: template.sections.filter(s => s.editable === 'dynamic').length,
    customized: customizedSectionIds.size,
    custom: customSections.length,
  };
  
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
      />
      
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <p className="text-xs text-muted-foreground">
              v{template.version} • {sortedSections.length} sections
              {editableCounts.custom > 0 && (
                <span className="text-purple-600 dark:text-purple-400 ml-2">
                  • {editableCounts.custom} custom
                </span>
              )}
              {hasCustomizations && (
                <span className="text-green-600 dark:text-green-400 ml-2">
                  • {editableCounts.customized} modified
                </span>
              )}
              {hasOrderChanges && (
                <span className="text-amber-600 dark:text-amber-400 ml-2">
                  • reordered
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
              <Download className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleImportClick} className="h-8">
              <Upload className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            {(hasCustomizations || hasOrderChanges || editableCounts.custom > 0) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setResetDialogOpen(true)} 
                className="h-8 text-destructive hover:text-destructive"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                <span className="hidden sm:inline">Reset All</span>
              </Button>
            )}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className={`${editableColors.editable} text-xs`}>
            <Pencil className="h-3 w-3 mr-1" />
            Customizable ({editableCounts.editable})
          </Badge>
          <Badge variant="outline" className={`${editableColors.readonly} text-xs`}>
            <Lock className="h-3 w-3 mr-1" />
            System ({editableCounts.readonly})
          </Badge>
          <Badge variant="outline" className={`${editableColors.dynamic} text-xs`}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Runtime ({editableCounts.dynamic})
          </Badge>
          {editableCounts.custom > 0 && (
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30">
              <Plus className="h-3 w-3 mr-1" />
              Custom ({editableCounts.custom})
            </Badge>
          )}
          {hasCustomizations && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
              <Check className="h-3 w-3 mr-1" />
              Modified ({editableCounts.customized})
            </Badge>
          )}
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
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setAddSectionDialogOpen(true)} 
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Section
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={expandAll} className="h-7 text-xs">
              Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} className="h-7 text-xs">
              Collapse All
            </Button>
            {hasOrderChanges && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetOrder} 
                className="h-7 text-xs text-muted-foreground"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                Reset Order
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1 h-[calc(100%-40px)]">
            <div className="p-4">
              {sortedSections.map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  isCustomized={isCustomized(section.id)}
                  effectiveContent={getEffectiveContent(section)}
                  onSave={(content) => {
                    if (customSectionIds.has(section.id)) {
                      updateCustomSection(section.id, { content });
                    } else {
                      updateSection(section.id, content);
                    }
                  }}
                  onReset={() => resetSection(section.id)}
                  isCustomSection={customSectionIds.has(section.id)}
                  onDelete={customSectionIds.has(section.id) ? () => setDeleteConfirmId(section.id) : undefined}
                  onUpdateTitle={customSectionIds.has(section.id) ? (title) => updateCustomSection(section.id, { title }) : undefined}
                  onMoveUp={() => moveSection(section.id, 'up', template.sections)}
                  onMoveDown={() => moveSection(section.id, 'down', template.sections)}
                  isFirst={index === 0}
                  isLast={index === sortedSections.length - 1}
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
                  Coming in Phase 3
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      
      {/* Reset All Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Customizations?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all customizations, custom sections, and order changes back to defaults. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Add Section Dialog */}
      <Dialog open={addSectionDialogOpen} onOpenChange={setAddSectionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Custom Section</DialogTitle>
            <DialogDescription>
              Create a new custom instruction section. Custom sections are fully editable and can be reordered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title *</label>
              <Input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., Custom Guidelines"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={newSectionDescription}
                onChange={(e) => setNewSectionDescription(e.target.value)}
                placeholder="Brief description of this section's purpose"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={newSectionContent}
                onChange={(e) => setNewSectionContent(e.target.value)}
                placeholder="Enter your custom instructions here..."
                className="min-h-[120px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSection} disabled={!newSectionTitle.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Section Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this custom section. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirmId && handleDeleteSection(deleteConfirmId)} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
