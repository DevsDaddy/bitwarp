/**
 * BitWarp Networking Websocket UUID Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build 1002
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated 12.04.2026
 */
/**
 * Fast UUID Util
 * with support v1 / v3 / v4 / v5 / v7
 */
export class UUID {
  // UUID constants and private fields
  private static readonly HEX_TABLE: readonly string[] = Array.from({ length: 256 }, (_, i) =>
    i.toString(16).padStart(2, '0')
  );

  // Used for UUID validation
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Namespace for UUID v3/v5 (RFC 4122)
  static readonly NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  static readonly NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

  // v1: counter and last timestamp
  private static lastV1Timestamp = 0;
  private static v1ClockSequence = 0;
  private static nodeId: Uint8Array | null = null;

  // #region UUIDv4
  /**
   * Generate UUIDv4
   * @returns {string} UUIDv4
   */
  public static v4(): string {
    const buf = this.getRandomBytes(16);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    return this.format(buf);
  }

  /**
   * Generate list of UUIDv4
   * @param count {number} Count
   * @returns {string[]} Array of UUIDv4
   */
  public static v4Many(count: number): string[] {
    if (count <= 0) return [];
    const result = new Array<string>(count);
    const totalBytes = count * 16;
    const bigBuffer = this.getRandomBytes(totalBytes);

    for (let i = 0; i < count; i++) {
      const offset = i * 16;
      const buf = bigBuffer.subarray(offset, offset + 16);
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      result[i] = this.format(buf);
    }
    return result;
  }

  /**
   * v4 Alias
   * @returns {string} UUIDv4
   */
  public static generate(): string {
    return this.v4();
  }

  /**
   * Generate many alias
   * @param count {number} Count
   * @returns {string[]} Array of UUIDv4
   */
  public static generateMany(count: number): string[] {
    return this.v4Many(count);
  }

  // #endregion UUIDv4

  // #region UUIDv1
  /**
   * Generate UUIDv1 (based on time and node ID)
   * @returns {string} UUIDv1
   */
  public static v1(): string {
    const now = this.getTimestamp();
    const buf = new Uint8Array(16);

    const timeLow = Number(now & 0xffffffffn);
    const timeMid = Number((now >> 32n) & 0xffffn);
    const timeHigh = Number((now >> 48n) & 0x0fffn);

    // time_low (bytes 0-3)
    buf[0] = (timeLow >>> 24) & 0xff;
    buf[1] = (timeLow >>> 16) & 0xff;
    buf[2] = (timeLow >>> 8) & 0xff;
    buf[3] = timeLow & 0xff;
    // time_mid (bytes 4-5)
    buf[4] = (timeMid >>> 8) & 0xff;
    buf[5] = timeMid & 0xff;
    // time_high_and_version (bytes 6-7)
    const timeHighAndVersion = timeHigh | 0x1000;
    buf[6] = (timeHighAndVersion >>> 8) & 0xff;
    buf[7] = timeHighAndVersion & 0xff;

    // clock sequence (bytes 8-9)
    const timestampMs = Date.now();
    if (timestampMs === this.lastV1Timestamp) {
      this.v1ClockSequence = (this.v1ClockSequence + 1) & 0x3fff;
    } else {
      this.v1ClockSequence = this.getRandomBytes(2)[0] << 8 | this.getRandomBytes(2)[1];
      this.v1ClockSequence &= 0x3fff;
      this.lastV1Timestamp = timestampMs;
    }
    const clockSeqWithVariant = this.v1ClockSequence | 0x8000; // вариант RFC 4122
    buf[8] = (clockSeqWithVariant >>> 8) & 0xff;
    buf[9] = clockSeqWithVariant & 0xff;

    // node (bytes 10-15)
    const node = this.getNodeId();
    buf.set(node, 10);

    return this.format(buf);
  }
  // #endregion UUIDv1

  // #region UUIDv7
  /**
   * Generate UUIDv1 (based on timestamp in ms)
   * @returns {string} UUIDv7
   */
  public static v7(): string {
    const buf = this.getRandomBytes(16);
    const timestampMs = BigInt(Date.now());

    // First 48 bits: Unix timestamp in ms (big-endian)
    buf[0] = Number((timestampMs >> 40n) & 0xffn);
    buf[1] = Number((timestampMs >> 32n) & 0xffn);
    buf[2] = Number((timestampMs >> 24n) & 0xffn);
    buf[3] = Number((timestampMs >> 16n) & 0xffn);
    buf[4] = Number((timestampMs >> 8n) & 0xffn);
    buf[5] = Number(timestampMs & 0xffn);

    // v 7 (bits 48-51 = 0111)
    buf[6] = (buf[6] & 0x0f) | 0x70;
    // RFC 4122 variant (bits 64-65 = 10)
    buf[8] = (buf[8] & 0x3f) | 0x80;

    return this.format(buf);
  }
  // #endregion UUIDv7

  // #region UUIDv3
  /**
   * Generate UUIDv3 (based on MD5 namespace + name)
   * @param namespace {string} namespace
   * @param name {string} name
   * @returns {Promise<string>} UUIDv3
   */
  public static async v3(namespace: string, name: string): Promise<string> {
    const hash = await this.hash('MD5', namespace, name);
    hash[6] = (hash[6] & 0x0f) | 0x30; // v3
    hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
    return this.format(hash);
  }
  // #endregion UUIDv3

  // #region UUIDv5
  /**
   * Generate UUIDv5 (SHA-1 hash namespace + name)
   * @param namespace {string} namespace
   * @param name {string} name
   * @returns {Promise<string>} UUIDv5
   */
  public static async v5(namespace: string, name: string): Promise<string> {
    const hash = await this.hash('SHA-1', namespace, name);
    hash[6] = (hash[6] & 0x0f) | 0x50; // v5
    hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122
    return this.format(hash);
  }
  // #endregion UUIDv5

