/**
 * BitWarp Networking peer management
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1031
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               20.04.2026
 */
import { CryptoProvider } from './crypto';
import { HandshakeStep } from './packets/handshake';

/**
 * Connection
 */
export interface ClientConnection {
  id : string;
  connector : any;
  isAlive : true;
  pingTimeout ? : NodeJS.Timeout;
  query : Map<string, string>;
}

/**
 * Client Disconnect Code
 */
export enum ClientDisconnectCode {
  NormalDisconnect = 0,
  ConnectionTimeout = 1,
  HandshakeError = 2,
  HandshakeTimeout = 3,
  ClientError = 4,
  ServerError = 5,
  Unknown = 999
}

/**
 * Client Disconnect Status
 */
export interface ClientDisconnect {
  connectionId : string;
  code : ClientDisconnectCode;
}

/**
 * Client Data
 */
export interface ClientData {
  connection : ClientConnection;
  data : Uint8Array;
}

/**
 *  BitWarp Peer
 */
export interface Peer {
  // Basic Data
  id : string;
  connection : ClientConnection;
  ping ? : number;

  // Encryption
  encryptor ? : CryptoProvider;
  clientKey : Uint8Array;

  // Handshake
  handshakeComplete : boolean;
  handshakeStep : HandshakeStep;

  // Peer Info
  isReady : boolean;
  info ? : any;
}

/**
 * Public Peer
 */
export type PeerData = Omit<Peer, "connection" | "encryptor" | "clientKey" | "handshakeStep">