/**
 * BitWarp Networking Client Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1094
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               20.04.2026
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
  HandshakeStep,
  HeaderEncoder,
  IClientTransport,
  ICompressionProvider,
  Logger,
  LogLevel, PacketAnalyzer,
  PacketType,
  PERF_CONSTANTS,
  Performance,
  PROTOCOL_VERSION,
  TransportCloseCode,
  TransportErrorHandler,
  UUID,
  QuarkDashProvider, PING_DELAY,
  PingPacket
} from '../shared';
import { WebSocketClientTransport } from './transport/websocket';
import { FlashBuffer } from 'flash-buffer';

/* Export Libraries */
export * from "./transport/websocket";

/**
 * BitWarp Client Options
 */
export interface BitWarpClientOptions extends BitWarpOptions {
  compression ? : ICompressionProvider | false;
  cryptoProvider ? : CryptoProvider | false;
  cryptoProviderOptions ? : CryptoProviderOptions;
  query ? : any;
  peerInfo ? : any;
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
  public readonly onPingChanged : BaseEvent<number> = new BaseEvent<number>();
  public readonly onReconnecting : BaseEvent<boolean> = new BaseEvent<boolean>();

  // Handshake events
  public readonly onHandshakeStarted : BaseEvent = new BaseEvent();
  public readonly onHandshakeComplete : BaseEvent = new BaseEvent();

  // Client state
  private _isConnected = false;
  private _connectedTime : number = 0;
  private _isHandshakeComplete  = false;
  private _handshakeStep : HandshakeStep = HandshakeStep.INIT;

