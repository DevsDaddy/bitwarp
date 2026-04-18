/**
 * BitWarp Networking Client Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1057
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               18.04.2026
 */
/* Import required modules */
import {
  BaseEvent,
  BitWarpOptions,
  BWeaveCompression,
  CryptoProvider,
  CryptoProviderOptions,
  ErrorHandler,
  ErrorType,
  HandshakeInit,
  HandshakePacket, HandshakePacketData,
  HandshakePayload,
  HandshakeStep,
  HeaderEncoder,
  IClientTransport,
  ICompressionProvider,
  Logger,
  LogLevel,
  PacketType,
  PERF_CONSTANTS,
  Performance,
  PROTOCOL_VERSION,
  TransportCloseCode,
  TransportErrorHandler,
  UUID
} from '../shared';
import { WebSocketClientTransport } from './transport/websocket';
import { FlashBuffer } from 'flash-buffer';
import { QuarkDashProvider } from '../shared/crypto/providers/quarkdash';

/* Export Libraries */
export * from "./transport/websocket";

/**
 * BitWarp Client Options
 */
export interface BitWarpClientOptions extends BitWarpOptions {
  compression ? : ICompressionProvider | false;
  cryptoProvider ? : CryptoProvider | false;
  cryptoProviderOptions ? : CryptoProviderOptions;
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

  // Handshake events
  public readonly onHandshakeStarted : BaseEvent = new BaseEvent();
  public readonly onHandshakeComplete : BaseEvent = new BaseEvent();

  // Client state
  private _isConnected = false;
  private _isHandshakeComplete  = false;
  private _handshakeStep : HandshakeStep = HandshakeStep.INIT;

  // Encryptors
  private _encryptProvider ? : CryptoProvider;
  private _publicKey ? : Uint8Array;

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

    // Create crypto provider
    if(this.options.cryptoProvider) this._encryptProvider = this.options.cryptoProvider;

