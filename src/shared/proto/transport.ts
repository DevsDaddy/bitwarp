/**
 * BitWarp Networking Transport
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1005
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               12.04.2026
 */
/* Import required modules */
import { BaseEvent } from '../types/event';
import { ErrorHandler } from '../types/handlers';
import { ClientConnection, ClientDisconnect } from './peer';

/**
 * Basic Transport Errors
 */
export enum TransportError {
  InitializationFailed = 0,
  ConnectionFailed = 1,
  CompressionFailed = 2,
  EncryptionFailed = 3,
  PacketReadFailed = 4,
  PacketWriteFailed = 5,
  HandshakeFailed = 6,
  KeyExchangeFailed = 7,
  DataParsingFailed = 8,
  CommandException = 9,
  EventException = 10,
  ReactiveException = 11,
  NetObjectException = 12,
  ClientException = 13,
  Unknown = 999
}

/**
 * Transport error
 */
export class TransportErrorHandler {
  private readonly _message : string;
  private readonly _stack : any;
  private readonly _type : TransportError;

  /**
   * Creates new Transport Error Handler
   * @param message {string} Message
   * @param stack {any} Error stack
   * @param type {TransportError} Error Type
   */
  constructor(message : string, stack ? : any, type ? : TransportError) {
    this._message  = message;
    this._stack = (stack) ? stack : null;
    this._type = (type) ? type : TransportError.Unknown;
  }

  // Public handler fields
  public get message() : string { return this._message; }
  public get stack() : any { return this._stack; }
  public get type() : TransportError { return this._type; }

  /**
   * Convert Error Handler to basic object
   * @returns { { message: string, stack: any, type: ErrorType } } Error Object
   */
  public toObject() : { message : string, stack : any, type : TransportError } {
    return {
      message : this.message,
      stack : this.stack,
      type : this.type
    }
  }

  /**
   * Convert Error Handler to JSON string
   * @returns {string} JSON string
   */
  public toJSON() : string {
    return JSON.stringify(this.toObject());
  }

  /**
   * Convert Error Handler to basic Error
   * @returns {Error} Basic Error
   */
  public toError() : Error {
    return new Error(this._message);
  }

  /**
   * Try to parse from JSON
   * @param jsonData
   */
  public static fromJSON(jsonData : string) : TransportErrorHandler {
    try {
      let parsed : any = JSON.parse(jsonData);
      return new TransportErrorHandler(parsed?.message ?? "Unknown error", parsed?.stack ?? null, parsed?.type ?? TransportError.Unknown);
    }catch (error : any) {
      return new TransportErrorHandler(`Failed to parse JSON Error Handler: ${error?.message ?? "Unknown Error"}`, error?.stack ?? null, TransportError.Unknown);
    }
  }

  /**
   * Convert an Error to Error Handler
   * @param error {Error} Basic Error
   * @returns {TransportErrorHandler} Error Handler
   */
  public static fromError(error : Error) : TransportErrorHandler {
    return new TransportErrorHandler(error.message, null, TransportError.Unknown);
  }

  /**
   * Parse error
   * @param object {any} Error parsing from string / error / any object
   * @returns {TransportErrorHandler} Returns an Error Handler
   */
  public static parse(object : any) : TransportErrorHandler {
    // Basic types parse
    if(typeof object === "string") return this.fromJSON(object);
    if(object instanceof TransportErrorHandler) return object;
    if(object instanceof ErrorHandler) return new TransportErrorHandler(object?.message ?? "Unknown error", object?.stack ?? null, TransportError.Unknown);
    if(object instanceof Error) return this.fromError(object);

    // Additional Parse
    let msg : string | null = object?.message ?? object?.msg ?? object?.error ?? object?.Message ?? object?.Error ?? object?.Msg ?? null;
    let stack : any | null = object?.stack ?? object?.Stack ?? null;
    let type : TransportError = object?.type ?? object?.TYPE ?? object?.errorType ?? object?.error_type ?? object?.ErrorType ?? object?.ERRORTYPE ?? object?.errortype ?? object?.ERROR_TYPE ?? TransportError.Unknown;

    // Additional Checks
    if(!msg) msg = "Unknown error";
    return new TransportErrorHandler(msg, stack, type);
  }
}

