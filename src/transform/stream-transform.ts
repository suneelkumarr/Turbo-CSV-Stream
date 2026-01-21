/**
 * Stream Transform Module
 * 
 * A transformation framework for CSV data implementing the Node.js stream.Transform API.
 * Works nicely with csv-generate, csv-parse, and csv-stringify.
 * 
 * Features:
 * - Follow the Node.js streaming API
 * - Chainable transform operations
 * - Built-in common transformations
 * - Async/await support
 * - Error handling with skip/recover options
 */

import { Transform, TransformCallback, TransformOptions, Readable, Writable } from 'stream';
import type { CSVRow } from '../types';

// ============================================
// Types
// ============================================

export type TransformFunction<TInput = CSVRow, TOutput = CSVRow> = 
  (record: TInput, index: number) => TOutput | null | Promise<TOutput | null>;

export type FilterFunction<T = CSVRow> = 
  (record: T, index: number) => boolean | Promise<boolean>;

export type MapFunction<TInput = CSVRow, TOutput = CSVRow> = 
  (record: TInput, index: number) => TOutput | Promise<TOutput>;

export type ReduceFunction<T = CSVRow, TAcc = any> = 
  (accumulator: TAcc, record: T, index: number) => TAcc | Promise<TAcc>;

export interface StreamTransformOptions extends TransformOptions {
  /** Handler for errors: 'throw' | 'skip' | 'emit' */
  onError?: 'throw' | 'skip' | 'emit';
  /** Whether to run transforms in parallel */
  parallel?: boolean;
  /** Maximum concurrent transforms when parallel is true */
  concurrency?: number;
  /** Whether to consume the stream automatically */
  consume?: boolean;
}

// ============================================
// Stream Transform Class
// ============================================

export class StreamTransform<TInput = CSVRow, TOutput = CSVRow> extends Transform {
  private transformFn: TransformFunction<TInput, TOutput>;
  private index: number = 0;
  private onErrorMode: 'throw' | 'skip' | 'emit';

  constructor(
    transformFn: TransformFunction<TInput, TOutput>,
    options: StreamTransformOptions = {}
  ) {
    super({ objectMode: true, ...options });
    this.transformFn = transformFn;
    this.onErrorMode = options.onError || 'throw';
  }

  async _transform(
    chunk: TInput,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ): Promise<void> {
    try {
      const result = await this.transformFn(chunk, this.index++);
      if (result !== null) {
        callback(null, result);
      } else {
        callback();
      }
    } catch (error) {
      if (this.onErrorMode === 'skip') {
        callback();
      } else if (this.onErrorMode === 'emit') {
        this.emit('transform-error', error, chunk, this.index - 1);
        callback();
      } else {
        callback(error as Error);
      }
    }
  }
}

// ============================================
// Specialized Transform Streams
// ============================================

/**
 * Filter stream - only passes records that match the predicate
 */
export class FilterStream<T = CSVRow> extends Transform {
  private filterFn: FilterFunction<T>;
  private index: number = 0;

  constructor(filterFn: FilterFunction<T>, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.filterFn = filterFn;
  }

  async _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): Promise<void> {
    try {
      const pass = await this.filterFn(chunk, this.index++);
      if (pass) {
        callback(null, chunk);
      } else {
        callback();
      }
    } catch (error) {
      callback(error as Error);
    }
  }
}

/**
 * Map stream - transforms each record
 */
export class MapStream<TInput = CSVRow, TOutput = CSVRow> extends Transform {
  private mapFn: MapFunction<TInput, TOutput>;
  private index: number = 0;

  constructor(mapFn: MapFunction<TInput, TOutput>, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.mapFn = mapFn;
  }

  async _transform(chunk: TInput, _encoding: BufferEncoding, callback: TransformCallback): Promise<void> {
    try {
      const result = await this.mapFn(chunk, this.index++);
      callback(null, result);
    } catch (error) {
      callback(error as Error);
    }
  }
}

/**
 * Reduce stream - accumulates values and emits final result
 */
export class ReduceStream<T = CSVRow, TAcc = any> extends Transform {
  private reduceFn: ReduceFunction<T, TAcc>;
  private accumulator: TAcc;
  private index: number = 0;

  constructor(reduceFn: ReduceFunction<T, TAcc>, initialValue: TAcc, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.reduceFn = reduceFn;
    this.accumulator = initialValue;
  }

