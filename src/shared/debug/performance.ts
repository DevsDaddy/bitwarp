/**
 * BitWarp Networking Performance Tools
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/**
 * Performance Record
 */
export interface PerformanceRecord {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
}

/**
 * Performance Measure
 */
export interface PerformanceMeasure{
  duration: number;
  startMark?: string;
  endMark?: string
}

/**
 * BitWarp Performance Tool
 */
export class Performance {
  // Marks storage
  private marks: Map<string, number> = new Map();
  // Measures storage
  private measures: Map<string, PerformanceMeasure> = new Map();
  // Native performance tool
  private useNativePerformance: boolean;
  // Performance link
  private perf: typeof performance | null = null;

  /**
   * Create Performance Measurement Class
   */
  constructor() {
    // @ts-ignore
    if (typeof performance !== 'undefined' && performance.now) {
      this.perf = performance;
      this.useNativePerformance = true;
    } else if (typeof require !== 'undefined') {
      try {
        const { performance: nodePerf } = require('perf_hooks');
        this.perf = nodePerf;
        this.useNativePerformance = true;
      } catch {
        this.useNativePerformance = false;
      }
    } else {
      this.useNativePerformance = false;
    }
  }

  /**
   * Get current time
   * @returns {number} Current timestamp
   */
  public now(): number {
    if (this.perf && this.perf.now) {
      return this.perf.now();
    }
    // Fallback for Date.now()
    return Date.now();
  }

  /**
   * Returns the current time in nanoseconds as a BigInt (Node.js with process.hrtime.bigint only).
   * If not supported or launched in browser returns 0n
   * @returns {bigint} Nanoseconds time or 0n
   */
  public nowBigInt(): bigint {
    if (typeof process !== 'undefined' && process.hrtime && process.hrtime.bigint) {
      return process.hrtime.bigint();
    }
    if (this.perf && (this.perf as any).timeOrigin !== undefined) {
      const timeOrigin = (this.perf as any).timeOrigin;
      return BigInt(Math.floor(timeOrigin * 1e6)) + BigInt(Math.floor(this.now() * 1e6));
    }
    return 0n;
  }

  /**
   * Create named timestamp
   * @param name {string} Name of timestamp
   */
  public mark(name: string): void {
    // @ts-ignore
    if (this.useNativePerformance && this.perf!.mark) {
      this.perf!.mark(name);
    } else {
      this.marks.set(name, this.now());
    }
  }

  /**
   * Measures the duration between two marks and stores the result.
   * @param name {string} Measure name
   * @param startMark {string} Start mark name
   * @param endMark {string} End mark name. If not defined - used current time
   * @returns {number} Duration value
   */
  public measure(name: string, startMark: string, endMark?: string): number {
    let duration: number;

    // @ts-ignore
    if (this.useNativePerformance && this.perf!.measure) {
      try {
        this.perf!.measure(name, startMark, endMark);
        const entries = this.perf!.getEntriesByName(name, 'measure');
        if (entries.length > 0) {
          duration = entries[entries.length - 1].duration;
        } else {
          duration = 0;
        }
      } catch (e) {
        duration = this.fallbackMeasure(startMark, endMark);
        this.measures.set(name, { duration, startMark, endMark });
      }
    } else {
      duration = this.fallbackMeasure(startMark, endMark);
      this.measures.set(name, { duration, startMark, endMark });
    }

    return duration;
  }

  /**
   * Starts a measurement with the specified name (preserves the initial label).
   * @param name {string} Measure name
   */
  public startMeasure(name: string): void {
    this.mark(`${name}:start`);
  }

  /**
   * Stops the measurement with the specified name and returns the duration.
   * @param name {string} Measure name
   * @returns {number} Duration
   * @private
   */
  public endMeasure(name: string): number {
    this.mark(`${name}:end`);
    return this.measure(name, `${name}:start`, `${name}:end`);
  }

  /**
   * Get all performance records (marks and measures)
   * @returns {Array<PerformanceRecord>} Performance records array
   */
  public getEntries(): Array<PerformanceRecord> {
    // @ts-ignore
    if (this.useNativePerformance && this.perf!.getEntries) {
      return this.perf!.getEntries().map(entry => ({
        name: entry.name,
        entryType: entry.entryType,
        startTime: entry.startTime,
        duration: entry.duration,
      }));
    } else {
      const entries: any[] = [];
      this.marks.forEach((time, name) => {
        entries.push({ name, entryType: 'mark', startTime: time, duration: 0 });
      });
      this.measures.forEach((measure, name) => {
        entries.push({ name, entryType: 'measure', startTime: 0, duration: measure.duration });
      });
      return entries;
    }
  }

  /**
   * Clear all performance marks and measures
   */
  public clear(): void {
    if (this.useNativePerformance) {
      // @ts-ignore
      if (this.perf!.clearMarks) this.perf!.clearMarks();
      // @ts-ignore
      if (this.perf!.clearMeasures) this.perf!.clearMeasures();
    }
    this.marks.clear();
    this.measures.clear();
  }

  /**
   * Clear mark by name
   * @param name {string} Measure name
   */
  public clearMark(name: string): void {
    // @ts-ignore
    if (this.useNativePerformance && this.perf!.clearMarks) {
      this.perf!.clearMarks(name);
    }
    this.marks.delete(name);
  }

  /**
   * Clear measure by name
   * @param name {string} Measure name
   */
  public clearMeasure(name: string): void {
    // @ts-ignore
    if (this.useNativePerformance && this.perf!.clearMeasures) {
      this.perf!.clearMeasures(name);
    }
    this.measures.delete(name);
  }

  /**
   * Returns information about memory usage (if available)
   * In Node.js is object with rss, heapTotal, heapUsed, external, arrayBuffers.
   * In chrome-based browser is sHeapSizeLimit, totalJSHeapSize, usedJSHeapSize.
   */
  public getMemoryUsage(): Record<string, number> | null {
    // Node.js
    if (typeof process !== 'undefined' && process.memoryUsage) {
      // @ts-ignore
      return process.memoryUsage();
    }
    // Browser (Chrome)
    if (this.perf && (this.perf as any).memory) {
      const mem = (this.perf as any).memory;
      return {
        jsHeapSizeLimit: mem.jsHeapSizeLimit,
        totalJSHeapSize: mem.totalJSHeapSize,
        usedJSHeapSize: mem.usedJSHeapSize,
      };
    }
    return null;
  }

  /**
   * Measures the execution time of a synchronous function and returns the result and duration.
   * @param fn {Function} Function for measurement
   */
  public measureFn<T>(fn: () => T): [T, number] {
    const start = this.now();
    const result = fn();
    const end = this.now();
    return [result, end - start];
  }

  /**
   * Measures the execution time of an async function and returns the result and duration.
   * @param fn {Function} Async function
   */
  public async measureAsyncFn<T>(fn: () => Promise<T>): Promise<[T, number]> {
    const start = this.now();
    const result = await fn();
    const end = this.now();
    return [result, end - start];
  }

  private fallbackMeasure(startMark: string, endMark?: string): number {
    const startTime = this.marks.get(startMark);
    if (startTime === undefined) {
      throw new Error(`Start mark "${startMark}" does not exist.`);
    }

    let endTime: number;
    if (endMark) {
      const end = this.marks.get(endMark);
      if (end === undefined) {
        throw new Error(`End mark "${endMark}" does not exist.`);
      }
      endTime = end;
    } else {
      endTime = this.now();
    }

    return endTime - startTime;
  }
}