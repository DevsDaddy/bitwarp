/**
 * BitWarp Networking Websocket Server Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1012
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               15.04.2026
 */
/* Import required modules */
import {
  BaseEvent,
  BinaryConverter,
  ClientConnection,
  ClientData,
  ClientDisconnect,
  ClientDisconnectCode, FastQueue,
  IServerTransport,
  ITransport,
  ITransportOptions,
  Logger,
  ParseUtils,
  Transport,
  TransportCloseCode,
  TransportError,
  TransportErrorHandler,
  UUID
} from '../../shared';
import { Router } from "../router";
import { WebSocket, WebSocketServer } from 'ws';
import 'dotenv/config';

/**
 * WebSocket based server transport options
 */
export interface WebSocketServerTransportOptions extends ITransportOptions {
  // WebSocket Server Options
  allowSynchronousEvents : boolean;
  autoPong : boolean;
  backlog ? : number;
  clientTracking ? : boolean;
  maxPayload : number;
  noServer : boolean;
  skipUTF8Validation : boolean;

  // Heartbeat options
  heartbeat : boolean;
  heartbeatTimer : number;
  heartbeatTimeout : number;

  // Resend options
  resend : boolean;
  resendTimer : number;
  resendPerIteration : number;

  // Rate Limit
  rateLimit : {
    enabled : boolean;
    maxConnections : number;
  }
}

/**
 * WebSocket based server transport
 */
export class WebSocketServerTransport extends Transport implements ITransport, IServerTransport {
  // Connections Management
  private _connections : Map<string, ClientConnection> = new Map();
  private _resendQueue : FastQueue<ClientData> = new FastQueue<ClientData>();
  private _heartbeatTimer ? : NodeJS.Timeout;
  private _resendTimer ? : NodeJS.Timeout;

  // Server transport events
  public onBeforeClientConnected : BaseEvent<ClientConnection> = new BaseEvent();
  public onClientConnected : BaseEvent<ClientConnection> = new BaseEvent<ClientConnection>();
  public onClientDisconnected : BaseEvent<ClientDisconnect> = new BaseEvent<ClientDisconnect>();
  public onBeforeClientDataSent : BaseEvent<ClientData> = new BaseEvent<ClientData>();
  public onClientDataReceived : BaseEvent<ClientData> = new BaseEvent<ClientData>();
  public onClientDataSend : BaseEvent<ClientData> = new BaseEvent<ClientData>();

  /**
   * Create WebSocket based server transport
   * @param options {WebSocketServerTransportOptions} Options
   */
  constructor(options ? : WebSocketServerTransportOptions) {
    // Options merge
    let currentOptions : WebSocketServerTransportOptions = (options) ? {...WebSocketServerTransport.defaultOptions, ...options} : WebSocketServerTransport.defaultOptions;
    super(currentOptions);
  }

  // Override transport getters
  public override get options(): WebSocketServerTransportOptions { return super.options as WebSocketServerTransportOptions; }
  public override get connector () : WebSocketServer { return super.connector as WebSocketServer; }

