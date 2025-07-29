/**
 * Cross-platform checksum utilities
 * Supports both Node.js (crypto) and browser (crypto.subtle)
 */

import { CHECKSUM_ALGORITHM } from '../constants';

/**
 * Calculate SHA-256 checksum of data
 * Works in both Node.js and browser environments
 */
export async function calculateChecksum(data: Buffer | Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment
    return await calculateChecksumBrowser(bytes);
  } else {
    // Node.js environment
    return calculateChecksumNode(bytes);
  }
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
  // Dynamic import for Node.js crypto to avoid bundling issues
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
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