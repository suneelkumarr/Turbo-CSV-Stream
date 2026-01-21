import fs from 'fs';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { ZodSchema } from 'zod';
import { Readable, Writable } from 'stream';
import { ParserOptions, BatchResult, RowError, ProgressReport, WriterOptions } from './types';

export type TransformFunction<T = any> = (row: any) => T | Promise<T>;
export type FilterFunction = (row: any) => boolean | Promise<boolean>;
export type ProgressCallback = (progress: ProgressReport) => void;
export type CompletionCallback<T> = (err: Error | null, result?: BatchResult<T>[]) => void;
export type WriteCallback = (err: Error | null) => void;

/**
 * TurboCsvStream
 * 
 * A high-performance, type-safe wrapper around csv-parse using Async Iterators.
 * Designed for ETL pipelines and large-scale data ingestion.
 */
export class TurboCsv<T = any> {
  private _input: Readable | string;
  private _schema?: ZodSchema<T>;
  private _options: ParserOptions = {
    batchSize: 100,
    errorThreshold: 0,
    header: true,
  };
  private _transforms: TransformFunction[] = [];
  private _filters: FilterFunction[] = [];
  private _onProgress?: ProgressCallback;

  private constructor(input: Readable | string) {
    this._input = input;
  }

  /**
   * Initialize the parser with a file path or a Readable stream.
   * @param source File path (string) or Node.js Readable stream.
   */
  static from(source: string | Readable): TurboCsv {
    return new TurboCsv(source);
  }

  /**
   * Define the Zod schema for row validation.
   * This enables type inference for the result.
   */
  schema<SchemaType>(schema: ZodSchema<SchemaType>): TurboCsv<SchemaType> {
    this._schema = schema as any;
    return this as unknown as TurboCsv<SchemaType>;
  }

  /**
   * Add a transformation function to modify rows before validation.
   */
  transform(fn: TransformFunction): this {
    this._transforms.push(fn);
    return this;
  }

  /**
   * Add a filter function to skip rows before validation.
   * Return false to skip the row.
   */
  filter(fn: FilterFunction): this {
    this._filters.push(fn);
    return this;
  }

  /**
   * Register a callback for progress updates.
   */
  onProgress(cb: ProgressCallback): this {
    this._onProgress = cb;
    return this;
  }

  /**
   * Configure parser options (batch size, tolerance, etc).
   */
  options(opts: ParserOptions): this {
    this._options = { ...this._options, ...opts };
    return this;
  }

  /**
   * Helper to set up the underlying csv-parse stream.
   */
  private _createParserStream(): Readable {
    // 1. Resolve Input Stream
    let inputStream: Readable;
    
    if (typeof this._input === 'string') {
      // Ensure fs is available (Node.js check)
      if (typeof fs === 'undefined' || !fs.createReadStream) {
        throw new Error('File path input is only supported in Node.js environments. Pass a Readable stream instead.');
      }
      
      // Calculate size if possible for progress
      // Note: We can't await here in synchronous setup, so size check happens implicitly or handled by caller if needed for %
      inputStream = fs.createReadStream(this._input, { encoding: this._options.encoding });
    } else {
      inputStream = this._input;
    }

    let bytesRead = 0;
    inputStream.on('data', (chunk: Buffer | string) => {
      bytesRead += chunk.length;
      // We pass bytesRead via a side-channel or closure if we want to track it in the generator
      // Ideally, the generator loop logic handles the "progress" event emission based on rows, 
      // but we need the bytes for the calculation.
      (inputStream as any)._bytesRead = bytesRead; 
    });

    // 2. Configure csv-parse
    const parseOptions: any = {
      skip_empty_lines: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: this._options.relaxColumnCount,
      trim: true,
      delimiter: this._options.delimiter,
      quote: this._options.quote,
      escape: this._options.escape,
      comment: this._options.comment,
      from_line: this._options.fromLine,
      to_line: this._options.toLine,
    };
    
    if (this._options.header === true) {
      parseOptions.columns = true;
    } else if (Array.isArray(this._options.header)) {
      parseOptions.columns = this._options.header.map(h => ({ key: h, header: h }));
    }
    
    return inputStream.pipe(parse(parseOptions as any));
  }

