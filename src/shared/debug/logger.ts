/**
 * BitWarp Networking Logger
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { Color } from '../types/color';
import { FormatUtils } from '../utils/format';

/**
 * Logger message type
 */
enum MessageType {
  log = 0,
  info = 1,
  warn = 2,
  error = 3,
  success = 4,
  head = 5
}

/**
 * Log level
 */
export enum LogLevel {
  All = 0,
  Log = 1 << 0,
  Info = 1 << 1,
  Warning = 1 << 2,
  Error = 1 << 3,
  Success = 1 << 4
}

/**
 * Format Options for log
 */
interface FormatOptions {
  backgroundColor ? : Color;
  fontColor ? : Color;
  plateColor ? : Color;
  plateBackgroundColor ? : Color;
  upperCase ? : boolean;
}

/**
 * BitWarp Logger
 */
export class Logger {
  // Logger settings
  private static _isEnabled : boolean = true;
  private static _logLevel : LogLevel = LogLevel.All;
  private static _logFormats : Map<MessageType,FormatOptions> = new Map<MessageType,FormatOptions>([
    [ MessageType.log, { plateColor: Color.black(), plateBackgroundColor: Color.white(), upperCase: false }],
    [ MessageType.info, { plateColor: Color.white(), plateBackgroundColor: Color.fromString("#0a96ff"), fontColor: Color.fromString("#0a96ff"), upperCase: false }],
    [ MessageType.warn, { plateColor: Color.white(), plateBackgroundColor: Color.fromString("#ff680a"), fontColor: Color.fromString("#ff680a"), upperCase: false }],
    [ MessageType.error, { plateColor: Color.white(), plateBackgroundColor: Color.fromString("#ff0a2f"), fontColor: Color.fromString("#ff0a2f"), upperCase: false }],
    [ MessageType.success, { plateColor: Color.black(), plateBackgroundColor: Color.fromString("#a5ff0a"), fontColor: Color.fromString("#a5ff0a"), upperCase: false }],
    [ MessageType.head, { plateColor: Color.white(), plateBackgroundColor: Color.fromString("#890aff"), upperCase: true }],
  ]);

  /**
   * Toggle logger
   * @param isEnabled {boolean} Enabled state
   */
  public static toggle(isEnabled ? : boolean) {
    this._isEnabled = (isEnabled === undefined) ? !this._isEnabled : isEnabled;
  }

  /**
   * Set current log level
   * @param level {LogLevel} Log level
   */
  public static setLevel(level : LogLevel) {
    this._logLevel = level;
  }

  /**
   * Set new formatting options
   * @param formatting {Map<MessageType,FormatOptions>} Format options
   */
  public static setFormatting(formatting : Map<MessageType,FormatOptions>) {
    this._logFormats = formatting;
  }

  /**
   * Write default log message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static log(message: string, ...args: any[]) { this.message(MessageType.log, message, ...args) }

  /**
   * Write info message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static info(message : string, ...args: any[]) { this.message(MessageType.info, message, ...args) }

  /**
   * Write warning message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static warning(message : string, ...args: any[]) { this.message(MessageType.warn, message, ...args) }
  public static warn(message : string, ...args: any[]) { this.message(MessageType.warn, message, ...args) }

  /**
   * Write error message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static error(message : string, ...args: any[]) { this.message(MessageType.error, message, ...args) }

  /**
   * Write success message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static success(message : string, ...args: any[]) { this.message(MessageType.success, message, ...args) }
  public static ok(message : string, ...args: any[]) { this.message(MessageType.success, message, ...args) }

  /**
   * Write head message
   * @param message {string} Header message
   */
  public static head(message : string) { this.message(MessageType.head, message) }

  /**
   * Clear log
   */
  public static clear() { console.clear() }

