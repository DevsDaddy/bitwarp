/**
 * BitWarp Networking Packets
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1001
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               13.04.2026
 */
/* Import required modules */
import { FlashBuffer } from 'flash-buffer';
import { PROTOCOL_MAGIC } from '../constants';

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
  RAW_BINARY = 0x9
  // Reserved for future extensions 0xA-0xF
}

/**
 * Packet flags
 */
export enum PacketFlag {
  None = 0,
  AckRequired = 1 << 0,
  Fragmented = 1 << 1
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