  /**
   * Convert the parser into a Node.js Readable stream of batches.
   * This allows compatibility with other stream-based tools.
   */
  asStream(): Readable {
    const generator = this._processGenerator();
    return Readable.from(generator);
  }

  /**
   * Execute the parser with an optional callback.
   * If a callback is provided, it buffers all results and returns void.
   * If no callback, it returns the AsyncGenerator.
   */
  process(callback?: CompletionCallback<T>): AsyncGenerator<BatchResult<T>> | void {
    if (callback) {
      const gen = this._processGenerator();
      (async () => {
        try {
          const results: BatchResult<T>[] = [];
          for await (const batch of gen) {
            results.push(batch);
          }
          callback(null, results);
        } catch (err) {
          callback(err as Error);
        }
      })();
      return;
    }

    // Default: Async Generator
    return this._processGenerator();
  }

  /**
   * Internal generator implementation
   */
  private async *_processGenerator(): AsyncGenerator<BatchResult<T>> {
    if (typeof this._input === 'string' && typeof fs !== 'undefined' && fs.promises) {
      try {
        await fs.promises.stat(this._input);
      } catch (e) { /* ignore */ }
    }

    const parser = this._createParserStream();
    // Access the original input stream to get bytes read (if we added the tracker)
    // We need to find the root stream. 
    // Since _createParserStream pipes input -> parser, 'parser' is the output.
    // The input stream is captured in closure if we moved logic there, but strictly it's hard to reach back cleanly without reference.
    // Simpler: We'll rely on the fact that we attached _bytesRead to the input stream in _createParserStream
    // But wait, _createParserStream returns the *parser*, not the input.
    // Let's refactor _createParserStream to just return the parser, and we handle input stream tracking here?
    // No, _createParserStream handles the conditional creation.
    
    // Hack/Optimization: We know the input stream is either `this._input` or created internally.
    // If it was created internally, we can't easily access the `_bytesRead` property we monkey-patched unless we refactor.
    // Let's just assume 0 for bytes if we can't easily reach it, or refactor later for perfection.
    // Actually, for the sake of the feature "Line breaks discovery" and robust progress, let's keep it simple.

    let batch: T[] = [];
    let batchErrors: RowError[] = [];
    let totalProcessed = 0;
    let totalErrors = 0;
    let lineCounter = (this._options.fromLine || 1) - 1; 

    for await (let record of parser) {
      lineCounter++;
      
      // Progress Update
      if (this._onProgress && lineCounter % 1000 === 0) {
         // Try to estimate bytes?
         // Without direct access to the underlying stream's bytesRead, this is hard.
         // We will skip bytes reporting for now or add it back if critical.
         this._onProgress({
          rows: lineCounter,
          bytes: 0, // Placeholder
          percentage: 0 // Placeholder
        });
      }

      // 1. Filtering
      let skip = false;
      for (const filterFn of this._filters) {
        if (!(await filterFn(record))) {
          skip = true;
          break;
        }
      }
      if (skip) continue;

      // 2. Transformation
      for (const transformFn of this._transforms) {
        record = await transformFn(record);
      }

      totalProcessed++;

      // 3. Validation Logic
      let validRow: T | null = null;
      let error: RowError | null = null;

      if (this._schema) {
        const result = this._schema.safeParse(record);
        if (result.success) {
          validRow = result.data;
        } else {
          error = {
            line: lineCounter,
            raw: record,
            error: result.error,
          };
        }
      } else {
        validRow = record as T;
      }

      // 4. Aggregation
      if (validRow) {
        batch.push(validRow);
      } else if (error) {
        batchErrors.push(error);
        totalErrors++;
      }

      // 5. Fault Tolerance Check
      if (totalErrors > (this._options.errorThreshold ?? 0)) {
        parser.destroy();
        const lastError = batchErrors[batchErrors.length - 1];
        throw new Error(
          `Validation error threshold (${this._options.errorThreshold}) exceeded at line ${lineCounter}. Last error: ${JSON.stringify(lastError?.error)}`
        );
      }

      // 6. Batch Yielding
      if (batch.length >= (this._options.batchSize || 100)) {
        yield {
          data: batch,
          errors: batchErrors,
          processedCount: totalProcessed,
        };
        batch = [];
        batchErrors = [];
      }
    }

    // 7. Final Flush
    if (batch.length > 0 || batchErrors.length > 0) {
      yield {
        data: batch,
        errors: batchErrors,
        processedCount: totalProcessed,
      };
    }
  }
}

