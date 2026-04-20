/**
 * BitWarp Networking Room Packet
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1031
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               20.04.2026
 */
/* Import required modules */
import { FlashBuffer, FlashBufferSchema, field } from 'flash-buffer';
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
  UPDATE = 5,
  ACCEPT = 6
}

/**
 * Create room payload
 */
export interface CreateRoomPayload {
  action: RoomAction.CREATE;

}

/**
 * Remove room payload
 */
export interface RemoveRoomPayload {
  action: RoomAction.DELETE;
  roomId: string;

}

/**
 * Update room payload
 */
export interface UpdateRoomPayload {
  action: RoomAction.UPDATE;
  roomId: string;

}

/**
 * Join room payload
 */
export interface JoinRoomPayload {
  action: RoomAction.JOIN;
  roomId: string;

}

/**
 * Leave room payload
 */
export interface LeaveRoomPayload {
  action: RoomAction.LEAVE;
  roomId: string;

}

export interface AcceptRoomPayload {
  action: RoomAction.ACCEPT;
  roomId: string;

}

/**
 * List rooms payload
 */
export interface ListRoomsPayload {
  action: RoomAction.LIST;

}

/**
 * Room Payload
 */
export type RoomPayload = CreateRoomPayload | RemoveRoomPayload | UpdateRoomPayload | JoinRoomPayload | LeaveRoomPayload | ListRoomsPayload | AcceptRoomPayload;

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

    switch (payload.action) {

      default: {
        throw new Error("Invalid action type for room packet.");
      }
    }
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

    // Get action
    const action = buf.readUint8() as RoomAction;
    switch (action) {

      default: {
        throw new Error('Unknown action type for room packet.');
      }
    }
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