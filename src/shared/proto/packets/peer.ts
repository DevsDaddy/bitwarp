/**
 * BitWarp Networking Peer Update Packet
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1050
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               20.04.2026
 */

import { BasePacket, IPacketData, PacketType } from '../packet';
import { FlashBuffer } from 'flash-buffer';

/**
 * Peer Update Payload
 */
export type PeerUpdatePayload = {
  peerInfo : any;
}

/**
 * Ping Packet Data
 */
export interface PeerUpdatePacketData extends IPacketData {
  payload: PeerUpdatePayload;
}

/**
 * Peer Update packet
 */
export class PeerUpdatePacket extends BasePacket {
  /**
   * Serialize packet
   * @param payload {PeerUpdatePayload} Payload
   * @returns {Uint8Array} Serialized ping packet
   */
  public static serialize(payload : PeerUpdatePayload) : Uint8Array {
    const buf = new FlashBuffer();
    buf.writeDynamic(payload.peerInfo);
    return buf.toUint8Array();
  }

  /**
   * Deserialize packet
   * @param data {Uint8Array} Raw Ping Packet
   * @returns {PingPayload} Payload
   */
  public static deserialize(data: Uint8Array): PeerUpdatePayload {
    const buf = new FlashBuffer();
    buf.writeBytes(data);
    buf.reset();

    const peerInfo = buf.readDynamic();
    return { peerInfo };
  }

  /**
   * Encode packet
   * @param payload {PeerUpdatePayload} Payload
   * @param requestId {number} Request internal id
   * @param flags {PacketFlag} Packet flags
   * @returns {Uint8Array} Ready-to-use packet buffer
   */
  public static override encode(payload: PeerUpdatePayload, requestId = 0, flags = 0): Uint8Array {
    let body = this.serialize(payload);
    return super.encode(body, requestId, flags, PacketType.UPDATE_PEER);
  }

  /**
   * Decode packet
   * @param buffer {Uint8Array} Packet buffer
   * @returns {PeerUpdatePacketData} Ready to parse packet
   */
  public static override decode(buffer: Uint8Array): PeerUpdatePacketData {
    let basePacket = super.decode(buffer);
    if(!basePacket.body) throw new Error(`Failed to decode packet. Packet body is not defined`);
    const payload = this.deserialize(basePacket.body);
    return { header: basePacket.header, payload };
  }
}