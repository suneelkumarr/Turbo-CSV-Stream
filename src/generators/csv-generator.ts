/**
 * CSV Generator Module
 * 
 * Flexible generator of random CSV strings and JavaScript objects
 * implementing the Node.js stream.Readable API.
 * 
 * Features:
 * - Scalable stream.Readable implementation
 * - Random or pseudo-random seed-based generation
 * - Idempotence with the "seed" option
 * - User-defined value generation
 * - Multiple types of values (integer, boolean, dates, ...)
 */

import { Readable, ReadableOptions } from 'stream';
import type { CSVRow, Primitive } from '../types';

// ============================================
// Types
// ============================================

export type GeneratorValueType = 
  | 'string' 
  | 'integer' 
  | 'float' 
  | 'boolean' 
  | 'date' 
  | 'datetime'
  | 'uuid'
  | 'email'
  | 'name'
  | 'word'
  | 'sentence'
  | 'paragraph'
  | 'url'
  | 'ip'
  | 'phone'
  | 'custom';

export interface ColumnGenerator {
  /** Column name/header */
  name: string;
  /** Type of value to generate */
  type: GeneratorValueType;
  /** Custom generator function (for type: 'custom') */
  generator?: (index: number, random: SeededRandom) => Primitive;
  /** Minimum value (for numeric types) */
  min?: number;
  /** Maximum value (for numeric types) */
  max?: number;
  /** String length or word count */
  length?: number;
  /** Date range start */
  startDate?: Date;
  /** Date range end */
  endDate?: Date;
  /** Fixed set of values to choose from */
  values?: Primitive[];
  /** Nullable probability (0-1) */
  nullable?: number;
  /** Prefix for string values */
  prefix?: string;
  /** Suffix for string values */
  suffix?: string;
  /** Format string for dates */
  format?: string;
}

export interface GeneratorOptions extends ReadableOptions {
  /** Number of rows to generate (default: 100) */
  length?: number;
  /** Seed for reproducible random generation */
  seed?: number;
  /** Column definitions */
  columns?: ColumnGenerator[] | number | string[];
  /** CSV delimiter (default: ',') */
  delimiter?: string;
  /** Whether to include headers (default: true) */
  header?: boolean;
  /** Quote character (default: '"') */
  quote?: string;
  /** End of line character (default: '\n') */
  eol?: string;
  /** Output as objects instead of CSV strings */
  objectMode?: boolean;
  /** Fixed row data (overrides generators) */
  fixedSize?: number;
  /** Max columns when columns is a number */
  maxWordLength?: number;
  /** Duration in milliseconds (alternative to length) */
  duration?: number;
  /** Sleep between rows in milliseconds */
  sleep?: number;
}

// ============================================
// Seeded Random Number Generator
// ============================================

export class SeededRandom {
  private seed: number;
  private readonly initialSeed: number;

  constructor(seed?: number) {
    this.initialSeed = seed ?? Date.now();
    this.seed = this.initialSeed;
  }

  /** Reset to initial seed */
  reset(): void {
    this.seed = this.initialSeed;
  }

  /** Get the current seed */
  getSeed(): number {
    return this.initialSeed;
  }

  /** Generate next random number between 0 and 1 */
  next(): number {
    // Linear Congruential Generator (LCG)
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /** Generate random integer between min and max (inclusive) */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Generate random float between min and max */
  float(min: number, max: number, decimals: number = 2): number {
    const value = this.next() * (max - min) + min;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /** Generate random boolean with given probability */
  bool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }

  /** Pick a random element from array */
  pick<T>(array: T[]): T {
    return array[this.int(0, array.length - 1)]!;
  }

  /** Shuffle array (Fisher-Yates) */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  /** Generate random string of given length */
  string(length: number, charset?: string): string {
    const chars = charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[this.int(0, chars.length - 1)];
    }
    return result;
  }

  /** Generate UUID v4 */
  uuid(): string {
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4';
      } else if (i === 19) {
        uuid += hex[this.int(8, 11)];
      } else {
        uuid += hex[this.int(0, 15)];
      }
    }
    return uuid;
  }

  /** Generate random date between two dates */
  date(start: Date, end: Date): Date {
    const startTime = start.getTime();
    const endTime = end.getTime();
    const randomTime = Math.floor(startTime + this.next() * (endTime - startTime));
    return new Date(randomTime);
  }
}

// ============================================
// Value Generators
// ============================================

const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat'];
const DOMAINS = ['example.com', 'test.org', 'sample.net', 'demo.io', 'mock.dev'];

