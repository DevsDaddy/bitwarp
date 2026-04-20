/**
 * BitWarp Networking Ping Packet
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1047
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               19.04.2026
 */
/* Import required modules */
import { FlashBuffer } from 'flash-buffer';
import { BasePacket, IPacketData, PacketType } from '../packet';

/* Ping Payload */
export type PingPayload = {
  timestamp : number;
}

/**
 * Ping Packet Data
 */
export interface PingPacketData extends IPacketData {
  payload: PingPayload;
}

/**
 * Ping packet
 */
export class PingPacket extends BasePacket {
  /**
   * Serialize packet
   * @param payload {PingPayload} Ping Payload
   * @returns {Uint8Array} Serialized ping packet
   */
  public static serialize(payload : PingPayload) : Uint8Array {
    const buf = new FlashBuffer();
    buf.writeBigInt64(BigInt(payload.timestamp), true);
    return buf.toUint8Array();
  }

  /**
   * Deserialize packet
   * @param data {Uint8Array} Raw Ping Packet
   * @returns {PingPayload} Error Payload
   */
  public static deserialize(data: Uint8Array): PingPayload {
    const buf = new FlashBuffer();
    buf.writeBytes(data);
    buf.reset();

    const timestamp = Number(buf.readBigInt64(true));
    return { timestamp };
  }

  /**
   * Encode ping packet
   * @param payload {PingPayload} Ping payload
   * @param requestId {number} Request internal id
   * @param flags {PacketFlag} Packet flags
   * @returns {Uint8Array} Ready-to-use packet buffer
   */
  public static override encode(payload: PingPayload, requestId = 0, flags = 0): Uint8Array {
    let body = this.serialize(payload);
    return super.encode(body, requestId, flags, PacketType.PING);
  }

  /**
   * Decode ping packet
   * @param buffer {Uint8Array} Packet buffer
   * @returns {PingPacketData} Ready to parse packet
   */
  public static override decode(buffer: Uint8Array): PingPacketData {
    let basePacket = super.decode(buffer);
    if(!basePacket.body) throw new Error(`Failed to decode packet. Packet body is not defined`);
    const payload = this.deserialize(basePacket.body);
    return { header: basePacket.header, payload };
  }
}