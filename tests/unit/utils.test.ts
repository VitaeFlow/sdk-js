/**
 * Tests for utility functions
 */

import { calculateChecksum, verifyChecksum } from '../../src/utils/checksum';
import { 
  compressData, 
  decompressData, 
  shouldCompress,
  getDataSize,
  isCompressed 
} from '../../src/utils/compression';

describe('checksum utilities', () => {
  const testData = 'Hello, VitaeFlow!';
  const expectedChecksum = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'; // This is just an example

  describe('calculateChecksum', () => {
    it('should calculate SHA-256 checksum for string', async () => {
      const checksum = await calculateChecksum(testData);
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should calculate SHA-256 checksum for Buffer', async () => {
      const buffer = Buffer.from(testData);
      const checksum = await calculateChecksum(buffer);
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBe(64);
    });

    it('should calculate SHA-256 checksum for Uint8Array', async () => {
      const uint8Array = new TextEncoder().encode(testData);
      const checksum = await calculateChecksum(uint8Array);
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBe(64);
    });

    it('should produce consistent results', async () => {
      const checksum1 = await calculateChecksum(testData);
      const checksum2 = await calculateChecksum(testData);
      expect(checksum1).toBe(checksum2);
    });
  });

  describe('verifyChecksum', () => {
    it('should verify correct checksum', async () => {
      const checksum = await calculateChecksum(testData);
      const isValid = await verifyChecksum(testData, checksum);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect checksum', async () => {
      const isValid = await verifyChecksum(testData, 'invalid_checksum');
      expect(isValid).toBe(false);
    });

    it('should be case insensitive', async () => {
      const checksum = await calculateChecksum(testData);
      const isValid = await verifyChecksum(testData, checksum.toUpperCase());
      expect(isValid).toBe(true);
    });
  });
});

describe('compression utilities', () => {
  const testData = 'This is test data for compression. '.repeat(100);

  describe('compression and decompression', () => {
    it('should compress and decompress string data', () => {
      const compressed = compressData(testData);
      const decompressed = decompressData(compressed);
      const result = new TextDecoder().decode(decompressed);
      
      expect(result).toBe(testData);
      expect(compressed.length).toBeLessThan(testData.length);
    });

    it('should compress and decompress Uint8Array data', () => {
      const uint8Data = new TextEncoder().encode(testData);
      const compressed = compressData(uint8Data);
      const decompressed = decompressData(compressed);
      
      expect(decompressed).toEqual(uint8Data);
    });
  });

  describe('shouldCompress', () => {
    it('should return true when compress=true', () => {
      expect(shouldCompress('small', true)).toBe(true);
    });

    it('should return false when compress=false', () => {
      expect(shouldCompress(testData, false)).toBe(false);
    });

    it('should auto-compress large data', () => {
      const largeData = 'x'.repeat(600 * 1024); // > COMPRESS_THRESHOLD
      expect(shouldCompress(largeData, 'auto')).toBe(true);
    });

    it('should not auto-compress small data', () => {
      expect(shouldCompress('small', 'auto')).toBe(false);
    });
  });

  describe('getDataSize', () => {
    it('should return correct size for string', () => {
      const size = getDataSize('test');
      expect(size).toBe(4);
    });

    it('should return correct size for Uint8Array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const size = getDataSize(data);
      expect(size).toBe(5);
    });
  });

  describe('isCompressed', () => {
    it('should detect compressed data', () => {
      const compressed = compressData(testData);
      expect(isCompressed(compressed)).toBe(true);
    });

    it('should not detect uncompressed data as compressed', () => {
      const uncompressed = new TextEncoder().encode(testData);
      expect(isCompressed(uncompressed)).toBe(false);
    });
  });
});