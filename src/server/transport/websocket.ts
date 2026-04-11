/**
 * BitWarp Networking Websocket Server Implementation
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
  ITransport,
  ITransportOptions,
  Logger, ParseUtils,
  Transport,
  TransportCloseCode,
  TransportError,
  TransportErrorHandler
} from '../../shared';
import { WebSocketServer, WebSocket } from 'ws';
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
}

/**
 * WebSocket based server transport
 */
export class WebSocketServerTransport extends Transport implements ITransport {
  // Connections Management
  private _heartbeatTimer ? : NodeJS.Timeout;
  private _rawConnections : Set<WebSocket> = new Set();

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
          self.handleRawConnection(client);
        });
        connector.addListener("close", () => {
          self.stopHeartbeat();
          self.dispose().then(()=>{
            self.onDisconnected.invoke(TransportCloseCode.ClosedByServer);
          })
        });
        connector.addListener("error", async (error) => {
          let err = new TransportErrorHandler(`WebSocket Server transport error. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed);
          self.isConnected = false;

          // Trying to reconnect
          if(self.options.reconnectOptions?.autoReconnect && !self.reconnection.isReconnecting){
            let reconnect = await self.reconnect();
            if(reconnect instanceof TransportErrorHandler) err = reconnect;
            else{
              resolve(reconnect);
              return;
            }
          }

          // Dispose before error
          self.dispose().then(()=>{
            self.onError.invoke(err);
            resolve(err);
          });
        });
        connector.addListener("listening", () => {
          Logger.success(`WebSocket Transport server is started at: ${self.options.host}:${self.options.port}`);
          self.isConnected = true;
          self.onConnected.invoke(connector);
          self.startHeartbeat();
          resolve(connector);
        });
        connector.addListener("wsClientError", (error) => {
          let err = new TransportErrorHandler(`WebSocket Server transport error. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ClientException);
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
        if(self.options.reconnectOptions?.maxAttempts && self.options.reconnectOptions?.maxAttempts > 0){
          if(self.reconnection.currentAttempt >= self.options.reconnectOptions?.maxAttempts){
            self.reconnection = { isReconnecting : false, reconnectionTimer: null, currentAttempt: 0 };
            self.onReconnecting.invoke(false);
            let err = `Failed to reconnect. The maximum number of attempts has been exhausted`;
            Logger.error(err);
            resolve(new TransportErrorHandler(err, null, TransportError.ConnectionFailed))
            return;
          }
        }

        // Try to reconnect
        let reconnectDelay = self.options.reconnectOptions?.delay ?? 5000;
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
   * Start transport heartbeat
   * @private
   */
  private startHeartbeat(): void {
    let self = this;
    if(!self.options.heartbeat) return;
    if(self._heartbeatTimer) self.stopHeartbeat();
    self._heartbeatTimer = setInterval(async ()=> {

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
   * Handle raw client connection
   * @param client {WebSocket} client
   * @private
   */
  private handleRawConnection(client : WebSocket) {
    let self = this;

    // Has raw connection - remove
    if(self._rawConnections.has(client)) {
      self._rawConnections.delete(client);
    }

    // Process raw connection to peer
    client.on("close", ()=>{
      // Remove client from raw connections
      if(self._rawConnections.has(client)) {
        self._rawConnections.delete(client);
      }
    })
    self._rawConnections.add(client);
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

    // Reconnect options
    reconnectOptions: {
      autoReconnect : ParseUtils.bool(process?.env?.TRANSPORT_RECONNECT ?? "true"),
      maxAttempts: parseInt(process?.env?.TRANSPORT_RECONNECT_DELAY ?? "5"),
      delay: parseInt(process?.env?.TRANSPORT_RECONNECT_ATTEMPTS ?? "5000")
    },

    // Heartbeat options
    heartbeat: true,
    heartbeatTimer: 30000,
    heartbeatTimeout: 5000
  }
}