/**
 * Data compression utilities using pako (zlib)
 */

import * as pako from 'pako';
import { COMPRESS_THRESHOLD } from '../constants';

/**
 * Compress data using zlib deflate
 */
export function compressData(data: string | Uint8Array): Uint8Array {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return pako.deflate(input);
}

/**
 * Decompress data using zlib inflate
 */
export function decompressData(compressedData: Uint8Array): Uint8Array {
  return pako.inflate(compressedData);
}

/**
 * Decompress data and return as string
 */
export function decompressToString(compressedData: Uint8Array): string {
  const decompressed = decompressData(compressedData);
  return new TextDecoder().decode(decompressed);
}

/**
 * Check if data should be compressed based on size and options
 */
export function shouldCompress(
  data: string | Uint8Array,
  compressOption: boolean | 'auto'
): boolean {
  if (compressOption === true) return true;
  if (compressOption === false) return false;
  
  // 'auto' mode: compress if data size exceeds threshold
  const size = typeof data === 'string' ? new TextEncoder().encode(data).length : data.length;
  return size > COMPRESS_THRESHOLD;
}

/**
 * Get the size of data in bytes
 */
export function getDataSize(data: string | Uint8Array): number {
  return typeof data === 'string' ? new TextEncoder().encode(data).length : data.length;
}

/**
 * Calculate compression ratio (compressed size / original size)
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return compressedSize / originalSize;
}

/**
 * Test if data appears to be compressed (heuristic check)
 */
export function isCompressed(data: Uint8Array): boolean {
  // Check for common compression signatures
  // zlib deflate starts with 0x78 (most common variants)
  if (data.length >= 2) {
    const firstByte = data[0];
    const secondByte = data[1];
    
    // zlib deflate magic numbers
    if (firstByte === 0x78 && (secondByte === 0x01 || secondByte === 0x9c || secondByte === 0xda)) {
      return true;
    }
  }
  
  return false;
}