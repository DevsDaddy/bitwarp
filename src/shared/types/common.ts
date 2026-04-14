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
import { LogLevel } from '../debug/logger';

/**
 * BitWarp Shared Options
 */
export interface BitWarpOptions {
  // Application options
  name ? : string;
  version ? : string;

  // Debug options
  debug ? : boolean;
  logLevel ? : LogLevel;

  // Basic options
  transport ? : ITransport;
}

/**
 * Middleware Handler
 */
export type MiddlewareHandler<TArgs extends any[] = any[]> = (...args: TArgs) => void | Promise<void>;