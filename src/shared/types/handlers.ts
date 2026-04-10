/**
 * BitWarp Networking Basic Handlers
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/**
 * Basic Error Types
 */
export enum ErrorType {
  SystemException = 0,
  ClientException = 1,
  ServerException = 2,
  Unknown = 99
}

/**
 * Error Handler
 */
export class ErrorHandler {
  private readonly _message : string;
  private readonly _stack : any;
  private readonly _type : ErrorType;

  /**
   * Creates new Error Handler
   * @param message {string} Message
   * @param stack {any} Error stack
   * @param type {ErrorType} Error Type
   */
  constructor(message : string, stack ? : any, type ? : ErrorType) {
    this._message  = message;
    this._stack = (stack) ? stack : null;
    this._type = (type) ? type : ErrorType.Unknown;
  }

  // Public handler fields
  public get message() : string { return this._message; }
  public get stack() : any { return this._stack; }
  public get type() : ErrorType { return this._type; }

  /**
   * Convert Error Handler to basic object
   * @returns { { message: string, stack: any, type: ErrorType } } Error Object
   */
  public toObject() : { message : string, stack : any, type : ErrorType } {
    return {
      message : this.message,
      stack : this.stack,
      type : ErrorType.SystemException
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
  public static fromJSON(jsonData : string) : ErrorHandler {
    try {
      let parsed : any = JSON.parse(jsonData);
      return new ErrorHandler(parsed?.message ?? "Unknown error", parsed?.stack ?? null, parsed?.type ?? ErrorType.Unknown);
    }catch (error : any) {
      return new ErrorHandler(`Failed to parse JSON Error Handler: ${error?.message ?? "Unknown Error"}`, error?.stack ?? null, ErrorType.SystemException);
    }
  }

  /**
   * Convert an Error to Error Handler
   * @param error {Error} Basic Error
   * @returns {ErrorHandler} Error Handler
   */
  public static fromError(error : Error) : ErrorHandler {
    return new ErrorHandler(error.message, null, ErrorType.Unknown);
  }

  /**
   * Parse error
   * @param object {any} Error parsing from string / error / any object
   * @returns {ErrorHandler} Returns an Error Handler
   */
  public static parse(object : any) : ErrorHandler {
    // Basic types parse
    if(typeof object === "string") return this.fromJSON(object);
    if(object instanceof ErrorHandler) return object;
    if(object instanceof Error) return this.fromError(object);

    // Additional Parse
    let msg : string | null = object?.message ?? object?.msg ?? object?.error ?? object?.Message ?? object?.Error ?? object?.Msg ?? null;
    let stack : any | null = object?.stack ?? object?.Stack ?? null;
    let code : number | null = object?.code ?? object?.Code ?? object?.status ?? object?.Status ?? null;
    let type : ErrorType = ErrorType.Unknown;

    // Additional Checks
    if(!msg) msg = "Unknown error";
    if(code) {
      if(code < 400) type = ErrorType.SystemException;
      if(code >= 400 && code < 500) type = ErrorType.ClientException;
      if(code > 500) type = ErrorType.ServerException;
    }

    // Create new Error Handler
    return new ErrorHandler(msg, stack, type);
  }
}