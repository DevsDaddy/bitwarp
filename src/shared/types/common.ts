/**
 * BitWarp Networking Common Types
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { ITransport } from '../proto/transport';

/**
 * BitWarp Shared Options
 */
export interface BitWarpOptions {
  // Application options
  name ? : string;
  version ? : string;

  // Basic options
  transport ? : ITransport;
}