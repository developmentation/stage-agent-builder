// Reference Resolution System
// Resolves placeholders like {{scratchpad}}, {{attribute:name}}, {{artifacts}} in tool parameters

import type { BlackboardEntry, ToolResultAttribute, FreeAgentArtifact } from "@/types/freeAgent";

export interface ResolverContext {
  scratchpad: string;
  blackboard: BlackboardEntry[];
  attributes: Record<string, ToolResultAttribute>;
  artifacts: FreeAgentArtifact[];
}

// Pattern matchers for different reference types
const PATTERNS = {
  scratchpad: /\{\{scratchpad\}\}/gi,
  blackboard: /\{\{blackboard\}\}/gi,
  attribute: /\{\{attribute:([^}]+)\}\}/gi,
  attributes: /\{\{attributes\}\}/gi,
  artifact: /\{\{artifact:([^}]+)\}\}/gi,
  artifacts: /\{\{artifacts\}\}/gi,
};

/**
 * Check if a value contains any reference placeholders
 */
export function containsReferences(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  
  return (
    PATTERNS.scratchpad.test(value) ||
    PATTERNS.blackboard.test(value) ||
    PATTERNS.attribute.test(value) ||
    PATTERNS.attributes.test(value) ||
    PATTERNS.artifact.test(value) ||
    PATTERNS.artifacts.test(value)
  );
}

/**
 * Resolve all reference placeholders in a value
 * Works recursively on objects and arrays
 */
export function resolveReferences(
  value: unknown,
  context: ResolverContext
): unknown {
  // Handle strings - resolve placeholders
  if (typeof value === 'string') {
    return resolveStringReferences(value, context);
  }
  
  // Handle arrays - resolve each element
  if (Array.isArray(value)) {
    return value.map(item => resolveReferences(item, context));
  }
  
  // Handle objects - resolve each property
  if (typeof value === 'object' && value !== null) {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveReferences(val, context);
    }
    return resolved;
  }
  
  // Return primitives unchanged
  return value;
}

/**
 * Resolve references in a string value
 */
function resolveStringReferences(str: string, ctx: ResolverContext): string {
  let result = str;
  
  // Reset lastIndex for all patterns (they have 'g' flag)
  Object.values(PATTERNS).forEach(p => p.lastIndex = 0);
  
  // {{scratchpad}} -> full scratchpad content
  result = result.replace(PATTERNS.scratchpad, () => ctx.scratchpad || '');
  
  // {{blackboard}} -> formatted blackboard entries
  result = result.replace(PATTERNS.blackboard, () => formatBlackboard(ctx.blackboard));
  
  // {{attributes}} -> all attributes as JSON object
  result = result.replace(PATTERNS.attributes, () => formatAllAttributes(ctx.attributes));
  
  // {{attribute:name}} -> specific attribute content
  // Need to reset regex since we're using it again
  PATTERNS.attribute.lastIndex = 0;
  result = result.replace(PATTERNS.attribute, (_, name) => {
    const trimmedName = name.trim();
    const attr = ctx.attributes[trimmedName];
    if (attr) {
      // Return the result as string - if it's already a string use it, otherwise stringify
      return typeof attr.result === 'string' ? attr.result : JSON.stringify(attr.result, null, 2);
    }
    return `[Attribute '${trimmedName}' not found]`;
  });
  
  // {{artifacts}} -> all artifacts as JSON array
  result = result.replace(PATTERNS.artifacts, () => {
    if (ctx.artifacts.length === 0) return '[]';
    return JSON.stringify(ctx.artifacts.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      description: a.description,
    })), null, 2);
  });
  
  // {{artifact:id}} -> specific artifact content
  // Need to reset regex since we're using it again
  PATTERNS.artifact.lastIndex = 0;
  result = result.replace(PATTERNS.artifact, (_, id) => {
    const trimmedId = id.trim();
    // Search by ID or title
    const artifact = ctx.artifacts.find(a => a.id === trimmedId || a.title === trimmedId);
    if (artifact) {
      return artifact.content;
    }
    return `[Artifact '${trimmedId}' not found]`;
  });
  
  return result;
}

/**
 * Format blackboard entries as readable text
 */
function formatBlackboard(entries: BlackboardEntry[]): string {
  if (!entries || entries.length === 0) return '[No blackboard entries]';
  
  return entries
    .map(e => `[${e.category.toUpperCase()}] (Iteration ${e.iteration}): ${e.content}`)
    .join('\n\n');
}

/**
 * Format all attributes as a JSON object with metadata
 */
function formatAllAttributes(attributes: Record<string, ToolResultAttribute>): string {
  if (!attributes || Object.keys(attributes).length === 0) return '{}';
  
  const formatted: Record<string, unknown> = {};
  for (const [name, attr] of Object.entries(attributes)) {
    formatted[name] = {
      tool: attr.tool,
      size: attr.size,
      createdAt: attr.createdAt,
      iteration: attr.iteration,
      result: attr.result,
    };
  }
  
  return JSON.stringify(formatted, null, 2);
}

/**
 * Get a summary of what references were resolved (for logging)
 */
export function getResolvedReferenceSummary(
  originalParams: Record<string, unknown>,
  resolvedParams: Record<string, unknown>
): string[] {
  const summary: string[] = [];
  
  function findChanges(orig: unknown, resolved: unknown, path: string = ''): void {
    if (typeof orig === 'string' && typeof resolved === 'string' && orig !== resolved) {
      // Check what was resolved
      if (orig.includes('{{scratchpad}}')) summary.push(`${path}: resolved {{scratchpad}}`);
      if (orig.includes('{{blackboard}}')) summary.push(`${path}: resolved {{blackboard}}`);
      if (orig.includes('{{attributes}}')) summary.push(`${path}: resolved {{attributes}}`);
      if (orig.includes('{{artifacts}}')) summary.push(`${path}: resolved {{artifacts}}`);
      
      const attrMatches = orig.match(/\{\{attribute:([^}]+)\}\}/g);
      if (attrMatches) {
        attrMatches.forEach(m => summary.push(`${path}: resolved ${m}`));
      }
      
      const artifactMatches = orig.match(/\{\{artifact:([^}]+)\}\}/g);
      if (artifactMatches) {
        artifactMatches.forEach(m => summary.push(`${path}: resolved ${m}`));
      }
    } else if (Array.isArray(orig) && Array.isArray(resolved)) {
      orig.forEach((item, i) => findChanges(item, resolved[i], `${path}[${i}]`));
    } else if (typeof orig === 'object' && orig !== null && typeof resolved === 'object' && resolved !== null) {
      for (const key of Object.keys(orig as Record<string, unknown>)) {
        findChanges((orig as Record<string, unknown>)[key], (resolved as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
      }
    }
  }
  
  findChanges(originalParams, resolvedParams);
  return summary;
}
