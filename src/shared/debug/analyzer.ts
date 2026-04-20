/**
 * BitWarp Networking Packet Analyzer
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { IPacketData } from '../proto/packet';
import { Logger } from './logger';

/**
 * Packet Analyzer Data
 */
export interface PacketInfo {
  // Basic info
  name ? : string;
  packetReceived : number;
  packetReady ? : number;
  rawPacket : Uint8Array;
  rawPacketSize ? : number;

  // Packet flags
  isCompressed ? : boolean;
  isEncrypted ? : boolean;
  compressedSize ? : number;

  // Packet
  packet ? : IPacketData
}

export const GeneralPacketNames = {
  HANDSHAKE: "handshake",
  ROOM: "room",
  COMMAND: "command",
  COMMAND_RESPONSE: "command_response",
  EVENT: "event",
  SYNC_OBJECT: "sync_object",
  SYNC_ACTION: "sync_action",
  STREAM_CONTROL: "stream_control",
  RAW_BINARY: "raw_binary",
  ERROR: "error",
  PING: "ping",
  UPDATE_PEER: "update_peer"
}

/**
 * BitWarp Packet Analyzer
 */
export class PacketAnalyzer {
  // Packet for analyzing
  private static _isEnabled : boolean = true;
  private static _packets : Map<string, PacketInfo> = new Map();

  // #region Toggle Analyzer
  /**
   * Toggle packet analyzer
   * @param isEnabled {boolean} Enable state
   */
  public static toggle(isEnabled : boolean) : void {
    this._isEnabled = isEnabled;
  }

  // #region Basic Operations
  /**
   * Create packet for analyzer
   * @param packetName {packetName} Packet name
   * @param packetInfo {PacketInfo} Packet info
   * @param override {boolean} Override exists packet?
   * @returns {boolean} Returns false if packet is already exists and not overwritten
   */
  public static create(packetName : string, packetInfo : PacketInfo, override : boolean = false) : boolean {
    if(!this._isEnabled) return false;

    // Check packet exists
    if(this._packets.has(packetName)){
      if(override) this._packets.delete(packetName);
      else return false;
    }

    // Set packet
    packetInfo.name = packetName;
    packetInfo.rawPacketSize = packetInfo.rawPacket.byteLength;
    this._packets.set(packetName, packetInfo);
    return true;
  }

  /**
   * Update packet
   * @param packetName {string} Packet name
   * @param packetInfo {PacketInfo} New packet info
   * @returns {boolean} Returns false if packet not found
   */
  public static update(packetName : string, packetInfo : PacketInfo) : boolean {
    if(!this._isEnabled) return false;
    if(!this._packets.has(packetName)) return false;

    if(packetInfo.name !== packetName) packetInfo.name = packetName;
    let packet = this._packets.get(packetName) as PacketInfo;
    packet = {...packet, ...packetInfo};
    this._packets.set(packetName, packet);
    return true;
  }

  /**
   * Get packet
   * @param packetName {string} packet name
   * @returns {PacketInfo|undefined} Packet info or undefined
   */
  public static get(packetName : string) : PacketInfo | undefined {
    if(!this._isEnabled) return undefined;
    return this._packets.get(packetName);
  }

  /**
   * Remove packet from analyzer
   * @param packetName {string} packet name
   * @returns {boolean} Returns false if packet not found
   */
  public static remove(packetName : string) : boolean{
    if(!this._isEnabled) return false;
    if(!this._packets.has(packetName)) return false;
    this._packets.delete(packetName);
    return true;
  }

  /**
   * Remove all packets from analyzer
   */
  public static clear() {
    if(!this._isEnabled) return;
    this._packets.clear();
  }

  /**
   * Write information about packet into log
   * @param packetName {string} packet name
   */
  public static logInfo(packetName : string){
    if(!this._isEnabled) return;
    let packetData = this._packets.get(packetName);
    if(!packetData){
      Logger.warning(`Failed to analyze packet ${packetName}. Packet not found in analyzer.`);
      return;
    }

    let packetInfo = `
      Packet: ${packetName}
      =======================================
      Received at: ${packetData.packetReceived}, Ready after: ${(packetData.packetReady ?? Date.now()) - packetData.packetReceived} ms.
      Raw size: ${packetData.rawPacketSize}
      ${packetData.isCompressed && packetData.compressedSize ? `Compressed size: ${packetData.compressedSize}` : ""}
      Compression: ${packetData.isCompressed ? "Enabled" : "Disabled"}
      Encryption: ${packetData.isEncrypted ? "Enabled" : "Disabled"}
    `;
    Logger.info(packetInfo);
  }
  // #endregion

  // #region Comparison
  /**
   * Time between two packets in ms
   * @param first {string} Fist packet name
   * @param second {string} Second packet name
   * @returns {number} Returns time between two packets or -1 if analyzer is disabled
   */
  public static timeBetween(first : string , second : string) : number{
    if(!this._isEnabled) return -1;

    let firstPacket = this._packets.get(first);
    let secondPacket = this._packets.get(second);
    if(!firstPacket || !secondPacket) throw new Error(`Failed to calculate time between two packets. One of packet is not found in analyzer`);

    return (firstPacket.packetReceived < secondPacket.packetReceived)
      ? secondPacket.packetReceived - firstPacket.packetReceived
      : firstPacket.packetReceived - secondPacket.packetReceived;
  }
  // #endregion
}