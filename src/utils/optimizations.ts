/**
 * Performance Optimizations for turbo-csv-stream
 * 
 * This module provides optimized versions of performance-critical functions
 * with caching, memoization, and algorithmic improvements.
 */

// ============================================
// Regex Cache
// ============================================

const regexCache = new Map<string, RegExp>();
const MAX_REGEX_CACHE_SIZE = 1000;

/**
 * Get cached regex or create and cache new one
 */
export function getCachedRegex(pattern: string): RegExp {
  let regex = regexCache.get(pattern);
  
  if (!regex) {
    regex = new RegExp(pattern);
    
    // Prevent unbounded cache growth
    if (regexCache.size >= MAX_REGEX_CACHE_SIZE) {
      const firstKey = regexCache.keys().next().value as string;
      if (firstKey) regexCache.delete(firstKey);
    }
    
    regexCache.set(pattern, regex);
  }
  
  return regex;
}

// ============================================
// Path Pattern Cache
// ============================================

const pathPatternCache = new Map<string, RegExp>();

/**
 * Compile glob pattern to regex with caching
 */
export function compilePathPattern(pattern: string): RegExp {
  let compiled = pathPatternCache.get(pattern);
  
  if (!compiled) {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except * and ?
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    compiled = new RegExp(`^${regexPattern}$`);
    
    if (pathPatternCache.size >= MAX_REGEX_CACHE_SIZE) {
      const firstKey = pathPatternCache.keys().next().value as string;
      if (firstKey) pathPatternCache.delete(firstKey);
    }
    
    pathPatternCache.set(pattern, compiled);
  }
  
  return compiled;
}

/**
 * Optimized path matching with caching
 */
export function matchPathOptimized(path: string, pattern: string): boolean {
  // Fast path for exact matches
  if (path === pattern) return true;
  
  // Fast path for simple wildcards
  if (pattern === '*') return true;
  if (pattern.endsWith('.*') && path.startsWith(pattern.slice(0, -2))) return true;
  
  // Use cached regex
  const regex = compilePathPattern(pattern);
  return regex.test(path);
}

// ============================================
// String Building Optimization
// ============================================

/**
 * Optimized path building with string array join
 */
export function buildPathOptimized(
  parts: string[],
  separator: string = '.',
  arrayNotation: 'brackets' | 'underscore' | 'none' = 'brackets'
): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  
  // Pre-allocate array for better performance
  const result: string[] = new Array(parts.length);
  result[0] = parts[0]!;
  
  // Number regex check cache
  const isNumber = /^\d+$/;
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    
    if (isNumber.test(part)) {
      if (arrayNotation === 'brackets') {
        result[i] = `[${part}]`;
      } else if (arrayNotation === 'underscore') {
        result[i] = `${separator}_${part}`;
      } else {
        result[i] = `${separator}${part}`;
      }
    } else {
      result[i] = `${separator}${part}`;
    }
  }
  
  return result.join('');
}

// ============================================
// Object Pool for Reusable Objects
// ============================================

class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(factory: () => T, reset: (obj: T) => void, maxSize: number = 100) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  acquire(): T {
    return this.pool.pop() || this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool = [];
  }
}

// Pool for Set objects used in circular detection
const setPool = new ObjectPool<Set<any>>(
  () => new Set(),
  (set) => set.clear(),
  50
);

// Pool for Map objects
const mapPool = new ObjectPool<Map<string, any>>(
  () => new Map(),
  (map) => map.clear(),
  50
);

export { setPool, mapPool, ObjectPool };

// ============================================
// Fast Type Checking
// ============================================

/**
 * Optimized type checks using typeof with minimal branching
 */
export const fastTypeCheck = {
  isString: (v: any): v is string => typeof v === 'string',
  isNumber: (v: any): v is number => typeof v === 'number',
  isBoolean: (v: any): v is boolean => typeof v === 'boolean',
  isObject: (v: any): v is object => v !== null && typeof v === 'object',
  isArray: Array.isArray, // Native is fastest
  isDate: (v: any): v is Date => v instanceof Date,
  isNull: (v: any): v is null => v === null,
  isUndefined: (v: any): v is undefined => v === undefined,
  isNullish: (v: any): v is null | undefined => v == null,
};

// ============================================
// Optimized CSV Escaping
// ============================================

