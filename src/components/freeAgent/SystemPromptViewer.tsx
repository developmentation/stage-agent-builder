import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  GripVertical,
  Search,
  Globe,
  Clock,
  Cloud,
  FileText,
  Github,
  ClipboardList,
  Mail,
  HelpCircle,
  Image,
  Volume2,
  BarChart2,
  Archive,
  ScanText,
  FolderOutput,
  FileCode,
  ClipboardCopy,
  ClipboardEdit,
  MessageSquare,
  Files,
  FileSearch,
  FileArchive,
  Edit3
} from "lucide-react";
import type { SystemPromptTemplate, PromptSection, ResponseSchema, ExportedPromptTemplate, ToolsManifest, ToolDefinition, ToolCategory } from "@/types/systemPrompt";
// Prompt customization is now passed as a prop from FreeAgentView
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PromptCustomizationHook {
  hasCustomizations: boolean;
  customizedSectionIds: Set<string>;
  getEffectiveContent: (section: PromptSection) => string;
  isCustomized: (sectionId: string) => boolean;
  updateSection: (sectionId: string, content: string) => void;
  resetSection: (sectionId: string) => void;
  resetAll: () => void;
  addCustomSection: (section: Omit<PromptSection, 'id' | 'order'>) => string;
  updateCustomSection: (sectionId: string, updates: Partial<PromptSection>) => void;
  deleteCustomSection: (sectionId: string) => void;
  getCustomSections: () => PromptSection[];
  moveSection: (sectionId: string, direction: 'up' | 'down', allSections: PromptSection[]) => void;
  getSortedSections: (templateSections: PromptSection[]) => PromptSection[];
  hasOrderChanges: boolean;
  resetOrder: () => void;
  getEffectiveToolDescription: (toolId: string, originalDescription: string) => string;
  isToolCustomized: (toolId: string) => boolean;
  updateToolDescription: (toolId: string, description: string) => void;
  resetToolDescription: (toolId: string) => void;
  hasToolCustomizations: boolean;
  exportCustomizations: (template: SystemPromptTemplate) => ExportedPromptTemplate;
  importCustomizations: (data: ExportedPromptTemplate, currentTemplate: SystemPromptTemplate) => boolean;
  // Disabling
  isSectionDisabled: (sectionId: string) => boolean;
  toggleSectionDisabled: (sectionId: string) => void;
  isToolDisabled: (toolId: string) => boolean;
  toggleToolDisabled: (toolId: string) => void;
  // Custom name
  getCustomName: () => string | undefined;
  setCustomName: (name: string) => void;
}

