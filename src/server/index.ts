/**
 * BitWarp Networking Server Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1038
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               17.04.2026
 */
/* Import required modules */
import {
  BaseEvent,
  BitWarpOptions,
  ErrorHandler,
  ErrorType, ICompressionProvider, IServerTransport,
  Logger,
  LogLevel,
  ParseUtils,
  TransportCloseCode,
  TransportErrorHandler,
  Performance, PERF_CONSTANTS, ClientData, ClientConnection, ClientDisconnect, HeaderEncoder, PacketType,
  BWeaveCompression
} from '../shared';
import { WebSocketServerTransport } from './transport/websocket';
import 'dotenv/config';
import { FlashBuffer } from 'flash-buffer';

/* Export Libraries */
export * from "./transport/websocket";
export * from "./peer";
export * from "./router";

/**
 * BitWarp Server Options
 */
export interface BitWarpServerOptions extends BitWarpOptions{
  compression ? : ICompressionProvider | false;
}

/**
 * Client Error
 */
export interface ClientError {
  connection : ClientConnection;
  error : ErrorHandler;
}

/**
 * BitWarp Server Implementation
 */
export class BitWarpServer {
  // Server events
  public onClientError : BaseEvent<ClientError> = new BaseEvent<ClientError>();

  // Server setup
  private readonly _isDebug : boolean;
  private readonly _options: BitWarpServerOptions;
  private readonly _transport : IServerTransport;
  private readonly _performance: Performance = new Performance();
  private readonly _compressor ? : ICompressionProvider;

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

    // Init compressor
    if(this.options.compression) this._compressor = this.options.compression;

    // Create transport is not defined
    this._isDebug = this.options.debug ?? false;
    this._transport = (this.options.transport) ? this.options.transport as IServerTransport : new WebSocketServerTransport();
    this._isStarted = false;
  }

  // #region Server Fields
  /**
   * Get current client options
   * @returns {BitWarpClientOptions} Current options
   */
  public get options() : BitWarpServerOptions { return this._options; }
  public get transport (): IServerTransport { return this._transport };
  public get isStarted (): boolean { return this._isStarted; }
  public get isDebug (): boolean { return this._isDebug; }
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

    // Add mark for transport initialized
    self._performance.mark(PERF_CONSTANTS.TRANSPORT_CREATED);

    // Start transport
    self._isStarted = false;
    self.unsubscribeAllTransport();
    self.transport.onClientConnected.addListener(connection => {
      self.handleRawConnection(connection);
    });
    self.transport.onClientDisconnected.addListener(disconnectState => {
      self.handleRawDisconnect(disconnectState);
    });
    self.transport.onClientDataReceived.addListener(clientData => {
      self.handleRawMessage(clientData);
    })
    self.transport.onConnected.addListener(() => {
      Logger.success(`BitWarp Server is successfully started`);
      self._performance.mark(PERF_CONSTANTS.TRANSPORT_CONNECTED);
      Logger.info(`Transport initialized for: ${self._performance.measure(PERF_CONSTANTS.TRANSPORT_MEASURE, PERF_CONSTANTS.TRANSPORT_CREATED, PERF_CONSTANTS.TRANSPORT_CONNECTED)} ms`)
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
    self.transport.onDisconnected.removeAllListeners();
    self.transport.onClientDisconnected.removeAllListeners();
    self.transport.onClientDataReceived.removeAllListeners();
  }
  // #endregion

  // #region Work with packets

  /**
   * Handle raw connection
   * @param connection {ClientConnection} Connection from transport
   * @private
   */
  private handleRawConnection(connection : ClientConnection) {
    // TODO: Handshake
  }

  /**
   * Handle raw disconnect
   * @param disconnect {ClientDisconnect} Disconnect state from transport
   * @private
   */
  private handleRawDisconnect(disconnect : ClientDisconnect) {

  }

  /**
   * Handle raw message
   * @param clientData {ClientData} Raw client data
   * @private
   */
  private handleRawMessage(clientData : ClientData) : void {
    let self = this;

    // Check compression
    if(self.options.compression){
      if(!self._compressor) throw new Error("Failed to decompress message. Compressor is not initialized.");
      clientData.data = self._compressor.decompress(clientData.data);
    }

    // Get message buffer
    const messageBuffer = new FlashBuffer();
    messageBuffer.writeBytes(clientData.data);
    messageBuffer.reset();

    // Read header and payload
    const headerData = HeaderEncoder.read(messageBuffer);
    switch (headerData.type){
      case PacketType.COMMAND : {
        break;
      }
      case PacketType.COMMAND_RESPONSE: {
        break;
      }
      case PacketType.ERROR: {
        const errorData = ErrorHandler.fromBuffer(clientData.data);
        Logger.error(`Received an error from connection: ${clientData.connection.id}. Error: ${errorData?.message ?? "Unknown error"}`);
        self.onClientError.invoke({ connection: clientData.connection, error: errorData });
        break;
      }
      case PacketType.EVENT: {

        break;
      }
      case PacketType.HANDSHAKE: {
        break;
      }
      case PacketType.RAW_BINARY: {
        break;
      }
      case PacketType.ROOM: {
        break;
      }
      case PacketType.STREAM_CONTROL: {
        break;
      }
      case PacketType.SYNC_ACTION: {
        break;
      }
      case PacketType.SYNC_OBJECT: {
        break;
      }
      default: {
        Logger.error(`Wrong packet type received from connection ${clientData.connection.id}: ${headerData.type}`);
        self.onError.invoke(new ErrorHandler(`Failed to deserialize packet from client. Unknown packet type`, null, ErrorType.ServerException));
        return;
      }
    }
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
      logLevel : LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error,
      compression: new BWeaveCompression()
    }
  }
  // #endregion
}