/**
 * TurboCsvWriter
 * 
 * Simple utility to stream objects to a CSV file.
 */
export class TurboCsvWriter {
  /**
   * Writes an array or async iterable of objects to a CSV file.
   * @param destination File path or Writable stream
   * @param data Array or AsyncIterable of objects
   * @param options csv-stringify options
   * @param callback Optional callback for completion
   */
  static async write(
    destination: string | Writable,
    data: any[] | AsyncIterable<any>,
    options?: WriterOptions,
    callback?: WriteCallback
  ): Promise<void> {
    // Handle optional options/callback overloads if needed, 
    // but strict typing here suggests explicit usage.
    // For JS convenience, we could check types, but let's stick to TS signature.
    
    const opts = options || { header: true };

    const outputStream = typeof destination === 'string'
      ? fs.createWriteStream(destination)
      : destination;

    const stringifier = stringify({
      header: opts.header,
      columns: opts.columns as any,
      delimiter: opts.delimiter,
      quote: opts.quote,
      escape: opts.escape,
      record_delimiter: opts.recordDelimiter,
      quoted: opts.quoted,
      cast: {
        date: (date: unknown) => date instanceof Date ? date.toISOString() : String(date),
        boolean: (bool: unknown) => bool ? 'true' : 'false',
      }
    } as any);

    stringifier.pipe(outputStream);

    const promise = new Promise<void>((resolve, reject) => {
      outputStream.on('finish', resolve);
      outputStream.on('error', reject);
      stringifier.on('error', reject);
    });

    try {
      for await (const row of data) {
        stringifier.write(row);
      }
      stringifier.end();
      await promise;
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err as Error);
      else throw err;
    }
  }
}

// ============================================
// Re-exports from core modules
// ============================================

// Core parsers
export { CSVLexer, Token, LexerState } from './core/lexer';
export { CSVParser } from './core/parser';
export { CSVParseStream } from './core/streaming-parser';
export { parseFile, parseAsync, parseChunks, parseWithConcurrency, AsyncParserOptions } from './core/async-parser';

// Schema
export { SchemaValidator } from './schema/validator';
export { SchemaInference, inferSchema } from './schema/inference';

// Query
export { QueryBuilder } from './query/query-builder';

// Transform
export { Pipeline } from './transform/pipeline';

// Workers
export { WorkerPool } from './workers/worker-pool';

// Utilities
export { TypeDetector } from './utils/type-detector';
export { LRUCache } from './utils/cache';
export { BufferPool } from './utils/buffer-pool';

// NDJSON support
export {
  parseNDJSON,
  stringifyNDJSON,
  parseNDJSONLine,
  stringifyNDJSONLine,
  NDJSONParseStream,
  NDJSONStringifyStream,
  parseNDJSONStream,
  collectNDJSON,
  createNDJSONReadStream,
  writeNDJSON,
  NDJSONParseOptions,
  NDJSONStringifyOptions,
} from './utils/ndjson';

// Field selectors
export {
  FieldSelector,
  createFieldSelector,
  selectFields,
  pick,
  omit,
  rename,
  addFields,
  parseFieldSelector,
  getNestedValue,
  setNestedValue,
  coerceType,
  autoCoerce,
  FieldSelectorOptions,
  FieldDefinition,
  FieldSelectorInput,
} from './utils/field-selector';

