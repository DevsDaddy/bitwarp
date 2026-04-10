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

/**
 * Logger message type
 */
enum MessageType {
  log = 0,
  info = 1,
  warn = 2,
  error = 3,
  success = 4
}

/**
 * BitWarp Logger
 */
export class Logger {

  /**
   * Default log message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static log(message: string, ...args: any[]) { this.message(MessageType.log, message, ...args) }

  /**
   * Default info message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static info(message : string, ...args: any[]) { this.message(MessageType.info, message, ...args) }

  /**
   * Default warning message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static warning(message : string, ...args: any[]) { this.message(MessageType.warn, message, ...args) }
  public static warn(message : string, ...args: any[]) { this.message(MessageType.warn, message, ...args) }

  /**
   * Default error message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static error(message : string, ...args: any[]) { this.message(MessageType.error, message, ...args) }

  /**
   * Default success message
   * @param message {string} Message
   * @param args {any[]} Arguments
   */
  public static success(message : string, ...args: any[]) { this.message(MessageType.success, message, ...args) }
  public static ok(message : string, ...args: any[]) { this.message(MessageType.success, message, ...args) }

  /**
   * Send formatted message to console
   * @param type {MessageType} Message type
   * @param message {string} Message
   * @param args {any[]} Arguments
   * @private
   */
  private static message(type : MessageType, message : string, ...args: any[]) {

  }

  
}