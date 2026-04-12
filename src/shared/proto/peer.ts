/**
 * BitWarp Networking peer management
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1005
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               12.04.2026
 */
/**
 * Connection
 */
export interface ClientConnection {
  id : string;
  connector : any;
  isAlive : true;
  pingTimeout ? : NodeJS.Timeout;
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
  id : string;
  connection : ClientConnection;
}