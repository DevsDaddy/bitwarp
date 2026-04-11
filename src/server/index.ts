/**
 * BitWarp Networking Server Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { BaseEvent, BitWarpOptions, ErrorHandler, Logger, LogLevel, ParseUtils } from '../shared';

/**
 * BitWarp Server Options
 */
export interface BitWarpServerOptions extends BitWarpOptions{

}

/**
 * BitWarp Server Implementation
 */
export class BitWarpServer {
  // Server setup
  private readonly _options: BitWarpServerOptions;

  // Server events
  public readonly onInitialized : BaseEvent = new BaseEvent();
  public readonly onInitializationError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();

  // #region basic setup and fields
  /**
   * Create BitWarp Server instance
   * @param options {BitWarpServerOptions} Server options
   */
  constructor(options?: BitWarpServerOptions) {
    this._options = Object.assign(BitWarpServer.defaultOptions, options);

    // Initial checks
    if(!this.options.debug) Logger.toggle(false);
    if(this.options.logLevel !== Logger.level) Logger.level = this.options.logLevel as LogLevel;
  }

  // #region Server Fields
  /**
   * Get current client options
   * @returns {BitWarpClientOptions} Current options
   */
  public get options() : BitWarpServerOptions { return this._options; }

  // #endregion

  /**
   * Return default options
   * @returns {BitWarpServerOptions} Default options
   */
  public static get defaultOptions() : BitWarpServerOptions {
    return {
      name : process?.env?.APPLICATION_NAME ?? "BitWarp Server",
      version : process?.env?.APPLICATION_VERSION ?? "1.0.0",
      debug : ParseUtils.bool(process?.env?.DEBUG_MODE ?? "true"),
      logLevel : LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error,
    }
  }
  // #endregion
}