  // Encryptors
  private _encryptProvider ? : CryptoProvider;
  private _publicKey ? : Uint8Array;
  private _ping ? : number;
  private _pintTimer ? : any;

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
    if(!this.options.analyzePackets) PacketAnalyzer.toggle(false);

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
    this._connectedTime = 0;
    this._ping = undefined;
    clearInterval(this._pintTimer);
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
  public get uptime() : number { return (!this._isConnected || this._connectedTime === 0) ? 0 : Date.now() - this._connectedTime; }
  public get ping() : number | undefined { return this._ping; }
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
      self._connectedTime = Date.now();
      self._isConnected = true;
      self._ping = undefined;
      clearInterval(self._pintTimer);

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
    self.transport.onReconnecting.addListener((isReconnecting)=> {
      self.onReconnecting.invoke(isReconnecting);
    });
    await self._transport.connect(self.options?.query ?? {});
  }

  /**
   * Disconnect from server
   */
  public async disconnect(): Promise<void> {
    await this.transport.disconnect(TransportCloseCode.ClosedByClient);
    await this.transport.dispose();
    this._isConnected = false;
    this._connectedTime = 0;
  }

  /**
   * Internal Dispose
   * @private
   */
  private dispose() {
    let self = this;
    self._isConnected = false;
    self._ping = undefined;
    clearInterval(self._pintTimer);
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
          if(!self._compressor) return Promise.reject(new Error("Failed to decompress message. Compressor is not initialized."));
          message = self._compressor.decompress(message);
        }catch(error : any){
          Logger.error(`Failed to decompress message. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, ErrorType.ClientException);
        }
      }

      // Get message buffer
      const messageBuffer = new FlashBuffer();
      messageBuffer.writeBytes(message);
      messageBuffer.reset();

      // Read header
      const headerData = HeaderEncoder.read(messageBuffer);

      // Check encryptor exists but skip for handshake and error
      if(self.options.cryptoProvider && headerData.type !== PacketType.HANDSHAKE && headerData.type !== PacketType.ERROR) {
        // Check encryptor
        let encryptor = self._encryptProvider;
        if(!encryptor){
          let errorData = new ErrorHandler(`Failed to deserialize packet from server. Encryptor is not initialized.`, null, ErrorType.HandshakeError)
          Logger.error(`Failed to process raw message from server: Handshake error for peer.`);
          self.onError.invoke(errorData);
          return Promise.reject(errorData.toError());
        }
      }

      // Switch by type
      switch (headerData.type){
        case PacketType.COMMAND_RESPONSE: {
          await self.processCommandResponsePacket(message);
          break;
        }
        case PacketType.ERROR: {
          const errorData = ErrorHandler.fromBuffer(message);
          Logger.error(`Error received from server. Error: ${errorData?.message ?? "Unknown error"}`);
          self.onError.invoke(errorData);
          break;
        }
        case PacketType.EVENT: {
          await self.processEventPacket(message);
          break;
        }
        case PacketType.HANDSHAKE: {
          const handshakeData = HandshakePacket.decode(message);
          await self.processHandshake(handshakeData);
          break;
        }
        case PacketType.RAW_BINARY: {
          await self.processRawPacket(message);
          break;
        }
        case PacketType.ROOM: {
          await self.processRoomPacket(message);
          break;
        }
        case PacketType.STREAM_CONTROL: {
          await self.processStreamPacket(message);
          break;
        }
        case PacketType.SYNC_ACTION: {
          await self.processSyncActionPacket(message);
          break;
        }
        case PacketType.SYNC_OBJECT: {
          await self.processSyncObjectPacket(message);
          break;
        }
        case PacketType.PING: {
          await self.processPingPacket(message);
          break;
        }
        case PacketType.UPDATE_PEER: {
          await self.processPeerUpdatePacket(message);
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
    }else if(data.buffer instanceof SharedArrayBuffer) data = new Uint8Array(data);
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
          protocolVersion: PROTOCOL_VERSION,
          peerInfo: self.options.peerInfo
        });

        // Send packet
        await self.transport.send({ packetId: UUID.v4(), data: self.preparePacket(handshakePacket) });
        break;
      }
      case HandshakeStep.FINISH : {
        await self.endHandshake();
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
    let self = this;
    self._handshakeStep = HandshakeStep.FINISH;
    self._isHandshakeComplete = true;
    await self.onHandshakeComplete.invokeAsync();

    self._performance.mark(PERF_CONSTANTS.HANDSHAKE_COMPLETE);
    Logger.success(`Handshake completed in ${self._performance.measure(PERF_CONSTANTS.HANDSHAKE_MEASURE, PERF_CONSTANTS.HANDSHAKE_STARTED, PERF_CONSTANTS.HANDSHAKE_COMPLETE)} ms. Ready for messaging with server.`);

    // Run ping
    await self.sendPingPacket();
    self._pintTimer = setInterval(async ()=> {
      await self.sendPingPacket();
    }, PING_DELAY);
  }
  // #endregion

  // #region Work with packets
  /**
   * Send ping packet
   * @private
   */
  private async sendPingPacket(){
    // Create ping packet
    let self = this;
    if(self._encryptProvider) PingPacket.setCryptoProvider(self._encryptProvider);
    let pingPacket = PingPacket.encode({
      timestamp: Date.now()
    });
    await self.transport.send({ packetId: UUID.v4(), data: self.preparePacket(pingPacket) });
    return Promise.resolve();
  }

  /**
   * Process ping packet
   * @param message {Uint8Array} Raw message
   * @private
   */
  private async processPingPacket(message : Uint8Array) : Promise<void>{
    let self = this;
    if(self._encryptProvider) PingPacket.setCryptoProvider(self._encryptProvider);
    let pingData = PingPacket.decode(message);
    let ping = Date.now() - pingData.payload.timestamp;
    self._ping = ping;
    self.onPingChanged.invoke(ping);
    Logger.info(`Connection ping: ${ping}ms`);
  }

  /**
   * Process peer info update
   * @param message {Uint8Array} Raw message
   * @private
   */
  private async processPeerUpdatePacket(message : Uint8Array) : Promise<void>{

  }

  /**
   * Process command response packet
   * @param message {Uint8Array} Raw packet
   * @private
   */
  private async processCommandResponsePacket(message : Uint8Array) : Promise<void> {

  }

  /**
   * Process event packet
   * @param message {Uint8Array} Raw packet
   * @private
   */
  private async processEventPacket(message : Uint8Array) : Promise<void> {

  }

  /**
   * Process raw binary packet
   * @param message {Uint8Array} Raw packet
   * @private
   */
  private async processRawPacket(message : Uint8Array) : Promise<void> {

  }


  public async createRoom() : Promise<void> {

  }

  /**
   * Process room packet
   * @param message {Uint8Array} Raw packet
   * @private
   */
  private async processRoomPacket(message : Uint8Array) : Promise<void> {

  }

  /**
   * Process stream packet
   * @param message {Uint8Array} Raw packet
   * @private
   */
  private async processStreamPacket(message : Uint8Array) : Promise<void> {

  }

  /**
   * Process sync action packet
   * @param message {Uint8Array} Raw packet
   * @private
   */
  private async processSyncActionPacket(message : Uint8Array) : Promise<void> {

  }

  /**
   * Process sync object packet
   * @param message {Uint8Array} Raw packet
   * @private
   */
  private async processSyncObjectPacket(message : Uint8Array) : Promise<void> {

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
      analyzePackets: false,
      logLevel: LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error,
      compression: new BWeaveCompression(),
      cryptoProvider: new QuarkDashProvider(),
      cryptoProviderOptions: {},
      query: {},
      peerInfo: undefined
    }
  }
  // #endregion

}