    // Create transport is not defined
    this._isDebug = this.options.debug ?? false;
    this._transport = (this.options.transport) ? this.options.transport as IClientTransport : new WebSocketClientTransport();
    this._isConnected = false;
    this._isHandshakeComplete = false;
    this._handshakeStep = HandshakeStep.INIT;
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
  public get isHandshakeComplete (): boolean { return this._isHandshakeComplete; };
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
    self.transport.onConnected.addListener(async () => {
      Logger.success(`BitWarp Client is successfully started`);
      self._performance.mark(PERF_CONSTANTS.TRANSPORT_CONNECTED);
      Logger.info(`Transport initialized for: ${self._performance.measure(PERF_CONSTANTS.TRANSPORT_MEASURE, PERF_CONSTANTS.TRANSPORT_CREATED, PERF_CONSTANTS.TRANSPORT_CONNECTED)} ms`)
      self.onInitialized.invoke();

      // Handshake
      await self.startHandshake();
    });
    self.transport.onDataReceived.addListener(async (data) => {
      await self.handleRawMessage(data);
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
  private async handleRawMessage(message : Uint8Array) : Promise<void> {
    let self = this;

    try {
      // Check compression
      if(self.options.compression){
        try{
          if(!self._compressor) throw new Error("Failed to decompress message. Compressor is not initialized.");
          message = self._compressor.decompress(message);
        }catch(error : any){
          Logger.error(`Failed to decompress message. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, ErrorType.ClientException);
        }
      }

      // Get message buffer
      const messageBuffer = new FlashBuffer();
      messageBuffer.writeBytes(message);
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
          const errorData = ErrorHandler.fromBuffer(message);
          Logger.error(`Error received from server. Error: ${errorData?.message ?? "Unknown error"}`);
          self.onError.invoke(errorData);
          break;
        }
        case PacketType.EVENT: {

          break;
        }
        case PacketType.HANDSHAKE: {
          const handshakeData = HandshakePacket.decode(message);
          await self.processHandshake(handshakeData);
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
          Logger.error(`Wrong packet type received: ${headerData.type}`);
          self.onError.invoke(new ErrorHandler(`Failed to deserialize packet from server. Unknown packet type`, null, ErrorType.ServerException));
          return;
        }
      }
    }catch (error : any) {
      const errorData = ErrorHandler.fromError(error);
      Logger.error(`Failed to process raw message. Error: ${error?.message ?? "Unknown error"}`, error);
      self.onError.invoke(errorData);
    }
  }

  /**
   * Prepare packet for transport send
   * @param data {Uint8Array} Raw packet buffer
   * @returns {Uint8Array} Prepared for transport raw packet
   * @private
   */
  private preparePacket(data : Uint8Array) : Uint8Array {
    let self = this;
    if(self.options.compression){
      data = self.options.compression.compress(data);
    }

    return data;
  }
  // #endregion

  // #region Handshake
  /**
   * Start handshake
   * @private
   */
  private async startHandshake(){
    let self = this;
    self._performance.mark(PERF_CONSTANTS.HANDSHAKE_STARTED);
    Logger.info(`Handshake started. Encryption: ${(self.options.cryptoProvider) ? "Enabled" : "Disabled"}`);
    self._isHandshakeComplete = false;
    self._handshakeStep = HandshakeStep.INIT;

    // Create key and ciphertext
    if(self.options.cryptoProvider) {
      self._encryptProvider?.dispose();
      self._publicKey = await self._encryptProvider?.getPublicKey();
    }else{
      self._encryptProvider = undefined;
      self._publicKey = undefined;
    }

    // Create handshake packet
    let handshakePacket = HandshakePacket.encode({
      step: HandshakeStep.INIT,
      clientPublicKey: self._publicKey ?? new Uint8Array(0)
    } as HandshakeInit);

    Logger.info("Sending handshake packet...");
    await self.transport.send({ packetId: UUID.v4(), data: self.preparePacket(handshakePacket) });
    await self.onHandshakeStarted.invokeAsync();
    return Promise.resolve();
  }

  /**
   * Process handshake
   * @param packet {HandshakePacketData} Handshake packet data
   * @private
   */
  private async processHandshake(packet : HandshakePacketData){
    let self = this;
    let data = packet.payload;

    // Check protocol version
    if(data.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error(`${data.protocolVersion} is not supported`);
    }

    // Handshake steps
    switch (data.step) {
      case HandshakeStep.INIT : {
        self.onError.invoke(new ErrorHandler(`Failed to process handshake. Unknown handshake step received from server.`));
        return Promise.resolve();
      }
      case HandshakeStep.RESPONSE : {
        // Prepare ciphertext
        let ciphertext : Uint8Array | null = new Uint8Array(0);
        if(self.options.cryptoProvider){
          if(!self._encryptProvider) throw new Error("Failed to process handshake packet from server. Encryption provider is not defined");
          ciphertext = await self._encryptProvider.initializeSession(data.serverPublicKey, true);
          if(!ciphertext) throw new Error("Failed to process handshake packet from server. Generated ciphertext is null");
        }

        // Create Packet
        self._handshakeStep = HandshakeStep.RESPONSE;
        let handshakePacket = HandshakePacket.encode({
          step: HandshakeStep.FINISH,
          cipherText: ciphertext,
          protocolVersion: PROTOCOL_VERSION
        });

        // Send packet
        await self.transport.send({ packetId: UUID.v4(), data: self.preparePacket(handshakePacket) });
        break;
      }
      case HandshakeStep.FINISH : {
        self._handshakeStep = HandshakeStep.FINISH;
        self._isHandshakeComplete = true;
        await self.onHandshakeComplete.invokeAsync();

        self._performance.mark(PERF_CONSTANTS.HANDSHAKE_COMPLETE);
        Logger.success(`Handshake completed in ${self._performance.measure(PERF_CONSTANTS.HANDSHAKE_MEASURE, PERF_CONSTANTS.HANDSHAKE_STARTED, PERF_CONSTANTS.HANDSHAKE_COMPLETE)} ms. Ready for messaging with server.`);
        break;
      }
      default: {
        self.onError.invoke(new ErrorHandler(`Failed to process handshake. Unknown handshake step received from server.`));
        return Promise.resolve();
      }
    }
  }

  /**
   * Finalize handshake
   * @private
   */
  private async endHandshake(){

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
      logLevel: LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error,
      compression: new BWeaveCompression(),
      cryptoProvider: new QuarkDashProvider(),
      cryptoProviderOptions: {}
    }
  }
  // #endregion

}