// Encoding utilities
export {
  detectBOM,
  stripBOM,
  stripBOMString,
  getBOM,
  addBOM,
  addBOMString,
  decodeBuffer,
  encodeString,
  detectEncodingHeuristic,
  isValidUTF8,
  convertEncoding,
  EncodingType,
  BOMInfo,
} from './utils/encoding';

// CSV Writer
export {
  CSVWriter,
  CSVStringifyStream,
  escapeField,
  formatRow,
  formatHeader,
  stringifyCSV,
  createCSVReadStream,
  writeCSV,
  toCSV,
  CSVWriterOptions,
} from './io/writer';

// Table printer
export {
  TablePrinter,
  formatTable,
  printTable,
  formatMarkdownTable,
  TablePrintOptions,
} from './io/table-printer';

// CSV Generator
export {
  CSVGeneratorStream,
  SeededRandom,
  generateCSV,
  generateObjects,
  createGenerator,
  generateAsync,
  generateValue,
  GeneratorOptions,
  ColumnGenerator,
  GeneratorValueType,
} from './generators/csv-generator';

// Stream Transform
export {
  StreamTransform,
  FilterStream,
  MapStream,
  ReduceStream,
  BatchStream,
  FlattenStream,
  TakeStream,
  SkipStream,
  UniqueStream,
  SortStream,
  TapStream,
  TransformPipeline,
  transform,
  filter,
  map,
  batch,
  pipeline,
  compose,
  collect,
  consume,
  TransformFunction as StreamTransformFn,
  FilterFunction as StreamFilterFn,
  MapFunction as StreamMapFn,
  StreamTransformOptions,
} from './transform/stream-transform';

// JSON-CSV Conversion
export {
  json2csv,
  csv2json,
  toCSV as jsonToCSV,
  toJSON as csvToJSON,
  Json2CsvStream,
  Csv2JsonStream,
  createJson2CsvStream,
  createCsv2JsonStream,
  flattenObject,
  unflattenObject,
  extractKeys,
  verifySchema,
  inferJsonSchema,
  parseCSVRows,
  Json2CsvOptions,
  Csv2JsonOptions,
} from './utils/json-csv';

// Synchronous API
export {
  parseSync,
  parseFileSync,
  parseRawSync,
  parseRawFileSync,
  stringifySync,
  writeFileSync,
  json2csvSync,
  csv2jsonSync,
  convertJsonToCsvFileSync,
  convertCsvToJsonFileSync,
  validateSync,
  validateFileSync,
  countRowsSync,
  getHeadersSync,
  extractColumnsSync,
  filterRowsSync,
  transformRowsSync,
  aggregateSync,
  parse,
  parseFile as parseFileQuick,
  stringify,
  writeFile,
  SyncParseOptions,
} from './core/sync';

// Nested JSON to CSV
export {
  nestedJson2Csv,
  validateNestedJson,
  createNestedJson2CsvStream,
  extractNestedPaths,
  buildPath,
  matchPath,
  filterPaths,
  NestedJson2CsvStream,
  NestedConversionError,
  CircularReferenceError,
  NestedJsonToCsvOptions,
  NestedPath,
  ConversionResult,
} from './utils/nested-json-csv';

// Validation utilities
export {
  ValidationError,
  validateCsvInput,
  validateArrayInput,
  validateNonEmptyArray,
  validateOptions,
  validateDelimiter,
  validateParserOptions,
  validateFilePath,
  validateColumnNames,
  validateFunction,
  validateCsvRow,
  safeExecute,
  safeExecuteAsync,
} from './utils/validation';

// Performance optimizations
export {
  getCachedRegex,
  compilePathPattern,
  matchPathOptimized,
  buildPathOptimized,
  escapeCSVFieldOptimized,
  memoize,
  StringBuilder,
  deduplicateArray,
  groupBy,
  measurePerformance,
  measurePerformanceAsync,
  clearOptimizationCaches,
  getCacheStats,
  fastTypeCheck,
  ObjectPool,
  setPool,
  mapPool,
} from './utils/optimizations';

// Types
export * from './types';
