/**
 * BitWarp Networking Error Packet
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1031
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               18.04.2026
 */
/* Import required modules */
import { FlashBuffer } from 'flash-buffer';
import { BasePacket, IPacketData, PacketType } from '../packet';

/**
 * Error Payload
 */
export type ErrorPayload = {
  message : string;
  stack : string;
  code : number;
};

/**
 * Error packet data
 */
export interface ErrorPacketData extends IPacketData {
  payload: ErrorPayload;
}

/**
 * Error Packet
 */
export class ErrorPacket extends BasePacket {
  /**
   * Serialize packet
   * @param payload {ErrorPayload} Error Payload
   * @returns {Uint8Array} Serialized error packet
   */
  public static serialize(payload : ErrorPayload) : Uint8Array {
    const buf = new FlashBuffer();
    if(!payload.stack) payload.stack = "";
    buf.writeUint16(payload.message.length, true);
    buf.writeString(payload.message, "utf-8");
    buf.writeUint16(payload.stack.length, true);
    buf.writeString(payload.stack, "utf-8");
    buf.writeUint8(payload.code);
    return buf.toUint8Array();
  }

  /**
   * Deserialize packet
   * @param data {Uint8Array} Raw Error Packet
   * @returns {HandshakePayload} Error Payload
   */
  public static deserialize(data: Uint8Array): ErrorPayload {
    const buf = new FlashBuffer();
    buf.writeBytes(data);
    buf.reset();

    const messageLength = buf.readUint16(true);
    const message = buf.readString(messageLength, "utf-8");
    const stackLength = buf.readUint16(true);
    const stack = buf.readString(stackLength, "utf-8");
    const code = buf.readUint8();

    return { message: message, stack: stack, code: code };
  }

  /**
   * Encode error packet
   * @param payload {ErrorPayload} Error payload
   * @param requestId {number} Request internal id
   * @param flags {PacketFlag} Packet flags
   * @returns {Uint8Array} Ready-to-use packet buffer
   */
  public static override encode(payload: ErrorPayload, requestId = 0, flags = 0): Uint8Array {
    const body = this.serialize(payload);
    return super.encode(body, requestId, flags, PacketType.ERROR);
  }

  /**
   * Decode error packet
   * @param buffer {Uint8Array} Packet buffer
   * @returns {ErrorPacketData} Ready to parse packet
   */
  public static override decode(buffer: Uint8Array): ErrorPacketData {
    const basePacket = super.decode(buffer);
    if(!basePacket.body) throw new Error(`Failed to decode packet. Packet body is not defined`);
    const payload = this.deserialize(basePacket.body);
    return { header: basePacket.header, payload };
  }
}