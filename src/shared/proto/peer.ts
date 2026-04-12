/**
 * BitWarp Networking peer management
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/**
 * Connection
 */
export interface Connection {
  id : string;
  connection : any;
  isAlive : true;
  pingTimeout ? : NodeJS.Timeout;
}

/**
 *  BitWarp Peer
 */
export interface Peer {
  id : string;
  connection : Connection;
}