import { Transform, Readable, type TransformCallback } from 'stream';
import { CSVLexer } from './lexer';
import { TypeDetector } from '../utils/type-detector';
import { SchemaValidator } from '../schema/validator';
import {
  ParseError,
  type StreamOptions,
  type CSVRow,
  type ParseMeta,
  type ProgressInfo,
  type ParserEvents,
  type Primitive,
} from '../types';

export interface StreamingParserEvents extends ParserEvents {
  readable: () => void;
  close: () => void;
  drain: () => void;
}

/**
 * High-performance streaming CSV parser
 * Memory-efficient for large files
 */
export class CSVParseStream extends Transform {
  private options: StreamOptions;
  private buffer: string = '';
  private lexer: CSVLexer;
  private typeDetector: TypeDetector;
  private schemaValidator?: SchemaValidator;
  private headers: string[] = [];
  private headersParsed: boolean = false;
  private errors: ParseError[] = [];
  private rowCount: number = 0;
  private bytesProcessed: number = 0;
  private startTime: number = 0;
  private totalBytes?: number;
  private aborted: boolean = false;

  constructor(options: StreamOptions = {}) {
    super({
      objectMode: options.objectMode !== false,
      highWaterMark: options.highWaterMark ?? 16,
    });

    this.options = {
      delimiter: ',',
      quote: '"',
      escape: '"',
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      encoding: 'utf-8',
      onError: 'skip',
      maxErrors: 100,
      ...options,
    };

    this.lexer = new CSVLexer(this.options);
    this.typeDetector = new TypeDetector({
      ...(this.options.nullValues && { nullValues: this.options.nullValues }),
      ...(this.options.booleanValues && { booleanValues: this.options.booleanValues }),
    });

    if (this.options.schema) {
      this.schemaValidator = new SchemaValidator(this.options.schema);
    }

    // Handle abort signal
    if (this.options.signal) {
      this.options.signal.addEventListener('abort', () => {
        this.aborted = true;
        this.destroy(new Error('Parsing aborted'));
      });
    }
  }

  /**
   * Set total bytes for progress calculation
   */
  setTotalBytes(bytes: number): void {
    this.totalBytes = bytes;
  }

