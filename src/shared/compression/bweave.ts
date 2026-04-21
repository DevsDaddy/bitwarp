/**
 * BitWarp BWeave Compression provider
 *
 * More about BWeave (hybrid compression module):
 * https://github.com/DevsDaddy/bweave
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1019
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               18.04.2026
 */
/* Import required modules */
import { CompressionProvider, ICompressionOptions, ICompressionProvider } from '../proto/compression';
import { BWeave, BWeaveMode, BWeaveOptions } from 'bweave';

/**
 * Add compression options
 */
export interface BWeaveCompressionOptions extends BWeaveOptions, ICompressionOptions {}

/**
 * BWeave Compression Provider
 */
export class BWeaveCompression extends CompressionProvider implements ICompressionProvider {
  /**
   * Create BWeave compression
   * @param options {BWeaveCompressionOptions} Options
   */
  constructor(options ? : BWeaveCompressionOptions) {
    // Options merge
    let currentOptions : BWeaveCompressionOptions = (options) ? {...BWeaveCompression.defaultOptions, ...options} : BWeaveCompression.defaultOptions;
    super(currentOptions);

    // Create compressor
    this.updateCompressor(new BWeave(currentOptions));
  }

  // Compression getters
  public override get options() : BWeaveCompressionOptions { return super.options as BWeaveCompressionOptions; }
  public override get compressor() : BWeave | undefined { return super.compressor as BWeave | undefined; }

  /**
   * Compress data using BWeave
   * @param data {Uint8Array} Uncompressed data
   * @returns {Uint8Array} Compressed data
   */
  public override compress(data: Uint8Array): Uint8Array {
    if(!this.compressor?.compress) throw new Error(`Failed to compress data. No compression method allowed in compressor`);
    return this.compressor?.compress(data);
  }

  /**
   * Decompress data
   * @param compressed {Uint8Array} Compressed data
   * @returns {Uint8Array} Decompressed data
   */
  public override decompress(compressed: Uint8Array): Uint8Array {
    if(!this.compressor?.decompress) throw new Error(`Failed to decompress data. No decompression method allowed in compressor`);
    return this.compressor?.decompress(compressed);
  }

  /**
   * Default Options for BWeave Compression
   */
  public static defaultOptions : BWeaveCompressionOptions = {
    autoMode: true,
    forcedMode: BWeaveMode.LZ77,
    blockSize: 0,
    parallel: false,
    dictCache: false,
    checksum: false,
    jsonSchema: {},
    dedupBlockSize: 64,
    sharedDict: undefined,
  }
}