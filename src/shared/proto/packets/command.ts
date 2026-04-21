/**
 * BitWarp Networking Command Packet
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1033
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               21.04.2026
 */
/* Import required modules */
import { BasePacket, IPacketData, PacketType } from '../packet';
import { FlashBuffer } from 'flash-buffer';

/**
 * Command payload
 */
export interface CommandPayload {
  isRequest : boolean;
  isNeedResponse : boolean;
  commandName: string;
  timestamp : number;
  data : any
}

/**
 * Command packet data
 */
export interface CommandPacketData extends IPacketData {
  payload : CommandPayload;
}

/**
 * Command packet
 */
export class CommandPacket extends BasePacket {
  /**
   * Serialize
   * @param payload {CommandPayload} Command payload
   * @returns {Uint8Array} Serialized command request
   */
  public static serialize(payload : CommandPayload) : Uint8Array {
    const buf = new FlashBuffer();
    buf.writeBool(payload.isRequest);
    buf.writeBool(payload.isNeedResponse);
    buf.writeString(payload.commandName, "utf-8", true);
    buf.writeBigInt64(BigInt(payload.timestamp), true);
    buf.writeDynamic(payload.data);
    return buf.toUint8Array();
  }

  /**
   * Deserialize
   * @param data {Uint8Array} Serialized data
   * @returns {CommandPayload} Deserialized payload
   */
  public static deserialize(data : Uint8Array) : CommandPayload {
    const buf = new FlashBuffer();
    buf.writeBytes(data);
    buf.reset();

    const isRequest : boolean = buf.readBool();
    const isNeedResponse : boolean = buf.readBool();
    const commandName : string = buf.readString();
    const timestamp : number = Number(buf.readBigInt64(true));
    const responseData : any = buf.readDynamic();
    return { isRequest, isNeedResponse, commandName, timestamp, data : responseData };
  }

  /**
   * Encode packet
   * @param payload {CommandPayload} Payload
   * @param requestId {number} Request internal id
   * @param flags {PacketFlag} Packet flags
   * @returns {Uint8Array} Ready-to-use packet buffer
   */
  public static override encode(payload: CommandPayload, requestId = 0, flags = 0): Uint8Array {
    let body = this.serialize(payload);
    return super.encode(body, requestId, flags, (payload.isRequest) ? PacketType.COMMAND : PacketType.COMMAND_RESPONSE);
  }

  /**
   * Decode packet
   * @param buffer {Uint8Array} Packet buffer
   * @returns {CommandPacketData} Ready to parse packet
   */
  public static override decode(buffer: Uint8Array): CommandPacketData {
    let basePacket = super.decode(buffer);
    if(!basePacket.body) throw new Error(`Failed to decode packet. Packet body is not defined`);
    const payload = this.deserialize(basePacket.body);
    return { header: basePacket.header, payload };
  }
}