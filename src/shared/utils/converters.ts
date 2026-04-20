/**
 * BitWarp Conversion Utils
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1006
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               20.04.2026
 */
/**
 * Binary converter
 */
export class BinaryConverter {
  // Reusable text encoders / decoders
  private static textEncoder: TextEncoder | null = null;
  private static textDecoder: TextDecoder | null = null;
  private static readonly HEX_LOOKUP: string[] = Array.from({ length: 256 }, (_, i) =>
    i.toString(16).padStart(2, '0')
  );

  /**
   * Covert to Uint8 Array
   * @param input {string|ArrayBuffer|Uint8Array|Buffer|Buffer[]} Input
   * @param copy {boolean} Copy values
   * @returns {Uint8Array} Converted value
   */
  public static toUint8Array(
    input: string | ArrayBuffer | Uint8Array | Buffer | Buffer[],
    copy = false
  ): Uint8Array {
    // string -> Uint8Array (UTF-8)
    if (typeof input === 'string') {
      return this.getTextEncoder().encode(input);
    }

    // ArrayBuffer -> Uint8Array (view)
    if (input instanceof ArrayBuffer) {
      return copy ? new Uint8Array(input.slice(0)) : new Uint8Array(input);
    }

    // Uint8Array
    if (input instanceof Uint8Array) {
      if (copy) {
        const copyArr = new Uint8Array(input.length);
        copyArr.set(input);
        return copyArr;
      }
      return input;
    }

    // Buffer[] (Node.js)
    if (Array.isArray(input)) {
      if (!this.isBufferAvailable()) {
        throw new TypeError('Buffer[] does\'t support outside Node.js');
      }

      // Use native Buffer.concat for performance
      const totalLength = input.reduce((sum, buf) => sum + buf.length, 0);
      // Buffer already Uint8Array, returns
      return Buffer.concat(input, totalLength);
    }

    // Unknown type
    throw new TypeError(`Unsupported type for: ${typeof input}`);
  }

  /**
   * Convert binary to string
   * @param input {Uint8Array} Binary array
   * @returns {string} UTF-8 string
   */
  public static toString(input: Uint8Array): string {
    return this.getTextDecoder().decode(input);
  }

