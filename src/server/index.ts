/**
 * BitWarp Networking Server Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1103
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               23.04.2026
 */
/* Import required modules */
import {
  BaseEvent,
  BitWarpOptions,
  BWeaveCompression,
  ClientConnection,
  ClientData,
  ClientDisconnect,
  CommandPacket,
  CryptoProvider,
  CryptoProviderOptions,
  ErrorHandler,
  ErrorType,
  GeneralPacketNames,
  Grants,
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
  PeerData,
  PeerUpdatePacket,
  PERF_CONSTANTS,
  Performance,
  PingPacket,
  PROTOCOL_VERSION,
  QuarkDashProvider,
  Room,
  RoomAction,
  RoomData,
  RoomGrants,
  RoomInfo,
  RoomPacket,
  SHA512,
  TransportCloseCode,
  TransportErrorHandler,
  UUID
} from '../shared';
import { WebSocketServerTransport } from './transport/websocket';
import 'dotenv/config';
import { FlashBuffer } from 'flash-buffer';
import { Router } from './router';

/* Export Libraries */
export * from "./transport/websocket";
export * from "./router";

/**
 * Client permissions
 */
export interface ClientPermissions {
  allowRoomPersistent: boolean;
  allowRoomCreate : boolean;
  allowRoomUpdate : boolean;
  allowRoomDelete : boolean;
  allowRoomList : boolean;
  allowCommands : boolean;
}

/**
 * BitWarp Server Options
 */
export interface BitWarpServerOptions extends BitWarpOptions{
  compression ? : ICompressionProvider | false;
  cryptoProvider ? : CryptoProvider | false;
  cryptoProviderOptions ? : CryptoProviderOptions;
  clientPermissions ? : ClientPermissions;
  defaultRoomGrants ? : RoomGrants;
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

  // Client connections
  public readonly onPreconnect : BaseEvent<ClientConnection> = new BaseEvent<ClientConnection>();
  public readonly onDisconnect : BaseEvent<string> = new BaseEvent<string>();

  // Handshake
  public readonly onHandshakeStarted : BaseEvent<ClientConnection> = new BaseEvent<ClientConnection>();
  public readonly onHandshakeComplete : BaseEvent<ClientConnection> = new BaseEvent<ClientConnection>();

  // Peer and Room Events
  public readonly onPeerCreated : BaseEvent<Peer> = new BaseEvent<Peer>();
  public readonly onPeerUpdated : BaseEvent<Peer> = new BaseEvent<Peer>();
  public readonly onPeerRemoved : BaseEvent<string> = new BaseEvent<string>();

  public readonly onBeforeRoomCreated : BaseEvent<Room> = new BaseEvent<Room>();
  public readonly onRoomCreated : BaseEvent<Room> = new BaseEvent<Room>();
  public readonly onBeforeRoomUpdated : BaseEvent<Room> = new BaseEvent<Room>();
  public readonly onRoomUpdated : BaseEvent<Room> = new BaseEvent<Room>();
  public readonly onBeforeRoomRemoved : BaseEvent<Room> = new BaseEvent<Room>();
  public readonly onRoomRemoved : BaseEvent<string> = new BaseEvent<string>();

  public readonly onPeerJoined : BaseEvent<{ room: Room, peer: Peer}> = new BaseEvent();
  public readonly onPeerLeave : BaseEvent<{ room: Room, peer: Peer}> = new BaseEvent();


  // Server state
  private _isStarted = false;
  private _connectedTime : number = 0;

  // Encryptors
  private _encryptProvider ? : CryptoProvider;

