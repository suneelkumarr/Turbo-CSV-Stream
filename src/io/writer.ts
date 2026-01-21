import { Transform, TransformCallback, Writable, Readable } from 'stream';
import type { CSVRow, Primitive, WriterOptions } from '../types';

/**
 * CSV Writer with automatic escaping
 * 
 * Features:
 * - Automatic escaping of quotes, newlines, and delimiters
 * - Configurable quote style (always, auto, minimal)
 * - Custom delimiters and line endings
 * - Header row generation
 * - Stream and batch modes
 */

export interface CSVWriterOptions extends WriterOptions {
  /** Quote style: 'always' | 'auto' | 'minimal' */
  quoteStyle?: 'always' | 'auto' | 'minimal';
  /** Fields to include (in order) */
  columns?: string[];
  /** Include header row */
  header?: boolean;
  /** Column delimiter */
  delimiter?: string;
  /** Quote character */
  quote?: string;
  /** Escape character */
  escape?: string;
  /** Record delimiter (line ending) */
  recordDelimiter?: string;
  /** Null value representation */
  nullValue?: string;
  /** Custom formatters per column */
  formatters?: Record<string, (value: Primitive) => string>;
}

const DEFAULT_OPTIONS: CSVWriterOptions = {
  quoteStyle: 'auto',
  header: true,
  delimiter: ',',
  quote: '"',
  escape: '"',
  recordDelimiter: '\n',
  nullValue: '',
};

/**
 * Escape a field value for CSV output
 */
