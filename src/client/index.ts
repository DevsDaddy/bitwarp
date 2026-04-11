/**
 * BitWarp Networking Client Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { BaseEvent, BitWarpOptions, ErrorHandler, Logger, LogLevel } from '../shared';

/**
 * BitWarp Client Options
 */
export interface BitWarpClientOptions extends BitWarpOptions {

}

/**
 * BitWarp Client Implementation
 */
export class BitWarpClient {
  // Client setup
  private readonly _options: BitWarpClientOptions;

  // Client events
  public readonly onInitialized : BaseEvent = new BaseEvent();
  public readonly onInitializationError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();

  // #region basic setup and fields
  /**
   * Create BitWarp Client instance
   * @param options {BitWarpClientOptions} Client options
   */
  constructor(options?: BitWarpClientOptions) {
    this._options = Object.assign(BitWarpClient.defaultOptions, options);

    // Initial checks
    if(!this.options.debug) Logger.toggle(false);
    if(this.options.logLevel !== Logger.level) Logger.level = this.options.logLevel as LogLevel;
  }

  // #region Client Fields
  /**
   * Get current client options
   * @returns {BitWarpClientOptions} Current options
   */
  public get options() : BitWarpClientOptions { return this._options; }

  // #endregion

  /**
   * Return default options
   * @returns {BitWarpClientOptions} Default options
   */
  public static get defaultOptions() : BitWarpClientOptions {
    return {
      name: "BitWarp Client",
      version: "1.0.0",
      debug: true,
      logLevel: LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error,
    }
  }
  // #endregion

}