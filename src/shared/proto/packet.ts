/**
 * BitWarp Networking Packets
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1048
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               22.04.2026
 */
/* Import required modules */
import { FlashBuffer } from 'flash-buffer';
import { PROTOCOL_MAGIC } from '../constants';
import { CryptoProvider } from './crypto';

/**
 * Raw Packet
 */
export interface RawPacket {
  packetId : string;
  data : Uint8Array;
}

/**
 * Packet Type
 */
export enum PacketType {
  HANDSHAKE = 0x1,
  ROOM = 0x2,
  COMMAND = 0x3,
  COMMAND_RESPONSE = 0x4,
  EVENT = 0x5,
  SYNC_OBJECT = 0x6,
  SYNC_ACTION = 0x7,
  STREAM_CONTROL = 0x8,
  RAW_BINARY = 0x9,
  ERROR = 0xA,
  PING = 0xB,
  UPDATE_PEER = 0xC,
  // Reserved for future extensions 0xD-0xF
}

/**
 * Packet flags
 */
export enum PacketFlag {
  None = 0,
  Fragmented = 1 << 0
}

/**
 * Packet header
 */
export interface PacketHeader {
  magic: number;            // Can be changed in constants (by default 0x4E42 ('NB'))
  type: PacketType;         // Our Packet Type
  flags: number;            // Flags
  requestId: number;        // VarUint, 0 if not used
  payloadLength: number;    // VarUint, body length in bytes
}

/**
 * Basic packet
 */
export interface Packet<T = any> {
  header: PacketHeader;
  payload: T;
}

/**
 * Packet Data interface
 */
export interface IPacketData {
  header: ReturnType<typeof HeaderEncoder.read>;
  body ? : Uint8Array;
  payload ? : any;
}

/**
 * Base packet implementation
 */
export class BasePacket {
  private static _cryptoProvider ? : CryptoProvider;

  /**
   * Set crypto provider
   * @param provider {CryptoProvider} Crypto provider
   */
  public static setCryptoProvider(provider : CryptoProvider) : void {
    this._cryptoProvider = provider;
  }

  /**
   * Get crypto provider
   * @returns {CryptoProvider} crypto provider
   */
  public static getCryptoProvider() : CryptoProvider | undefined {
    return this._cryptoProvider;
  }

  /**
   * Encode packet
   * @param body {Uint8Array} Serialized packet body
   * @param requestId {number} Request internal id
   * @param flags {PacketFlag} Packet flags
   * @param packetType {PacketType} Packet Type
   * @returns {Uint8Array} Ready-to-use packet buffer
   */
  public static encode(body: Uint8Array | any, requestId = 0, flags = 0, packetType = PacketType.HANDSHAKE): Uint8Array {
    if(!(body instanceof Uint8Array)) throw new Error(`Base packet class data argument must be a Uint8Array`);

    // Work with encryption
    if(this._cryptoProvider) body = this._cryptoProvider.encryptSync(body);

    // Create buffer
    const buf = new FlashBuffer();
    HeaderEncoder.write(buf, {
      type: packetType,
      flags,
      requestId,
      payloadLength: body.byteLength,
    });
    buf.writeBytes(body);
    return buf.toUint8Array();
  }

  /**
   * Decode handshake packet
   * @param buffer {Uint8Array} Packet buffer
   * @returns {HandshakePacketData} Ready to parse packet
   */
  public static decode(buffer: Uint8Array): IPacketData {
    const buf = new FlashBuffer();
    buf.writeBytes(buffer);
    buf.reset();
    const header = HeaderEncoder.read(buf);
    let body = buf.readBytes(header.payloadLength);
    if(this._cryptoProvider) body = this._cryptoProvider.decryptSync(body);
    return { header, body };
  }
}

/**
 * Protocol header encoder for any packets
 */
export class HeaderEncoder {
  /**
   * Write packet header to buffer
   * and returns written bytes length
   * @param buffer {FlashBuffer} Input buffer
   * @param header {Omit<PacketHeader>} Header without magic byte
   * @returns {number} Written bytes length
   */
  public static write(buffer : FlashBuffer, header : Omit<PacketHeader, "magic">) {
    const startOffset = buffer.offset;

    // Write magic bytes
    buffer.writeUint16(PROTOCOL_MAGIC);

    // Type & Flags (1 byte) - first 4 bits type, last 4 bits flags
    const typeAndFlags = ((header.type & 0x0F) << 4) | (header.flags & 0x0F);
    buffer.writeUint8(typeAndFlags);

    // Request ID (VarUint)
    buffer.writeVarUint(header.requestId);

    // Payload Length (VarUint)
    buffer.writeVarUint(header.payloadLength);
    return buffer.offset - startOffset;
  }

  /**
   * Read packet header from buffer
   * @throws Error if magic bytes is wrong
   * @param buffer {FlashBuffer} Input buffer
   * @returns {PacketHeader} Packet header
   */
  public static read(buffer: FlashBuffer): PacketHeader {
    // Parse magic bytes
    const magic = buffer.readUint16();
    if (magic !== PROTOCOL_MAGIC) {
      throw new Error(`Invalid magic: 0x${magic.toString(16)}`);
    }

    // Type and flags
    const typeAndFlags = buffer.readUint8();
    const type = (typeAndFlags >> 4) as PacketType;
    const flags = typeAndFlags & 0x0F;

    // Request id and data length
    const requestId = Number(buffer.readVarUint());
    const payloadLength = Number(buffer.readVarUint());

    return {
      magic,
      type,
      flags,
      requestId,
      payloadLength,
    };
  }
}