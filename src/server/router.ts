/**
 * BitWarp Networking Router Implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1012
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               15.04.2026
 */

import { ClientData, ITransport, Logger, TransportErrorHandler } from '../shared';

/**
 * Router Event Handler
 */
type EventHandler<TArgs extends any[] = any[]> = (...args: TArgs) => void | Promise<void>;

/**
 * Event map with args
 */
interface EventMap {
  // Transport Event Map
  transportBeforeConnect : [];
  transportConnected: [transport : ITransport];
  transportError : [TransportErrorHandler];
  transportBeforeDataSend : [ClientData];
  transportDataSent : [ClientData];

  message: [data: string, from: string];
  connect: [];
  error: [error: Error];
}

/**
 * Basic Router for Applications based on BitWarp Networking
 */
export class Router {
  // Router handlers: event -> many callbacks
  private static handlers = new Map<string, Set<EventHandler>>();

  /**
   * Register router event handler
   * @param eventType {any} Event type
   * @param handler {EventHandler} Event Handler
   */
  public static onEvent<K extends keyof EventMap>(eventType: K, handler: EventHandler<EventMap[K]>): void;
  public static onEvent(eventType: string, handler: EventHandler): void;
  public static onEvent(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  /**
   * Remove event handler
   * @param eventType {any} Event type
   * @param handler {EventHandler} Event handler
   */
  public static offEvent<K extends keyof EventMap>(eventType: K, handler: EventHandler<EventMap[K]>): void;
  public static offEvent(eventType: string, handler: EventHandler): void;
  public static offEvent(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Invoke router event with arguments
   * @param eventType {any} Event type
   * @param args {EventMap} Event args
   */
  public static async invoke<K extends keyof EventMap>(eventType: K, ...args: EventMap[K]): Promise<void>;
  public static async invoke(eventType: string, ...args: any[]): Promise<void>;
  public static async invoke(eventType: string, ...args: any[]): Promise<void> {
    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];

    for (const handler of handlers) {
      try {
        const result = handler(...args);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error : any) {
        Logger.error(`BitWarp Router error in ${eventType}: ${error?.message ?? "Unknown error"}`, error);
      }
    }

    if (promises.length > 0) {
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'rejected') {
          Logger.error(`BitWarp Router error in ${eventType}. Error: ${result?.reason?.message ?? "Unknown error"}.`, result.reason);
        }
      }
    }
  }

  /**
   * Clear all router events by type or all
   * @param eventType {string} Event type
   */
  public static clear(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get registered events for router
   */
  public static getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }
}