  /**
   * Convert to array buffer
   * @param input {Uint8Array} Input data
   * @param copy {boolean} Copy data or not
   * @returns {ArrayBuffer} Result buffer
   */
  public static toArrayBuffer(input: Uint8Array, copy = false): ArrayBuffer {
    if (copy) {
      // Copy data in new ArrayBuffer
      // @ts-ignore
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    if (input.byteOffset === 0 && input.byteLength === input.buffer.byteLength) {
      // @ts-ignore
      return input.buffer;
    }
    // @ts-ignore
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }

  /**
   * Convert to buffer
   * @param input {Uint8Array} Input binary array
   * @returns {Buffer} Returns buffer
   */
  public static toBuffer(input: Uint8Array): Buffer {
    if (!this.isBufferAvailable()) {
      throw new Error('Buffer available only in Node.js');
    }
    // Buffer.from without copy, if available (uses ArrayBuffer)
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }

  /**
   * To buffer array
   * @param input {Uint8Array} Binary array
   * @param chunkSize {number} chunk size
   * @returns {Buffer[]} Array buffer
   */
  public static toBufferArray(input: Uint8Array, chunkSize?: number): Buffer[] {
    if (!this.isBufferAvailable()) {
      throw new Error('Buffer available only in Node.js');
    }

    if (chunkSize === undefined || chunkSize <= 0) {
      return [this.toBuffer(input)];
    }

    const buffers: Buffer[] = [];
    let offset = 0;
    while (offset < input.length) {
      const end = Math.min(offset + chunkSize, input.length);
      const slice = input.subarray(offset, end);
      buffers.push(this.toBuffer(slice));
      offset = end;
    }
    return buffers;
  }

  /**
   * Convert Binary Array to HEX String
   * @param input {Uint8Array} Binary array
   * @param separator {string} separator (for example " " or "-")
   * @returns {string} HEX String
   */
  public static toHex(input: Uint8Array, separator = ''): string {
    const len = input.length;
    if (len === 0) return '';

    const lookup = this.HEX_LOOKUP;
    let result = '';

    if (len > 500) {
      const parts: string[] = new Array(len);
      for (let i = 0; i < len; i++) {
        parts[i] = lookup[input[i]];
      }
      return parts.join(separator);
    } else {
      for (let i = 0; i < len; i++) {
        if (i > 0) result += separator;
        result += lookup[input[i]];
      }
      return result;
    }
  }

  /**
   * Convert HEX to Binary Array
   * @param hex {string} HEX Input string
   * @returns {Uint8Array} Binary array
   */
  public static fromHex(hex: string): Uint8Array {
    let normalized = hex;
    if (/[^0-9A-Fa-f]/.test(hex)) {
      // Remove unsupported symbols
      normalized = hex.replace(/[^0-9A-Fa-f]/g, '');
    }

    const len = normalized.length;
    if (len % 2 !== 0) {
      throw new Error('Wrong length for HEX');
    }

    const bytes = new Uint8Array(len / 2);
    // Get two symbols
    for (let i = 0, j = 0; i < len; i += 2, j++) {
      const high = this.hexCharToNibble(normalized.charCodeAt(i));
      const low = this.hexCharToNibble(normalized.charCodeAt(i + 1));
      bytes[j] = (high << 4) | low;
    }
    return bytes;
  }

  private static hexCharToNibble(code: number): number {
    // '0'-'9' (48-57)
    if (code >= 48 && code <= 57) {
      return code - 48;
    }
    // 'A'-'F' (65-70)
    if (code >= 65 && code <= 70) {
      return code - 55;
    }
    // 'a'-'f' (97-102)
    if (code >= 97 && code <= 102) {
      return code - 87;
    }
    throw new Error(`Wrong symbol in HEX: ${String.fromCharCode(code)}`);
  }

  private static isBufferAvailable(): boolean {
    return typeof Buffer !== 'undefined';
  }

  private static getTextEncoder(): TextEncoder {
    if (!this.textEncoder) {
      this.textEncoder = new TextEncoder();
    }
    return this.textEncoder;
  }

  private static getTextDecoder(): TextDecoder {
    if (!this.textDecoder) {
      this.textDecoder = new TextDecoder('utf-8');
    }
    return this.textDecoder;
  }
}

/**
 * URI Converter
 */
export class URIConverter {
  /**
   * Convert object to URI Params
   * @param obj {any} Object
   * @returns {string} URI Params
   */
  public static toURIParams(obj : any) : string {
    // Check object
    if(!obj || typeof obj !== 'object') return "";

    // Bring to key/val
    let kval : string[] = [];
    for (let [key, value] of Object.entries(obj)) {
      let val = (value) ? value.toString() : "";
      kval.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`);
    }

    return kval.join("&");
  }

  /**
   * Convert URI Params to object of type
   * @param urlParams {string} URL Params or URL
   * @returns {any} Typed object
   * @constructor
   */
  public static toObject<T>(urlParams : string) : T {
    // Check and split params
    if(urlParams.startsWith("/")) urlParams = urlParams.substring(1);
    if(urlParams.startsWith("http:") || urlParams.startsWith("https:") || urlParams.startsWith("ws:") ||
      urlParams.startsWith("wss:") || urlParams.startsWith("?")) {
      urlParams = urlParams.split("?")?.[1] ?? "";
    }
    if(urlParams.length < 1) return {} as T;

    // Split to array of params
    let urlArr = urlParams.split("&");
    if(urlArr.length < 1) return {} as T;

    let finalObject : any = {};
    for(let i = 0; i < urlArr.length; i++) {
      let kval = urlArr[i].split("=");
      if(kval.length > 0){
        finalObject[kval[0]] = kval?.[1]?.toString() ?? undefined;
      }
    }

    return finalObject as T;
  }

  /**
   * Convert URI Params to map
   * @param urlParams {string} URI Params or URL
   * @returns {Map<string,string>} Params map
   */
  public static toMap(urlParams : string) : Map<string, string> {
    // Check and split params
    if(urlParams.startsWith("/")) urlParams = urlParams.substring(1);
    if(urlParams.startsWith("http:") || urlParams.startsWith("https:") || urlParams.startsWith("ws:") ||
      urlParams.startsWith("wss:") || urlParams.startsWith("?")) {
      urlParams = urlParams.split("?")?.[1] ?? "";
    }
    if(urlParams.length < 1) return new Map<string, string>();

    // Split to array of params
    let urlArr = urlParams.split("&");
    if(urlArr.length < 1) return new Map<string, string>();

    let finalMap : Map<string, string> = new Map<string, string>();
    for(let i = 0; i < urlArr.length; i++) {
      let kval = urlArr[i].split("=");
      if(kval.length > 0){
        finalMap.set(kval[0], kval?.[1]?.toString() ?? "");
      }
    }

    return finalMap;
  }
}