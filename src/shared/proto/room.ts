/**
 * BitWarp Networking room management
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1031
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               20.04.2026
 */
/* Import required modules */
import { Peer, PeerData } from "./peer";

/**
 * BitWarp Room
 */
export interface Room {
  // Basic room info
  id: string;
  owner: Peer;
  peers: Set<Peer> | Set<PeerData>;
  info: RoomInfo;

  // Room access
  accessKey: string;
  isPublic: boolean;
  needAccept: boolean;
}

/**
 * Room Info
 */
export interface RoomInfo {
  name: string;
  description: string;
}

/**
 * Public room info
 */
export type RoomData = Omit<Room, "accessKey">;