export function generateValue(
  column: ColumnGenerator,
  index: number,
  random: SeededRandom
): Primitive {
  // Check nullable
  if (column.nullable && random.next() < column.nullable) {
    return null;
  }

  // Check fixed values
  if (column.values && column.values.length > 0) {
    return random.pick(column.values);
  }

  const prefix = column.prefix || '';
  const suffix = column.suffix || '';

  switch (column.type) {
    case 'string':
      return prefix + random.string(column.length || 10) + suffix;

    case 'integer':
      return random.int(column.min ?? 0, column.max ?? 1000);

    case 'float':
      return random.float(column.min ?? 0, column.max ?? 1000);

    case 'boolean':
      return random.bool();

    case 'date': {
      const start = column.startDate || new Date('2020-01-01');
      const end = column.endDate || new Date('2023-12-31');
      const date = random.date(start, end);
      return date.toISOString().split('T')[0]!;
    }

    case 'datetime': {
      const start = column.startDate || new Date('2020-01-01');
      const end = column.endDate || new Date('2023-12-31');
      return random.date(start, end).toISOString();
    }

    case 'uuid':
      return random.uuid();

    case 'email': {
      const firstName = random.pick(FIRST_NAMES).toLowerCase();
      const lastName = random.pick(LAST_NAMES).toLowerCase();
      const domain = random.pick(DOMAINS);
      return `${firstName}.${lastName}${random.int(1, 99)}@${domain}`;
    }

    case 'name':
      return `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;

    case 'word':
      return random.pick(WORDS);

    case 'sentence': {
      const wordCount = column.length || random.int(5, 15);
      const words: string[] = [];
      for (let i = 0; i < wordCount; i++) {
        words.push(random.pick(WORDS));
      }
      const sentence = words.join(' ');
      return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
    }

    case 'paragraph': {
      const sentenceCount = column.length || random.int(3, 8);
      const sentences: string[] = [];
      for (let i = 0; i < sentenceCount; i++) {
        const wordCount = random.int(5, 15);
        const words: string[] = [];
        for (let j = 0; j < wordCount; j++) {
          words.push(random.pick(WORDS));
        }
        const sentence = words.join(' ');
        sentences.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.');
      }
      return sentences.join(' ');
    }

    case 'url':
      return `https://${random.pick(DOMAINS)}/${random.string(8).toLowerCase()}`;

    case 'ip':
      return `${random.int(1, 255)}.${random.int(0, 255)}.${random.int(0, 255)}.${random.int(1, 255)}`;

    case 'phone':
      return `+1-${random.int(200, 999)}-${random.int(200, 999)}-${random.int(1000, 9999)}`;

    case 'custom':
      if (column.generator) {
        return column.generator(index, random);
      }
      return null;

    default:
      return random.string(10);
  }
}

// ============================================
// CSV Generator Stream
// ============================================

export class CSVGeneratorStream extends Readable {
  private options: Required<Pick<GeneratorOptions, 'length' | 'delimiter' | 'header' | 'quote' | 'eol'>> & GeneratorOptions;
  private random: SeededRandom;
  private columns: ColumnGenerator[];
  private currentIndex: number = 0;
  private headerWritten: boolean = false;
  private startTime: number = 0;

  constructor(options: GeneratorOptions = {}) {
    super({ 
      objectMode: options.objectMode || false,
      highWaterMark: options.highWaterMark
    });

    this.options = {
      length: 100,
      delimiter: ',',
      header: true,
      quote: '"',
      eol: '\n',
      ...options
    };

    this.random = new SeededRandom(options.seed);
    this.columns = this.initColumns(options.columns);
  }

  private initColumns(columns?: ColumnGenerator[] | number | string[]): ColumnGenerator[] {
    if (!columns) {
      // Default: 5 columns with mixed types
      return [
        { name: 'id', type: 'integer', min: 1, max: 1000000 },
        { name: 'name', type: 'name' },
        { name: 'email', type: 'email' },
        { name: 'active', type: 'boolean' },
        { name: 'created_at', type: 'datetime' },
      ];
    }

    if (typeof columns === 'number') {
      // Generate N random columns
      const result: ColumnGenerator[] = [];
      const types: GeneratorValueType[] = ['string', 'integer', 'float', 'boolean'];
      for (let i = 0; i < columns; i++) {
        result.push({
          name: `column${i + 1}`,
          type: this.random.pick(types),
        });
      }
      return result;
    }

    if (Array.isArray(columns) && typeof columns[0] === 'string') {
      // Array of column names - default to string type
      return (columns as string[]).map(name => ({
        name,
        type: 'string' as GeneratorValueType,
        length: 10,
      }));
    }

    return columns as ColumnGenerator[];
  }

  private escapeValue(value: Primitive): string {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);
    const needsQuote = str.includes(this.options.delimiter) || 
                       str.includes(this.options.quote) || 
                       str.includes('\n') ||
                       str.includes('\r');

