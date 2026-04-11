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
  Logger,
  Transport,
  TransportCloseCode,
  TransportError,
  TransportErrorHandler
} from '../../shared';
import { WebSocketServer } from 'ws';
import 'dotenv/config';

/**
 * WebSocket based server transport options
 */
export interface WebSocketServerTransportOptions extends ITransportOptions {
  allowSynchronousEvents : boolean;
  autoPong : boolean;
  backlog ? : number;
  clientTracking ? : boolean;
  maxPayload : number;
  noServer : boolean;
  skipUTF8Validation : boolean;
}

/**
 * WebSocket based server transport
 */
export class WebSocketServerTransport extends Transport implements ITransport {
  /**
   * Create WebSocket based server transport
   * @param options {WebSocketServerTransportOptions} Options
   */
  constructor(options ? : WebSocketServerTransportOptions) {
    // Options merge
    let currentOptions : WebSocketServerTransportOptions = (options) ? {...WebSocketServerTransport.defaultOptions, ...options} : WebSocketServerTransport.defaultOptions;
    super(currentOptions);
  }

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
        let currentOptions : WebSocketServerTransportOptions = self.options as WebSocketServerTransportOptions;
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
        connector.addListener("connection", (client) => {
          // TODO: Client connection
        });
        connector.addListener("close", () => {
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
          resolve(connector);
        });
        connector.addListener("wsClientError", (error) => {
          // TODO: Process client error
          let err = new TransportErrorHandler(`WebSocket Server transport error. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ClientException);
          self.onError.invoke(err);
          resolve(err);
        });

        // Update connector
        self.updateConnector(connector);
        self.onBeforeConnected.invoke();
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
   * Default options
   */
  public static defaultOptions: WebSocketServerTransportOptions = {
    protocol: "",
    host: "localhost",
    port: 8080,
    path: "/",

    allowSynchronousEvents: true,
    autoPong: true,
    maxPayload : 104857600,
    noServer : false,
    skipUTF8Validation: false,

    reconnectOptions: {
      autoReconnect : true,
      maxAttempts: 5,
      delay: 5000
    }
  }
}