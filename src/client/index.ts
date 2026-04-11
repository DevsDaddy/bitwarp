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
import {
  BaseEvent,
  BitWarpOptions,
  ErrorHandler,
  ErrorType,
  ITransport,
  Logger,
  LogLevel,
  TransportCloseCode, TransportErrorHandler
} from '../shared';
import { WebSocketClientTransport } from './transport/websocket';

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
  private readonly _transport : ITransport;

  // Client events
  public readonly onInitialized : BaseEvent = new BaseEvent();
  public readonly onInitializationError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();
  public readonly onStopped : BaseEvent = new BaseEvent();
  public readonly onError : BaseEvent<ErrorHandler> = new BaseEvent<ErrorHandler>();

  // Client state
  private _isConnected = false;

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

    // Create transport is not defined
    this._transport = (this.options.transport) ? this.options.transport : new WebSocketClientTransport();
    this._isConnected = false;
  }

  // #region Client Fields
  /**
   * Get current client options
   * @returns {BitWarpClientOptions} Current options
   */
  public get options() : BitWarpClientOptions { return this._options; }
  public get transport (): ITransport { return this._transport };
  public get isConnected (): boolean { return this._isConnected; };
  // #endregion

  // #region Client connection
  /**
   * Connect to server
   */
  public async connect(): Promise<void> {
    let self = this;
    Logger.head(`Connecting BitWarp Client`);

    // Server is started
    if(self._isConnected) {
      Logger.warning(`BitWarp Client is already connected`);
      return;
    }

    // Transport is started
    if(self.transport && self.transport.isConnected) {
      self._isConnected = true;
      self.onInitialized.invoke();
      return;
    }

    // Start transport
    self.transport.onConnected.removeAllListeners();
    self.transport.onConnected.addListener(() => {
      Logger.success(`BitWarp Client is successfully started`);
      self.onInitialized.invoke();

      // TODO: Handshake with server
    });
    self.transport.onError.removeAllListeners();
    self.transport.onError.addListener((error) => {
      Logger.error(`BitWarp Client Error: ${error?.message ?? "Unknown error"}`);
      self.onInitializationError.invoke(new ErrorHandler(error.message, error?.stack ?? null, ErrorType.ClientException));
    });
    self.transport.onDisconnected.removeAllListeners();
    self.transport.onDisconnected.addListener((reason) => {
      if(reason instanceof TransportErrorHandler) {
        Logger.error(`BitWarp Client Stop Error: ${reason?.message ?? "Unknown error"}`);
        self.onError.invoke(new ErrorHandler(reason.message, reason?.stack ?? null, ErrorType.ClientException));
        return;
      }

      // Stop Server
      Logger.success(`BitWarp Client is stopped`, reason);
      self.dispose();
      self.onStopped.invoke();
    })
    await self._transport.connect();
  }

  /**
   * Disconnect from server
   */
  public async disconnect(): Promise<void> {
    await this.transport.disconnect(TransportCloseCode.ClosedByClient);
    await this.transport.dispose();
    this._isConnected = false;
  }

  /**
   * Internal Dispose
   * @private
   */
  private dispose() {
    let self = this;
    self._isConnected = false;
    self.transport.updateConnector(undefined);
    // TODO: Cleanup server
  }
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
      logLevel: LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error
    }
  }
  // #endregion

}