    if (needsQuote) {
      return this.options.quote + str.replace(new RegExp(this.options.quote, 'g'), this.options.quote + this.options.quote) + this.options.quote;
    }

    return str;
  }

  private generateRow(index: number): CSVRow {
    const row: CSVRow = {};
    for (const column of this.columns) {
      row[column.name] = generateValue(column, index, this.random);
    }
    return row;
  }

  private formatRow(row: CSVRow): string {
    const values = this.columns.map(col => this.escapeValue(row[col.name]));
    return values.join(this.options.delimiter) + this.options.eol;
  }

  private formatHeader(): string {
    return this.columns.map(col => this.escapeValue(col.name)).join(this.options.delimiter) + this.options.eol;
  }

  _read(): void {
    // Check duration limit
    if (this.options.duration) {
      if (this.startTime === 0) {
        this.startTime = Date.now();
      }
      if (Date.now() - this.startTime >= this.options.duration) {
        this.push(null);
        return;
      }
    }

    // Write header first
    if (this.options.header && !this.headerWritten) {
      this.headerWritten = true;
      if (this.readableObjectMode) {
        // In object mode, headers are implicit in object keys
      } else {
        this.push(this.formatHeader());
      }
    }

    // Check if we've generated enough rows
    if (this.currentIndex >= this.options.length) {
      this.push(null);
      return;
    }

    // Generate row
    const row = this.generateRow(this.currentIndex);
    this.currentIndex++;

    // Handle sleep option
    if (this.options.sleep && this.options.sleep > 0) {
      setTimeout(() => {
        if (this.readableObjectMode) {
          this.push(row);
        } else {
          this.push(this.formatRow(row));
        }
      }, this.options.sleep);
    } else {
      if (this.readableObjectMode) {
        this.push(row);
      } else {
        this.push(this.formatRow(row));
      }
    }
  }

  /** Get the random generator for external use */
  getRandom(): SeededRandom {
    return this.random;
  }

  /** Get column definitions */
  getColumns(): ColumnGenerator[] {
    return this.columns;
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Generate CSV string synchronously
 */
export function generateCSV(options: GeneratorOptions = {}): string {
  const { length = 100, objectMode = false, ...rest } = options;
  const random = new SeededRandom(options.seed);
  
  const stream = new CSVGeneratorStream({ ...rest, length, objectMode: false, seed: random.getSeed() });
  const columns = stream.getColumns();
  
  const lines: string[] = [];
  
  // Header
  if (options.header !== false) {
    const header = columns.map(col => col.name).join(rest.delimiter || ',');
    lines.push(header);
  }
  
  // Data rows
  for (let i = 0; i < length; i++) {
    const row: string[] = [];
    for (const column of columns) {
      const value = generateValue(column, i, random);
      const str = value === null || value === undefined ? '' : String(value);
      const delimiter = rest.delimiter || ',';
      const quote = rest.quote || '"';
      
      if (str.includes(delimiter) || str.includes(quote) || str.includes('\n')) {
        row.push(quote + str.replace(new RegExp(quote, 'g'), quote + quote) + quote);
      } else {
        row.push(str);
      }
    }
    lines.push(row.join(rest.delimiter || ','));
  }
  
  return lines.join(rest.eol || '\n') + (rest.eol || '\n');
}

/**
 * Generate array of objects synchronously
 */
export function generateObjects(options: GeneratorOptions = {}): CSVRow[] {
  const { length = 100 } = options;
  const random = new SeededRandom(options.seed);
  
  const stream = new CSVGeneratorStream({ ...options, length, objectMode: true, seed: random.getSeed() });
  const columns = stream.getColumns();
  
  const rows: CSVRow[] = [];
  
  for (let i = 0; i < length; i++) {
    const row: CSVRow = {};
    for (const column of columns) {
      row[column.name] = generateValue(column, i, random);
    }
    rows.push(row);
  }
  
  return rows;
}

/**
 * Create a CSV generator stream
 */
export function createGenerator(options: GeneratorOptions = {}): CSVGeneratorStream {
  return new CSVGeneratorStream(options);
}

/**
 * Async generator for CSV rows
 */
export async function* generateAsync(options: GeneratorOptions = {}): AsyncGenerator<CSVRow> {
  const { length = 100 } = options;
  const random = new SeededRandom(options.seed);
  
  const stream = new CSVGeneratorStream({ ...options, length, objectMode: true, seed: random.getSeed() });
  const columns = stream.getColumns();
  
  for (let i = 0; i < length; i++) {
    const row: CSVRow = {};
    for (const column of columns) {
      row[column.name] = generateValue(column, i, random);
    }
    
    if (options.sleep && options.sleep > 0) {
      await new Promise(resolve => setTimeout(resolve, options.sleep));
    }
    
    yield row;
  }
}

export default CSVGeneratorStream;