  // Peers List and Rooms list
  private _peers : Map<string, Peer> = new Map<string, Peer>();
  private _rooms : Map<string, Room> = new Map<string, Room>();

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
  public get performance() : Performance { return this._performance; }
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
    self.transport.onClientConnected.addListener(async connection => {
      await self.handleRawConnection(connection);
    });
    self.transport.onClientDisconnected.addListener(async disconnectState => {
      await self.handleRawDisconnect(disconnectState);
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
   * Send error to client
   * @param connection {ClientConnection} Client connection
   * @param error {ErrorHandler} Error
   */
  public async sendError(connection: ClientConnection, error : ErrorHandler) : Promise<void> {
    let self = this;
    try { await self.transport.send(self.preparePacket(error.toBuffer()), connection) }catch{}
    return Promise.reject(error);
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
  private async handleRawConnection(connection : ClientConnection) {
    let self = this;
    await Router.invoke("preconnect", self, connection);
    await self.onPreconnect.invokeAsync(connection);
  }

  /**
   * Handle raw disconnect
   * @param disconnect {ClientDisconnect} Disconnect state from transport
   * @private
   */
  private async handleRawDisconnect(disconnect : ClientDisconnect) {
    let self = this;
    await Router.invoke("disconnect", self, disconnect.connectionId);
    await self.removePeerByConnectionId(disconnect.connectionId);
    await self.onDisconnect.invokeAsync(disconnect.connectionId);
    return Promise.resolve();
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
          await self.processCommandPacket(clientData);
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
          await self.processEventPacket(clientData);
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
          await self.processRawPacket(clientData);
          break;
        }
        case PacketType.ROOM: {
          await self.processRoomPacket(clientData);
          break;
        }
        case PacketType.STREAM_CONTROL: {
          await self.processStreamPacket(clientData);
          break;
        }
        case PacketType.SYNC_ACTION: {
          await self.processSyncActionPacket(clientData);
          break;
        }
        case PacketType.SYNC_OBJECT: {
          await self.processSyncObjectPacket(clientData);
          break;
        }
        case PacketType.PING: {
          await self.processPingPacket(clientData);
          break;
        }
        case PacketType.UPDATE_PEER: {
          await self.processPeerUpdatePacket(clientData);
          break;
        }
        default: {
          let error = new ErrorHandler(`Failed to deserialize packet from client. Unknown packet type`, null, ErrorType.ServerException);
          Logger.error(`Wrong packet type received from connection ${clientData.connection.id}: ${headerData.type}`);
          await Router.invoke("error", self, error);
          self.onError.invoke(error);
          await self.sendError(clientData.connection, error);
        }
      }

      return Promise.resolve();
    }catch (error : any){
      let errorData = new ErrorHandler(`Failed to deserialize packet from client. Unknown packet type`, null, ErrorType.ClientException)
      Logger.error(`Failed to process raw message for ${clientData.connection.id}: ${error?.message ?? "Unknown error"}`);
      await Router.invoke("error", self, errorData);
      self.onError.invoke(errorData);
      await self.sendError(clientData.connection, errorData);
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
        clientKey: new Uint8Array(0),
        isReady: false,
        info: undefined
      };
      self._peers.set(peerId, peerData);
      let peerInstance = self._peers.get(peerId) as Peer;
      await self.onPeerCreated.invokeAsync(peerInstance);
      await Router.invoke("peerCreated", self, peerId, peerInstance);
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
        let peer = self.getPeerByConnectionId(clientData.id);
        if(!peer) return Promise.reject(`Failed to process handshake response. Peer not found.`);
        let serverPublic = (peerData.encryptor) ? await peerData.encryptor.getPublicKey() : new Uint8Array(0);
        let responsePacket = HandshakePacket.encode({
          protocolVersion: PROTOCOL_VERSION,
          step: HandshakeStep.RESPONSE,
          serverPublicKey: serverPublic as Uint8Array,
          peer: peer as Peer
        });

        // Update Peer
        peerData.clientKey = handshakeData.clientPublicKey;
        peerData.handshakeStep = HandshakeStep.RESPONSE;
        await self.updatePeer(peerData.id, peerData);

        // Send handshake
        await self.transport.send(self.preparePacket(responsePacket), clientData);
        await self.onHandshakeStarted.invokeAsync(clientData);
        break;
      }
      case HandshakeStep.RESPONSE: {
        let error = new ErrorHandler(`Failed to process handshake. Response handshake step is readonly.`);
        await self.removePeerByConnectionId(clientData.id);
        await self.transport.send(error.toBuffer(), clientData);
        break;
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

        // Validate peer
        await Router.invoke("validatePeer", self, clientData, handshakeData.peerInfo);

        // Update peer
        peerData.handshakeStep = HandshakeStep.FINISH;
        peerData.handshakeComplete = true;
        peerData.clientKey = new Uint8Array(0); // empty key
        peerData.info = handshakeData.peerInfo;
        await self.updatePeer(peerData.id, peerData);

        // Echo packet
        let responsePacket = HandshakePacket.encode({
          protocolVersion: PROTOCOL_VERSION,
          step: HandshakeStep.FINISH,
          cipherText: handshakeData.cipherText,
          peerInfo: handshakeData.peerInfo
        });

        // All Right
        Logger.info(`Handshake complete for connection: ${clientData.id}`, handshakeData.peerInfo);
        await self.transport.send(self.preparePacket(responsePacket), clientData);
        await self.onHandshakeComplete.invokeAsync(clientData);
        break;
      }
      default: {
        let error = new ErrorHandler(`Unknown handshake step received.`);
        await self.transport.send(error.toBuffer(), clientData);
        return Promise.resolve();
      }
    }

    return Promise.resolve();
  }

  /**
   * Process ping packet
   * @param clientData {ClientData} Connection
   * @private
   */
  private async processPingPacket(clientData : ClientData) : Promise<void> {
    let self = this;
    // Decrypt packet
    let peerData = self.getPeerByConnectionId(clientData.connection.id);
    if(!peerData) throw new Error(`No peer data found for ${clientData.connection.id}.`);
    let encryptor = peerData?.encryptor;
    if(encryptor) PingPacket.setCryptoProvider(encryptor);

    // Update ping for peer
    let pingPacket = PingPacket.decode(clientData.data);
    peerData.ping = Date.now() - pingPacket.payload.timestamp;
    await self.updatePeer(peerData.id, peerData, true);

    // Send ping packet
    let encoded = PingPacket.encode(pingPacket.payload, pingPacket.header.requestId, pingPacket.header.flags);
    await self.transport.send(self.preparePacket(encoded), clientData.connection)
    return Promise.resolve();
  }

  /**
   * Update peer info
   * @param peer
   * @param newData
   */
  public async updatePeerInfo(peer : Peer, newData : any) : Promise<void> {
    let self = this;
    let encryptor = peer?.encryptor;
    if(encryptor) PeerUpdatePacket.setCryptoProvider(encryptor);

    // Update peer info
    peer.info = newData;
    await self.updatePeer(peer.id, peer, true);

    // TODO: Update for all in rooms

    // Send peer data packet
    Logger.info(`Peer info updated for Peer ${peer.id}. New data:`, peer.info);
    let encoded = PeerUpdatePacket.encode({ peerInfo: peer.info });
    await self.transport.send(self.preparePacket(encoded), peer.connection)
    return Promise.resolve();
  }

  /**
   * Process peer info update packet
   * @param clientData {ClientData} Connection
   * @private
   */
  private async processPeerUpdatePacket(clientData : ClientData) : Promise<void> {
    let self = this;
    let peerData = self.getPeerByConnectionId(clientData.connection.id);
    if(!peerData) throw new Error(`No peer data found for ${clientData.connection.id}.`);
    let encryptor = peerData?.encryptor;
    if(encryptor) PeerUpdatePacket.setCryptoProvider(encryptor);

    // Update peer data
    let peerUpdatePacket = PeerUpdatePacket.decode(clientData.data);
    peerData.info = peerUpdatePacket?.payload?.peerInfo ?? undefined;
    await self.updatePeer(peerData.id, peerData, true);

    // Send peer data packet
    Logger.info(`Peer info updated for ${clientData.connection.id}. New data:`, peerData.info);
    let encoded = PeerUpdatePacket.encode({ peerInfo: peerData.info }, peerUpdatePacket.header.requestId, peerUpdatePacket.header.flags);
    await self.transport.send(self.preparePacket(encoded), clientData.connection)
    return Promise.resolve();
  }

  /**
   * Process command packet
   * @param clientData {ClientData} Client data
   * @private
   */
  private async processCommandPacket(clientData : ClientData) : Promise<void> {
    let self = this;
    if(!self.options.clientPermissions?.allowCommands) return Promise.reject(new Error(`Failed to execute command. Commands are disabled by server config.`));

    // Get Peer and Encryptor
    let peerData = self.getPeerByConnectionId(clientData.connection.id);
    if(!peerData) return Promise.reject(new Error(`No peer data found for ${clientData.connection.id}.`));
    let encryptor = peerData?.encryptor;
    if(encryptor) CommandPacket.setCryptoProvider(encryptor);

    // Decode command data
    let command = CommandPacket.decode(clientData.data);
    let commandName = command.payload.commandName;

    // Create response wrapper
    let isResponseCalled : boolean = false;
    let finalResponse : any = undefined;
    function commandResponse(responseData : any){
      if(!isResponseCalled) isResponseCalled = true;
      finalResponse = responseData;
    }

    // Execute command
    Logger.info(`Execute command ${commandName} called by connection ${clientData.connection.id} with data`, command.payload.data);
    await Router.invokeCommand(commandName, self, clientData, command.payload.data, commandResponse);

    // If need to send response
    if(command.payload.isNeedResponse){
      let response = CommandPacket.encode({
        isRequest: false,
        isNeedResponse: command.payload.isNeedResponse,
        commandName: commandName,
        timestamp: Date.now(),
        data: (isResponseCalled) ? finalResponse : null
      }, command.header.requestId, command.header.flags);
      await self.transport.send(self.preparePacket(response), clientData.connection)
    }

    // Resolve
    return Promise.resolve();
  }

  /**
   * Process event packet
   * @param clientData {ClientData} Client data
   * @private
   */
  private async processEventPacket(clientData : ClientData) : Promise<void> {

    return Promise.resolve();
  }

  /**
   * Process raw binary data
   * @param clientData {ClientData} Client data
   * @private
   */
  private async processRawPacket(clientData : ClientData) : Promise<void> {

    return Promise.resolve();
  }

  /**
   * Process room packet
   * @param clientData {ClientData} Client data
   * @private
   */
  private async processRoomPacket(clientData : ClientData) : Promise<void> {
    let self = this;

    // Get Peer and Encryptor
    let peerData = self.getPeerByConnectionId(clientData.connection.id);
    if(!peerData) return Promise.reject(new Error(`No peer data found for ${clientData.connection.id}.`));
    let encryptor = peerData?.encryptor;
    if(encryptor) RoomPacket.setCryptoProvider(encryptor);

    // Unpack room packet
    let roomPacket = RoomPacket.decode(clientData.data);
    switch (roomPacket.payload.action){
      case RoomAction.CREATE: {
        // Check Grants
        if(!self.options.clientPermissions?.allowRoomCreate) return Promise.reject(new Error(`Failed to create room. The server configuration disallow room creations by client.`));

        // Create room
        let roomData = roomPacket.payload.data;
        let room = await self.createRoom(peerData.id, roomData.info, roomData.grants ?? self.options.defaultRoomGrants, roomData.accessKey, roomData.needAccept, roomData.persistent);

        // Create response
        let response = RoomPacket.encode({
          action: RoomAction.CREATE,
          data: room
        });
        await self.transport.send(self.preparePacket(response), clientData.connection)
        return Promise.resolve();
      }
      case RoomAction.UPDATE: {

        return Promise.resolve();
      }
      case RoomAction.DELETE: {

        return Promise.resolve();
      }
      case RoomAction.LIST: {

        return Promise.resolve();
      }
      case RoomAction.JOIN: {

        return Promise.resolve();
      }
      case RoomAction.LEAVE: {

        return Promise.resolve();
      }
      case RoomAction.ACCEPT: {

        return Promise.resolve();
      }
      case RoomAction.UPDATE_PEER: {

        return Promise.resolve();
      }
      default: {
        return Promise.reject(new Error(`Failed to process room packet. Unknown action type received.`))
      }
    }
  }

  /**
   * Process stream packet
   * @param clientData {ClientData} Client data
   * @private
   */
  private async processStreamPacket(clientData : ClientData) : Promise<void> {

    return Promise.resolve();
  }

  /**
   * Process sync action packet
   * @param clientData {ClientData} Client data
   * @private
   */
  private async processSyncActionPacket(clientData : ClientData) : Promise<void> {

    return Promise.resolve();
  }

  /**
   * Process sync object packet
   * @param clientData {ClientData} Client data
   * @private
   */
  private async processSyncObjectPacket(clientData : ClientData) : Promise<void> {

    return Promise.resolve();
  }
  // #endregion

  // #region work with peers
  /**
   * Get ReadOnly Peer
   * @param peerId {string} Read only peer
   * @returns {PeerData} Read-only peer data
   */
  public getReadonlyPeer(peerId : string) : PeerData | undefined {
    let self = this;
    if(!self._peers.has(peerId)) return undefined;
    return self._peers.get(peerId) as PeerData;
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
   * Update peer
   * @param peerId {string} Peer id
   * @param peerData {Peer} Peer data
   * @param notify {boolean} Notify changes?
   * @private
   */
  public async updatePeer(peerId : string, peerData : Peer, notify : boolean = true) : Promise<void> {
    let self = this;
    self._peers.set(peerId, peerData);
    let peer = self._peers.get(peerId) as Peer;

    if(notify){
      await self.onPeerUpdated.invokeAsync(peer);
      await Router.invoke("peerUpdated", self, peerId, peer);
    }

    return Promise.resolve();
  }

  /**
   * Remove peer by ID
   * @param peerId {string} Peer ID
   * @private
   */
  public async removePeer(peerId : string) : Promise<void> {
    let self = this;
    if(!self._peers.has(peerId)) return Promise.resolve();

    // Remove peer
    self._peers.delete(peerId);
    self.removePeerFromAllRooms(peerId);
    await self.onPeerRemoved.invokeAsync(peerId);
    await Router.invoke("peerRemoved", self, peerId);
    return Promise.resolve();
  }

  /**
   * Remove peer by connection ID
   * @param connectionId {string} Connection ID
   * @private
   */
  private async removePeerByConnectionId(connectionId : string) : Promise<void>{
    let self = this;

    // Remove from peers
    let peerId = null;
    self._peers.forEach((peer : Peer) => {
      if(peer.connection.id === connectionId){
        peerId = peer.id;
        return;
      }
    });
    if(peerId) await self.removePeer(peerId);
    return Promise.resolve();
  }
  // #endregion

  // #region Rooms management
  /**
   * Get room by room id
   * @param roomId {string} Room id
   * @returns {Room|undefined} Return room instance or undefined
   */
  public getRoom(roomId : string) : Room | undefined {
    let self = this;
    return self._rooms.get(roomId);
  }

  /**
   * Get readonly room
   * @param roomId {string} Room ID
   * @returns {RoomData} Read only room data
   */
  public getReadonlyRoom(roomId : string) : RoomData | undefined {
    let self = this;
    let room = self.getRoom(roomId);
    if(!room) return undefined;

    // Return room as Read Only
    else return room as RoomData;
  }

  /**
   * Return all rooms
   * @returns {Map<string, Room>} Rooms list
   */
  public get rooms() {
    return this._rooms;
  }

  /**
   * Return all public rooms
   * @returns {Map<string, Room>} Public rooms only
   */
  public get publicRooms() {
    return new Map(
      [...this.rooms.entries()]
        .filter(([roomId, room]) => room.needAccept)
    );
  }

  /**
   * Create new room instance
   * @param ownerId {string} Owner Peer ID. Empty if owner a server
   * @param info {RoomInfo} Room info
   * @param grants {RoomGrants} Room grants or null for default
   * @param accessKey {string} Access key (Password)
   * @param needAccept {boolean} Is need accept to join? If owner is server - ignores
   * @param persistent {boolean} Is persistent room (don't remove when no peers)
   * @returns {Room} Room instance
   */
  public async createRoom(ownerId : string, info : RoomInfo, grants: RoomGrants | null = null, accessKey : string = "", needAccept : boolean = false, persistent : boolean = false) : Promise<Room> {
    let self = this;

    // Check owner id
    if(ownerId.length > 0) {
      let peer = self._peers.get(ownerId);
      if(!peer) return Promise.reject(new Error(`Failed to create room. Owner ID ${ownerId} is not found at server.`));
    }

    // Check room name
    if(!info.name || info.name.length < 1) {
      return Promise.reject(`Failed to create room. Room name is required.`);
    }

    // Check persistent allowed
    if(persistent && !self.options.clientPermissions?.allowRoomPersistent){
      return Promise.reject(new Error(`Failed to create persistent room. This options is disabled by server.`));
    }

    // Define unique room id
    let roomId = "";
    while (roomId.length < 1) {
      let uuid = UUID.v4();
      if(!self.rooms.has(uuid)) roomId = uuid;
    }

    // Create Room object
    let room : Room = {
      id: roomId,
      owner: ownerId,
      info: info,
      accessKey: (accessKey.length > 0) ? SHA512.hash(accessKey, false) as string : "",
      needAccept : (ownerId.length > 0) ? needAccept : false,
      peers: new Set<string>(),
      persistent: persistent,
      grants: (grants) ? {...self.options.defaultRoomGrants as RoomGrants, ...grants as RoomGrants} : self.options.defaultRoomGrants as RoomGrants
    };

    // On before room created
    await self.onBeforeRoomCreated.invokeAsync(room);
    await Router.invoke("roomBeforeCreated", self, room);

    // On room created
    self._rooms.set(roomId, room);
    let roomInstance = self._rooms.get(roomId) as Room;
    Logger.success(`Room created with owner ${ownerId}. Room: `, roomInstance);
    await self.onRoomCreated.invokeAsync(roomInstance);
    await Router.invoke("roomCreated", self, roomInstance);
    return roomInstance;
  }

  /**
   * Update an exists room
   * @param roomId {string} Room ID
   * @param ownerId {string|null} New owner ID
   * @param info {RoomInfo|null} New room info
   * @param grants {RoomGrants|null} New room grants
   * @param accessKey {string} New access key
   * @param needAccept {boolean} Is need accept to join
   * @param persistent {boolean} Is room persistent
   * @returns {Room} Updated room data
   */
  public async updateRoom(roomId : string, ownerId : string | null = null, info : RoomInfo | null = null, grants: RoomGrants | null = null, accessKey : string = "", needAccept : boolean = false, persistent : boolean = false) : Promise<Room> {
    let self = this;

    // Check room id
    if(roomId.length < 1) {
      return Promise.reject(new Error(`Failed to update room. No room id is specified.`));
    }

    // Check owner id
    if(ownerId && ownerId.length > 0) {
      let peer = self._peers.get(ownerId);
      if(!peer) return Promise.reject(new Error(`Failed to create room. Owner ID ${ownerId} is not found at server.`));
    }

    // Check persistent allowed
    if(persistent && !self.options.clientPermissions?.allowRoomPersistent){
      return Promise.reject(new Error(`Failed to set persistent room. This options is disabled by server.`));
    }

    // Find room
    let room = self.getRoom(roomId);
    if(!room) return Promise.reject(new Error(`Failed to update room. Room with ID ${roomId} is not found at server.`));

    // Change room data
    if(ownerId) room.owner = ownerId;
    if(info) room.info = info;
    room.accessKey = (accessKey.length > 0) ? SHA512.hash(accessKey, false) as string : "";
    room.persistent = persistent;
    if(grants) room.grants = {...room.grants, ...grants};
    if(ownerId)
      room.needAccept = (ownerId.length > 0) ? needAccept : false;
    else
      room.needAccept = (room.owner.length > 0) ? needAccept : false;

    // Update room data
    await self.onBeforeRoomUpdated.invokeAsync(room);
    await Router.invoke("roomBeforeUpdated", self, room);
    self._rooms.set(roomId, room);
    let roomInstance = self._rooms.get(roomId) as Room;
    Logger.success(`Room ${roomId} updated with owner ${ownerId}. Room: `, roomInstance);
    await self.onRoomUpdated.invokeAsync(roomInstance);
    await Router.invoke("roomUpdated", self, roomInstance);
    return roomInstance;
  }

  /**
   * Remove room by ID
   * @param roomId {string} room id
   */
  public async removeRoom(roomId : string) : Promise<void> {
    let self = this;
    let room = self.getRoom(roomId);
    if(!room) throw new Error(`Failed to remove room ${roomId}. Room is not found at server.`);
    await self.onBeforeRoomRemoved.invokeAsync(room);
    await Router.invoke("roomBeforeRemoved", self, room);

    // Clean up all peers (fire leave event)
    let peers = self.getRoomPeers(roomId);


    // Remove room
    self._rooms.delete(roomId);
    await self.onRoomRemoved.invokeAsync(roomId);
    await Router.invoke("roomRemoved", self, roomId);
    return Promise.resolve();
  }

  public async leaveRoom(roomId : string, peerId : string) : Promise<void> {
    let self = this;

    // Check room
    let room = self.getRoom(roomId);
    if(!room) throw new Error(`Failed to leave room ${roomId}. Room is not found at server.`);

    // Check peer exists
    let peer = self._peers.get(roomId);
    if(!peer) throw new Error(`Failed to leave room ${roomId}. Peer ${peerId} is not found at server.`);




  }

  public async joinRoom(roomId : string, peerId : string) : Promise<void> {
    let self = this;

    // Check room
    let room = self.getRoom(roomId);
    if(!room) throw new Error(`Failed to join room ${roomId}. Room is not found at server.`);

    // Check peer exists
    let peer = self._peers.get(roomId);
    if(!peer) throw new Error(`Failed to leave room ${roomId}. Peer ${peerId} is not found at server.`);


  }

  /**
   * Get all room peers
   * @param roomId {string} Room ID
   * @param exclude {string[]} Exclude peers from final list
   * @returns {Peer[]} Array of peers
   */
  public getRoomPeers(roomId : string, exclude ? : string[]) : Peer[] {
    let self = this;
    let peers: Peer[] = [];

    // Get room
    let room = self.getRoom(roomId);
    if(!room) return [];

    // Collect peers
    if(!room.peers) return [];
    room.peers.forEach(peerId => {
      let inExclude = exclude && exclude.find(pid => pid === peerId);
      if(self._peers.has(peerId) && !inExclude){
        peers.push(self._peers.get(peerId) as Peer);
      }
    });

    return peers;
  }

  /**
   * Get an array of rooms for peer
   * @param peerId {string} Peer id
   * @returns Room[] Array of rooms
   */
  public getPeerRooms(peerId : string) : Room[] {
    let self = this;
    let rooms : Room[] = [];
    self._rooms.forEach((room : Room) => {
      if(room.peers && room.peers.has(peerId) || room.owner === peerId) rooms.push(room);
    });

    return rooms;
  }

  /**
   * Remove peer from room
   * @param roomId {string} Room ID
   * @param peerId {string} Peer ID
   */
  public removePeerFromRoom(roomId : string, peerId : string) : void {
    let self = this;
    let room = self.getRoom(roomId);
    if(!room) return;

    // Check for owner
    if(room.owner === peerId){
      if(room.persistent) {
        room.owner = "";
      }else{
        // TODO: Destroy room
        return;
      }
    }

    // Remove peer from room
    if(room.peers) room.peers.delete(peerId);
    if(room.peers && room.peers.size < 1 && !room.persistent){
      // TODO: Destroy room
      return;
    }

    // TODO: Notify peer removed
    return;
  }

  /**
   * Remove peer from rooms
   * @param roomIds {string[]} Room IDs
   * @param peerId {string} Peer ID
   */
  public removePeerFromRooms(roomIds : string[], peerId : string) : void {
    let self = this;
    let roomsNum = roomIds.length;
    if(!roomsNum || roomsNum < 1) return;

    for(let i = 0; i < roomsNum; i++) {
      self.removePeerFromRoom(roomIds[i], peerId);
    }
  }

  /**
   * Remove peer from all rooms
   * @param peerId {string} Peer ID
   */
  public removePeerFromAllRooms(peerId : string) : void {
    let self = this;
    self._rooms.forEach((room: Room) => {
      if(room.peers && room.peers.has(peerId) || room.owner === peerId) self.removePeerFromRoom(room.id, peerId);
    });
  }
  // #endregion

  /**
   * Return default options
   * @returns {BitWarpServerOptions} Default options
   */
  public static get defaultOptions() : BitWarpServerOptions {
    return {
      // Basic options
      name : process?.env?.APPLICATION_NAME ?? "BitWarp Server",
      version : process?.env?.APPLICATION_VERSION ?? "1.0.0",
      debug : ParseUtils.bool(process?.env?.DEBUG_MODE ?? "true"),
      analyzePackets : ParseUtils.bool(process?.env?.ANALYZE_PACKETS ?? "false"),
      logLevel : LogLevel.Info | LogLevel.Log | LogLevel.Success | LogLevel.Warning | LogLevel.Error,

      // Compression and encryption
      compression: new BWeaveCompression(),
      cryptoProvider: new QuarkDashProvider(),
      cryptoProviderOptions: {},

      // Client permission
      clientPermissions : {
        allowRoomPersistent: true,
        allowRoomCreate: true,
        allowRoomDelete: true,
        allowRoomUpdate: true,
        allowRoomList: true,
        allowCommands: true
      },

      // Default room grants
      defaultRoomGrants: {
        roomUpdates: Grants.Owner,
        roomRemove: Grants.Owner,
        roomAccept: Grants.Owner
      }
    }
  }
  // #endregion
}