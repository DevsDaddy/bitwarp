/**
 * BitWarp Networking Client Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1010
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               13.04.2026
 */
/* Import required modules */
import {
  BaseEvent,
  BitWarpOptions,
  ErrorHandler,
  ErrorType, IClientTransport, ICompressionProvider,
  Logger,
  LogLevel,
  TransportCloseCode, TransportErrorHandler,
  Performance, PERF_CONSTANTS
} from '../shared';
import { WebSocketClientTransport } from './transport/websocket';

/**
 * BitWarp Client Options
 */
export interface BitWarpClientOptions extends BitWarpOptions {
  compression ? : ICompressionProvider | false;
}

/**
 * BitWarp Client Implementation
 */
export class BitWarpClient {
  // Client setup
  private readonly _isDebug : boolean;
  private readonly _options: BitWarpClientOptions;
  private readonly _transport : IClientTransport;
  private readonly _performance: Performance = new Performance();
  private readonly _compressor ? : ICompressionProvider;

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

    // Init compressor
    if(this.options.compression) this._compressor = this.options.compression;

    // Create transport is not defined
    this._isDebug = this.options.debug ?? false;
    this._transport = (this.options.transport) ? this.options.transport as IClientTransport : new WebSocketClientTransport();
    this._isConnected = false;
  }

  // #region Client Fields
  /**
   * Get current client options
   * @returns {BitWarpClientOptions} Current options
   */
  public get options() : BitWarpClientOptions { return this._options; }
  public get transport (): IClientTransport { return this._transport };
  public get isConnected (): boolean { return this._isConnected; };
  public get isDebug() : boolean { return this._isDebug; };
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

    // Add mark for transport initialized
    self._performance.mark(PERF_CONSTANTS.TRANSPORT_CREATED);

    // Start transport
    self.unsubscribeAllTransport();
    self.transport.onConnected.addListener(() => {
      Logger.success(`BitWarp Client is successfully started`);
      self._performance.mark(PERF_CONSTANTS.TRANSPORT_CONNECTED);
      Logger.info(`Transport initialized for: ${self._performance.measure(PERF_CONSTANTS.TRANSPORT_MEASURE, PERF_CONSTANTS.TRANSPORT_CREATED, PERF_CONSTANTS.TRANSPORT_CONNECTED)} ms`)
      self.onInitialized.invoke();

      // TODO: Handshake with server
    });
    self.transport.onDataReceived.addListener((data) => {
      self.handleRawMessage(data);
    });
    self.transport.onError.addListener((error) => {
      Logger.error(`BitWarp Client Error: ${error?.message ?? "Unknown error"}`);
      self.onInitializationError.invoke(new ErrorHandler(error.message, error?.stack ?? null, ErrorType.ClientException));
    });
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
    self.unsubscribeAllTransport();
    self.transport.updateConnector(undefined);
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
    self.transport.onDataReceived.removeAllListeners();
  }
  // #endregion

  // #region Work with packets

  /**
   * Handle raw message from server
   * @param message {Uint8Array} Message data
   * @private
   */
  private handleRawMessage(message : Uint8Array) {
    let self = this;

    // Check compression
    if(self.options.compression){
      if(!self._compressor) throw new Error("Failed to decompress message. Compressor is not initialized.");
      message = self._compressor.decompress(message);
    }


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