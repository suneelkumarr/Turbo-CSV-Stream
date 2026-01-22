import { CSVLexer } from './lexer';
import { TypeDetector } from '../utils/type-detector';
import { SchemaValidator } from '../schema/validator';
import {
  ParseError,
  type ParserOptions,
  type CSVRow,
  type ParseResult,
  type Primitive,
} from '../types';

const DEFAULT_OPTIONS: Required<Pick<ParserOptions, 
  'delimiter' | 'quote' | 'escape' | 'header' | 'skipEmptyLines' | 
  'dynamicTyping' | 'encoding' | 'chunkSize' | 'relaxColumnCount' |
  'relaxQuotes' | 'onError' | 'maxErrors' | 'trim'
>> = {
  delimiter: ',',
  quote: '"',
  escape: '"',
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
  encoding: 'utf-8',
  chunkSize: 64 * 1024,
  relaxColumnCount: false,
  relaxQuotes: false,
  onError: 'throw',
  maxErrors: 100,
  trim: false,
};

/**
 * High-performance CSV parser
 * Supports synchronous parsing with extensive options
 */
export class CSVParser<T extends CSVRow = CSVRow> {
  private options: ParserOptions;
  private lexer: CSVLexer;
  private typeDetector: TypeDetector;
  private schemaValidator?: SchemaValidator;
  private headers: string[] = [];
  private errors: ParseError[] = [];
  private rowCount: number = 0;

  constructor(options: ParserOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    // Auto-enable relaxQuotes when onError is 'skip' to handle malformed data gracefully
    // But respect explicit relaxQuotes setting if provided
    const shouldRelaxQuotes = options.relaxQuotes !== undefined 
      ? options.relaxQuotes 
      : (this.options.onError === 'skip');
    
    const lexerOptions = {
      ...this.options,
      relaxQuotes: shouldRelaxQuotes
    };
    this.lexer = new CSVLexer(lexerOptions);
    this.typeDetector = new TypeDetector({
      ...(this.options.nullValues && { nullValues: this.options.nullValues }),
      ...(this.options.booleanValues && { booleanValues: this.options.booleanValues }),
      ...(this.options.dateFormats && { dateFormats: this.options.dateFormats }),
    });

    if (this.options.schema) {
      this.schemaValidator = new SchemaValidator(this.options.schema);
    }
  }

  /**
   * Parse CSV string synchronously
   */
  parse(input: string | Buffer): ParseResult<T> {
    const startTime = performance.now();
    const data: T[] = [];
    
    // Handle Buffer input
    const str = Buffer.isBuffer(input) 
      ? input.toString(this.options.encoding) 
      : input;

    // Detect line break style from input
    const detectedLinebreak = this.detectLinebreak(str);

    // Handle BOM
    const cleanInput = this.options.bom !== false ? this.removeBOM(str) : str;
    
    this.lexer.init(cleanInput);
    this.errors = [];
    this.rowCount = 0;

    // Parse header
    if (this.options.header === true) {
      this.parseHeader();
    } else if (Array.isArray(this.options.header)) {
      this.headers = this.options.header;
    } else if (this.options.columns === true) {
      this.parseHeader();
    } else if (Array.isArray(this.options.columns)) {
      this.headers = this.options.columns;
    }

    // Skip initial lines

    // Parse data rows
    let lineNumber = this.options.skipLines ?? 0;
    const fromLine = this.options.fromLine ?? 0;
    const toLine = this.options.toLine ?? Infinity;
    const maxRows = this.options.maxRows ?? Infinity;

    while (data.length < maxRows) {
      // Optimization: use parseRowFast for better performance
      const fields = this.lexer.parseRowFast();
      
      if (fields === null) break;
      
      lineNumber++;
      
      // Skip lines outside range
      if (lineNumber < fromLine) continue;
      if (lineNumber > toLine) break;

      // Skip empty lines
      if (this.options.skipEmptyLines && this.isEmptyRow(fields)) {
        continue;
      }

      try {
        const row = this.processRow(fields, lineNumber);
        
        if (row === null) continue; // Filtered out

        // Apply filter
        if (this.options.filter && !this.options.filter(row, this.rowCount)) {
          continue;
        }

        // Apply transform
        const transformedRow = this.options.transform 
          ? this.options.transform(row, this.rowCount)
          : row;

        if (transformedRow !== null) {
          data.push(transformedRow as T);
          this.rowCount++;
        }
      } catch (error) {
        this.handleError(error as ParseError, lineNumber);
        if (this.errors.length >= (this.options.maxErrors ?? 100)) {
          break;
        }
      }
    }

    const parseTime = performance.now() - startTime;
    
    return {
      data,
      errors: this.errors,
      meta: {
        delimiter: this.options.delimiter || ',',
        linebreak: detectedLinebreak,
        headers: this.headers || [],
        rowCount: this.rowCount,
        columnCount: this.headers?.length || 0,
        truncated: false,
        encoding: this.options.encoding || 'utf8',
        parseTime,
        bytesProcessed: str.length
      }
    };
  }