  async _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): Promise<void> {
    try {
      this.accumulator = await this.reduceFn(this.accumulator, chunk, this.index++);
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    callback(null, this.accumulator);
  }
}

/**
 * Batch stream - groups records into batches
 */
export class BatchStream<T = CSVRow> extends Transform {
  private batchSize: number;
  private batch: T[] = [];

  constructor(batchSize: number, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.batchSize = batchSize;
  }

  _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.batch.push(chunk);
    if (this.batch.length >= this.batchSize) {
      const batch = this.batch;
      this.batch = [];
      callback(null, batch);
    } else {
      callback();
    }
  }

  _flush(callback: TransformCallback): void {
    if (this.batch.length > 0) {
      callback(null, this.batch);
    } else {
      callback();
    }
  }
}

/**
 * Flatten stream - flattens arrays/batches into individual records
 */
export class FlattenStream<T = CSVRow> extends Transform {
  constructor(options?: TransformOptions) {
    super({ objectMode: true, ...options });
  }

  _transform(chunk: T | T[], _encoding: BufferEncoding, callback: TransformCallback): void {
    if (Array.isArray(chunk)) {
      for (const item of chunk) {
        this.push(item);
      }
      callback();
    } else {
      callback(null, chunk);
    }
  }
}

/**
 * Take stream - only passes the first N records
 */
export class TakeStream<T = CSVRow> extends Transform {
  private count: number;
  private taken: number = 0;

  constructor(count: number, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.count = count;
  }

  _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.taken < this.count) {
      this.taken++;
      callback(null, chunk);
    } else {
      callback();
      this.push(null); // End the stream
    }
  }
}

/**
 * Skip stream - skips the first N records
 */
export class SkipStream<T = CSVRow> extends Transform {
  private count: number;
  private skipped: number = 0;

  constructor(count: number, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.count = count;
  }

  _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.skipped < this.count) {
      this.skipped++;
      callback();
    } else {
      callback(null, chunk);
    }
  }
}

/**
 * Unique stream - removes duplicate records based on a key
 */
export class UniqueStream<T = CSVRow> extends Transform {
  private keyFn: (record: T) => string;
  private seen: Set<string> = new Set();

  constructor(keyFn: (record: T) => string, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.keyFn = keyFn;
  }

  _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): void {
    const key = this.keyFn(chunk);
    if (!this.seen.has(key)) {
      this.seen.add(key);
      callback(null, chunk);
    } else {
      callback();
    }
  }
}

/**
 * Sort stream - collects all records and sorts them (use with caution on large datasets)
 */
export class SortStream<T = CSVRow> extends Transform {
  private compareFn: (a: T, b: T) => number;
  private records: T[] = [];

  constructor(compareFn: (a: T, b: T) => number, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.compareFn = compareFn;
  }

  _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.records.push(chunk);
    callback();
  }

  _flush(callback: TransformCallback): void {
    this.records.sort(this.compareFn);
    for (const record of this.records) {
      this.push(record);
    }
    callback();
  }
}

/**
 * Tap stream - allows side effects without modifying the stream
 */
export class TapStream<T = CSVRow> extends Transform {
  private tapFn: (record: T, index: number) => void | Promise<void>;
  private index: number = 0;

  constructor(tapFn: (record: T, index: number) => void | Promise<void>, options?: TransformOptions) {
    super({ objectMode: true, ...options });
    this.tapFn = tapFn;
  }

  async _transform(chunk: T, _encoding: BufferEncoding, callback: TransformCallback): Promise<void> {
    try {
      await this.tapFn(chunk, this.index++);
      callback(null, chunk);
    } catch (error) {
      callback(error as Error);
    }
  }
}

// ============================================
// Pipeline Builder
// ============================================

export class TransformPipeline<TInput = CSVRow, TOutput = CSVRow> {
  private transforms: Transform[] = [];

  /**
   * Add a custom transform
   */
  pipe<TNext>(transform: Transform): TransformPipeline<TInput, TNext> {
    this.transforms.push(transform);
    return this as unknown as TransformPipeline<TInput, TNext>;
  }

  /**
   * Filter records
   */
  filter(fn: FilterFunction<TOutput>): TransformPipeline<TInput, TOutput> {
    return this.pipe(new FilterStream(fn as FilterFunction));
  }

  /**
   * Map/transform records
   */
  map<TNext>(fn: MapFunction<TOutput, TNext>): TransformPipeline<TInput, TNext> {
    return this.pipe(new MapStream(fn as unknown as MapFunction));
  }

