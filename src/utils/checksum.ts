/**
 * Cross-platform checksum utilities
 * Supports both Node.js (crypto) and browser (crypto.subtle)
 */

import { CHECKSUM_ALGORITHM } from '../constants';

// Cache for checksums to avoid recalculating for same string data
const checksumCache = new Map<string, string>();

/**
 * Calculate SHA-256 checksum of data
 * Works in both Node.js and browser environments
 * Uses caching for string data to improve performance
 */
export async function calculateChecksum(data: Buffer | Uint8Array | string): Promise<string> {
  // Check cache for string data
  if (typeof data === 'string' && checksumCache.has(data)) {
    return checksumCache.get(data)!;
  }
  
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  
  let checksum: string;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment
    checksum = await calculateChecksumBrowser(bytes);
  } else {
    // Node.js environment
    checksum = calculateChecksumNode(bytes);
  }
  
  // Cache result for string data
  if (typeof data === 'string') {
    checksumCache.set(data, checksum);
  }
  
  return checksum;
}

/**
 * Calculate checksum in browser using crypto.subtle
 */
async function calculateChecksumBrowser(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate checksum in Node.js using crypto module
 */
function calculateChecksumNode(data: Buffer | Uint8Array): string {
  try {
    // Use require for Node.js crypto - this will be replaced by build system for browser
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  } catch (error) {
    // Fallback for environments where crypto is not available
    throw new Error('Crypto module not available. Use browser environment or Node.js with crypto support.');
  }
}

/**
 * Verify checksum matches expected value
 */
export async function verifyChecksum(
  data: Buffer | Uint8Array | string,
  expectedChecksum: string
): Promise<boolean> {
  const actualChecksum = await calculateChecksum(data);
  return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
}

/**
 * Get the algorithm name used for checksums
 */
export function getChecksumAlgorithm(): string {
  return CHECKSUM_ALGORITHM;
}