  _transform(chunk: Buffer | string, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (this.aborted) {
      callback();
      return;
    }

    if (this.startTime === 0) {
      this.startTime = performance.now();
    }

    try {
      // Convert chunk to string
      const str = Buffer.isBuffer(chunk) ? chunk.toString(this.options.encoding) : chunk;
      this.bytesProcessed += Buffer.byteLength(str);
      
      // Append to buffer
      this.buffer += str;
      
      // Process complete rows
      this.processBuffer();
      
      // Emit progress
      this.emitProgress();
      
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    try {
      // Process remaining buffer
      if (this.buffer.length > 0) {
        this.lexer.init(this.buffer);
        this.parseRemainingRows();
      }

      // Emit end event with meta
      const meta = this.getMeta();
      this.emit('end', meta);
      
      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  private processBuffer(): void {
    // Find last complete row (last newline)
    let lastNewline = -1;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const char = this.buffer.charCodeAt(i);
      if (char === 10 || char === 13) {
        lastNewline = i;
        break;
      }
    }

    if (lastNewline === -1) {
      // No complete row yet
      return;
    }

    // Extract complete rows
    const complete = this.buffer.slice(0, lastNewline + 1);
    this.buffer = this.buffer.slice(lastNewline + 1);

    // Parse complete rows
    this.lexer.init(complete);
    
    // Parse header if needed
    if (!this.headersParsed && this.options.header === true) {
      this.parseStreamHeader();
    }

    // Parse data rows
    this.parseDataRows();
  }

  private parseStreamHeader(): void {
    const fields = this.lexer.parseRow();
    
    if (!fields) return;

    this.headers = fields.map((h, i) => {
      const header = h.trim() || `column_${i}`;
      return this.options.renameHeaders?.[header] ?? header;
    });

    if (typeof this.options.columns === 'function') {
      this.headers = this.options.columns(this.headers);
    }

    this.headersParsed = true;
    this.emit('header', this.headers);
  }

  private parseDataRows(): void {
    const skipLines = this.options.skipLines ?? 0;
    const fromLine = this.options.fromLine ?? 0;
    const toLine = this.options.toLine ?? Infinity;
    const maxRows = this.options.maxRows ?? Infinity;

    while (this.rowCount < maxRows) {
      const fields = this.lexer.parseRow();
      
      if (fields === null) break;

      const lineNumber = this.rowCount + skipLines + (this.headersParsed ? 1 : 0);

      // Skip lines outside range
      if (lineNumber < fromLine) continue;
      if (lineNumber > toLine) break;

      // Skip empty lines
      if (this.options.skipEmptyLines && this.isEmptyRow(fields)) {
        continue;
      }

      try {
        const row = this.processRow(fields, lineNumber);
        
        if (row === null) continue;

        // Apply filter
        if (this.options.filter && !this.options.filter(row, this.rowCount)) {
          continue;
        }

        // Apply transform
        const transformedRow = this.options.transform
          ? this.options.transform(row, this.rowCount)
          : row;

        if (transformedRow !== null) {
          this.push(transformedRow);
          this.emit('data', transformedRow, this.rowCount);
          this.rowCount++;
        }
      } catch (error) {
        this.handleError(error as ParseError, lineNumber);
      }
    }
  }

  private parseRemainingRows(): void {
    if (!this.headersParsed && this.options.header === true) {
      this.parseStreamHeader();
    }
    this.parseDataRows();
  }

  private processRow(fields: string[], lineNumber: number): CSVRow | null {
    // Handle missing headers
    if (this.headers.length === 0) {
      if (Array.isArray(this.options.header)) {
        this.headers = this.options.header;
      } else if (Array.isArray(this.options.columns)) {
        this.headers = this.options.columns;
      } else {
        this.headers = fields.map((_, i) => `column_${i}`);
      }
      this.headersParsed = true;
      this.emit('header', this.headers);
    }

    // Validate column count
    if (!this.options.relaxColumnCount && this.headers.length > 0) {
      if (fields.length !== this.headers.length) {
        throw new ParseError(
          `Expected ${this.headers.length} columns but found ${fields.length}`,
          'COLUMN_MISMATCH',
          lineNumber,
          1,
          this.rowCount
        );
      }
    }

    const row: CSVRow = {};

    for (let i = 0; i < fields.length; i++) {
      const header = this.headers[i] ?? `column_${i}`;
      const rawValue = fields[i] ?? '';
      const finalHeader = this.options.renameHeaders?.[header] ?? header;

      let value: Primitive = rawValue;

      if (this.options.cast) {
        value = this.options.cast(rawValue, {
          column: i,
          header: finalHeader,
          index: i,
          lines: lineNumber,
          quoting: false,
        });
      } else if (this.shouldConvertType(finalHeader)) {
        value = this.typeDetector.autoConvert(rawValue);
      }

      row[finalHeader] = value;
    }

    // Schema validation
    if (this.schemaValidator) {
      const result = this.schemaValidator.validate(row);
      if (!result.valid) {
        throw new ParseError(
          result.errors.join('; '),
          'VALIDATION_ERROR',
          lineNumber,
          1,
          this.rowCount
        );
      }
      return result.data as CSVRow;
    }

    return row;
  }

  private isEmptyRow(fields: string[]): boolean {
    return fields.every(f => f.trim() === '');
  }

  private shouldConvertType(header: string): boolean {
    const dt = this.options.dynamicTyping;
    if (typeof dt === 'boolean') return dt;
    if (Array.isArray(dt)) return dt.includes(header);
    if (typeof dt === 'function') return dt(header);
    return false;
  }

  private handleError(error: ParseError, _lineNumber: number): void {
    error.row = this.rowCount;
    this.errors.push(error);
    this.emit('error', error);

    if (this.errors.length >= (this.options.maxErrors ?? 100)) {
      this.destroy(new Error('Maximum error count exceeded'));
    }

    if (this.options.onError === 'throw') {
      throw error;
    }
  }

  private emitProgress(): void {
    const elapsed = performance.now() - this.startTime;
    const rowsPerSecond = this.rowCount / (elapsed / 1000);

    const progress: ProgressInfo = {
      rowsProcessed: this.rowCount,
      bytesProcessed: this.bytesProcessed,
      rowsPerSecond,
    };

    if (this.totalBytes) {
      progress.totalBytes = this.totalBytes;
      progress.percentage = (this.bytesProcessed / this.totalBytes) * 100;
      progress.estimatedTimeRemaining = 
        ((this.totalBytes - this.bytesProcessed) / this.bytesProcessed) * elapsed;
    }

    this.emit('progress', progress);
  }

  private getMeta(): ParseMeta {
    return {
      delimiter: this.options.delimiter ?? ',',
      linebreak: '\n',
      headers: this.headers,
      rowCount: this.rowCount,
      columnCount: this.headers.length,
      truncated: false,
      encoding: this.options.encoding ?? 'utf-8',
      parseTime: performance.now() - this.startTime,
      bytesProcessed: this.bytesProcessed,
    };
  }

  /**
   * Get headers (may be empty until first row is parsed)
   */
  getHeaders(): string[] {
    return [...this.headers];
  }

  /**
   * Get errors
   */
  getErrors(): ParseError[] {
    return [...this.errors];
  }

  /**
   * Get current row count
   */
  getRowCount(): number {
    return this.rowCount;
  }
}

/**
 * Create a streaming parser
 */
export function createParseStream(
  options?: StreamOptions
): CSVParseStream {
  return new CSVParseStream(options);
}

/**
 * Parse a readable stream
 */
export async function parseStream(
  input: Readable,
  options?: StreamOptions
): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const parser = new CSVParseStream(options);
    const data: CSVRow[] = [];

    parser.on('data', (row: CSVRow) => data.push(row));
    parser.on('error', (error: ParseError) => reject(error));
    parser.on('end', () => resolve(data));

    input.pipe(parser);
  });
}