/**
 * BitWarp Networking event types
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
import { Logger } from '../debug/logger';

/**
 * Basic Listener
 */
export type BaseListener<EventData = any> = (data: EventData) => void | Promise<void>;

/**
 * Base listener interface
 */
export interface IBaseListener {
  addListener(listener: BaseListener): () => void;
  removeListener(listener: BaseListener): void;
  removeAllListeners(): void;
  listenerCount(): number;
  hasListeners(): boolean;
}

/**
 * Base invoker interface
 */
export interface IBaseInvoker {
  invoke(data: any): void;
  invokeAsync(data: any): Promise<void>;
}

/**
 * Basic Event
 */
export class BaseEvent<EventData = void> implements IBaseListener, IBaseInvoker {
  // Listeners
  private listeners: Set<BaseListener<EventData>> = new Set();

  /**
   * Add event listener
   * @param listener {BaseListener} Event listener function
   * @returns {Function} Unsubscribe function
   */
  public addListener(listener: BaseListener<EventData>): () => void {
    this.listeners.add(listener);
    return () => this.removeListener(listener);
  }

  /**
   * Remove event listener
   * @param listener {BaseListener} Remove listener function
   */
  public removeListener(listener: BaseListener<EventData>): void {
    this.listeners.delete(listener);
  }

  /**
   * Invoke event with data
   * @param data {any} Event data
   */
  public invoke(data: EventData): void {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error : any) {
        Logger.error(`Error in event listener: ${error?.message ?? "Unknown error"}`);
      }
    });
  }

  /**
   * Invoke event listener async
   * @param data {any} Event data
   */
  public async invokeAsync(data: EventData): Promise<void> {
    const promises: Promise<void>[] = [];

    this.listeners.forEach(listener => {
      try {
        const result = listener(data);
        if (result instanceof Promise) {
          promises.push(result.catch(error => {
            Logger.error(`Error in async event listener: ${error?.message ?? "Unknown error"}`);
          }));
        }
      } catch (error : any) {
        Logger.error(`Error in event listener: ${error?.message ?? "Unknown error"}`);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Remove all listeners
   */
  public removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get listeners count
   * @returns {number} Listeners count
   */
  public listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Check if listeners exists
   * @returns {boolean}
   */
  public hasListeners(): boolean {
    return this.listeners.size > 0;
  }
}