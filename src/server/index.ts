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
import {
  BaseEvent,
  BitWarpOptions,
  ErrorHandler,
  ErrorType,
  ITransport,
  Logger,
  LogLevel,
  ParseUtils,
  TransportCloseCode,
  TransportErrorHandler
} from '../shared';
import { WebSocketServerTransport } from './transport/websocket';
import 'dotenv/config';

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
  private readonly _transport : ITransport;

  // Server events
  public readonly onInitialized : BaseEvent = new BaseEvent();
  public readonly onInitializationError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();
  public readonly onStopped : BaseEvent = new BaseEvent();
  public readonly onError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();

  // Server state
  private _isStarted = false;

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

    // Create transport is not defined
    this._transport = (this.options.transport) ? this.options.transport : new WebSocketServerTransport();
    this._isStarted = false;
  }

  // #region Server Fields
  /**
   * Get current client options
   * @returns {BitWarpClientOptions} Current options
   */
  public get options() : BitWarpServerOptions { return this._options; }
  public get transport (): ITransport { return this._transport };
  public get isStarted (): boolean { return this._isStarted; }
  // #endregion

  // #region Server connection
  /**
   * Start BitWarp Server
   */
  public async start(): Promise<void> {
    let self = this;
    Logger.head(`Starting BitWarp Server`);

    // Server is started
    if(self._isStarted) {
      Logger.warning(`BitWarp Server is already started`);
      return;
    }

    // Transport is started
    if(self.transport && self.transport.isConnected) {
      self._isStarted = true;
      self.onInitialized.invoke();
      return;
    }

    // Start transport
    self._isStarted = false;
    self.unsubscribeAllTransport();
    self.transport.onConnected.addListener(() => {
      Logger.success(`BitWarp Server is successfully started`);
      self.onInitialized.invoke();
    });
    self.transport.onError.addListener((error) => {
      Logger.error(`BitWarp Server Error: ${error?.message ?? "Unknown error"}`);
      self.onInitializationError.invoke(new ErrorHandler(error.message, error?.stack ?? null, ErrorType.ServerException));
    });
    self.transport.onDisconnected.addListener((reason) => {
      if(reason instanceof TransportErrorHandler) {
        Logger.error(`BitWarp Server Stop Error: ${reason?.message ?? "Unknown error"}`);
        self.onError.invoke(new ErrorHandler(reason.message, reason?.stack ?? null, ErrorType.ServerException));
        return;
      }

      // Stop Server
      Logger.success(`BitWarp Server is stopped`, reason);
      self.dispose();
      self.onStopped.invoke();
    })
    await self._transport.connect();
  }

  /**
   * Stop BitWarp Server
   */
  public async stop(): Promise<void> {
    await this.transport.disconnect(TransportCloseCode.ClosedByServer);
    await this.transport.dispose();
    this._isStarted = false;
  }

  /**
   * Internal Dispose
   * @private
   */
  private dispose() {
    let self = this;
    self._isStarted = false;
    self.unsubscribeAllTransport();
    self.transport.updateConnector(undefined);
    // TODO: Cleanup server
  }

  /**
   * Unsubscribe all transport events
   * @private
   */
  private unsubscribeAllTransport(){
    let self = this;
    self.transport.onConnected.removeAllListeners();
    self.transport.onError.removeAllListeners();
    self.transport.onDisconnected.removeAllListeners();
  }
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
      logLevel : LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error
    }
  }
  // #endregion
}