/**
 * BitWarp Networking room management
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1035
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               21.04.2026
 */
/* Import required modules */
import { Peer, PeerData } from './peer';
import { Grants } from './grants';

/**
 * BitWarp Room
 */
export interface Room {
  // Basic room info
  id: string;
  owner: string;
  peers: Set<string>;
  info: RoomInfo;
  persistent : boolean;

  // Room access
  accessKey: string;
  needAccept: boolean;

  // Room grants
  grants : RoomGrants;
}

/**
 * Room Info
 */
export interface RoomInfo {
  name: string;
  description ? : string;
}

/**
 * Room Grants
 */
export interface RoomGrants {
  roomUpdates : Grants,
  roomRemove : Grants
}

/**
 * Public room info
 */
export type RoomData = Omit<Room, "accessKey">;