  /**
   * Take first N records
   */
  take(count: number): TransformPipeline<TInput, TOutput> {
    return this.pipe(new TakeStream(count));
  }

  /**
   * Skip first N records
   */
  skip(count: number): TransformPipeline<TInput, TOutput> {
    return this.pipe(new SkipStream(count));
  }

  /**
   * Batch records
   */
  batch(size: number): TransformPipeline<TInput, TOutput[]> {
    return this.pipe(new BatchStream(size)) as unknown as TransformPipeline<TInput, TOutput[]>;
  }

  /**
   * Flatten batched records
   */
  flatten(): TransformPipeline<TInput, TOutput extends (infer U)[] ? U : TOutput> {
    return this.pipe(new FlattenStream()) as any;
  }

  /**
   * Remove duplicates
   */
  unique(keyFn: (record: TOutput) => string): TransformPipeline<TInput, TOutput> {
    return this.pipe(new UniqueStream(keyFn as (record: CSVRow) => string));
  }

  /**
   * Tap into the stream for side effects
   */
  tap(fn: (record: TOutput, index: number) => void | Promise<void>): TransformPipeline<TInput, TOutput> {
    return this.pipe(new TapStream(fn as (record: CSVRow, index: number) => void));
  }

  /**
   * Build the pipeline and return connected stream
   */
  build(source: Readable): Readable {
    let current: Readable = source;
    for (const transform of this.transforms) {
      current = current.pipe(transform);
    }
    return current;
  }

  /**
   * Execute pipeline and collect results
   */
  async collect(source: Readable): Promise<TOutput[]> {
    const results: TOutput[] = [];
    const stream = this.build(source);

    return new Promise((resolve, reject) => {
      stream.on('data', (data: TOutput) => results.push(data));
      stream.on('end', () => resolve(results));
      stream.on('error', reject);
    });
  }

  /**
   * Execute pipeline and pipe to destination
   */
  async execute(source: Readable, destination?: Writable): Promise<void> {
    const stream = this.build(source);

    return new Promise((resolve, reject) => {
      if (destination) {
        stream.pipe(destination);
        destination.on('finish', resolve);
        destination.on('error', reject);
      } else {
        stream.on('data', () => {}); // Consume
        stream.on('end', resolve);
        stream.on('error', reject);
      }
    });
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Create a transform stream
 */
export function transform<TInput = CSVRow, TOutput = CSVRow>(
  fn: TransformFunction<TInput, TOutput>,
  options?: StreamTransformOptions
): StreamTransform<TInput, TOutput> {
  return new StreamTransform(fn, options);
}

/**
 * Create a filter stream
 */
export function filter<T = CSVRow>(
  fn: FilterFunction<T>,
  options?: TransformOptions
): FilterStream<T> {
  return new FilterStream(fn, options);
}

/**
 * Create a map stream
 */
export function map<TInput = CSVRow, TOutput = CSVRow>(
  fn: MapFunction<TInput, TOutput>,
  options?: TransformOptions
): MapStream<TInput, TOutput> {
  return new MapStream(fn, options);
}

/**
 * Create a batch stream
 */
export function batch<T = CSVRow>(
  size: number,
  options?: TransformOptions
): BatchStream<T> {
  return new BatchStream(size, options);
}

/**
 * Create a pipeline builder
 */
export function pipeline<T = CSVRow>(): TransformPipeline<T, T> {
  return new TransformPipeline();
}

/**
 * Compose multiple transform functions into one
 */
export function compose<T = CSVRow>(
  ...fns: TransformFunction<T, T>[]
): TransformFunction<T, T> {
  return async (record: T, index: number): Promise<T | null> => {
    let current: T | null = record;
    for (const fn of fns) {
      if (current === null) return null;
      current = await fn(current, index);
    }
    return current;
  };
}

/**
 * Collect stream data into an array
 */
export async function collect<T = CSVRow>(stream: Readable): Promise<T[]> {
  const results: T[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (data: T) => results.push(data));
    stream.on('end', () => resolve(results));
    stream.on('error', reject);
  });
}

/**
 * Consume stream without collecting
 */
export async function consume(stream: Readable): Promise<number> {
  let count = 0;
  return new Promise((resolve, reject) => {
    stream.on('data', () => count++);
    stream.on('end', () => resolve(count));
    stream.on('error', reject);
  });
}

export default StreamTransform;