  // #region Validation and Parsing
  /**
   * Check if UUID is string
   * @param uuid {any} UUID
   */
  public static validate(uuid: any): boolean {
    return typeof uuid === 'string' && this.UUID_REGEX.test(uuid);
  }

  /**
   * Is UUID (TypeScript Guard)
   * @param uuid {string} UUID string
   */
  public static isUUID(uuid: unknown): uuid is string {
    return typeof uuid === 'string' && this.UUID_REGEX.test(uuid);
  }

  /**
   * Get UUID version
   * @param uuid {string} UUID string
   * @returns {number|null} Returns UUID version number or null if not a valid UUID string
   */
  public static version(uuid: string): number | null {
    if (!this.validate(uuid)) return null;
    return parseInt(uuid.charAt(14), 16);
  }

  /**
   * Parse UUID string to Uint8Array
   * @param uuid {string} UUID string
   * @returns {Uint8Array|null} Returns UUID buffer (Uint8Array) or null if not valid
   */
  public static parse(uuid: string): Uint8Array | null {
    if (!this.validate(uuid)) return null;
    return this.parseBytesUnchecked(uuid);
  }

  /**
   * Compare two UUID
   * @param a {string} UUID string
   * @param b {string} UUID string
   */
  public static equals(a: string, b: string): boolean {
    if (!this.validate(a) || !this.validate(b)) return false;
    return a.toLowerCase() === b.toLowerCase();
  }

  /**
   * Normalize UUID (lowercase without spaces).
   * @param uuid {string} UUID string
   * @returns {string|null} Returns normalized UUID string or null if not valid
   */
  public static normalize(uuid: string): string | null {
    const trimmed = uuid.trim().toLowerCase();
    return this.validate(trimmed) ? trimmed : null;
  }

  /**
   * Generate raw UUIDv4 (without "-")
   * @returns {string} Raw UUIDv4
   */
  public static v4Raw(): string {
    const buf = this.getRandomBytes(16);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += this.HEX_TABLE[buf[i]];
    }
    return result;
  }
  // #endregion Validation and Parsing

  // #region Branded type
  /**
   * Branded type for UUID string
   * @param uuid UUID string
   * @returns Branded type
   */
  public static brand<T extends string>(uuid: T): T & { __brand: 'UUID' } {
    if (!this.validate(uuid)) {
      throw new TypeError(`Invalid UUID: ${uuid}`);
    }
    return uuid as T & { __brand: 'UUID' };
  }

  /**
   * Check if value is branded UUID
   * @param value
   */
  public static isBranded(value: unknown): value is string & { __brand: 'UUID' } {
    return this.isUUID(value);
  }
  // #endregion Branded type

  // #region Private Utils
  private static getRandomBytes(length: number): Uint8Array {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      return globalThis.crypto.getRandomValues(new Uint8Array(length));
    }
    try {
      const nodeCrypto = require('crypto');
      return new Uint8Array(nodeCrypto.randomBytes(length));
    } catch {
      throw new Error('No secure random number generator available');
    }
  }

  private static format(buffer: Uint8Array): string {
    const h = this.HEX_TABLE;
    return (
      h[buffer[0]] + h[buffer[1]] + h[buffer[2]] + h[buffer[3]] + '-' +
      h[buffer[4]] + h[buffer[5]] + '-' +
      h[buffer[6]] + h[buffer[7]] + '-' +
      h[buffer[8]] + h[buffer[9]] + '-' +
      h[buffer[10]] + h[buffer[11]] + h[buffer[12]] + h[buffer[13]] + h[buffer[14]] + h[buffer[15]]
    );
  }

  private static parseBytesUnchecked(uuid: string): Uint8Array {
    const bytes = new Uint8Array(16);
    const normalized = uuid.replace(/-/g, '');
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(normalized.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  private static getNodeId(): Uint8Array {
    if (!this.nodeId) {
      const rand = this.getRandomBytes(6);
      rand[0] |= 0x01;
      this.nodeId = rand;
    }
    return this.nodeId;
  }

  private static getTimestamp(): bigint {
    const GREGORIAN_OFFSET = 122192928000000000n;
    const unixNano = BigInt(Date.now()) * 1000000n;
    return GREGORIAN_OFFSET + unixNano * 10n;
  }

  private static async hash(
    algorithm: 'MD5' | 'SHA-1',
    namespace: string,
    name: string
  ): Promise<Uint8Array> {
    const nsBytes = this.parseBytesUnchecked(namespace);
    const nameBytes = new TextEncoder().encode(name);
    const combined = new Uint8Array(nsBytes.length + nameBytes.length);
    combined.set(nsBytes);
    combined.set(nameBytes, nsBytes.length);

    // Node.js env
    if (typeof process !== 'undefined' && process.versions?.node) {
      const crypto = await import('crypto');
      const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''));
      hash.update(combined);
      return new Uint8Array(hash.digest());
    }

    if (globalThis.crypto?.subtle) {
      if (algorithm === 'MD5') {
        throw new Error(
          'MD5 is not supported by Web Crypto API. UUID v3 cannot be generated in browsers without a polyfill.'
        );
      }
      const hashBuffer = await globalThis.crypto.subtle.digest(algorithm, combined);
      return new Uint8Array(hashBuffer);
    }

    throw new Error('No cryptographic API available');
  }
  // #endregion
}

// Тип для удобства использования
export type UUIDString = ReturnType<typeof UUID.brand>;