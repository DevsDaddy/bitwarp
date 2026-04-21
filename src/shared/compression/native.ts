/**
 * BitWarp Native Compression Provider
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
import pako from 'pako';

/**
 * Native compression format
 */
export type NativeCompressionFormat = 'gzip' | 'deflate' | 'deflate-raw';

/**
 * Native compression options
 */
export interface NativeCompressionOptions extends ICompressionOptions {
  format ? : NativeCompressionFormat;
}

/**
 * Native compressor
 */
export class NativeCompressor {
  private readonly _format: NativeCompressionFormat = 'deflate-raw';

  /**
   * Create native compressor
   * @param format {NativeCompressionFormat} Format
   */
  constructor(format?: NativeCompressionFormat) {
    if(format) this._format = format;
  }

  // Compressor getters
  public get format() : NativeCompressionFormat { return this._format; }

  /**
   * Compress data using predefined format
   * @param data {Uint8Array} Decompressed data
   * @returns {Uint8Array} Compressed data
   */
  public compress(data: Uint8Array): Uint8Array {
    if (!data.length) return new Uint8Array(0);

    // Compress
    switch (this._format) {
      case 'gzip': return pako.gzip(data);
      case 'deflate-raw': return pako.deflateRaw(data);
      case 'deflate': return pako.deflate(data);
      default: {
        throw new Error(`Unsupported compression format ${this._format}`);
      }
    }
  }

  /**
   * Decompress data using predefined format
   * @param compressed {Uint8Array} Compressed data
   * @returns {Uint8Array} Decompressed data
   */
  public decompress(compressed: Uint8Array): Uint8Array {
    if (!compressed.length) return new Uint8Array(0);

    // Decompress
    switch (this._format) {
      case 'gzip': return pako.ungzip(compressed);
      case 'deflate-raw': return pako.inflateRaw(compressed);
      case 'deflate': return pako.inflate(compressed);
      default: {
        throw new Error(`Unsupported compression format ${this._format}`);
      }
    }
  }
}

/**
 * Native compression provider
 */
export class NativeCompression extends CompressionProvider implements ICompressionProvider {
  /**
   * Create native compression
   * @param options {NativeCompressionOptions} Options
   */
  constructor(options ? : NativeCompressionOptions) {
    // Options merge
    let currentOptions : NativeCompressionOptions = (options) ? {...NativeCompression.defaultOptions, ...options} : NativeCompression.defaultOptions;
    super(currentOptions);

    // Create compressor
    this.updateCompressor(new NativeCompressor(currentOptions.format));
  }

  // Compression getters
  public override get options() : NativeCompressionOptions { return super.options as NativeCompressionOptions; }
  public override get compressor() : NativeCompressor | undefined { return super.compressor as NativeCompressor | undefined; }

  /**
   * Compress data
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
   * Default Options for Native Compression
   */
  public static defaultOptions : NativeCompressionOptions = {
    format : "deflate-raw"
  }
}