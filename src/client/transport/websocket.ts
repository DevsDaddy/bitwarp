/**
 * BitWarp Networking WebSocket Client Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1005
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               12.04.2026
 */
/* Import required modules */
import {
  IClientTransport,
  ITransport,
  ITransportOptions,
  Logger,
  Transport,
  TransportCloseCode,
  TransportError,
  TransportErrorHandler
} from '../../shared';

/**
 * WebSocket based client transport options
 */
export interface WebSocketClientTransportOptions extends ITransportOptions {

}

/**
 * WebSocket based client transport
 */
export class WebSocketClientTransport extends Transport implements ITransport, IClientTransport {

  /**
   * Create WebSocket based client transport
   * @param options {WebSocketClientTransportOptions} Options
   */
  constructor(options ? : WebSocketClientTransportOptions) {
    // Options merge
    let currentOptions : WebSocketClientTransportOptions = (options) ? {...WebSocketClientTransport.defaultOptions, ...options} : WebSocketClientTransport.defaultOptions;
    super(currentOptions);
  }

  // Override transport getters
  public override get options(): WebSocketClientTransportOptions { return super.options as WebSocketClientTransportOptions; }
  public override get connector () : WebSocket { return super.connector as WebSocket; }

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
        self.onBeforeConnected.invoke();
        let currentOptions = self.options;
        let url : string = `${currentOptions.protocol}${currentOptions.host}:${currentOptions.port}${currentOptions.path}`;
        let connector = new WebSocket(url);

        // Subscribe to connector events
        connector.addEventListener("open", async () => {
          Logger.success(`WebSocket Transport client is connected with: ${self.options.host}:${self.options.port}`);
          self.isConnected = true;
          self.onConnected.invoke(connector);
          resolve(connector);
        });
        connector.addEventListener("close", async (event) => {
          // Websocket code
          let wsCode = event?.code ?? 0;
          let isNormalClose = (wsCode <= 1000);

          // If not normal close
          if(!isNormalClose) {
            if(self.reconnection.isReconnecting) self.reconnection.isReconnecting = false;
            if(self.options.reconnectOptions?.autoReconnect && !self.reconnection.isReconnecting){
              let reconnect = await self.reconnect();
              if(reconnect instanceof TransportErrorHandler){
                self.onError.invoke(new TransportErrorHandler(`Reconnect Error: ${reconnect?.message ?? "Unknown error"}`, reconnect?.stack ?? null, reconnect?.type ?? TransportError.ConnectionFailed));
              } else{
                resolve(reconnect);
                return;
              }
            }
          }

          // Is Normal close
          self.dispose().then(()=>{
            self.onDisconnected.invoke((wsCode === 0) ? TransportCloseCode.ClosedByClient : TransportCloseCode.ClosedByServer);
          })
        });
        connector.addEventListener("error", async (event) => {
          self.onError.invoke(new TransportErrorHandler(`WebSocket Transport Client Error`, event));
        });
        connector.addEventListener("message", async (event) => {
          // TODO: On message
        });

        // Update connector
        self.updateConnector(connector);
      }catch(error : any) {
        resolve(new TransportErrorHandler(`Failed to connect WebSocket Client transport. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
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
        let connection = self.connector as WebSocket ?? null;
        if(!connection) {
          resolve(closeCode);
          return;
        }

        // Close socket connection
        connection.close(closeCode === TransportCloseCode.ClosedByClient || closeCode === TransportCloseCode.AlreadyClosed ? 0 : 600);
        setTimeout(()=>{
          resolve(closeCode);
        }, 2000);
      }catch(error : any) {
        resolve(new TransportErrorHandler(`Failed to disconnect WebSocket Client transport with code: ${closeCode}. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
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
        resolve(new TransportErrorHandler(`Failed to reconnect WebSocket Client transport. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
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
        reject(new TransportErrorHandler(`Failed to dispose WebSocket Client transport. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ConnectionFailed));
      }
    });
  }

  /**
   * Default options
   */
  public static defaultOptions: WebSocketClientTransportOptions = {
    protocol: "ws://",
    host: "localhost",
    port: 8080,
    path: "/",

    reconnectOptions: {
      autoReconnect : true,
      maxAttempts: 5,
      delay: 5000
    }
  }
}