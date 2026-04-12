/**
 * BitWarp Networking compression module tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1001
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               12.04.2026
 */
/* Import required modules */
import { describe, it, expect } from 'vitest';
import { BWeaveCompression, BinaryConverter } from '../../src/shared';

/**
 * Describe tests
 */
describe('BitWrap Compression Module Tests', () => {
  /* BWeave Compression */
  describe('BWeave Compression Provider Checks', () => {
    // Create compressor
    const compressor = new BWeaveCompression();

    // Empty data test
    it('Roundtrip for empty data', () => {
      const empty = new Uint8Array(0);
      const compressed = compressor.compress(empty);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toEqual(empty);
      expect(compressed.length).toBe(4);
    });

    // Short data test
    it('Roundtrip for very short data (size may increase)', () => {
      const short = BinaryConverter.textToBytes("Hello");
      const compressed = compressor.compress(short);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toEqual(short);
    });

    // Long data test
    it('Compresses long repetitive text effectively', () => {
      const original = BinaryConverter.textToBytes("abc".repeat(1000));
      const compressed = compressor.compress(original);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });

    // Repeating bytes test
    it('Compresses repeating bytes (RLE)', () => {
      const original = new Uint8Array(5000).fill(0x42);
      const compressed = compressor.compress(original);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });
  })
});