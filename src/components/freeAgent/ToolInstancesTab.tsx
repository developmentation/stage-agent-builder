// Tool Instances Tab - UI for creating and managing tool instances
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Trash2, Edit, Copy, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { ToolsManifest } from '@/types/freeAgent';
import type { ToolInstancesManager } from '@/hooks/useToolInstances';

interface ToolInstancesTabProps {
  toolInstancesManager: ToolInstancesManager;
  toolsManifest: ToolsManifest | null;
}

export function ToolInstancesTab({
  toolInstancesManager,
  toolsManifest,
}: ToolInstancesTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state for add/edit
  const [selectedBaseTool, setSelectedBaseTool] = useState<string>('');
  const [instanceName, setInstanceName] = useState('');
  const [instanceLabel, setInstanceLabel] = useState('');
  const [instanceDescription, setInstanceDescription] = useState('');
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

  // Get tools that support instancing (those with edge functions)
  const availableTools = useMemo(() => {
    if (!toolsManifest?.tools) return [];
    return Object.entries(toolsManifest.tools)
      .filter(([_, tool]) => tool.edge_function)
      .map(([id, tool]) => ({ id, name: tool.name, description: tool.description }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [toolsManifest]);

  // Group instances by base tool
  const instancesByTool = useMemo(() => {
    const groups: Record<string, typeof toolInstancesManager.instances> = {};
    for (const instance of toolInstancesManager.instances) {
      if (!groups[instance.baseToolId]) {
        groups[instance.baseToolId] = [];
      }
      groups[instance.baseToolId].push(instance);
    }
    return groups;
  }, [toolInstancesManager.instances]);

  const resetForm = () => {
    setSelectedBaseTool('');
    setInstanceName('');
    setInstanceLabel('');
    setInstanceDescription('');
    setEditingInstanceId(null);
  };

  const handleAddInstance = () => {
    if (!selectedBaseTool || !instanceName.trim() || !instanceLabel.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const result = toolInstancesManager.addInstance(
      selectedBaseTool,
      instanceName,
      instanceLabel,
      instanceDescription
    );

    if (result) {
      toast.success(`Created instance: ${result.fullToolId}`);
      setIsAddModalOpen(false);
      resetForm();
    } else {
      toast.error('Failed to create instance - it may already exist');
    }
  };

  const handleEditInstance = () => {
    if (!editingInstanceId || !instanceLabel.trim()) {
      toast.error('Please fill in required fields');
      return;
    }

    toolInstancesManager.updateInstance(editingInstanceId, {
      instanceName: instanceName,
      label: instanceLabel,
      description: instanceDescription,
    });

    toast.success('Instance updated');
    setIsEditModalOpen(false);
    resetForm();
  };

  const handleDeleteInstance = () => {
    if (deleteConfirmId) {
      toolInstancesManager.deleteInstance(deleteConfirmId);
      toast.success('Instance deleted');
      setDeleteConfirmId(null);
    }
  };

  const openEditModal = (instance: typeof toolInstancesManager.instances[0]) => {
    setEditingInstanceId(instance.id);
    setSelectedBaseTool(instance.baseToolId);
    setInstanceName(instance.instanceName);
    setInstanceLabel(instance.label);
    setInstanceDescription(instance.description);
    setIsEditModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Computed full tool ID preview
  const previewFullId = selectedBaseTool && instanceName.trim()
    ? `${selectedBaseTool}:${instanceName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`
    : '';

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          <span className="font-medium">Tool Instances</span>
          <Badge variant="secondary">{toolInstancesManager.instances.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Instances list */}
      <ScrollArea className="flex-1">
        {toolInstancesManager.instances.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No tool instances configured.</p>
            <p className="text-xs mt-1">Create instances to use multiple configurations of the same tool.</p>
          </div>
        ) : (
          <div className="space-y-3 pr-2">
            {Object.entries(instancesByTool).map(([baseToolId, instances]) => {
              const baseTool = toolsManifest?.tools?.[baseToolId];
              return (
                <div key={baseToolId} className="border rounded-lg p-3">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <span>{baseTool?.name || baseToolId}</span>
                    <Badge variant="outline" className="text-xs">{instances.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {instances.map(instance => (
                      <div
                        key={instance.id}
                        className="flex items-start gap-2 p-2 bg-muted/50 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{instance.label}</span>
                            <button
                              onClick={() => copyToClipboard(instance.fullToolId)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <code className="bg-muted px-1 rounded">{instance.fullToolId}</code>
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                          {instance.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {instance.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditModal(instance)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(instance.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Add Instance Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tool Instance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Base Tool *</Label>
              <Select value={selectedBaseTool} onValueChange={setSelectedBaseTool}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tool..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTools.map(tool => (
                    <SelectItem key={tool.id} value={tool.id}>
                      <div className="flex flex-col">
                        <span>{tool.name}</span>
                        <span className="text-xs text-muted-foreground">{tool.id}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Instance Name *</Label>
              <Input
                placeholder="e.g., policies_database"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              />
              <p className="text-xs text-muted-foreground">
                Alphanumeric and underscores only. Used in tool ID.
              </p>
            </div>

            {previewFullId && (
              <div className="p-2 bg-muted rounded-md">
                <Label className="text-xs">Full Tool ID</Label>
                <code className="block text-sm font-mono">{previewFullId}</code>
              </div>
            )}

            <div className="space-y-2">
              <Label>Display Label *</Label>
              <Input
                placeholder="e.g., Policy Database"
                value={instanceLabel}
                onChange={(e) => setInstanceLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this instance is for..."
                value={instanceDescription}
                onChange={(e) => setInstanceDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddInstance}>
              Create Instance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Instance Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tool Instance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Base Tool</Label>
              <Input value={selectedBaseTool} disabled />
            </div>

            <div className="space-y-2">
              <Label>Instance Name</Label>
              <Input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              />
            </div>

            {previewFullId && (
              <div className="p-2 bg-muted rounded-md">
                <Label className="text-xs">Full Tool ID</Label>
                <code className="block text-sm font-mono">{previewFullId}</code>
              </div>
            )}

            <div className="space-y-2">
              <Label>Display Label *</Label>
              <Input
                value={instanceLabel}
                onChange={(e) => setInstanceLabel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={instanceDescription}
                onChange={(e) => setInstanceDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditInstance}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Instance?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tool instance. Any secret mappings for this instance will also need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInstance}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