  /**
   * Send formatted message to console
   * @param type {MessageType} Message type
   * @param message {string} Message
   * @param args {any[]} Arguments
   * @private
   */
  private static message(type : MessageType, message : string, ...args: any[]) {
    // Log is disabled
    if(!this._isEnabled) return;

    // Bit Levels
    let canWrite = false;
    let isAll = (this._logLevel & LogLevel.All) === LogLevel.All;
    let isLog = (this._logLevel & LogLevel.Log) === LogLevel.Log;
    let isInfo = (this._logLevel & LogLevel.Info) === LogLevel.Info;
    let isWarning = (this._logLevel & LogLevel.Warning) === LogLevel.Warning;
    let isError = (this._logLevel & LogLevel.Error) === LogLevel.Error;
    let isSuccess = (this._logLevel & LogLevel.Success) === LogLevel.Success;

    // Switch message type
    switch(type) {
      case MessageType.log : {
        if(isAll || isLog) canWrite = true;
        break;
      }
      case MessageType.info : {
        if(isAll || isInfo) canWrite = true;
        break;
      }
      case MessageType.warn : {
        if(isAll || isWarning) canWrite = true;
        break;
      }
      case MessageType.error : {
        if(isAll || isError) canWrite = true;
        break;
      }
      case MessageType.success : {
        if(isAll || isSuccess) canWrite = true;
        break;
      }
      case MessageType.head : {
        if(isAll || isLog || isInfo || isWarning || isError || isSuccess) canWrite = true;
        break;
      }
      default: throw new Error(`Failed to write logger message. Unknown type ${type}`);
    }

    // Cannot write?
    if(!canWrite) return;

    // Is Header
    if(type === MessageType.head){
      console.log(this.formatMessage(` ✦ ${message} ✦ `, this.getFormatting(type), true));
      return;
    }

    // Prepare Prefix
    let prefix =
      this.formatMessage(`[ BITWARP LOG ] (${FormatUtils.formatDate(new Date(), "{{dd}}.{{mm}} {{HH}}:{{ii}}:{{ss}}")}) `, {
        backgroundColor: Color.fromString("#33FFFF"),
        fontColor: Color.black(),
        upperCase: true
      });

    // Prepare plate
    let plateText = "";
    if(type === MessageType.info) plateText = " INFO ";
    if(type === MessageType.error) plateText = " ERROR ";
    if(type === MessageType.success) plateText = " SUCCESS ";
    if(type === MessageType.warn) plateText = " WARNING ";
    if(type === MessageType.log) plateText = " LOG ";
    let plate = this.formatMessage(plateText, this.getFormatting(type), true);
    let msg = this.formatMessage(message, this.getFormatting(type), false);

    // Prepare Message
    if(type === MessageType.error) {
      console.error(`${prefix}${plate} ${msg}`, ...args);
    }else if(type === MessageType.warn) {
      console.warn(`${prefix}${plate} ${msg}`, ...args);
    }else{
      console.log(`${prefix}${plate} ${msg}`, ...args);
    }
  }

  /**
   * Format message
   * @param message {string} Message
   * @param format {FormatOptions} Format options
   * @param isPlate {boolean} is plate message
   * @returns {string} Formatted message
   * @private
   */
  private static formatMessage(message : string, format ? : FormatOptions, isPlate : boolean = false) : string {
    let fontColor : Color | null = (isPlate) ? format?.plateColor ?? null : format?.fontColor ?? null;
    let bgColor : Color | null = (isPlate) ? format?.plateBackgroundColor ?? null : format?.backgroundColor ?? null;
    if(format?.upperCase) message = message.toUpperCase();
    if(!fontColor && !bgColor) return message;

    // Format
    let bgStart = (bgColor) ? `\x1b[48;2;${bgColor.toString(";")}m` : "";
    let fontStart = (fontColor) ? `\x1b[38;2;${fontColor.toString(";")}m` : "";
    return `${bgStart}${fontStart}${message}${(fontStart.length > 0 ? "\x1b[0m" : "")}${bgStart.length > 0 ? "\x1b[0m" : ""}`;
  }

  /**
   * Get formatting by type
   * @param type {MessageType} Message type
   */
  private static getFormatting(type : MessageType) : FormatOptions {
    if(this._logFormats.has(type)) return this._logFormats.get(type) as FormatOptions;
    return {};
  }
}