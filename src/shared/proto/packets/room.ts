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
import { Room, RoomData } from '../room';
import { PeerData } from '../peer';

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
  ACCEPT = 6,
  UPDATE_PEER = 7
}

/**
 * Create room payload
 */
export interface CreateRoomPayload {
  action: RoomAction.CREATE;
  data : Room;
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
  data: Room;
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
  peerId: string;
}

/**
 * List rooms payload
 */
export interface ListRoomsPayload {
  action: RoomAction.LIST;
  offset: number;
  rooms: RoomData[] | undefined;
}

/**
 * Update room peer payload
 */
export interface UpdateRoomPeerPayload {
  action: RoomAction.UPDATE_PEER;
  roomId: string;
  peerId: string;
  peerData: PeerData;
}

/**
 * Room Payload
 */
export type RoomPayload = CreateRoomPayload | RemoveRoomPayload | UpdateRoomPayload | JoinRoomPayload | LeaveRoomPayload | ListRoomsPayload | AcceptRoomPayload | UpdateRoomPeerPayload;

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
      case RoomAction.CREATE: {
        buf.writeDynamic(payload.data);
        break;
      }
      case RoomAction.DELETE: {
        buf.writeString(payload.roomId, "utf-8", true);
        break;
      }
      case RoomAction.UPDATE: {
        buf.writeString(payload.roomId, "utf-8", true);
        buf.writeDynamic(payload.data);
        break;
      }
      case RoomAction.LIST: {
        buf.writeInt32(payload.offset, true);
        buf.writeDynamic(payload.rooms);
        break;
      }
      case RoomAction.ACCEPT: {
        buf.writeString(payload.roomId, "utf-8", true);
        buf.writeString(payload.peerId, "utf-8", true);
        break;
      }
      case RoomAction.JOIN: {
        buf.writeString(payload.roomId, "utf-8", true);
        break;
      }
      case RoomAction.LEAVE: {
        buf.writeString(payload.roomId, "utf-8", true);
        break;
      }
      case RoomAction.UPDATE_PEER: {
        buf.writeString(payload.roomId, "utf-8", true);
        buf.writeString(payload.peerId, "utf-8", true);
        buf.writeDynamic(payload.peerData);
        break;
      }
      default: {
        throw new Error("Invalid action type for room packet.");
      }
    }

    // Return buffer
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

    // Get action
    const action = buf.readUint8() as RoomAction;
    switch (action) {
      case RoomAction.CREATE: {
        let data : Room = buf.readDynamic();
        return { data, action };
      }
      case RoomAction.DELETE: {
        let roomId = buf.readString();
        return {roomId, action};
      }
      case RoomAction.UPDATE: {
        let roomId = buf.readString();
        let roomData : Room = buf.readDynamic();
        return {roomId, data: roomData, action};
      }
      case RoomAction.LIST: {
        let offset = buf.readInt32(true);
        let rooms : RoomData[] | undefined = buf.readDynamic();
        return {offset, rooms, action};
      }
      case RoomAction.ACCEPT: {
        let roomId = buf.readString();
        let peerId = buf.readString();
        return {roomId, peerId, action};
      }
      case RoomAction.JOIN: {
        let roomId = buf.readString();
        return {roomId, action};
      }
      case RoomAction.LEAVE: {
        let roomId = buf.readString();
        return {roomId, action};
      }
      case RoomAction.UPDATE_PEER: {
        let roomId = buf.readString();
        let peerId = buf.readString();
        let peerData : PeerData = buf.readDynamic();
        return {roomId, peerId, peerData, action};
      }
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