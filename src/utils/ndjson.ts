import { Transform, TransformCallback, Readable, Writable } from 'stream';

/**
 * NDJSON (Newline Delimited JSON) Parser and Stringifier
 * 
 * Features:
 * - Stream-based parsing and stringification
 * - Handles incomplete lines across chunks
 * - Configurable error handling
 * - High performance with minimal memory footprint
 */

export interface NDJSONParseOptions {
  /** How to handle parse errors: 'throw', 'skip', or 'emit' */
  onError?: 'throw' | 'skip' | 'emit';
  /** Custom reviver function for JSON.parse */
  reviver?: (key: string, value: any) => any;
  /** Skip empty lines */
  skipEmpty?: boolean;
}

export interface NDJSONStringifyOptions {
  /** End-of-line character(s) */
  eol?: string;
  /** Custom replacer function for JSON.stringify */
  replacer?: (key: string, value: any) => any;
  /** Number of spaces for indentation (0 = no formatting) */
  space?: number;
}

/**
 * Parse a single NDJSON line
 */
export function parseNDJSONLine<T = any>(
  line: string,
  reviver?: (key: string, value: any) => any
): T {
  return JSON.parse(line, reviver);
}

/**
 * Stringify a value to NDJSON format (single line)
 */
export function stringifyNDJSONLine(
  value: any,
  replacer?: (key: string, value: any) => any,
  space?: number
): string {
  const json = JSON.stringify(value, replacer, space);
  // If formatted with spaces, collapse to single line
  if (space && space > 0) {
    return json.replace(/\n\s*/g, ' ');
  }
  return json;
}

/**
 * Parse an entire NDJSON string into an array of objects
 */
export function parseNDJSON<T = any>(
  input: string,
  options: NDJSONParseOptions = {}
): T[] {
  const { reviver, skipEmpty = true, onError = 'throw' } = options;
  const lines = input.split(/\r?\n/);
  const results: T[] = [];
  const errors: Error[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    
    if (!line) {
      if (skipEmpty) continue;
      if (onError === 'throw') {
        throw new Error(`Empty line at line ${i + 1}`);
      }
      continue;
    }

    try {
      results.push(JSON.parse(line, reviver));
    } catch (err) {
      const error = new Error(`Invalid JSON at line ${i + 1}: ${(err as Error).message}`);
      
      if (onError === 'throw') {
        throw error;
      } else if (onError === 'emit') {
        errors.push(error);
      }
      // 'skip' - just continue
    }
  }

  return results;
}

/**
 * Stringify an array of objects to NDJSON format
 */
export function stringifyNDJSON(
  data: any[],
  options: NDJSONStringifyOptions = {}
): string {
  const { eol = '\n', replacer, space } = options;
  
  return data
    .map(item => stringifyNDJSONLine(item, replacer, space))
    .join(eol) + eol;
}

/**
 * Transform stream that parses NDJSON
 */
export class NDJSONParseStream extends Transform {
  private buffer: string = '';
  private lineNumber: number = 0;
  private readonly options: NDJSONParseOptions;

  constructor(options: NDJSONParseOptions = {}) {
    super({ objectMode: true });
    this.options = {
      onError: 'throw',
      skipEmpty: true,
      ...options,
    };
  }

  _transform(chunk: Buffer | string, _encoding: string, callback: TransformCallback): void {
    const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    this.buffer += str;

    const lines = this.buffer.split(/\r?\n/);
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.lineNumber++;
      this.parseLine(line);
    }

    callback();
  }

  _flush(callback: TransformCallback): void {
    // Process any remaining content in buffer
    if (this.buffer.trim()) {
      this.lineNumber++;
      this.parseLine(this.buffer);
    }
    callback();
  }

  private parseLine(line: string): void {
    const trimmed = line.trim();
    
    if (!trimmed) {
      if (!this.options.skipEmpty) {
        this.handleError(new Error(`Empty line at line ${this.lineNumber}`));
      }
      return;
    }

    try {
      const parsed = JSON.parse(trimmed, this.options.reviver);
      this.push(parsed);
    } catch (err) {
      this.handleError(
        new Error(`Invalid JSON at line ${this.lineNumber}: ${(err as Error).message}`)
      );
    }
  }

  private handleError(error: Error): void {
    switch (this.options.onError) {
      case 'throw':
        this.destroy(error);
        break;
      case 'emit':
        this.emit('parseError', error);
        break;
      case 'skip':
      default:
        // Silently skip
        break;
    }
  }
}

/**
 * Transform stream that stringifies objects to NDJSON
 */
export class NDJSONStringifyStream extends Transform {
  private readonly options: NDJSONStringifyOptions;

  constructor(options: NDJSONStringifyOptions = {}) {
    super({ objectMode: true });
    this.options = {
      eol: '\n',
      ...options,
    };
  }

  _transform(chunk: any, _encoding: string, callback: TransformCallback): void {
    try {
      const line = stringifyNDJSONLine(chunk, this.options.replacer, this.options.space);
      this.push(line + this.options.eol);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

/**
 * Create a readable stream from an array of objects
 */
export function createNDJSONReadStream(data: any[], options: NDJSONStringifyOptions = {}): Readable {
  const { eol = '\n', replacer, space } = options;
  let index = 0;

  return new Readable({
    read() {
      if (index < data.length) {
        const line = stringifyNDJSONLine(data[index], replacer, space);
        this.push(line + eol);
        index++;
      } else {
        this.push(null);
      }
    },
  });
}

/**
 * Collect objects from an NDJSON stream into an array
 */
export async function collectNDJSON<T = any>(stream: Readable): Promise<T[]> {
  const results: T[] = [];
  
  for await (const item of stream) {
    results.push(item as T);
  }
  
  return results;
}

/**
 * Async generator for parsing NDJSON from a readable stream
 */
export async function* parseNDJSONStream<T = any>(
  stream: Readable,
  options: NDJSONParseOptions = {}
): AsyncGenerator<T> {
  const parser = new NDJSONParseStream(options);
  stream.pipe(parser);

  for await (const item of parser) {
    yield item as T;
  }
}

/**
 * Write NDJSON to a writable stream
 */
export function writeNDJSON(
  stream: Writable,
  data: any[],
  options: NDJSONStringifyOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { eol = '\n', replacer, space } = options;
    let index = 0;

    const write = () => {
      while (index < data.length) {
        const line = stringifyNDJSONLine(data[index], replacer, space) + eol;
        const canContinue = stream.write(line);
        index++;
        
        if (!canContinue) {
          stream.once('drain', write);
          return;
        }
      }
      resolve();
    };

    stream.on('error', reject);
    write();
  });
}
