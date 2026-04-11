/**
 * BitWarp Networking Compression module
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/**
 * Compression provider interface
 */
export interface ICompressionProvider {
  compress(data: Uint8Array): Uint8Array;
  decompress(compressed: Uint8Array): Uint8Array;
}

/**
 * Compression Provider
 */
export abstract class CompressionProvider implements ICompressionProvider {
  /**
   * Compress data buffer
   * @param data {Uint8Array} Decompressed buffer
   * @returns {Uint8Array} Compressed buffer
   */
  public abstract compress(data: Uint8Array): Uint8Array;

  /**
   * Decompress data buffer
   * @param compressed {Uint8Array} Compressed buffer
   * @returns {Uint8Array} Decompressed buffer
   */
  public abstract decompress(compressed: Uint8Array): Uint8Array;
}