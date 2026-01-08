// Binary Tool Utilities - Shared detection and formatting for binary content

// Tools that produce binary output (images, audio)
export const BINARY_TOOLS = ['image_generation', 'elevenlabs_tts'];

/**
 * Check if a tool produces binary content
 */
export function isBinaryTool(toolName: string): boolean {
  // Handle tool instance suffixes like "image_generation:my_instance"
  const baseTool = toolName.includes(':') ? toolName.split(':')[0] : toolName;
  return BINARY_TOOLS.includes(baseTool);
}

interface BinaryContentInfo {
  isBinary: boolean;
  mimeType: string | undefined;
  size: number;
  summary: string;
}

/**
 * Detect and analyze binary content in tool results
 */
export function detectBinaryContent(tool: string, result: unknown): BinaryContentInfo {
  if (!isBinaryTool(tool) || !result || typeof result !== 'object') {
    return { isBinary: false, mimeType: undefined, size: 0, summary: '' };
  }

  const resultObj = result as Record<string, unknown>;
  
  // Image generation returns { imageUrl: string, mimeType: string }
  if (resultObj.imageUrl) {
    const imageUrl = resultObj.imageUrl as string;
    const mimeType = (resultObj.mimeType as string) || 'image/png';
    const size = imageUrl.length;
    return {
      isBinary: true,
      mimeType,
      size,
      summary: `[Binary ${mimeType} - ${Math.round(size / 1024)}KB]`,
    };
  }

  // TTS returns { audioContent: string, contentType: string } or { audioData: string, contentType: string }
  const audioContent = (resultObj.audioContent || resultObj.audioData) as string | undefined;
  if (audioContent) {
    const mimeType = (resultObj.contentType as string) || (resultObj.mimeType as string) || 'audio/mpeg';
    const size = audioContent.length;
    return {
      isBinary: true,
      mimeType,
      size,
      summary: `[Binary ${mimeType} - ${Math.round(size / 1024)}KB]`,
    };
  }

  return { isBinary: false, mimeType: undefined, size: 0, summary: '' };
}

/**
 * Format a binary tool result for display (metadata only, no raw data)
 */
export function formatBinaryResultString(tool: string, result: unknown): string {
  const info = detectBinaryContent(tool, result);
  if (info.isBinary) {
    return info.summary;
  }
  // Fallback to JSON stringification for non-binary
  return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
}

/**
 * Create a sanitized result for context passing (removes large binary data)
 */
export function sanitizeBinaryResultForContext(tool: string, result: unknown): unknown {
  const info = detectBinaryContent(tool, result);
  if (!info.isBinary || !result || typeof result !== 'object') {
    return result;
  }

  const resultObj = result as Record<string, unknown>;
  
  // Replace binary data with metadata summary
  if (resultObj.imageUrl) {
    return {
      _binaryContent: true,
      mimeType: resultObj.mimeType || 'image/png',
      size: (resultObj.imageUrl as string).length,
      summary: info.summary,
      model: resultObj.model,
    };
  }

  const audioContent = (resultObj.audioContent || resultObj.audioData) as string | undefined;
  if (audioContent) {
    return {
      _binaryContent: true,
      mimeType: resultObj.contentType || resultObj.mimeType || 'audio/mpeg',
      size: audioContent.length,
      summary: info.summary,
    };
  }

  return result;
}

/**
 * Check if content looks like binary data (for rendering decisions)
 */
export function looksLikeBinaryContent(content: unknown): boolean {
  if (!content) return false;
  
  if (typeof content === 'string') {
    // Check for data URLs
    if (content.startsWith('data:image/') || content.startsWith('data:audio/')) {
      return true;
    }
    // Check for very long base64-like content
    if (content.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(content.slice(0, 100))) {
      return true;
    }
  }
  
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    // Check for known binary result structures
    if (obj.imageUrl || obj.audioContent || obj.audioData) {
      return true;
    }
    // Check for our sanitized binary marker
    if (obj._binaryContent === true) {
      return true;
    }
  }
  
  return false;
}
