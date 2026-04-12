/**
 * BitWarp Networking Fast Queue implementation
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1005
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               12.04.2026
 */

/**
 * Extremely fast Queue implementation
 */
export class FastQueue<T> {
  // Elements storage
  private storage: Record<number, T> = Object.create(null);
  private head = 0;
  private tail = 0;

  /**
   * Add item to the end of queue
   * @param item {any} Item
   */
  public enqueue(item: T): void {
    this.storage[this.tail] = item;
    this.tail++;
  }

  /**
   * Remove item from start of queue and return it
   * With O(1)
   * @returns {any|undefined} Returns an item or undefined
   */
  public dequeue(): T | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    const item = this.storage[this.head];
    delete this.storage[this.head];
    this.head++;
    return item;
  }

  /**
   * Returns an item from start of queue
   * @returns {any|undefined} Returns an item or undefined if queue is empty
   */
  public peek(): T | undefined {
    return this.isEmpty() ? undefined : this.storage[this.head];
  }

  /**
   * Get size of queue
   * @returns {number} Size of queue
   */
  public get size(): number {
    return this.tail - this.head;
  }

  /**
   * Checks if queue is empty
   * @returns {boolean}
   */
  public isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Clean queue
   */
  public clear(): void {
    this.storage = Object.create(null);
    this.head = 0;
    this.tail = 0;
  }

  /**
   * Итератор для поддержки for...of.
   * Элементы перебираются в порядке от головы к хвосту.
   */
  /**
   * An iterator support (for...of)
   * Items cycle from start to tail
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = this.head; i < this.tail; i++) {
      yield this.storage[i];
    }
  }
}