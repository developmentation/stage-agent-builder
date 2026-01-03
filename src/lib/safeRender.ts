// Safe string rendering utility - prevents React crashes from malformed object data

/**
 * Safely converts any value to a renderable string.
 * Prevents React errors like "Objects are not valid as a React child"
 */
export function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Complex Object]';
    }
  }
  return String(value);
}
