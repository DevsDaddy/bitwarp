/**
 * BitWarp Networking Server Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1078
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               19.04.2026
 */
/* Import required modules */
import {
  BaseEvent,
  BitWarpOptions,
  BWeaveCompression,
  ClientConnection,
  ClientData,
  ClientDisconnect,
  CryptoProvider,
  CryptoProviderOptions,
  ErrorHandler,
  ErrorType,
  GeneralPacketNames,
  HandshakePacket,
  HandshakePacketData,
  HandshakeStep,
  HeaderEncoder,
  ICompressionProvider,
  IServerTransport,
  Logger,
  LogLevel,
  PacketAnalyzer,
  PacketType,
  ParseUtils,
  Peer,
  PERF_CONSTANTS,
  Performance,
  PROTOCOL_VERSION,
  QuarkDashProvider,
  TransportCloseCode,
  TransportErrorHandler,
  UUID,
  PingPacket
} from '../shared';
import { WebSocketServerTransport } from './transport/websocket';
import 'dotenv/config';
import { FlashBuffer } from 'flash-buffer';
import { Router } from './router';

/* Export Libraries */
export * from "./transport/websocket";
export * from "./peer";
export * from "./router";

/**
 * BitWarp Server Options
 */
export interface BitWarpServerOptions extends BitWarpOptions{
  compression ? : ICompressionProvider | false;
  cryptoProvider ? : CryptoProvider | false;
  cryptoProviderOptions ? : CryptoProviderOptions;
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

  // Handshake
  public readonly onHandshakeStarted : BaseEvent<ClientConnection> = new BaseEvent<ClientConnection>();
  public readonly onHandshakeComplete : BaseEvent<ClientConnection> = new BaseEvent<ClientConnection>();

  // Server state
  private _isStarted = false;
  private _connectedTime : number = 0;

  // Encryptors
  private _encryptProvider ? : CryptoProvider;

  // Peers List
  private _peers : Map<string, Peer> = new Map<string, Peer>();

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
    if(!this.options.analyzePackets) PacketAnalyzer.toggle(false);

    // Init compressor
    if(this.options.compression) this._compressor = this.options.compression;

    // Create crypto provider
    if(this.options.cryptoProvider) this._encryptProvider = this.options.cryptoProvider;

