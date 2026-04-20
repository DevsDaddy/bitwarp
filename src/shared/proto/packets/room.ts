/**
 * BitWarp Networking Room Packet
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1029
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               17.04.2026
 */
/* Import required modules */
import { FlashBuffer } from 'flash-buffer';
import { PacketType, HeaderEncoder, BasePacket, IPacketData } from '../packet';

/**
 * Room Action
 */
export enum RoomAction {
  JOIN = 0,
  LEAVE = 1,
  LIST = 2,
  CREATE = 3,
  DELETE = 4,
  UPDATE = 5
}

/**
 * Room payload
 */
export interface RoomPayload {
  action: RoomAction;
  roomId: string;
  data?: Uint8Array; // Additional room data, for example: password
}

/**
 * Room Packet Data
 */
export interface RoomPacketData extends IPacketData {
  payload: RoomPayload;
}

/**
 * Room Packet
 */
export class RoomPacket extends BasePacket {
  /**
   * Serialize payload
   * @param payload {RoomPayload} Room payload
   * @returns {Uint8Array} Serialized buffer
   */
  public static serialize(payload: RoomPayload): Uint8Array {
    const buf = new FlashBuffer();
    buf.writeUint8(payload.action);
    buf.writeUint16(payload.roomId.length, true);
    buf.writeString(payload.roomId, 'utf-8');
    if (payload.data) {
      buf.writeUint16(payload.data.byteLength);
      buf.writeBytes(payload.data);
    } else {
      buf.writeUint16(0);
    }
    return buf.toUint8Array();
  }

  /**
   * Deserialize room payload
   * @param rawBuffer {Uint8Array} Raw buffer
   * @returns {RoomPayload} Room payload
   */
  public static deserialize(rawBuffer: Uint8Array): RoomPayload {
    const buf = new FlashBuffer();
    buf.writeBytes(rawBuffer);
    buf.reset();

    const action = buf.readUint8() as RoomAction;
    const roomIdLen = buf.readUint16(true);
    const roomId = buf.readString(roomIdLen, "utf-8");
    const dataLen = buf.readUint16();
    let data: Uint8Array | undefined;
    if (dataLen > 0) {
      data = buf.readBytes(dataLen);
    }

    return { action, roomId, data };
  }

  /**
   * Encode room packet
   * @param payload {RoomPayload} Room payload
   * @param requestId {number} Request internal id
   * @param flags {PacketFlag} Packet flags
   * @returns {Uint8Array} Ready-to-use packet buffer
   */
  public static override encode(payload: RoomPayload, requestId = 0, flags = 0): Uint8Array {
    let body = this.serialize(payload);
    return super.encode(body, requestId, flags, PacketType.ROOM);
  }

  /**
   * Decode room packet
   * @param buffer {Uint8Array} Packet buffer
   * @returns {RoomPacketData} Ready to parse packet
   */
  public static override decode(buffer: Uint8Array): RoomPacketData {
    let basePacket = super.decode(buffer);
    if(!basePacket.body) throw new Error(`Failed to decode packet. Packet body is not defined`);
    const payload = this.deserialize(basePacket.body);
    return { header: basePacket.header, payload };
  }
}