export function escapeField(
  value: Primitive,
  options: CSVWriterOptions = {}
): string {
  const {
    quoteStyle = 'auto',
    delimiter = ',',
    quote = '"',
    escape = '"',
    nullValue = '',
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    return nullValue;
  }

  // Convert to string
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // Check if quoting is needed
  const containsSpecialChars = 
    str.includes(quote) ||
    str.includes(delimiter) ||
    str.includes('\n') ||
    str.includes('\r');

  const needsQuoting = 
    quoteStyle === 'always' ||
    (quoteStyle === 'auto' && containsSpecialChars) ||
    (quoteStyle === 'minimal' && containsSpecialChars);

  if (needsQuoting) {
    // Escape quotes by doubling them
    const escaped = str.replace(new RegExp(escapeRegex(quote), 'g'), escape + quote);
    return quote + escaped + quote;
  }

  return str;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a row as CSV line
 */
export function formatRow(
  row: CSVRow | Primitive[],
  columns: string[],
  options: CSVWriterOptions = {}
): string {
  const { delimiter = ',', formatters = {} } = options;
  
  const values = columns.map(col => {
    let value: Primitive;
    
    if (Array.isArray(row)) {
      const idx = columns.indexOf(col);
      value = row[idx];
    } else {
      value = row[col];
    }

    // Apply custom formatter if exists
    if (formatters[col]) {
      const formatted = formatters[col](value);
      return escapeField(formatted, options);
    }

    return escapeField(value, options);
  });

  return values.join(delimiter);
}

/**
 * Format header row
 */
export function formatHeader(columns: string[], options: CSVWriterOptions = {}): string {
  const { delimiter = ',' } = options;
  return columns.map(col => escapeField(col, options)).join(delimiter);
}

/**
 * Stringify an array of rows to CSV format
 */
export function stringifyCSV(
  data: CSVRow[],
  options: CSVWriterOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { recordDelimiter = '\n', header = true } = opts;

  if (data.length === 0) {
    return '';
  }

  // Determine columns
  const columns = opts.columns || Object.keys(data[0]!);
  const lines: string[] = [];

  // Add header row
  if (header) {
    lines.push(formatHeader(columns, opts));
  }

  // Add data rows
  for (const row of data) {
    lines.push(formatRow(row, columns, opts));
  }

  return lines.join(recordDelimiter) + recordDelimiter;
}

/**
 * Transform stream that stringifies objects to CSV
 */
export class CSVStringifyStream extends Transform {
  private readonly options: CSVWriterOptions;
  private columns: string[] | null = null;
  private headerWritten: boolean = false;

  constructor(options: CSVWriterOptions = {}) {
    super({ objectMode: true });
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (this.options.columns) {
      this.columns = this.options.columns;
    }
  }

  _transform(chunk: CSVRow, _encoding: string, callback: TransformCallback): void {
    try {
      const { recordDelimiter = '\n', header = true } = this.options;

      // Determine columns from first row if not specified
      if (!this.columns) {
        this.columns = Object.keys(chunk);
      }

      // Write header row on first data
      if (!this.headerWritten && header) {
        this.push(formatHeader(this.columns, this.options) + recordDelimiter);
        this.headerWritten = true;
      }

      // Write data row
      this.push(formatRow(chunk, this.columns, this.options) + recordDelimiter);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
}

/**
 * CSV Writer class for writing CSV data
 */
export class CSVWriter {
  private readonly options: CSVWriterOptions;
  private columns: string[] | null = null;
  private output: string = '';
  private headerWritten: boolean = false;

  constructor(options: CSVWriterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    if (this.options.columns) {
      this.columns = this.options.columns;
    }
  }

  /**
   * Write a single row
   */
  writeRow(row: CSVRow): void {
    const { recordDelimiter = '\n', header = true } = this.options;

    // Determine columns from first row
    if (!this.columns) {
      this.columns = Object.keys(row);
    }

    // Write header if needed
    if (!this.headerWritten && header) {
      this.output += formatHeader(this.columns, this.options) + recordDelimiter;
      this.headerWritten = true;
    }

    // Write data row
    this.output += formatRow(row, this.columns, this.options) + recordDelimiter;
  }

  /**
   * Write multiple rows
   */
  writeRows(rows: CSVRow[]): void {
    for (const row of rows) {
      this.writeRow(row);
    }
  }

  /**
   * Get the current output
   */
  toString(): string {
    return this.output;
  }

  /**
   * Clear the output buffer
   */
  clear(): void {
    this.output = '';
    this.headerWritten = false;
    // Reset columns unless they were predefined in options
    if (!this.options.columns) {
      this.columns = null;
    }
  }

  /**
   * Create a write stream
   */
  createWriteStream(): CSVStringifyStream {
    return new CSVStringifyStream(this.options);
  }
}

/**
 * Create a readable stream from CSV data
 */
export function createCSVReadStream(
  data: CSVRow[],
  options: CSVWriterOptions = {}
): Readable {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { recordDelimiter = '\n', header = true } = opts;
  const columns = opts.columns || (data.length > 0 ? Object.keys(data[0]!) : []);
  
  let index = -1;
  const headerLine = header ? formatHeader(columns, opts) : null;

  return new Readable({
    read() {
      if (index === -1 && headerLine) {
        this.push(headerLine + recordDelimiter);
        index++;
        return;
      }

      if (index < data.length) {
        const line = formatRow(data[index]!, columns, opts);
        this.push(line + recordDelimiter);
        index++;
      } else {
        this.push(null);
      }
    },
  });
}

/**
 * Write CSV to a writable stream
 */
export function writeCSV(
  stream: Writable,
  data: CSVRow[],
  options: CSVWriterOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const { recordDelimiter = '\n', header = true } = opts;
    const columns = opts.columns || (data.length > 0 ? Object.keys(data[0]!) : []);
    
    let index = -1;

    const write = (): void => {
      // Write header first
      if (index === -1 && header) {
        const headerLine = formatHeader(columns, opts) + recordDelimiter;
        const canContinue = stream.write(headerLine);
        index++;
        
        if (!canContinue) {
          stream.once('drain', write);
          return;
        }
      }

      // Write data rows
      while (index < data.length) {
        const line = formatRow(data[index]!, columns, opts) + recordDelimiter;
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

/**
 * Quick CSV stringify function
 */
export function toCSV(
  data: CSVRow[],
  options: CSVWriterOptions = {}
): string {
  return stringifyCSV(data, options);
}