  /**
   * Check if a row is empty
   */
  private isEmptyRow(fields: string[]): boolean {
    return fields.every(f => f === '' || f === null || f === undefined);
  }

  /**
   * Process a row of CSV fields into a structured object
   */
  private processRow(fields: string[], lineNumber: number): CSVRow | null {
    const row: CSVRow = {};

    for (let i = 0; i < fields.length; i++) {
      let value: Primitive = fields[i]!;
      const header = this.headers?.[i];

      // Skip if no header
      if (!header && this.options.header !== false) continue;

      const finalHeader = header || `field${i + 1}`;

      // Dynamic typing
      if (this.options.dynamicTyping) {
        value = this.typeDetector.detect(value as string);
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

  private parseHeader(): void {
    const fields = this.lexer.parseRow();
    
    if (!fields) {
      throw new ParseError(
        'Empty CSV file or no header found',
        'SCHEMA_ERROR',
        1,
        1
      );
    }

    this.headers = fields.map((h, i) => {
      const header = h.trim() || `column_${i}`;
      return this.options.renameHeaders?.[header] ?? header;
    });

    // Apply columns function
    if (typeof this.options.columns === 'function') {
      this.headers = this.options.columns(this.headers);
    }
  }

  /**
   * Check if row is empty
   */
  private handleError(error: ParseError, lineNumber: number): void {
    error.row = this.rowCount;
    this.errors.push(error);

    const handler = this.options.onError;
    
    if (handler === 'throw') {
      throw error;
    }
    
    if (typeof handler === 'function') {
      const action = handler(error, lineNumber);
      if (action === undefined) throw error;
    }
  }

  /**
   * Remove BOM from string
   */
  private removeBOM(str: string): string {
    if (str.charCodeAt(0) === 0xFEFF) {
      return str.slice(1);
    }
    return str;
  }

  /**
   * Detect line break style
   */
  private detectLinebreak(input: string): string {
    const crlfIndex = input.indexOf('\r\n');
    const lfIndex = input.indexOf('\n');
    const crIndex = input.indexOf('\r');

    if (crlfIndex !== -1 && (crlfIndex < lfIndex || lfIndex === -1)) {
      return '\r\n';
    }
    if (crIndex !== -1 && (crIndex < lfIndex || lfIndex === -1)) {
      return '\r';
    }
    return '\n';
  }

  /**
   * Get detected headers
   */
  getHeaders(): string[] {
    return [...this.headers];
  }

  /**
   * Get parsing errors
   */
  getErrors(): ParseError[] {
    return [...this.errors];
  }
}

/**
 * Quick parse function
 */
export function parse<T extends CSVRow = CSVRow>(
  input: string | Buffer,
  options?: ParserOptions
): ParseResult<T> {
  const parser = new CSVParser<T>(options);
  return parser.parse(input);
}

/**
 * Parse and return only data (throws on error)
 */
export function parseSync<T extends CSVRow = CSVRow>(
  input: string | Buffer,
  options?: ParserOptions
): T[] {
  const result = parse<T>(input, { ...options, onError: 'throw' });
  return result.data;
}