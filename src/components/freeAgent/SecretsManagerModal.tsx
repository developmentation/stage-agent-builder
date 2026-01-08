// Secrets Manager Modal - Full UI for managing secrets and tool mappings
import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Download,
  Upload,
  FileText,
  Link,
  X,
  Settings,
  AlertTriangle,
  Check,
  Copy,
} from 'lucide-react';
import type { SecretsManager } from '@/hooks/useSecretsManager';
import type { Secret, ToolParameterMapping, CustomHeader } from '@/types/secrets';
import type { ToolsManifest, ToolDefinition } from '@/types/freeAgent';
import type { ToolInstancesManager } from '@/hooks/useToolInstances';
import { toast } from 'sonner';

interface SecretsManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secretsManager: SecretsManager;
  toolsManifest: ToolsManifest | null;
  toolInstancesManager?: ToolInstancesManager;
}

export function SecretsManagerModal({
  open,
  onOpenChange,
  secretsManager,
  toolsManifest,
  toolInstancesManager,
}: SecretsManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'secrets' | 'mappings' | 'import'>('secrets');
  
  // Secret form state
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [editingSecretId, setEditingSecretId] = useState<string | null>(null);
  const [editingSecretValue, setEditingSecretValue] = useState('');
  
  // Mapping form state
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [selectedParam, setSelectedParam] = useState<string>('');
  const [selectedSecretKey, setSelectedSecretKey] = useState<string>('');
  const [newHeaderName, setNewHeaderName] = useState('');
  const [selectedHeaderSecretKey, setSelectedHeaderSecretKey] = useState<string>('');
  
  // Import state
  const [importText, setImportText] = useState('');
  const [importType, setImportType] = useState<'json' | 'env'>('env');
  const [exportIncludeValues, setExportIncludeValues] = useState(false);
  
  // Confirm dialogs
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteSecretId, setDeleteSecretId] = useState<string | null>(null);

  // Tool type filter for mappings tab
  const [toolTypeFilter, setToolTypeFilter] = useState<'global' | 'instances'>('global');

  // Get tools that have edge functions (can receive secrets)
  const edgeFunctionTools = useMemo(() => {
    if (!toolsManifest?.tools) return [];
    return Object.entries(toolsManifest.tools)
      .filter(([_, tool]) => tool.edge_function)
      .map(([id, tool]) => ({ id, ...tool }));
  }, [toolsManifest]);

  // Get tools that have instances vs global-only tools
  const toolsWithInstances = useMemo(() => {
    if (!toolInstancesManager) return new Set<string>();
    return new Set(toolInstancesManager.instances.map(i => i.baseToolId));
  }, [toolInstancesManager?.instances]);

  // Filter tools based on whether they have instances
  const globalOnlyTools = useMemo(() => {
    return edgeFunctionTools.filter(tool => !toolsWithInstances.has(tool.id));
  }, [edgeFunctionTools, toolsWithInstances]);

  // Get all tool instances for the dropdown
  const allInstances = useMemo(() => {
    return toolInstancesManager?.instances || [];
  }, [toolInstancesManager?.instances]);

  // Get parameters for selected tool (handles both global and instance tools)
  const selectedToolParams = useMemo(() => {
    if (!selectedTool || !toolsManifest?.tools) return [];
    
    // For instances, extract the base tool ID
    const baseToolId = selectedTool.includes(':') ? selectedTool.split(':')[0] : selectedTool;
    const tool = toolsManifest.tools[baseToolId];
    if (!tool?.parameters) return [];
    return Object.entries(tool.parameters).map(([name, param]) => ({
      name,
      ...param,
    }));
  }, [selectedTool, toolsManifest]);

  // Toggle secret visibility
  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Add new secret
  const handleAddSecret = () => {
    if (!newSecretName.trim() || !newSecretKey.trim() || !newSecretValue.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    
    // Check for duplicate key
    if (secretsManager.getSecretByKey(newSecretKey)) {
      toast.error(`Secret with key "${newSecretKey}" already exists`);
      return;
    }
    
    secretsManager.addSecret(newSecretName, newSecretKey, newSecretValue);
    setNewSecretName('');
    setNewSecretKey('');
    setNewSecretValue('');
    toast.success('Secret added');
  };

  // Update secret value
  const handleUpdateSecretValue = (id: string) => {
    if (!editingSecretValue.trim()) {
      toast.error('Secret value cannot be empty');
      return;
    }
    secretsManager.updateSecret(id, { value: editingSecretValue });
    setEditingSecretId(null);
    setEditingSecretValue('');
    toast.success('Secret updated');
  };

  // Delete secret
  const handleDeleteSecret = () => {
    if (deleteSecretId) {
      secretsManager.deleteSecret(deleteSecretId);
      setDeleteSecretId(null);
      toast.success('Secret deleted');
    }
  };

  // Add parameter mapping
  const handleAddMapping = () => {
    if (!selectedTool || !selectedParam || !selectedSecretKey) {
      toast.error('Please select tool, parameter, and secret');
      return;
    }
    secretsManager.addMapping(selectedTool, selectedParam, selectedSecretKey);
    setSelectedParam('');
    setSelectedSecretKey('');
    toast.success('Mapping added');
  };

  // Add header mapping
  const handleAddHeaderMapping = () => {
    if (!selectedTool || !newHeaderName.trim() || !selectedHeaderSecretKey) {
      toast.error('Please select tool, enter header name, and select secret');
      return;
    }
    secretsManager.addHeaderMapping(selectedTool, newHeaderName, selectedHeaderSecretKey);
    setNewHeaderName('');
    setSelectedHeaderSecretKey('');
    toast.success('Header mapping added');
  };

  // Import handler
  const handleImport = () => {
    if (!importText.trim()) {
      toast.error('Please paste content to import');
      return;
    }
    
    try {
      if (importType === 'env') {
        secretsManager.importFromEnv(importText);
        toast.success('Secrets imported from ENV');
      } else {
        const parsed = JSON.parse(importText);
        // For JSON import, we need to ask for secret values
        // For now, import with empty values if it's an export format
        if (parsed.secrets && parsed.mappings) {
          // This is an export format - check if values are included
          const secretValues: Record<string, string> = {};
          let hasValues = false;
          parsed.secrets.forEach((s: { key: string; value?: string }) => {
            if (s.value) {
              secretValues[s.key] = s.value;
              hasValues = true;
            } else {
              secretValues[s.key] = '';
            }
          });
          secretsManager.importConfig(parsed, secretValues);
          if (hasValues) {
            toast.success('Config imported with secret values');
          } else {
            toast.info('Config imported - please fill in secret values');
          }
        } else {
          // Try to import as key-value pairs
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string') {
              const existing = secretsManager.getSecretByKey(key);
              if (existing) {
                secretsManager.updateSecret(existing.id, { value });
              } else {
                secretsManager.addSecret(key, key, value);
              }
            }
          }
          toast.success('Secrets imported from JSON');
        }
      }
      setImportText('');
    } catch (e) {
      toast.error('Failed to parse import content');
      console.error('Import error:', e);
    }
  };

  // Export handler
  const handleExport = () => {
    const exported = secretsManager.exportConfig(exportIncludeValues);
    const json = JSON.stringify(exported, null, 2);
    navigator.clipboard.writeText(json);
    toast.success(exportIncludeValues 
      ? 'Config copied to clipboard (WITH secret values - handle securely!)' 
      : 'Config copied to clipboard (without secret values)');
  };

  // Clear all
  const handleClearAll = () => {
    secretsManager.clearAll();
    setClearConfirmOpen(false);
    toast.success('All secrets cleared');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-50px)] h-[calc(100%-50px)] max-w-none max-h-none flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Secrets Manager
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="secrets" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Key className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Secrets</span> ({secretsManager.secrets.length})
              </TabsTrigger>
              <TabsTrigger value="mappings" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Link className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Mappings</span> ({secretsManager.mappings.length + secretsManager.headerMappings.reduce((acc, hm) => acc + hm.headers.length, 0)})
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Import/Export</span>
                <span className="sm:hidden">I/E</span>
              </TabsTrigger>
            </TabsList>

            {/* Secrets Tab */}
            <TabsContent value="secrets" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-4 pr-2">
                  {/* Add Secret Form */}
                  <div className="p-3 sm:p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-medium mb-3">Add New Secret</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Display Name</Label>
                        <Input
                          placeholder="e.g., GitHub PAT"
                          value={newSecretName}
                          onChange={(e) => setNewSecretName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Key</Label>
                        <Input
                          placeholder="e.g., GITHUB_TOKEN"
                          value={newSecretKey}
                          onChange={(e) => setNewSecretKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                        <Label className="text-xs">Value</Label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Secret value"
                            value={newSecretValue}
                            onChange={(e) => setNewSecretValue(e.target.value)}
                            className="flex-1"
                          />
                          <Button onClick={handleAddSecret} size="icon" className="shrink-0">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Secrets List */}
                  <div className="space-y-2">
                    {secretsManager.secrets.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No secrets configured. Add secrets above to get started.
                      </div>
                    ) : (
                      secretsManager.secrets.map((secret) => (
                        <div
                          key={secret.id}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{secret.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {secret.key}
                              </Badge>
                              {secret.type === 'oauth' && (
                                <Badge variant="secondary" className="text-xs">OAuth</Badge>
                              )}
                            </div>
                            {editingSecretId === secret.id ? (
                              <div className="flex items-center gap-2 mt-2">
                                <Input
                                  type="password"
                                  value={editingSecretValue}
                                  onChange={(e) => setEditingSecretValue(e.target.value)}
                                  className="flex-1"
                                  autoFocus
                                />
                                <Button size="sm" onClick={() => handleUpdateSecretValue(secret.id)}>
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingSecretId(null)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground font-mono mt-1">
                                {visibleSecrets.has(secret.id) ? secret.value : '••••••••••••'}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleSecretVisibility(secret.id)}
                                  >
                                    {visibleSecrets.has(secret.id) ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {visibleSecrets.has(secret.id) ? 'Hide' : 'Show'} value
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setEditingSecretId(secret.id);
                                      setEditingSecretValue(secret.value);
                                    }}
                                  >
                                    <Settings className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit value</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteSecretId(secret.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete secret</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Mappings Tab */}
            <TabsContent value="mappings" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-4 pr-2">
                  {/* Tool Selection */}
                  <div className="p-3 sm:p-4 border rounded-lg bg-muted/30">
                    <h3 className="font-medium mb-3">Configure Tool Parameters</h3>
                    <div className="space-y-3">
                      {/* Tool Type Filter - only show if there are instances */}
                      {allInstances.length > 0 && (
                        <div className="flex gap-2 mb-3">
                          <Button
                            variant={toolTypeFilter === 'global' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setToolTypeFilter('global'); setSelectedTool(''); }}
                          >
                            Global Tools ({globalOnlyTools.length})
                          </Button>
                          <Button
                            variant={toolTypeFilter === 'instances' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => { setToolTypeFilter('instances'); setSelectedTool(''); }}
                          >
                            Tool Instances ({allInstances.length})
                          </Button>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs">
                          {toolTypeFilter === 'instances' ? 'Select Tool Instance' : 'Select Tool'}
                        </Label>
                        <Select value={selectedTool} onValueChange={setSelectedTool}>
                          <SelectTrigger>
                            <SelectValue placeholder={toolTypeFilter === 'instances' ? 'Choose an instance...' : 'Choose a tool to configure...'} />
                          </SelectTrigger>
                          <SelectContent>
                            {toolTypeFilter === 'instances' ? (
                              // Show tool instances
                              allInstances.map((instance) => (
                                <SelectItem key={instance.id} value={instance.fullToolId}>
                                  <div className="flex flex-col">
                                    <span>{instance.label}</span>
                                    <span className="text-xs text-muted-foreground">{instance.fullToolId}</span>
                                  </div>
                                </SelectItem>
                              ))
                            ) : (
                              // Show global-only tools (those without instances)
                              (allInstances.length > 0 ? globalOnlyTools : edgeFunctionTools).map((tool) => (
                                <SelectItem key={tool.id} value={tool.id}>
                                  {tool.name} ({tool.id})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedTool && (
                        <>
                          {/* Parameter Mapping */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t">
                            <div className="space-y-1">
                              <Label className="text-xs">Parameter</Label>
                              <Select value={selectedParam} onValueChange={setSelectedParam}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select parameter" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedToolParams.map((param) => (
                                    <SelectItem key={param.name} value={param.name}>
                                      {param.name}
                                      {(param as { sensitive?: boolean }).sensitive && <Badge className="ml-2 text-xs">sensitive</Badge>}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Secret</Label>
                              <Select value={selectedSecretKey} onValueChange={setSelectedSecretKey}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select secret" />
                                </SelectTrigger>
                                <SelectContent>
                                  {secretsManager.secrets.map((secret) => (
                                    <SelectItem key={secret.key} value={secret.key}>
                                      {secret.name} ({secret.key})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end sm:col-span-2 lg:col-span-1">
                              <Button 
                                onClick={handleAddMapping} 
                                disabled={!selectedParam || !selectedSecretKey}
                                className="w-full sm:w-auto"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Map Parameter
                              </Button>
                            </div>
                          </div>

                          {/* Header Mapping */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t">
                            <div className="space-y-1">
                              <Label className="text-xs">Header Name</Label>
                              <Input
                                placeholder="e.g., Authorization"
                                value={newHeaderName}
                                onChange={(e) => setNewHeaderName(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Secret</Label>
                              <Select value={selectedHeaderSecretKey} onValueChange={setSelectedHeaderSecretKey}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select secret" />
                                </SelectTrigger>
                                <SelectContent>
                                  {secretsManager.secrets.map((secret) => (
                                    <SelectItem key={secret.key} value={secret.key}>
                                      {secret.name} ({secret.key})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end sm:col-span-2 lg:col-span-1">
                              <Button 
                                onClick={handleAddHeaderMapping} 
                                disabled={!newHeaderName.trim() || !selectedHeaderSecretKey}
                                className="w-full sm:w-auto"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Map Header
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Active Mappings */}
                  <div className="space-y-3">
                    <h3 className="font-medium">Active Mappings</h3>
                    
                    {/* Parameter Mappings */}
                    {secretsManager.mappings.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm text-muted-foreground">Parameters</h4>
                        {secretsManager.mappings.map((mapping) => (
                          <div
                            key={mapping.id}
                            className="flex items-center justify-between p-2 border rounded bg-background gap-2"
                          >
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <Badge variant="outline" className="shrink-0">{mapping.toolId}</Badge>
                              <span className="text-muted-foreground">.</span>
                              <span className="font-mono text-sm truncate">{mapping.parameterPath}</span>
                              <span className="text-muted-foreground">→</span>
                              <Badge className="shrink-0">{mapping.secretKey}</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => secretsManager.deleteMapping(mapping.id)}
                              className="h-7 w-7 shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Header Mappings */}
                    {secretsManager.headerMappings.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm text-muted-foreground">Headers</h4>
                        {secretsManager.headerMappings.flatMap((hm) =>
                          hm.headers.map((header) => (
                            <div
                              key={header.id}
                              className="flex items-center justify-between p-2 border rounded bg-background gap-2"
                            >
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <Badge variant="outline" className="shrink-0">{hm.toolId}</Badge>
                                <span className="text-muted-foreground">header:</span>
                                <span className="font-mono text-sm truncate">{header.name}</span>
                                <span className="text-muted-foreground">→</span>
                                <Badge className="shrink-0">{header.secretKey}</Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => secretsManager.deleteHeaderMapping(hm.toolId, header.id)}
                                className="h-7 w-7 shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {secretsManager.mappings.length === 0 && secretsManager.headerMappings.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No mappings configured. Select a tool above to add mappings.
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Import/Export Tab */}
            <TabsContent value="import" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-4 pr-2">
                  {/* Import Section */}
                  <div className="flex flex-col gap-3 p-3 sm:p-4 border rounded-lg">
                    <h3 className="font-medium">Import Secrets</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={importType === 'env' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setImportType('env')}
                        className="flex-1 sm:flex-none"
                      >
                        <FileText className="w-4 h-4 mr-1 shrink-0" />
                        <span>ENV</span>
                      </Button>
                      <Button
                        variant={importType === 'json' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setImportType('json')}
                        className="flex-1 sm:flex-none"
                      >
                        <FileText className="w-4 h-4 mr-1 shrink-0" />
                        <span>JSON</span>
                      </Button>
                    </div>
                    <Textarea
                      placeholder={
                        importType === 'env'
                          ? 'GITHUB_TOKEN=ghp_xxxx\nAPI_KEY=sk-xxxx\n...'
                          : '{\n  "GITHUB_TOKEN": "ghp_xxxx",\n  "API_KEY": "sk-xxxx"\n}'
                      }
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="min-h-[150px] font-mono text-sm"
                    />
                    <Button onClick={handleImport} disabled={!importText.trim()} className="w-full">
                      <Upload className="w-4 h-4 mr-2 shrink-0" />
                      Import
                    </Button>
                  </div>

                  {/* Export Section */}
                  <div className="flex flex-col gap-3 p-3 sm:p-4 border rounded-lg">
                    <h3 className="font-medium">Export Configuration</h3>
                    <p className="text-sm text-muted-foreground">
                      {exportIncludeValues 
                        ? <><strong className="text-destructive">Warning:</strong> Secret values WILL be exported. Handle the output securely!</>
                        : <>Secret values are NOT exported for security - only keys and mappings.</>
                      }
                    </p>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="include-values"
                        checked={exportIncludeValues}
                        onCheckedChange={(checked) => setExportIncludeValues(checked === true)}
                      />
                      <Label htmlFor="include-values" className="text-sm cursor-pointer">
                        Include secret values in export
                      </Label>
                    </div>
                    <div className="bg-muted/30 rounded p-3 overflow-auto max-h-[200px]">
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(secretsManager.exportConfig(exportIncludeValues), null, 2)}
                      </pre>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={handleExport} className="flex-1">
                        <Copy className="w-4 h-4 mr-2 shrink-0" />
                        <span className="truncate">Copy to Clipboard</span>
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setClearConfirmOpen(true)}
                        disabled={secretsManager.secrets.length === 0}
                        className="sm:flex-none"
                      >
                        <Trash2 className="w-4 h-4 sm:mr-2 shrink-0" />
                        <span className="hidden sm:inline">Clear All</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Secret Confirmation */}
      <AlertDialog open={!!deleteSecretId} onOpenChange={() => setDeleteSecretId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Secret
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the secret and remove all mappings that reference it.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSecret} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Clear All Secrets
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all secrets and mappings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