interface SystemPromptViewerProps {
  onClose?: () => void;
  configuredParams?: Array<{ tool: string; param: string }>;
  promptCustomization: PromptCustomizationHook;
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

// Icon mapping for tools
const toolIconMap: Record<string, React.ReactNode> = {
  Clock: <Clock className="h-4 w-4" />,
  Cloud: <Cloud className="h-4 w-4" />,
  Search: <Search className="h-4 w-4" />,
  Globe: <Globe className="h-4 w-4" />,
  Github: <Github className="h-4 w-4" />,
  FileCode: <FileCode className="h-4 w-4" />,
  ClipboardList: <ClipboardList className="h-4 w-4" />,
  Edit3: <Edit3 className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  Database: <Database className="h-4 w-4" />,
  ClipboardCopy: <ClipboardCopy className="h-4 w-4" />,
  ClipboardEdit: <ClipboardEdit className="h-4 w-4" />,
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  Files: <Files className="h-4 w-4" />,
  Archive: <Archive className="h-4 w-4" />,
  FileArchive: <FileArchive className="h-4 w-4" />,
  FolderOutput: <FolderOutput className="h-4 w-4" />,
  FileSearch: <FileSearch className="h-4 w-4" />,
  ScanText: <ScanText className="h-4 w-4" />,
  Brain: <Brain className="h-4 w-4" />,
  BarChart2: <BarChart2 className="h-4 w-4" />,
  Mail: <Mail className="h-4 w-4" />,
  HelpCircle: <HelpCircle className="h-4 w-4" />,
  Image: <Image className="h-4 w-4" />,
  Volume2: <Volume2 className="h-4 w-4" />,
  Download: <Download className="h-4 w-4" />,
  Upload: <Upload className="h-4 w-4" />,
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
  isDisabled?: boolean;
  onToggleDisabled?: () => void;
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
  isLast,
  isDisabled,
  onToggleDisabled
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
        isDisabled ? 'opacity-50 border-muted bg-muted/30' :
        isCustomSection ? 'border-purple-500/50 bg-purple-500/5' :
        isCustomized ? 'border-green-500/50 bg-green-500/5' :
        section.editable === 'editable' ? 'border-primary/30 bg-primary/5' : 
        section.editable === 'dynamic' ? 'border-amber-500/30 bg-amber-500/5' : 
        'border-border bg-card'
      }`}>
        <div className="flex items-center">
          {/* Enable/Disable toggle */}
          <div className="flex items-center px-2 border-r border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={!isDisabled}
                    onCheckedChange={() => onToggleDisabled?.()}
                    className="scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isDisabled ? 'Enable section' : 'Disable section'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
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
            <button className="flex-1 px-3 py-3 flex flex-wrap items-center gap-2 hover:bg-muted/50 transition-colors text-left min-w-0 overflow-hidden">
              <span className="text-muted-foreground shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <span className="text-muted-foreground shrink-0">{icon}</span>
              <span className={`font-medium text-sm truncate min-w-0 flex-1 ${isDisabled ? 'line-through text-muted-foreground' : ''}`}>{section.title}</span>
              <div className="flex flex-wrap gap-1 shrink-0">
                {isDisabled && (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted-foreground/30 whitespace-nowrap">
                    Disabled
                  </Badge>
                )}
                {isCustomSection && !isDisabled && (
                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 whitespace-nowrap">
                    <Plus className="h-3 w-3 mr-1" />
                    Custom
                  </Badge>
                )}
                {isCustomized && !isCustomSection && !isDisabled && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 whitespace-nowrap">
                    <Check className="h-3 w-3 mr-1" />
                    Modified
                  </Badge>
                )}
                {!isDisabled && (
                  <Badge variant="outline" className={`text-xs whitespace-nowrap ${editableColors[section.editable]}`}>
                    {section.editable === 'readonly' && <Lock className="h-3 w-3 mr-1" />}
                    {section.editable === 'editable' && <Pencil className="h-3 w-3 mr-1" />}
                    {section.editable === 'dynamic' && <RefreshCw className="h-3 w-3 mr-1" />}
                    {editableLabels[section.editable]}
                  </Badge>
                )}
              </div>
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
                  className="min-h-[200px] w-full max-w-full font-mono text-sm resize-y"
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
              <div className="mt-2 text-sm bg-muted/30 rounded-md p-3 overflow-hidden max-w-full">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-background prose-pre:border prose-pre:border-border prose-code:text-primary break-words" style={{ overflowWrap: 'anywhere' }}>
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
          <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-80 font-mono whitespace-pre-wrap break-words">
            {schema.rawSchema}
          </pre>
        ) : (
          <div className="text-sm bg-muted/30 rounded-md p-3 overflow-hidden max-w-full">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all overflow-hidden">
              {schema.rawSchema}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ToolCard component
interface ToolCardProps {
  toolId: string;
  tool: ToolDefinition;
  categories: Record<string, ToolCategory>;
  isCustomized: boolean;
  effectiveDescription: string;
  onSave: (description: string) => void;
  onReset: () => void;
  isDisabled?: boolean;
  onToggleDisabled?: () => void;
}

function ToolCard({ 
  toolId, 
  tool, 
  categories, 
  isCustomized, 
  effectiveDescription, 
  onSave, 
  onReset,
  isDisabled,
  onToggleDisabled
}: ToolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(effectiveDescription);
  
  const icon = toolIconMap[tool.icon] || <Settings className="h-4 w-4" />;
  const toolCategories = Array.isArray(tool.category) ? tool.category : [tool.category];
  
  useEffect(() => {
    if (!isEditing) {
      setEditDescription(effectiveDescription);
    }
  }, [effectiveDescription, isEditing]);
  
  const handleSave = useCallback(() => {
    onSave(editDescription);
    setIsEditing(false);
    toast.success(`Updated description for "${tool.name}"`);
  }, [editDescription, onSave, tool.name]);
  
  const handleCancel = useCallback(() => {
    setEditDescription(effectiveDescription);
    setIsEditing(false);
  }, [effectiveDescription]);
  
  const handleReset = useCallback(() => {
    onReset();
    setIsEditing(false);
    toast.success(`Reset "${tool.name}" to default description`);
  }, [onReset, tool.name]);
  
  const params = Object.entries(tool.parameters || {});
  const requiredParams = params.filter(([_, p]) => p.required);
  const optionalParams = params.filter(([_, p]) => !p.required);
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className={`border rounded-lg mb-2 overflow-hidden transition-colors ${
        isDisabled ? 'opacity-50 border-muted bg-muted/30' :
        isCustomized ? 'border-green-500/50 bg-green-500/5' : 'border-border bg-card'
      }`}>
        <div className="flex items-center">
          {/* Enable/Disable toggle */}
          <div className="flex items-center px-2 border-r border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={!isDisabled}
                    onCheckedChange={() => onToggleDisabled?.()}
                    className="scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isDisabled ? 'Enable tool' : 'Disable tool'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <CollapsibleTrigger asChild>
            <button className="flex-1 px-3 py-3 flex flex-wrap items-center gap-2 hover:bg-muted/50 transition-colors text-left min-w-0 overflow-hidden">
              <span className="text-muted-foreground shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <span className="text-muted-foreground shrink-0">{icon}</span>
              <span className={`font-medium text-sm truncate min-w-0 flex-1 ${isDisabled ? 'line-through text-muted-foreground' : ''}`}>{tool.name}</span>
              <div className="flex flex-wrap gap-1 shrink-0">
                {isDisabled && (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted-foreground/30 whitespace-nowrap">
                    Disabled
                  </Badge>
                )}
                {!isDisabled && toolCategories.map((cat) => {
                  const category = categories[cat];
                  return category ? (
                    <Badge 
                      key={cat}
                      variant="outline" 
                      className="text-xs whitespace-nowrap"
                      style={{ 
                        backgroundColor: `${category.color}20`,
                        borderColor: `${category.color}50`,
                        color: category.color
                      }}
                    >
                      {category.name}
                    </Badge>
                  ) : null;
                })}
                {isCustomized && !isDisabled && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30 whitespace-nowrap">
                    <Check className="h-3 w-3 mr-1" />
                    Modified
                  </Badge>
                )}
                {tool.frontend_handler && !isDisabled && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 whitespace-nowrap">
                    Frontend
                  </Badge>
                )}
              </div>
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-border/50">
            <div className="mt-3 space-y-3">
              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Description</span>
                  {!isEditing && (
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => { setEditDescription(effectiveDescription); setIsEditing(true); }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      {isCustomized && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs text-muted-foreground"
                          onClick={handleReset}
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="min-h-[80px] font-mono text-sm resize-y"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleSave} className="h-7 text-xs">
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 text-xs">
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/80 break-words" style={{ overflowWrap: 'anywhere' }}>{effectiveDescription}</p>
                )}
              </div>
              
              {/* Parameters */}
              {params.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Parameters</span>
                  <div className="mt-1 space-y-2">
                    {requiredParams.map(([name, param]) => (
                      <div key={name} className="flex flex-wrap items-start gap-1.5 text-xs">
                        <code className="px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono shrink-0">{name}</code>
                        <span className="text-muted-foreground shrink-0">({param.type})</span>
                        <Badge variant="outline" className="h-4 text-[10px] bg-red-500/10 text-red-600 border-red-500/30 shrink-0">required</Badge>
                        <span className="text-muted-foreground break-words w-full sm:w-auto sm:flex-1">{param.description}</span>
                      </div>
                    ))}
                    {optionalParams.map(([name, param]) => (
                      <div key={name} className="flex flex-wrap items-start gap-1.5 text-xs">
                        <code className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded font-mono shrink-0">{name}</code>
                        <span className="text-muted-foreground shrink-0">({param.type})</span>
                        <span className="text-muted-foreground break-words w-full sm:w-auto sm:flex-1">{param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Edge function / Handler */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {tool.edge_function && (
                  <span>Edge Function: <code className="px-1 py-0.5 bg-muted rounded">{tool.edge_function}</code></span>
                )}
                {tool.frontend_handler && (
                  <span>Handler: <code className="px-1 py-0.5 bg-muted rounded">frontend</code></span>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function SystemPromptViewer({ onClose, configuredParams = [], promptCustomization }: SystemPromptViewerProps) {
  const [template, setTemplate] = useState<SystemPromptTemplate | null>(null);
  const [toolsManifest, setToolsManifest] = useState<ToolsManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"sections" | "schemas" | "tools">("sections");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [addSectionDialogOpen, setAddSectionDialogOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [toolSearchQuery, setToolSearchQuery] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use the shared promptCustomization from props
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
    getEffectiveToolDescription,
    isToolCustomized,
    updateToolDescription,
    resetToolDescription,
    hasToolCustomizations,
    isSectionDisabled,
    toggleSectionDisabled,
    isToolDisabled,
    toggleToolDisabled,
    getCustomName,
    setCustomName,
  } = promptCustomization;
  
  // Load template and tools manifest
  useEffect(() => {
    Promise.all([
      fetch("/data/systemPromptTemplate.json").then(res => res.json()),
      fetch("/data/toolsManifest.json").then(res => res.json())
    ]).then(([templateData, toolsData]) => {
      setTemplate(templateData as SystemPromptTemplate);
      setToolsManifest(toolsData as ToolsManifest);
      setLoading(false);
    }).catch((err) => {
      console.error("Failed to load data:", err);
      setLoading(false);
    });
  }, []);
  
  // Group tools by category (dynamic)
  const toolsByCategory = useMemo(() => {
    if (!toolsManifest) return {};
    
    const groups: Record<string, Array<{ id: string; tool: ToolDefinition }>> = {};
    
    Object.entries(toolsManifest.tools).forEach(([id, tool]) => {
      const cats = Array.isArray(tool.category) ? tool.category : [tool.category];
      cats.forEach(cat => {
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({ id, tool });
      });
    });
    
    return groups;
  }, [toolsManifest]);
  
  // Replace dynamic placeholders with actual runtime data
  const getDisplayContent = useCallback((section: PromptSection): string => {
    let content = getEffectiveContent(section);
    
    // Replace {{CONFIGURED_PARAMS}} with actual configured params
    if (content.includes('{{CONFIGURED_PARAMS}}')) {
      if (configuredParams.length === 0) {
        content = content.replace('{{CONFIGURED_PARAMS}}', 
          '*No tool parameters currently configured. Add secrets and mappings in the Secrets tab.*');
      } else {
        // Group by tool
        const byTool: Record<string, string[]> = {};
        for (const cp of configuredParams) {
          if (!byTool[cp.tool]) byTool[cp.tool] = [];
          byTool[cp.tool].push(cp.param);
        }
        
        const paramsList = Object.entries(byTool)
          .map(([tool, params]) => `- **${tool}**: ${params.join(', ')}`)
          .join('\n');
        
        content = content.replace('{{CONFIGURED_PARAMS}}', 
          `## 🔐 PRE-CONFIGURED TOOL PARAMETERS\n\nThe following tool parameters have been pre-configured with secrets/credentials:\n\n${paramsList}\n\n*These values are injected automatically at execution time.*`);
      }
    }
    
    return content;
  }, [getEffectiveContent, configuredParams]);

  // Filter tools by search
  const filteredToolsByCategory = useMemo(() => {
    if (!toolSearchQuery.trim()) return toolsByCategory;
    
    const query = toolSearchQuery.toLowerCase();
    const filtered: Record<string, Array<{ id: string; tool: ToolDefinition }>> = {};
    
    Object.entries(toolsByCategory).forEach(([cat, tools]) => {
      const matchingTools = tools.filter(({ id, tool }) => 
        id.toLowerCase().includes(query) ||
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      );
      if (matchingTools.length > 0) {
        filtered[cat] = matchingTools;
      }
    });
    
    return filtered;
  }, [toolsByCategory, toolSearchQuery]);
  
  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
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
    
    // Use custom name for filename if available
    const customName = getCustomName?.();
    const safeName = (customName || template.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    a.download = `${safeName}-v${template.version}.json`;
    
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template exported successfully");
  }, [template, exportCustomizations, getCustomName]);
  
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
  // For "modified" count, exclude sections that are also disabled (they show "Disabled" badge instead)
  // Also exclude custom sections (they show "Custom" badge instead)
  const visibleCustomizedCount = Array.from(customizedSectionIds).filter(
    id => !isSectionDisabled(id) && !customSectionIds.has(id)
  ).length;
  
  const editableCounts = {
    editable: template.sections.filter(s => s.editable === 'editable').length,
    readonly: template.sections.filter(s => s.editable === 'readonly').length,
    dynamic: template.sections.filter(s => s.editable === 'dynamic').length,
    customized: visibleCustomizedCount,
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
        <div className="flex items-center gap-2 mb-1">
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-lg font-semibold max-w-xs"
                placeholder="Template name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCustomName(editName);
                    setIsEditingName(false);
                    toast.success("Template name updated");
                  } else if (e.key === 'Escape') {
                    setIsEditingName(false);
                  }
                }}
              />
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={() => {
                  setCustomName(editName);
                  setIsEditingName(false);
                  toast.success("Template name updated");
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={() => setIsEditingName(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold">
                {getCustomName() || template.name}
              </h2>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setEditName(getCustomName() || template.name);
                  setIsEditingName(true);
                }}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          v{template.version} • {sortedSections.length} sections
          {toolsManifest && (
            <span className="ml-2">• {Object.keys(toolsManifest.tools).length} tools</span>
          )}
          {editableCounts.custom > 0 && (
            <span className="text-purple-600 dark:text-purple-400 ml-2">
              • {editableCounts.custom} custom
            </span>
          )}
          {(hasCustomizations || hasToolCustomizations) && (
            <span className="text-green-600 dark:text-green-400 ml-2">
              • modified
            </span>
          )}
          {hasOrderChanges && (
            <span className="text-amber-600 dark:text-amber-400 ml-2">
              • reordered
            </span>
          )}
        </p>
        
        {/* Export/Import buttons */}
        <TooltipProvider delayDuration={300}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
                  <Download className="h-3 w-3 xl:mr-1" />
                  <span className="hidden xl:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="xl:hidden">
                Export
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleImportClick} className="h-8">
                  <Upload className="h-3 w-3 xl:mr-1" />
                  <span className="hidden xl:inline">Import</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="xl:hidden">
                Import
              </TooltipContent>
            </Tooltip>
            {(hasCustomizations || hasOrderChanges || editableCounts.custom > 0 || hasToolCustomizations) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setResetDialogOpen(true)} 
                    className="h-8 text-destructive hover:text-destructive"
                  >
                    <RotateCcw className="h-3 w-3 xl:mr-1" />
                    <span className="hidden xl:inline">Reset All</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="xl:hidden">
                  Reset All
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
        
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
        <TooltipProvider delayDuration={300}>
          <TabsList className="mx-4 mt-3 mb-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="sections" className="flex-1 flex items-center justify-center gap-1 px-1 min-w-0">
                  <FileJson className="h-3 w-3 shrink-0" />
                  <span className="hidden xl:inline truncate text-xs">Sections</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="xl:hidden">
                Sections
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="schemas" className="flex-1 flex items-center justify-center gap-1 px-1 min-w-0">
                  <Code className="h-3 w-3 shrink-0" />
                  <span className="hidden xl:inline truncate text-xs">Response Schema</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="xl:hidden">
                Response Schema
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="tools" className="flex-1 flex items-center justify-center gap-1 px-1 min-w-0">
                  <Settings className="h-3 w-3 shrink-0" />
                  <span className="hidden xl:inline truncate text-xs">Tools</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="xl:hidden">
                Tools
              </TooltipContent>
            </Tooltip>
          </TabsList>
        </TooltipProvider>
        
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
                  effectiveContent={getDisplayContent(section)}
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
                  isDisabled={isSectionDisabled(section.id)}
                  onToggleDisabled={() => toggleSectionDisabled(section.id)}
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
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={toolSearchQuery}
                onChange={(e) => setToolSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="pl-8 h-8"
              />
            </div>
            <Badge variant="outline" className="text-xs">
              {toolsManifest ? Object.keys(toolsManifest.tools).length : 0} tools
            </Badge>
            {hasToolCustomizations && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                <Check className="h-3 w-3 mr-1" />
                Customized
              </Badge>
            )}
          </div>
          <ScrollArea className="h-[calc(100%-48px)]">
            <div className="p-4">
              {toolsManifest ? (
                Object.entries(filteredToolsByCategory).length > 0 ? (
                  Object.entries(filteredToolsByCategory)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([categoryId, tools]) => {
                      const category = toolsManifest.categories[categoryId];
                      if (!category) return null;
                      
                      const isExpanded = expandedCategories.has(categoryId);
                      
                      return (
                        <div key={categoryId} className="mb-3">
                        <button
                            onClick={() => toggleCategory(categoryId)}
                            className="w-full flex flex-wrap items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                          >
                            <span className="shrink-0">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                            <span 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: category.color }} 
                            />
                            <span className="font-medium text-sm shrink-0">{category.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({tools.length})</span>
                            <span className="hidden sm:block flex-1" />
                            <span className="text-xs text-muted-foreground break-words w-full sm:w-auto">{category.description}</span>
                          </button>
                          
                          {isExpanded && (
                            <div className="ml-4 mt-2">
                              {tools.map(({ id, tool }) => (
                                <ToolCard
                                  key={id}
                                  toolId={id}
                                  tool={tool}
                                  categories={toolsManifest.categories}
                                  isCustomized={isToolCustomized(id)}
                                  effectiveDescription={getEffectiveToolDescription(id, tool.description)}
                                  onSave={(desc) => updateToolDescription(id, desc)}
                                  onReset={() => resetToolDescription(id)}
                                  isDisabled={isToolDisabled(id)}
                                  onToggleDisabled={() => toggleToolDisabled(id)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tools match "{toolSearchQuery}"</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Loading tools...</p>
                </div>
              )}
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
