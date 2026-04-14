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
  PING = 0xA,
  PONG = 0xB,
  // Reserved for future extensions 0xC-0xF
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