    // Create transport is not defined
    this._isDebug = this.options.debug ?? false;
    this._transport = (this.options.transport) ? this.options.transport as IServerTransport : new WebSocketServerTransport();
    this._isStarted = false;
    this._connectedTime = 0;
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
  public get uptime() : number { return (!this._isStarted || this._connectedTime === 0) ? 0 : Date.now() - this._connectedTime; }
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
    self.transport.onClientDataReceived.addListener(async clientData => {
      await self.handleRawMessage(clientData);
    })
    self.transport.onConnected.addListener(() => {
      Logger.success(`BitWarp Server is successfully started`);
      self._connectedTime = Date.now();
      self._isStarted = true;
      self._performance.mark(PERF_CONSTANTS.TRANSPORT_CONNECTED);
      Logger.info(`Transport initialized for: ${self._performance.measure(PERF_CONSTANTS.TRANSPORT_MEASURE, PERF_CONSTANTS.TRANSPORT_CREATED, PERF_CONSTANTS.TRANSPORT_CONNECTED)} ms`)
      self.onInitialized.invoke();
    });
    self.transport.onError.addListener((error) => {
      Logger.error(`BitWarp Server Error: ${error?.message ?? "Unknown error"}`);
      self.onInitializationError.invoke(new ErrorHandler(error.message, error?.stack ?? null, ErrorType.ServerException));
    });
    self.transport.onDisconnected.addListener(async (reason) => {
      if(reason instanceof TransportErrorHandler) {
        Logger.error(`BitWarp Server Stop Error: ${reason?.message ?? "Unknown error"}`);
        await Router.invoke("error", self, reason);
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
    this._connectedTime = 0;
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
    let self = this;
    self.removePeerByConnectionId(disconnect.connectionId);
  }

  /**
   * Handle raw message
   * @param clientData {ClientData} Raw client data
   * @private
   */
  private async handleRawMessage(clientData : ClientData) : Promise<void> {
    let self = this;
    try {
      // Check compression
      let packetTime = performance.now();
      let compressedSize = clientData.data.byteLength;
      if(self.options.compression){
        if(!self._compressor) return Promise.reject(new Error("Failed to decompress message. Compressor is not initialized."));
        clientData.data = self._compressor.decompress(clientData.data);
      }

      // Get message buffer
      const messageBuffer = new FlashBuffer();
      messageBuffer.writeBytes(clientData.data);
      messageBuffer.reset();

      // Read header
      const headerData = HeaderEncoder.read(messageBuffer);

      // Check encryptor exists but skip for handshake and error
      if(self.options.cryptoProvider && headerData.type !== PacketType.HANDSHAKE && headerData.type !== PacketType.ERROR) {
        // Check encryptor
        let encryptor = self.getPeerByConnectionId(clientData.connection.id)?.encryptor;
        if(!encryptor){
          let errorData = new ErrorHandler(`Failed to deserialize packet from client. Encryptor is not initialized. Retry handshake.`, null, ErrorType.HandshakeError)
          Logger.error(`Failed to process raw message for ${clientData.connection.id}: Handshake error for peer.`);
          await Router.invoke("error", self, errorData);
          self.onError.invoke(errorData);
          try { await self.transport.send(self.preparePacket(errorData.toBuffer()), clientData.connection) }catch{}
          return Promise.reject(errorData.toError());
        }
      }

      // Switch by header type
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
          await self.transport.send(self.preparePacket(errorData.toBuffer()), clientData.connection)
          break;
        }
        case PacketType.EVENT: {

          break;
        }
        case PacketType.HANDSHAKE: {
          const handshakeData = HandshakePacket.decode(clientData.data);
          PacketAnalyzer.create(GeneralPacketNames.HANDSHAKE + handshakeData.payload.step, {
            packet: handshakeData,
            rawPacket: clientData.data,
            packetReceived: packetTime,
            packetReady: performance.now(),
            isCompressed: !!self.options.compression,
            isEncrypted: !!self.options.cryptoProvider,
            compressedSize: compressedSize
          }, true);
          PacketAnalyzer.logInfo(GeneralPacketNames.HANDSHAKE + handshakeData.payload.step);
          await self.handleHandshake(clientData.connection, handshakeData);
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
        case PacketType.PING: {
          await self.processPingPacket(clientData, clientData.data);
          break;
        }
        default: {
          let error = new ErrorHandler(`Failed to deserialize packet from client. Unknown packet type`, null, ErrorType.ServerException);
          Logger.error(`Wrong packet type received from connection ${clientData.connection.id}: ${headerData.type}`);
          await Router.invoke("error", self, error);
          self.onError.invoke(error);
          await self.transport.send(self.preparePacket(error.toBuffer()), clientData.connection);
          return;
        }
      }
    }catch (error : any){
      let errorData = new ErrorHandler(`Failed to deserialize packet from client. Unknown packet type`, null, ErrorType.ClientException)
      Logger.error(`Failed to process raw message for ${clientData.connection.id}: ${error?.message ?? "Unknown error"}`);
      await Router.invoke("error", self, errorData);
      self.onError.invoke(errorData);
      try { await self.transport.send(self.preparePacket(errorData.toBuffer()), clientData.connection) }catch{}
      return Promise.reject(error);
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

  /**
   * Handle Handshake
   * @param clientData {ClientConnection} Client connection
   * @param packet {HandshakePacketData} Handshake payload
   * @private
   */
  private async handleHandshake(clientData : ClientConnection, packet : HandshakePacketData) : Promise<void> {
    let self = this;

    // Call router middleware
    await Router.invoke("handshake", self, clientData, packet);

    // Has peer data - recreate
    let handshakeData = packet.payload;
    let peerData : Peer | undefined = self.getPeerByConnectionId(clientData.id);
    if(!peerData){
      let peerId = UUID.v4();
      peerData = {
        connection: clientData,
        id: peerId,
        encryptor: self._encryptProvider?.getNewInstance() ?? undefined,
        handshakeComplete: false,
        handshakeStep : HandshakeStep.INIT,
        clientKey: new Uint8Array(0)
      };
      self._peers.set(peerId, peerData);
    }

    // Check protocol version
    if(handshakeData.protocolVersion !== PROTOCOL_VERSION){
      let error = new ErrorHandler(`Failed to initialize handshake. Protocol version mismatch. Required version: ${PROTOCOL_VERSION}`);
      await self.transport.send(error.toBuffer(), clientData);
      return;
    }

    // Check handshake packet
    switch (handshakeData.step) {
      case HandshakeStep.INIT: {
        // Check encryptor and keys
        if(self.options.cryptoProvider && !peerData.encryptor){
          let error = `Failed to process handshake initialization. Peer ${peerData.id} doesn't have an encryptor instance.`
          Logger.error(error);
          return Promise.reject(new Error(error));
        }
        if(self.options.cryptoProvider && handshakeData.clientPublicKey.length < 1){
          let error = `Failed to process handshake initialization. Received an empty client key.`
          Logger.error(error);
          return Promise.reject(new Error(error));
        }

        // Setup encryptor
        let serverPublic = (peerData.encryptor) ? await peerData.encryptor.getPublicKey() : new Uint8Array(0);
        let responsePacket = HandshakePacket.encode({
          protocolVersion: PROTOCOL_VERSION,
          step: HandshakeStep.RESPONSE,
          serverPublicKey: serverPublic as Uint8Array
        });

        // Update Peer
        peerData.clientKey = handshakeData.clientPublicKey;
        peerData.handshakeStep = HandshakeStep.RESPONSE;
        self._peers.set(peerData.id, peerData);

        // Send handshake
        await self.transport.send(self.preparePacket(responsePacket), clientData);
        await self.onHandshakeStarted.invokeAsync(clientData);
        return Promise.resolve();
      }
      case HandshakeStep.RESPONSE: {
        let error = new ErrorHandler(`Failed to process handshake. Response handshake step is readonly.`);
        self.removePeerByConnectionId(clientData.id);
        await self.transport.send(error.toBuffer(), clientData);
        return Promise.resolve();
      }
      case HandshakeStep.FINISH: {
        // Check encryptor
        if(self.options.cryptoProvider && !peerData.encryptor){
          let error = `Failed to process handshake initialization. Peer ${peerData.id} doesn't have an encryptor instance.`
          Logger.error(error);
          return Promise.reject(new Error(error));
        }

        // Initialize session
        if(self.options.cryptoProvider){
          try{
            await peerData.encryptor?.initializeSession(peerData.clientKey, false);
            await peerData.encryptor?.finalizeSession(handshakeData.cipherText);
          }catch(error : any){
            Logger.error(`Failed to process handshake session. Error: ${error?.message ?? "Unknown error"}`);
            return Promise.reject(error);
          }
        }

        // Update peer
        peerData.handshakeStep = HandshakeStep.FINISH;
        peerData.handshakeComplete = true;
        peerData.clientKey = new Uint8Array(0); // empty key
        self._peers.set(peerData.id, peerData);

        // Echo packet
        let responsePacket = HandshakePacket.encode({
          protocolVersion: PROTOCOL_VERSION,
          step: HandshakeStep.FINISH,
          cipherText: handshakeData.cipherText
        });

        // All Right
        Logger.info(`Handshake complete for connection: ${clientData.id}`)
        await self.transport.send(self.preparePacket(responsePacket), clientData);
        await self.onHandshakeComplete.invokeAsync(clientData);
        return Promise.resolve();
      }
      default: {
        let error = new ErrorHandler(`Unknown handshake step received.`);
        await self.transport.send(error.toBuffer(), clientData);
        return Promise.resolve();
      }
    }
  }

  /**
   * Remove peer by ID
   * @param peerId {string} Peer ID
   * @private
   */
  private removePeer(peerId : string){
    let self = this;
    if(!self._peers.has(peerId)) return;

    // Remove peer
    self._peers.delete(peerId);
    // Notify peer removed
    return;
  }

  /**
   * Remove peer by connection ID
   * @param connectionId {string} Connection ID
   * @private
   */
  private removePeerByConnectionId(connectionId : string){
    let self = this;

    // Remove from peers
    self._peers.forEach((peer : Peer) => {
      if(peer.connection.id === connectionId){
        self.removePeer(peer.id);
        return;
      }
    });
  }

  /**
   * Get peer by connection ID
   * @param connectionId {string} Connection id
   * @private
   */
  private getPeerByConnectionId(connectionId : string) : Peer | undefined{
    let self = this;
    let foundPeer : Peer | undefined = undefined;
    self._peers.forEach((peer : Peer) => {
      if(peer.connection.id === connectionId){
        foundPeer = peer;
        return;
      }
    });

    return foundPeer;
  }

  /**
   * Process ping packet
   * @param clientData {ClientData} Connection
   * @param raw {Uint8Array} Raw packet
   * @private
   */
  private async processPingPacket(clientData : ClientData, raw : Uint8Array) : Promise<void> {
    let self = this;
    let encryptor = self.getPeerByConnectionId(clientData.connection.id)?.encryptor;
    if(encryptor) PingPacket.setCryptoProvider(encryptor);
    let pingPacket = PingPacket.decode(raw);
    let encoded = PingPacket.encode(pingPacket.payload, pingPacket.header.requestId, pingPacket.header.flags);
    await self.transport.send(self.preparePacket(encoded), clientData.connection)
    return Promise.resolve();
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
      analyzePackets : ParseUtils.bool(process?.env?.ANALYZE_PACKETS ?? "false"),
      logLevel : LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error,
      compression: new BWeaveCompression(),
      cryptoProvider: new QuarkDashProvider(),
      cryptoProviderOptions: {}
    }
  }
  // #endregion
}