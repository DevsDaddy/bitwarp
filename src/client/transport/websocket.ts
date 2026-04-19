/**
 * BitWarp Networking WebSocket Client Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1058
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               19.04.2026
 */
/* Import required modules */
import {
  BaseEvent,
  BinaryConverter,
  FastQueue,
  IClientTransport,
  ITransport,
  ITransportOptions,
  Logger, MiddlewareHandler,
  RawPacket,
  Transport,
  TransportCloseCode,
  TransportError,
  TransportErrorHandler
} from '../../shared';

/**
 * WebSocket based client transport options
 */
export interface WebSocketClientTransportOptions extends ITransportOptions {
  resend : { enabled: boolean; delay : number; maxAttempts: number };
}

/**
 * WebSocket based client transport
 */
export class WebSocketClientTransport extends Transport implements ITransport, IClientTransport {
  // Client Events
  public onDataReceived : BaseEvent<Uint8Array> = new BaseEvent<Uint8Array>();
  public onPacketSent : BaseEvent<RawPacket> = new BaseEvent<RawPacket>();
  public onPacketError : BaseEvent<{ packet: RawPacket, error: TransportErrorHandler }> = new BaseEvent<{ packet: RawPacket, error: TransportErrorHandler }>();
  public onBeforePacketSend : BaseEvent<RawPacket> = new BaseEvent<RawPacket>();

  // Resend queue
  private _resendQueue : FastQueue<RawPacket> = new FastQueue();
  private _resendTimer ? : NodeJS.Timeout;
  private _resendAttempts : number = 0;

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
  public get url() : string | undefined { let c = super.connector as WebSocket; return c?.url ?? undefined; }

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
        self.stopResend();
        let currentOptions = self.options;
        let url : string = `${currentOptions.protocol}${currentOptions.host}:${currentOptions.port}${currentOptions.path}`;
        let connector = new WebSocket(url);

        // Subscribe to connector events
        connector.addEventListener("open", async () => {
          Logger.success(`WebSocket Transport client is connected with: ${self.options.host}:${self.options.port}`);
          self.updateConnector(connector);
          self.isConnected = true;
          self.startResend();
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
            if(self.options.reconnect?.autoReconnect && !self.reconnection.isReconnecting){
              let reconnect = await self.reconnect();
              if(reconnect instanceof TransportErrorHandler){
                self.onError.invoke(new TransportErrorHandler(`Reconnect Error: ${reconnect?.message ?? "Unknown error"}`, reconnect?.stack ?? null, reconnect?.type ?? TransportError.ConnectionFailed));
              } else{
                resolve(reconnect);
                return;
              }
            }
          }else{
            self.stopResend()
            self._resendQueue.clear();
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
          let data = event?.data ?? undefined;
          if(!data) {
            Logger.warning(`WebSocket Transport received an empty message event.`, event);
          }else{
            await self.handleMessage(data);
          }
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
   * Send Raw Message using Transport
   * @param rawPacket {RawPacket} Raw Data
   * @returns {Promise<boolean>} Packet send state
   */
  public async send(rawPacket : RawPacket): Promise<void> {
    let self = this;
    try {
      // Send an event
      await self.onBeforePacketSend.invokeAsync(rawPacket);
      await self.invokeMiddleware(rawPacket);

      // If not connected - put to resend queue
      if(!self.isConnected || self.connector.readyState !== WebSocket.OPEN) {
        console.log(self.connector, self.isConnected, self.connector.readyState);
        if(self.options.resend.enabled){
          Logger.info(`Failed to send packet ${rawPacket.packetId}. Trying to resend.`)
          self._resendQueue.enqueue(rawPacket);
          return Promise.resolve();
        }else{
          await self.onPacketError.invokeAsync({
            packet: rawPacket,
            error: new TransportErrorHandler(`Failed to send packet ${rawPacket.packetId}. Connection lost.`, null, TransportError.ConnectionFailed)
          })
          return Promise.resolve();
        }
      }

      // Send message via transport
      self.connector.send(rawPacket.data);
      await self.onPacketSent.invokeAsync(rawPacket);
      return Promise.resolve();
    }catch(error : any) {
      if(self.options.resend.enabled){
        Logger.info(`Failed to send packet ${rawPacket.packetId}. Trying to resend.`, error)
        self._resendQueue.enqueue(rawPacket);
        return Promise.resolve();
      }else{
        await self.onPacketError.invokeAsync({
          packet: rawPacket,
          error: new TransportErrorHandler(`Failed to send packet ${rawPacket.packetId}. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.ClientException)
        })
      }
    }
  }

  /**
   * Handle raw socket data
   * @param data {any} WebSocket Data
   * @private
   */
  private async handleMessage(data : any) {
    let uint8: Uint8Array;

    if (data instanceof Blob) {
      const arrayBuffer = await data.arrayBuffer();
      uint8 = BinaryConverter.toUint8Array(arrayBuffer);
    } else if (data instanceof ArrayBuffer) {
      uint8 = BinaryConverter.toUint8Array(data);
    } else if (typeof data === 'string') {
      uint8 = BinaryConverter.toUint8Array(data);
    } else {
      Logger.error(`Unknown data type received: ${typeof data}`);
      return;
    }

    await this.onDataReceived.invokeAsync(uint8);
  }

  /**
   * Start raw data resend
   * @private
   */
  private startResend(): void {
    let self = this;
    if(!self.options.resend.enabled) return;
    if(self._resendTimer) self.stopResend();

    // Start heartbeat
    self._resendTimer = setInterval(async ()=> {
      let queueSize = self._resendQueue.size;
      if(queueSize > 0){
        for(let i= 0; i < queueSize; i++){
          const msg = self._resendQueue.dequeue();
          if(msg) await self.send(msg);
        }

        // Clean queue
        self._resendAttempts += 1;
        if(self._resendAttempts >= (self.options.resend.maxAttempts - 1)){
          self._resendAttempts = 0;
          self._resendQueue.clear();
          self.stopResend();
        }
      }
    }, self.options.resend.delay);
  }

  /**
   * Stop raw data resend
   * @private
   */
  private stopResend(): void {
    let self = this;
    if(!self._resendTimer || !self.options.resend.enabled) return;
    clearInterval(self._resendTimer);
    self._resendTimer = undefined;
  }

  /**
   * Default options
   */
  public static defaultOptions: WebSocketClientTransportOptions = {
    protocol: "ws://",
    host: "localhost",
    port: 8080,
    path: "/",

    reconnect: {
      autoReconnect : true,
      maxAttempts: 5,
      delay: 5000
    },

    resend : {
      enabled : true,
      maxAttempts: 5,
      delay: 5000
    }
  }
}