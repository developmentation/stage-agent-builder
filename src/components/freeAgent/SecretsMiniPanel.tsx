// Secrets Mini Panel - Summary display for the Control panel sub-tab
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Key,
  Link,
  Settings,
  AlertTriangle,
  Check,
} from 'lucide-react';
import type { SecretsManager } from '@/hooks/useSecretsManager';

interface SecretsMiniPanelProps {
  secretsManager: SecretsManager;
  onOpenModal: () => void;
}

export function SecretsMiniPanel({
  secretsManager,
  onOpenModal,
}: SecretsMiniPanelProps) {
  const totalMappings = secretsManager.mappings.length + 
    secretsManager.headerMappings.reduce((acc, hm) => acc + hm.headers.length, 0);

  const hasSecrets = secretsManager.secrets.length > 0;
  const hasMappings = totalMappings > 0;

  // Get configured params for display
  const configuredParams = secretsManager.getConfiguredToolParams();

  return (
    <div className="space-y-4 p-2">
      {/* Summary Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={hasSecrets ? "default" : "outline"} className="gap-1">
          <Key className="w-3 h-3" />
          {secretsManager.secrets.length} secrets
        </Badge>
        <Badge variant={hasMappings ? "default" : "outline"} className="gap-1">
          <Link className="w-3 h-3" />
          {totalMappings} mappings
        </Badge>
      </div>

      {/* Quick status */}
      {!hasSecrets && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/50 rounded">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          No secrets configured
        </div>
      )}

      {hasSecrets && !hasMappings && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 bg-muted/50 rounded">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          Secrets not mapped to tools
        </div>
      )}

      {hasSecrets && hasMappings && (
        <div className="flex items-center gap-2 text-sm text-green-600 p-2 bg-green-500/10 rounded">
          <Check className="w-4 h-4" />
          {totalMappings} parameter{totalMappings !== 1 ? 's' : ''} configured
        </div>
      )}

      {/* Configured Parameters List */}
      {configuredParams.length > 0 && (
        <ScrollArea className="h-[120px]">
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              Configured Parameters
            </h4>
            {configuredParams.map((cp, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1"
              >
                <Badge variant="outline" className="text-xs py-0">
                  {cp.tool}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <span className="font-mono">{cp.param}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Open Modal Button */}
      <Button onClick={onOpenModal} className="w-full" variant="outline">
        <Settings className="w-4 h-4 mr-2" />
        Manage Secrets
      </Button>
    </div>
  );
}