const NEEDS_QUOTING_REGEX = /[",\n\r]/;

/**
 * Fast CSV field escaping with minimal allocations
 */
export function escapeCSVFieldOptimized(
  value: string,
  delimiter: string = ',',
  quote: string = '"',
  alwaysQuote: boolean = false
): string {
  if (!value) return alwaysQuote ? quote + quote : '';
  
  // Fast path: no special characters
  if (!alwaysQuote && delimiter === ',' && quote === '"') {
    if (!NEEDS_QUOTING_REGEX.test(value)) {
      return value;
    }
  }
  
  // Check if quoting needed
  const needsQuoting = alwaysQuote ||
    value.includes(delimiter) ||
    value.includes(quote) ||
    value.includes('\n') ||
    value.includes('\r');

  if (!needsQuoting) return value;
  
  // Escape quotes - use replaceAll if available (faster)
  const escaped = quote === '"' 
    ? value.replace(/"/g, '""')
    : value.replace(new RegExp(quote, 'g'), quote + quote);
  
  return quote + escaped + quote;
}

// ============================================
// Batch Processing Utilities
// ============================================

/**
 * Process items in optimized batches
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, Math.min(i + batchSize, items.length));
    const batchResults = await processor(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Synchronous batch processing
 */
export function processBatchSync<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => R[]
): R[] {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, Math.min(i + batchSize, items.length));
    const batchResults = processor(batch);
    results.push(...batchResults);
  }
  
  return results;
}

// ============================================
// Memoization Utilities
// ============================================

/**
 * Simple memoization with LRU eviction
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: { maxSize?: number; keyFn?: (...args: Parameters<T>) => string } = {}
): T {
  const cache = new Map<string, ReturnType<T>>();
  const maxSize = options.maxSize || 1000;
  const keyFn = options.keyFn || ((...args: any[]) => JSON.stringify(args));
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    
    // LRU eviction
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value as string;
      if (firstKey) cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  }) as T;
}

// ============================================
// String Builder for Large Outputs
// ============================================

/**
 * Efficient string builder for constructing large CSV strings
 */
export class StringBuilder {
  private chunks: string[] = [];
  private size: number = 0;

  append(str: string): this {
    this.chunks.push(str);
    this.size += str.length;
    return this;
  }

  appendLine(str: string, eol: string = '\n'): this {
    this.chunks.push(str);
    this.chunks.push(eol);
    this.size += str.length + eol.length;
    return this;
  }

  toString(): string {
    return this.chunks.join('');
  }

  clear(): void {
    this.chunks = [];
    this.size = 0;
  }

  getSize(): number {
    return this.size;
  }
}

// ============================================
// Optimized Array Operations
// ============================================

/**
 * Fast array deduplication
 */
export function deduplicateArray<T>(arr: T[], keyFn?: (item: T) => string): T[] {
  if (!keyFn) {
    return Array.from(new Set(arr));
  }
  
  const seen = new Set<string>();
  const result: T[] = [];
  
  for (const item of arr) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Fast array grouping
 */
export function groupBy<T>(
  arr: T[],
  keyFn: (item: T) => string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  for (const item of arr) {
    const key = keyFn(item);
    const group = groups.get(key);
    
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  
  return groups;
}

// ============================================
// Performance Monitoring
// ============================================

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  itemsProcessed: number;
  throughput: number;
  memoryUsed?: number;
}

/**
 * Measure performance of a function
 */
export function measurePerformance<T>(
  operation: string,
  fn: () => T,
  itemCount: number = 0
): { result: T; metrics: PerformanceMetrics } {
  const startMemory = process.memoryUsage?.()?.heapUsed || 0;
  const startTime = performance.now();
  
  const result = fn();
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage?.()?.heapUsed || 0;
  
  const duration = endTime - startTime;
  const memoryUsed = endMemory - startMemory;
  
  return {
    result,
    metrics: {
      operation,
      duration,
      itemsProcessed: itemCount,
      throughput: itemCount > 0 ? itemCount / (duration / 1000) : 0,
      memoryUsed,
    },
  };
}

/**
 * Async performance measurement
 */
export async function measurePerformanceAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  itemCount: number = 0
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  const startMemory = process.memoryUsage?.()?.heapUsed || 0;
  const startTime = performance.now();
  
  const result = await fn();
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage?.()?.heapUsed || 0;
  
  const duration = endTime - startTime;
  const memoryUsed = endMemory - startMemory;
  
  return {
    result,
    metrics: {
      operation,
      duration,
      itemsProcessed: itemCount,
      throughput: itemCount > 0 ? itemCount / (duration / 1000) : 0,
      memoryUsed,
    },
  };
}

// ============================================
// Memory Management
// ============================================

/**
 * Clear all optimization caches
 */
export function clearOptimizationCaches(): void {
  regexCache.clear();
  pathPatternCache.clear();
  setPool.clear();
  mapPool.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  regexCache: number;
  pathPatternCache: number;
} {
  return {
    regexCache: regexCache.size,
    pathPatternCache: pathPatternCache.size,
  };
}

export default {
  getCachedRegex,
  compilePathPattern,
  matchPathOptimized,
  buildPathOptimized,
  setPool,
  mapPool,
  ObjectPool,
  fastTypeCheck,
  escapeCSVFieldOptimized,
  processBatch,
  processBatchSync,
  memoize,
  StringBuilder,
  deduplicateArray,
  groupBy,
  measurePerformance,
  measurePerformanceAsync,
  clearOptimizationCaches,
  getCacheStats,
};