/**
 * Transport close code
 */
export enum TransportCloseCode {
  AlreadyClosed = 0,
  ClosedByClient = 1,
  ClosedByServer = 2,
  Unknown = 3
}

/**
 * BitWarp Transport Interface
 */
export interface ITransport {
  // Connection events
  onBeforeConnected : BaseEvent;
  onConnected : BaseEvent<any|TransportErrorHandler>;
  onError : BaseEvent<TransportErrorHandler>;
  onDisconnected : BaseEvent<TransportCloseCode|TransportErrorHandler>;
  onReconnecting : BaseEvent<boolean>;

  // Public getters
  isConnected : boolean;
  reconnection : ReconnectStatus;
  get options() : ITransportOptions;
  get connector () : ITransportOptions | undefined;

  // Initialization methods
  updateConnector(connector : any) : any | TransportErrorHandler;

  // Connection methods
  connect() : Promise<any|TransportErrorHandler>;
  disconnect(closeCode : TransportCloseCode) : Promise<TransportCloseCode|TransportErrorHandler>;
  reconnect() : Promise<any|TransportErrorHandler>;
  dispose() : Promise<void>;
}

/**
 * Server Transport
 */
export interface IServerTransport extends ITransport{
  onClientConnected : BaseEvent<ClientConnection>;
  onClientDisconnected : BaseEvent<ClientDisconnect>;
}

/**
 * Client Transport
 */
export interface IClientTransport extends ITransport{

}

/**
 * Basic Transport Options
 */
export interface ITransportOptions {
  protocol ? : string,
  host ? : string;
  port ? : number;
  path ? : string;
  reconnectOptions ? : ReconnectOptions;
}

/**
 * Reconnect options
 */
export interface ReconnectOptions {
  autoReconnect? : boolean;
  maxAttempts?: number;
  delay?: number;
}

export interface ReconnectStatus {
  isReconnecting? : boolean;
  currentAttempt ? : number;
  reconnectionTimer ? : any;
}

/**
 * Abstract Transport Class
 */
export abstract class Transport implements ITransport {
  // Connection transport events
  public onBeforeConnected : BaseEvent = new BaseEvent();
  public onConnected : BaseEvent<any|TransportErrorHandler> = new BaseEvent<any|TransportErrorHandler>();
  public onError : BaseEvent<TransportErrorHandler> = new BaseEvent<TransportErrorHandler>();
  public onDisconnected : BaseEvent<TransportCloseCode|TransportErrorHandler> = new BaseEvent<TransportCloseCode|TransportErrorHandler>();
  public onReconnecting : BaseEvent<boolean> = new BaseEvent<boolean>();

  // Setup basic components
  private readonly _options : ITransportOptions;
  private _connector ? : any;

  /**
   * Basic transport
   * @param options {ITransportOptions} transport options
   */
  constructor(options : ITransportOptions) {
    this._options = options;
  }

  // Public transport getters
  public isConnected : boolean = false;
  public reconnection : ReconnectStatus = { isReconnecting : false, reconnectionTimer : false, currentAttempt: 0 };
  public get options() : ITransportOptions { return this._options; }
  public get connector () : ITransportOptions | undefined { return this._connector; }

  // Initialization methods
  /**
   * Set new connector
   * @param connector {any} Connector
   * @return {any|TransportErrorHandler} Returns connector or Transport Error Handler
   */
  public updateConnector(connector : any) : any | TransportErrorHandler {
    try {
      if(this.isConnected || this.connector) return new TransportErrorHandler(`Failed to update connector. Connector is already used.`, null, TransportError.InitializationFailed);
      this._connector = connector;
    }catch(error : any) {
      return new TransportErrorHandler(`Failed to set transport connector. Error: ${error?.message ?? "Unknown error"}`, error?.stack ?? null, TransportError.InitializationFailed);
    }
  }

  // Connection methods
  public abstract connect(): Promise<any | TransportErrorHandler>;
  public abstract disconnect(closeCode : TransportCloseCode): Promise<TransportCloseCode | TransportErrorHandler>;
  public abstract reconnect(): Promise<any|TransportErrorHandler>;
  public abstract dispose() : Promise<void>;
}