  /**
   * Connect
   * @returns {Promise<any|TransportErrorHandler>} Returns connector instance or Transport Error Handler
   */
  public override async connect(): Promise<any | TransportErrorHandler> {
    let self = this;
    return new Promise(async (resolve) => {
      try {
        Logger.info(`WebSocket Transport Connection...`);

        // Check connector exists
        if(self.isConnected || self.connector) await self.dispose();

        // Create connector
        self.stopHeartbeat();
        self.stopResendQueue();
        self._resendQueue.clear();
        self._connections.clear();
        await Router.invoke("transportBeforeConnect");
        self.onBeforeConnected.invoke();
        let currentOptions = self.options;
        let hostUrl = `${currentOptions.protocol}${currentOptions.host}`;
        let connector = new WebSocketServer({
          host: hostUrl,
          port: currentOptions.port,
          path: currentOptions.path,
          allowSynchronousEvents: currentOptions.allowSynchronousEvents,
          autoPong: currentOptions.autoPong,
          maxPayload: currentOptions.maxPayload,
          skipUTF8Validation: currentOptions.skipUTF8Validation,
          noServer: currentOptions.noServer,
          ...(currentOptions?.backlog && { backlog: currentOptions.backlog }),
          ...(currentOptions?.clientTracking && { clientTracking: currentOptions.clientTracking }),
          perMessageDeflate: false
        });

        // Subscribe to connector events
        connector.addListener("connection", (client : WebSocket) => {
          if(self.options.rateLimit.enabled && self.options.rateLimit.maxConnections > 0){
            if(self._connections.size > self.options.rateLimit.maxConnections){
              client.close(1013, "Server overload")
              return;
            }
          }

          self.handleConnection(client);
        });
        connector.addListener("close", () => {
          self.stopHeartbeat();
          self.stopResendQueue();
          self._resendQueue.clear();
          self._connections.clear();
          self.dispose().then(()=>{
            self.onDisconnected.invoke(TransportCloseCode.ClosedByServer);
          })
        });
        connector.addListener("error", async (error) => {
          let err = new TransportErrorHandler(`WebSocket Server transport error. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed);
          self.isConnected = false;

          // Trying to reconnect
          if(self.options.reconnect?.autoReconnect && !self.reconnection.isReconnecting){
            let reconnect = await self.reconnect();
            if(reconnect instanceof TransportErrorHandler) err = reconnect;
            else{
              resolve(reconnect);
              return;
            }
          }

          // Dispose before error
          self.dispose().then(async ()=>{
            await Router.invoke("transportError", err);
            self.onError.invoke(err);
            resolve(err);
          });
        });
        connector.addListener("listening", async () => {
          Logger.success(`WebSocket Transport server is started at: ${self.options.host}:${self.options.port}`);
          self.isConnected = true;
          await Router.invoke("transportConnected", self);
          self.onConnected.invoke(connector);
          self.startHeartbeat();
          self.startResendQueue();
          resolve(connector);
        });
        connector.addListener("wsClientError", async (error) => {
          let err = new TransportErrorHandler(`WebSocket Server transport error. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ClientException);
          await Router.invoke("transportError", err);
          self.onError.invoke(err);
          resolve(err);
        });

        // Update connector
        self.updateConnector(connector);
      }catch(error : any) {
        resolve(new TransportErrorHandler(`Failed to connect WebSocket Server transport. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
      }
    })
  }

  /**
   * Disconnect
   * @param closeCode {TransportCloseCode} Close reason
   * @returns {Promise<TransportCloseCode|TransportErrorHandler>} Returns real close code or Transport Error Handler
   */
  public override async disconnect(closeCode : TransportCloseCode): Promise<TransportCloseCode | TransportErrorHandler> {
    let self = this;
    return new Promise((resolve)=> {
      try {
        // Check connection
        let connection = self.connector as WebSocketServer ?? null;
        if(!connection) {
          resolve(closeCode);
          return;
        }

        // Close socket connection
        connection.close();
        setTimeout(()=>{
          resolve(closeCode);
        }, 2000);
      }catch(error : any) {
        resolve(new TransportErrorHandler(`Failed to disconnect WebSocket Server transport with code: ${closeCode}. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
      }
    });
  }

  /**
   * Reconnect
   * @returns {Promise<any|TransportErrorHandler>} Returns connector instance or Transport Error Handler
   */
  public override async reconnect(): Promise<any | TransportErrorHandler> {
    let self = this;
    return new Promise((resolve)=> {
      try {
        // Check connection state
        if(self.isConnected) self.isConnected = false;

        // Trying to reconnect
        if(!self.reconnection.isReconnecting) self.reconnection.isReconnecting = true;
        if(!self.reconnection.currentAttempt) self.reconnection.currentAttempt = 0;
        self.onReconnecting.invoke(true);

        // Attempts exhausted
        if(self.options.reconnect?.maxAttempts && self.options.reconnect?.maxAttempts > 0){
          if(self.reconnection.currentAttempt >= self.options.reconnect?.maxAttempts){
            self.reconnection = { isReconnecting : false, reconnectionTimer: null, currentAttempt: 0 };
            self.onReconnecting.invoke(false);
            let err = `Failed to reconnect. The maximum number of attempts has been exhausted`;
            Logger.error(err);
            resolve(new TransportErrorHandler(err, null, TransportError.ConnectionFailed))
            return;
          }
        }

        // Try to reconnect
        let reconnectDelay = self.options.reconnect?.delay ?? 5000;
        self.reconnection.currentAttempt += 1;
        Logger.info(`Trying to restart WebSocket Transport. Attempt ${self.reconnection.currentAttempt}`);
        self.reconnection.reconnectionTimer = setTimeout(async ()=> {
          let connection = await self.connect();
          if(connection instanceof TransportErrorHandler) {
            return await self.reconnect();
          }

          // All right, reconnected
          self.reconnection.reconnectionTimer = null;
          self.reconnection.currentAttempt = 0;
          self.reconnection.isReconnecting = false;
          self.onReconnecting.invoke(false);
          resolve(connection);
        }, reconnectDelay);
      }catch(error : any) {
        resolve(new TransportErrorHandler(`Failed to reconnect WebSocket Server transport. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
      }
    });
  }

  /**
   * Dispose transport connection and clean all
   */
  public override async dispose(): Promise<void> {
    let self = this;
    return new Promise((resolve, reject)=> {
      try {
        if(self.isConnected) self.isConnected = false;
        if(self.connector) self.updateConnector(self.connector);
        resolve();
      }catch(error : any) {
        reject(new TransportErrorHandler(`Failed to dispose WebSocket Server transport. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
      }
    });
  }

  /**
   * Send data for connection
   * @param data {Uint8Array} Raw data
   * @param to {ClientConnection|Set<ClientConnection>} Client connection or set of client connections
   * TODO: Use Redis Streams
   */
  public async send(data: Uint8Array, to: ClientConnection | Set<ClientConnection>) : Promise<true | TransportErrorHandler> {
    let self = this;
    return new Promise(async (resolve, reject)=> {
      if(data.length === 0) {
        reject(new TransportErrorHandler(`Failed to send data via transport. Data is empty.`, null, TransportError.CommandException));
        return;
      }

      /** Try to send data using connection */
      async function trySend(connection : ClientConnection) {
        try{
          let socket = connection.connector as WebSocket;
          if(!socket || socket.readyState !== WebSocket.OPEN) {
            self.terminateConnection(connection.id, ClientDisconnectCode.ClientError);
            reject(new TransportErrorHandler(`Failed to send data via transport. Connection ${connection.id} socket is dead.`, null, TransportError.ConnectionFailed));
            return;
          }

          // Send data to client
          await self.invokeMiddleware(connection, data);
          await Router.invoke("transportBeforeDataSend", { connection: connection, data: data });
          self.onBeforeClientDataSent.invoke({ connection: connection, data: data});
          socket.send(data);
          self.onClientDataSend.invoke({ connection: connection, data: data });
          await Router.invoke("transportDataSent", { connection: connection, data: data });
          resolve(true);
          return;
        }catch(error : any) {
          self.terminateConnection(connection.id, ClientDisconnectCode.ClientError);
          reject(new TransportErrorHandler(`Failed to send data via transport. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
          return;
        }
      }

      // Single client
      if(!(to instanceof Set)) return trySend(to as ClientConnection);

      // Multiple clients
      to.forEach((connection : ClientConnection) => {
        trySend(connection);
      })
      resolve(true);
    });
  }

  /**
   * Send data by ID
   * @param data {Uint8Array} Raw data
   * @param to {string|Set<string>} Connection ID or Set of IDs
   * @returns {true|TransportErrorHandler} Returns true or Transport Error Handler
   * TODO: Use Redis Streams
   */
  public async sendById(data : Uint8Array, to: string | Set<string>) : Promise<true | TransportErrorHandler> {
    let self = this;
    let recipients: Set<ClientConnection> = new Set();
    return new Promise(async (resolve, reject)=> {
      // Single connection
      if (typeof to === "string") {
        let connection = self._connections.get(to);
        if (!connection) {
          reject(new TransportErrorHandler(`Failed to send data via transport. Connection is not found for id: ${to}`));
          return;
        }
        if (!connection.isAlive) {
          self._resendQueue.enqueue({ connection: connection as ClientConnection, data: data});
          reject(new TransportErrorHandler(`Failed to send data for ${to}. Connection is not alive.`, null, TransportError.ConnectionFailed));
          return;
        }

        self.send(data, connection).then(result => {
          resolve(result);
        }).catch(error => reject(TransportErrorHandler.parse(error)));
        return;
      }

      // For each connection ids
      to.forEach((connectionId) => {
        let connection = self._connections.get(connectionId);
        if(connection && connection.isAlive) {
          if(!recipients.has(connection)) recipients.add(connection);
        }else{
          if(connection && !connection.isAlive) self._resendQueue.enqueue({ connection: connection as ClientConnection, data: data});
        }
      });

      // Send to all available
      self.send(data, recipients).then(result => {
        resolve(result);
      }).catch(error => reject(TransportErrorHandler.parse(error)));
      return;
    });
  }

  /**
   * Start transport heartbeat
   * @private
   */
  private startHeartbeat(): void {
    let self = this;
    if(!self.options.heartbeat) return;
    if(self._heartbeatTimer) self.stopHeartbeat();

    // Start heartbeat
    self._heartbeatTimer = setInterval(async ()=> {
      self._connections.forEach(connection => {
        self.pingConnection(connection);
      });
    }, self.options.heartbeatTimer);
  }

  /**
   * Stop transport heartbeat
   * @private
   */
  private stopHeartbeat(): void {
    let self = this;
    if(!self._heartbeatTimer || !self.options.heartbeat) return;
    clearInterval(self._heartbeatTimer);
    self._heartbeatTimer = undefined;
  }

  /**
   * Ping connection
   * @param connection {ClientConnection} Connection
   * @private
   */
  private pingConnection(connection : ClientConnection) {
    // Get socket
    let self = this;
    let socket = connection.connector as WebSocket;

    // Connection is already closed?
    if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      self.terminateConnection(connection.id);
      return;
    }

    // Not alive
    if (!connection.isAlive) {
      Logger.log(`Connection ${connection.id} did not respond to ping, terminating...`);
      self.terminateConnection(connection.id);
      return;
    }

    // Setup ping timeout
    if (connection.pingTimeout) clearTimeout(connection.pingTimeout);
    connection.pingTimeout = setTimeout(() => {
      if (!connection.isAlive) {
        self.terminateConnection(connection.id);
      }
    }, self.options.heartbeatTimeout);
  }

  /**
   * Terminate connection
   * @param connectionId {string} connection id
   * @param disconnectCode {ClientDisconnectCode} disconnect code
   * @private
   */
  private terminateConnection(connectionId: string, disconnectCode ? : ClientDisconnectCode): void {
    // Find connection
    let self = this;
    const connection = self._connections.get(connectionId);
    if (!connection) return;

    // Has timeout
    if (connection.pingTimeout) {
      clearTimeout(connection.pingTimeout);
    }

    // Close connection
    let socket = connection.connector as WebSocket;
    if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
      socket.terminate();
    }

    // Remove connection
    self._connections.delete(connectionId);
    self.onClientDisconnected.invoke({ connectionId: connectionId, code : disconnectCode ?? ClientDisconnectCode.ConnectionTimeout})
    Logger.info(`Connection ${connectionId} terminated. Disconnection Code: ${disconnectCode ?? ClientDisconnectCode.ConnectionTimeout}`);
  }

  /**
   * Handle raw client connection
   * @param client {WebSocket} client
   * @private
   */
  private handleConnection(client : WebSocket) {
    let self = this;

    // Create client connection data
    const connectionId = UUID.v4();
    let connection : ClientConnection = {
      id : connectionId,
      isAlive : true,
      connector: client
    };

    // On before client connected
    self.onBeforeClientConnected.invoke(connection);

    // Add connection to set
    self._connections.set(connectionId, connection);
    client.on('pong', () => {
      connection.isAlive = true;
      if (connection.pingTimeout) {
        clearTimeout(connection.pingTimeout);
        connection.pingTimeout = undefined;
      }
    });

    // Add other connection events
    client.on('message', (data) => {
      self.handleMessage(connection, data);
    });
    client.on('close', () => {
      self.handleDisconnect(connectionId);
    })
    client.on('error', (err) => {
      Logger.error(`Connection #${connection.id} error: ${err}`);
      self.terminateConnection(connectionId, ClientDisconnectCode.ClientError);
    });

    // Send Event
    self.onClientConnected.invoke(connection);
    Logger.info(`New connection: ${connectionId}`);
  }

  /**
   * Handle disconnect
   * @param connectionId {string} connection ID
   * @private
   */
  private handleDisconnect(connectionId : string) : void {
    let self = this;

    // Find connection
    const connection = self._connections.get(connectionId);
    if (!connection) return;

    // Clean connection timeouts
    if (connection.pingTimeout) {
      clearTimeout(connection.pingTimeout);
    }

    // Remove connection
    self._connections.delete(connectionId);
    self.onClientDisconnected.invoke({ connectionId: connectionId, code: ClientDisconnectCode.NormalDisconnect});
    Logger.info(`Connection ${connectionId} disconnected normally.`);
  }

  /**
   * Handle raw message
   * @param connection {ClientConnection} client connection
   * @param data {string|Buffer|ArrayBuffer|Buffer[]} Message data
   * @private
   * TODO: Use Redis Streams
   */
  private handleMessage(connection : ClientConnection, data : string | Buffer | ArrayBuffer | Buffer[]) : void {
    this.onClientDataReceived.invoke({
      connection: connection,
      data: BinaryConverter.toUint8Array(data as any)
    })
  }

  /**
   * Start resend queue
   * @private
   * TODO: Use Redis Streams
   */
  private startResendQueue(){
    let self = this;
    if(!self.options.resend) return;
    if(self._resendTimer) self.stopResendQueue();

    // Start resend queue
    self._resendTimer = setInterval(()=> {
      if(self._resendQueue.size > 0) {
        Logger.info(`Resending queue failed messages: ${self._resendQueue.size}`);
        for(let i = 0; i < self.options.resendPerIteration; i++) {
          const msg = self._resendQueue.dequeue();
          if(msg) self.send(msg.data, msg.connection);
        }
      }
    }, self.options.resendTimer);
  }

  /**
   * Stop resend queue
   * @private
   */
  private stopResendQueue(){
    let self = this;
    if(!self._resendTimer || !self.options.resend) return;
    clearInterval(self._resendTimer);
    self._resendTimer = undefined;
  }

  /**
   * Default options
   */
  public static defaultOptions: WebSocketServerTransportOptions = {
    // Basic Options
    protocol: process?.env?.TRANSPORT_PROTO ?? "",
    host: process?.env?.TRANSPORT_HOST ?? "localhost",
    port: parseInt(process?.env?.TRANSPORT_PORT ?? "8080"),
    path: process?.env?.TRANSPORT_PATH ?? "/",

    // Websocket server options
    allowSynchronousEvents: true,
    autoPong: true,
    maxPayload : 104857600,
    noServer : false,
    skipUTF8Validation: false,

    // Rate Limit Options
    rateLimit: {
      enabled: ParseUtils.bool(process?.env?.RATE_LIMIT ?? "true"),
      maxConnections: parseInt(process?.env?.RATE_LIMIT_MAX_CONNECTIONS ?? "5000")
    },

    // Reconnect options
    reconnect: {
      autoReconnect : ParseUtils.bool(process?.env?.TRANSPORT_RECONNECT ?? "true"),
      maxAttempts: parseInt(process?.env?.TRANSPORT_RECONNECT_DELAY ?? "5"),
      delay: parseInt(process?.env?.TRANSPORT_RECONNECT_ATTEMPTS ?? "5000")
    },

    // Heartbeat options
    heartbeat: true,
    heartbeatTimer: 30000,
    heartbeatTimeout: 5000,

    resend: true,
    resendTimer: 30000,
    resendPerIteration: 10000
  }
}