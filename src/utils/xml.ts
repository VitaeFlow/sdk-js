/**
 * XML utilities for XMP metadata
 */

/**
 * Escape XML special characters
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Simple XML parser for XMP (extracts key-value pairs)
 */
export function parseXmlKeyValues(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Simple regex-based parser for key="value" attributes
  const attributeRegex = /(\w+(?::\w+)?)\s*=\s*["']([^"']*?)["']/g;
  let match;
  
  while ((match = attributeRegex.exec(xml)) !== null) {
    const [, key, value] = match;
    if (key && value !== undefined) {
      result[key] = value;
    }
  }
  
  // Also parse self-closing tags like <vf:hasStructuredData>true</vf:hasStructuredData>
  const tagRegex = /<(\w+(?::\w+)?)\s*(?:[^>]*?)>\s*([^<]*?)\s*<\/\1>/g;
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, key, value] = match;
    if (key && value !== undefined) {
      result[key] = value.trim();
    }
  }
  
  return result;
}

/**
 * Extract namespace prefix from a qualified name (e.g., "vf:hasStructuredData" -> "vf")
 */
export function getNamespacePrefix(qualifiedName: string): string | null {
  const colonIndex = qualifiedName.indexOf(':');
  return colonIndex > 0 ? qualifiedName.substring(0, colonIndex) : null;
}

/**
 * Extract local name from a qualified name (e.g., "vf:hasStructuredData" -> "hasStructuredData")
 */
export function getLocalName(qualifiedName: string): string {
  const colonIndex = qualifiedName.indexOf(':');
  return colonIndex > 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}