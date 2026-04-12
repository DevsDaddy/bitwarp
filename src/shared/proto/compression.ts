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
import { ErrorHandler, ErrorType } from '../types/handlers';

/**
 * Compression provider interface
 */
export interface ICompressionProvider {
  // Public fields
  get options() : ICompressionOptions;
  get compressor () : any | undefined;

  // Provider methods
  compress(data: Uint8Array): Uint8Array;
  decompress(compressed: Uint8Array): Uint8Array;
}

/**
 * Compression options
 */
export interface ICompressionOptions {}

/**
 * Compression Provider
 */
export abstract class CompressionProvider implements ICompressionProvider {
  private readonly _options : ICompressionOptions;
  private _compressor ? : any;

  /**
   * Creates compression provider
   * @param options {ICompressionOptions} Compression provider options
   */
  constructor(options: ICompressionOptions) {
    this._options = options;
  }

  // Basic getters
  public get options() : ICompressionOptions { return this._options; }
  public get compressor () : any | undefined { return this._compressor; }

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

  /**
   * Set new compressor
   * @param compressor {any} Compressor
   * @return {any|ErrorHandler} Returns compressor or Error Handler
   */
  public updateCompressor(compressor : any) : any | ErrorHandler {
    try {
      if(this.compressor) return new ErrorHandler(`Failed to update compressor. Compressor is already used.`, null, ErrorType.SystemException);
      this._compressor = compressor;
    }catch(error : any) {
      return new ErrorHandler(`Failed to set compressor for provider. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, ErrorType.SystemException);
    }
  }
}