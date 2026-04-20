/**
 * BitWarp Networking Handshake Packet
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1050
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               20.04.2026
 */
/* Import required modules */
import { FlashBuffer } from 'flash-buffer';
import { IPacketData, BasePacket } from '../packet';
import { PROTOCOL_VERSION } from '../../constants';

/**
 * Handshake Step
 */
export enum HandshakeStep {
  INIT = 0,
  RESPONSE = 1,
  FINISH = 2,
}

/**
 * Handshake Initialization
 */
export interface HandshakeInit {
  step: HandshakeStep.INIT;
  clientPublicKey: Uint8Array;
  protocolVersion: number;
}

/**
 * Handshake Response
 */
export interface HandshakeResponse {
  step: HandshakeStep.RESPONSE;
  serverPublicKey: Uint8Array;
  protocolVersion: number;
}

/**
 * Handshake finish
 */
export interface HandshakeFinish {
  step: HandshakeStep.FINISH;
  protocolVersion: number;
  cipherText : Uint8Array;
  peerInfo : any;
}

/**
 * Handshake payload
 */
export type HandshakePayload = HandshakeInit | HandshakeResponse | HandshakeFinish;

/**
 * Handshake packet data
 */
export interface HandshakePacketData extends IPacketData {
  payload: HandshakePayload;
}

/**
 * Handshake Packet
 */
export class HandshakePacket extends BasePacket {
  /**
   * Serialize packet
   * @param payload {HandshakePayload} Handshake Payload
   * @returns {Uint8Array} Serialized handshake packet
   */
  public static serialize(payload: HandshakePayload): Uint8Array {
    const buf = new FlashBuffer();

    buf.writeUint8(payload.step);

    switch (payload.step) {
      case HandshakeStep.INIT: {
        const init = payload as HandshakeInit;
        buf.writeUint16(PROTOCOL_VERSION, true);
        buf.writeUint16(init.clientPublicKey.byteLength, true);
        buf.writeBytes(init.clientPublicKey);
        break;
      }
      case HandshakeStep.RESPONSE: {
        const resp = payload as HandshakeResponse;
        buf.writeUint16(PROTOCOL_VERSION, true);
        buf.writeUint16(resp.serverPublicKey.byteLength, true);
        buf.writeBytes(resp.serverPublicKey);
        break;
      }
      case HandshakeStep.FINISH: {
        const resp = payload as HandshakeFinish;
        buf.writeUint16(PROTOCOL_VERSION, true);
        buf.writeUint16(resp.cipherText.byteLength, true);
        buf.writeBytes(resp.cipherText);
        buf.writeDynamic(resp.peerInfo);
        break;
      }
    }

    return buf.toUint8Array();
  }

  /**
   * Deserialize packet
   * @param data {Uint8Array} Raw Handshake Packet
   * @returns {HandshakePayload} Handshake Payload
   */
  public static deserialize(data: Uint8Array): HandshakePayload {
    const buf = new FlashBuffer();
    buf.writeBytes(data);
    buf.reset();

    const step = buf.readUint8() as HandshakeStep;

    switch (step) {
      case HandshakeStep.INIT: {
        const protocolVersion = buf.readUint16(true);
        const keyLen = buf.readUint16(true);
        const clientPublicKey = buf.readBytes(keyLen);
        return { protocolVersion, step, clientPublicKey };
      }
      case HandshakeStep.RESPONSE: {
        const protocolVersion = buf.readUint16(true);
        const keyLen = buf.readUint16(true);
        const serverPublicKey = buf.readBytes(keyLen);
        return { protocolVersion, step, serverPublicKey };
      }
      case HandshakeStep.FINISH:
        const protocolVersion = buf.readUint16(true);
        const keyLen = buf.readUint16(true);
        const cipherText = buf.readBytes(keyLen);
        const peerInfo = buf.readDynamic();
        return { protocolVersion, step, cipherText, peerInfo };
      default:
        throw new Error(`Unknown handshake step: ${step}`);
    }
  }

  /**
   * Encode handshake packet
   * @param payload {HandshakePayload} Handshake payload
   * @param requestId {number} Request internal id
   * @param flags {PacketFlag} Packet flags
   * @returns {Uint8Array} Ready-to-use packet buffer
   */
  public static override encode(payload: HandshakePayload, requestId = 0, flags = 0): Uint8Array {
    const body = this.serialize(payload);
    return super.encode(body, requestId, flags);
  }

  /**
   * Decode handshake packet
   * @param buffer {Uint8Array} Packet buffer
   * @returns {HandshakePacketData} Ready to parse packet
   */
  public static override decode(buffer: Uint8Array): HandshakePacketData {
    const basePacket = super.decode(buffer);
    if(!basePacket.body) throw new Error(`Failed to decode packet. Packet body is not defined`);
    const payload = this.deserialize(basePacket.body);
    return { header: basePacket.header, payload };
  }
}