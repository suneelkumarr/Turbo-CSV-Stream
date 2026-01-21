import { createReadStream, stat } from 'fs';
import { promisify } from 'util';
import { createParseStream } from './streaming-parser';
import {
  type StreamOptions,
  type CSVRow,
  type ParseResult,
  type ParseMeta,
  type ProgressInfo,
  type ParseError,
} from '../types';

const statAsync = promisify(stat);

export interface AsyncParserOptions extends StreamOptions {
  onProgress?: (progress: ProgressInfo) => void;
  onRow?: (row: CSVRow, index: number) => void | Promise<void>;
  concurrency?: number;
}

/**
 * Parse CSV file asynchronously
 */
export async function parseFile(
  filePath: string,
  options: AsyncParserOptions = {}
): Promise<ParseResult> {
  const stats = await statAsync(filePath);
  const data: CSVRow[] = [];
  const errors: ParseError[] = [];
  
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, {
      encoding: options.encoding ?? 'utf-8',
      highWaterMark: options.highWaterMark ?? 64 * 1024,
    });

    const parser = createParseStream(options);
    parser.setTotalBytes(stats.size);

    let meta: ParseMeta | undefined;

    parser.on('data', async (row: CSVRow) => {
      if (options.onRow) {
        await options.onRow(row, data.length);
      }
      data.push(row);
    });

    parser.on('progress', (progress: ProgressInfo) => {
      options.onProgress?.(progress);
    });

    parser.on('error', (error: ParseError) => {
      errors.push(error);
      if (options.onError === 'throw') {
        stream.destroy();
        reject(error);
      }
    });

    parser.on('end', (m: ParseMeta) => {
      meta = m;
    });

    stream.on('error', reject);
    
    stream.on('close', () => {
      resolve({
        data,
        meta: meta!,
        errors,
      });
    });

    stream.pipe(parser);
  });
}

/**
 * Parse CSV with async iterator
 */
export async function* parseAsync(
  input: string | Buffer | NodeJS.ReadableStream,
  options: StreamOptions = {}
): AsyncGenerator<CSVRow, void, undefined> {
  const parser = createParseStream(options);

  if (typeof input === 'string' || Buffer.isBuffer(input)) {
    parser.end(input);
  } else {
    input.pipe(parser);
  }

  for await (const row of parser) {
    yield row;
  }
}

/**
 * Parse CSV in chunks for batch processing
 */
export async function* parseChunks(
  input: string | Buffer | NodeJS.ReadableStream,
  chunkSize: number = 1000,
  options: StreamOptions = {}
): AsyncGenerator<CSVRow[], void, undefined> {
  let chunk: CSVRow[] = [];

  for await (const row of parseAsync(input, options)) {
    chunk.push(row);
    
    if (chunk.length >= chunkSize) {
      yield chunk;
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    yield chunk;
  }
}

/**
 * Parse with concurrency control for async operations
 */
export async function parseWithConcurrency<R = void>(
  input: string | Buffer | NodeJS.ReadableStream,
  processor: (row: CSVRow, index: number) => Promise<R>,
  options: AsyncParserOptions = {}
): Promise<R[]> {
  const concurrency = options.concurrency ?? 10;
  const results: R[] = [];
  const pending: Promise<void>[] = [];
  let index = 0;

  for await (const row of parseAsync(input, options)) {
    const currentIndex = index++;
    
    const promise = processor(row, currentIndex).then((result) => {
      results[currentIndex] = result;
    });

    pending.push(promise);

    if (pending.length >= concurrency) {
      await Promise.race(pending);
      // Remove completed promises
      const completedIndex = pending.findIndex(p => 
        Promise.race([p, Promise.resolve('pending')]).then(v => v !== 'pending')
      );
      if (completedIndex !== -1) {
        pending.splice(completedIndex, 1);
      }
    }
  }

  await Promise.all(pending);
  return results;
}