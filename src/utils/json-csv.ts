/**
 * JSON-CSV Converter Module
 * 
 * Bidirectional conversion between JSON and CSV formats.
 * 
 * Features:
 * - Header generation based on document keys
 * - Nested document support with dot notation
 * - Array value support
 * - Schema verification
 * - Custom field ordering
 * - RFC 4180 compliance
 * - Wrapped value support
 * - Multiple schema support
 * - Empty field value option
 * - Synchronous and async APIs
 */

import type { CSVRow, Primitive } from '../types';
import { getNestedValue, setNestedValue } from './field-selector';

// ============================================
// Types
// ============================================

export interface Json2CsvOptions {
  /** Specific keys to include (in order) */
  keys?: string[];
  /** Keys to exclude */
  excludeKeys?: string[];
  /** Delimiter character (default: ',') */
  delimiter?: string;
  /** Quote character (default: '"') */
  quote?: string;
  /** Wrap all fields in quotes */
  wrapStrings?: boolean;
  /** End of line character (default: '\n') */
  eol?: string;
  /** Include header row (default: true) */
  header?: boolean;
  /** Empty value representation (default: '') */
  emptyFieldValue?: string;
  /** Flatten nested objects with dot notation */
  flatten?: boolean;
  /** Maximum flatten depth (default: Infinity) */
  flattenDepth?: number;
  /** Array delimiter for array values (default: ',') */
  arrayDelimiter?: string;
  /** Expand arrays into separate columns */
  expandArrays?: boolean;
  /** Custom formatters per field */
  formatters?: Record<string, (value: Primitive) => string>;
  /** Sort keys alphabetically */
  sortKeys?: boolean;
  /** Prepend BOM for Excel compatibility */
  prependBom?: boolean;
  /** Transform function before conversion */
  transform?: (row: any) => any;
}

export interface Csv2JsonOptions {
  /** Specific keys/columns to include */
  keys?: string[];
  /** Delimiter character (default: ',') */
  delimiter?: string;
  /** Quote character (default: '"') */
  quote?: string;
  /** Parse nested keys from dot notation */
  parseNested?: boolean;
  /** Trim whitespace from values */
  trim?: boolean;
  /** Empty value representation */
  emptyFieldValue?: string | null;
  /** Parse arrays from delimited strings */
  parseArrays?: boolean;
  /** Array delimiter for parsing (default: ',') */
  arrayDelimiter?: string;
  /** Fields that should be parsed as arrays */
  arrayFields?: string[];
  /** Custom parsers per field */
  parsers?: Record<string, (value: string) => Primitive>;
  /** Auto-detect types (numbers, booleans, dates) */
  dynamicTyping?: boolean;
  /** Transform function after parsing */
  transform?: (row: any) => any;
  /** Check schema consistency */
  checkSchema?: boolean;
  /** Header is in first row (default: true) */
  header?: boolean;
  /** Custom header names (when header is false) */
  headerNames?: string[];
}

export interface SchemaField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required?: boolean;
  default?: Primitive;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Flatten a nested object with dot notation keys
 */
export function flattenObject(
  obj: Record<string, any>,
  prefix: string = '',
  maxDepth: number = Infinity,
  currentDepth: number = 0
): Record<string, Primitive> {
  const result: Record<string, Primitive> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      currentDepth < maxDepth
    ) {
      Object.assign(result, flattenObject(value, newKey, maxDepth, currentDepth + 1));
    } else if (Array.isArray(value)) {
      // Convert array to string or handle specially
      result[newKey] = value.map(v => 
        v === null || v === undefined ? '' : String(v)
      ).join(',') as Primitive;
    } else if (value instanceof Date) {
      result[newKey] = value.toISOString();
    } else if (value !== null && typeof value === 'object') {
      // Stringify objects that exceed maxDepth
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value as Primitive;
    }
  }

  return result;
}

/**
 * Unflatten a dot-notation object back to nested structure
 */
export function unflattenObject(obj: Record<string, Primitive>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    setNestedValue(result, key, value);
  }

  return result;
}

/**
 * Extract all keys from an array of objects (including nested)
 */
export function extractKeys(
  objects: Record<string, any>[],
  options: { flatten?: boolean; flattenDepth?: number; sortKeys?: boolean } = {}
): string[] {
  const keySet = new Set<string>();

  for (const obj of objects) {
    const target = options.flatten 
      ? flattenObject(obj, '', options.flattenDepth)
      : obj;
    
    for (const key of Object.keys(target)) {
      keySet.add(key);
    }
  }

  const keys = Array.from(keySet);
  
  if (options.sortKeys) {
    keys.sort();
  }

  return keys;
}

/**
 * Escape a field value for CSV
 */
export function escapeCSVField(
  value: Primitive,
  options: { delimiter?: string; quote?: string; wrapStrings?: boolean; emptyFieldValue?: string }
): string {
  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const emptyValue = options.emptyFieldValue ?? '';

  if (value === null || value === undefined) {
    return emptyValue;
  }

  if (value instanceof Date) {
    value = value.toISOString();
  }

  const str = String(value);

  if (str === '') {
    return emptyValue;
  }

  const needsQuote = options.wrapStrings || 
                     str.includes(delimiter) || 
                     str.includes(quote) || 
                     str.includes('\n') ||
                     str.includes('\r');

  if (needsQuote) {
    return quote + str.replace(new RegExp(quote, 'g'), quote + quote) + quote;
  }

  return str;
}

/**
 * Parse a CSV field value
 */
export function parseCSVField(
  value: string,
  options: { trim?: boolean; emptyFieldValue?: string | null; dynamicTyping?: boolean }
): Primitive {
  let str = value;

  if (options.trim) {
    str = str.trim();
  }

  if (str === '') {
    return options.emptyFieldValue === undefined ? '' : options.emptyFieldValue;
  }

  if (options.dynamicTyping) {
    // Boolean
    if (str.toLowerCase() === 'true') return true;
    if (str.toLowerCase() === 'false') return false;
    
    // Null
    if (str.toLowerCase() === 'null') return null;
    
    // Number
    if (/^-?\d+$/.test(str)) {
      const num = parseInt(str, 10);
      if (Number.isSafeInteger(num)) return num;
    }
    if (/^-?\d+\.?\d*(?:e[+-]?\d+)?$/i.test(str)) {
      const num = parseFloat(str);
      if (!isNaN(num) && isFinite(num)) return num;
    }
    
    // ISO Date
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(str)) {
      const date = new Date(str);
      if (!isNaN(date.getTime())) return date;
    }
  }

  return str;
}

// ============================================
// JSON to CSV Conversion
// ============================================

/**
 * Convert JSON objects to CSV string
 */
export function json2csv(data: Record<string, any>[], options: Json2CsvOptions = {}): string {
  if (!data || data.length === 0) {
    return '';
  }

  const {
    keys,
    excludeKeys = [],
    delimiter = ',',
    quote = '"',
    wrapStrings = false,
    eol = '\n',
    header = true,
    emptyFieldValue = '',
    flatten = true,
    flattenDepth = Infinity,
    arrayDelimiter = ',',
    expandArrays = false,
    formatters = {},
    sortKeys = false,
    prependBom = false,
    transform,
  } = options;

  // Apply transform if provided
  let processedData = transform ? data.map(transform) : data;

  // Flatten objects if needed
  if (flatten) {
    processedData = processedData.map(obj => flattenObject(obj, '', flattenDepth));
  }

  // Determine columns
  let columns = keys || extractKeys(processedData, { flatten: false, sortKeys });
  
  // Exclude keys
  if (excludeKeys.length > 0) {
    const excludeSet = new Set(excludeKeys);
    columns = columns.filter(k => !excludeSet.has(k));
  }

  // Handle array expansion
  if (expandArrays) {
    const expandedColumns: string[] = [];
    for (const col of columns) {
      const maxLength = Math.max(
        ...processedData.map(row => {
          const val = row[col];
          return Array.isArray(val) ? val.length : 1;
        })
      );
      if (maxLength > 1) {
        for (let i = 0; i < maxLength; i++) {
          expandedColumns.push(`${col}[${i}]`);
        }
      } else {
        expandedColumns.push(col);
      }
    }
    columns = expandedColumns;
  }

  const lines: string[] = [];

  // Add BOM if requested
  if (prependBom) {
    lines.push('\uFEFF');
  }

  // Header row
  if (header) {
    const headerRow = columns.map(col => 
      escapeCSVField(col, { delimiter, quote, wrapStrings })
    ).join(delimiter);
    lines.push(headerRow);
  }

  // Data rows
  for (const row of processedData) {
    const values = columns.map(col => {
      // Handle array expansion notation
      const arrayMatch = col.match(/^(.+)\[(\d+)\]$/);
      let value: Primitive;

      if (arrayMatch) {
        const [, baseCol, indexStr] = arrayMatch;
        const index = parseInt(indexStr!, 10);
        const arr = row[baseCol!];
        value = Array.isArray(arr) ? arr[index] : undefined;
      } else {
        value = flatten ? row[col] : getNestedValue(row as CSVRow, col);
      }

      // Handle array values
      if (Array.isArray(value)) {
        value = value.map(v => v === null || v === undefined ? '' : String(v)).join(arrayDelimiter);
      }

      // Apply custom formatter
      if (formatters[col]) {
        value = formatters[col]!(value);
      }

      return escapeCSVField(value, { delimiter, quote, wrapStrings, emptyFieldValue });
    });

    lines.push(values.join(delimiter));
  }

  return lines.join(eol);
}

/**
 * Convert JSON objects to CSV string (alias)
 */
export const toCSV = json2csv;

// ============================================
// CSV to JSON Conversion
// ============================================

/**
 * Convert CSV string to JSON objects
 */
export function csv2json(csv: string, options: Csv2JsonOptions = {}): Record<string, any>[] {
  if (!csv || csv.trim() === '') {
    return [];
  }

  const {
    keys,
    delimiter = ',',
    quote = '"',
    parseNested = true,
    trim = true,
    emptyFieldValue = '',
    parseArrays = false,
    arrayDelimiter = ',',
    arrayFields = [],
    parsers = {},
    dynamicTyping = false,
    transform,
    checkSchema = false,
    header = true,
    headerNames,
  } = options;

  // Parse CSV into rows
  const rows = parseCSVRows(csv, { delimiter, quote });

  if (rows.length === 0) {
    return [];
  }

  // Determine headers
  let headers: string[];
  let dataRows: string[][];

  if (header) {
    headers = rows[0]!.map(h => trim ? h.trim() : h);
    dataRows = rows.slice(1);
  } else if (headerNames) {
    headers = headerNames;
    dataRows = rows;
  } else {
    // Generate default headers
    headers = rows[0]!.map((_, i) => `column${i + 1}`);
    dataRows = rows;
  }

  // Filter to specific keys if provided
  const keySet = keys ? new Set(keys) : null;
  const arrayFieldSet = new Set(arrayFields);

  // Schema validation
  let schema: string[] | null = null;
  if (checkSchema && dataRows.length > 0) {
    schema = headers;
  }

  const results: Record<string, any>[] = [];

  for (const row of dataRows) {
    // Skip empty rows
    if (row.every(cell => cell.trim() === '')) {
      continue;
    }

    // Schema check
    if (schema && row.length !== schema.length) {
      throw new Error(`Schema mismatch: expected ${schema.length} columns, got ${row.length}`);
    }

    const obj: Record<string, any> = {};

    for (let i = 0; i < headers.length; i++) {
      const key = headers[i]!;
      
      // Skip if not in keys filter
      if (keySet && !keySet.has(key)) {
        continue;
      }

      let value: any = row[i] ?? '';

      // Parse the value
      if (parsers[key]) {
        value = parsers[key]!(value);
      } else {
        value = parseCSVField(value, { trim, emptyFieldValue, dynamicTyping });
      }

      // Handle array parsing
      if (parseArrays && (arrayFieldSet.has(key) || (typeof value === 'string' && value.includes(arrayDelimiter)))) {
        if (typeof value === 'string' && value !== '') {
          value = value.split(arrayDelimiter).map(v => 
            parseCSVField(v.trim(), { trim, emptyFieldValue, dynamicTyping })
          );
        }
      }

      // Set the value (with nested path support)
      if (parseNested && key.includes('.')) {
        setNestedValue(obj, key, value);
      } else {
        obj[key] = value;
      }
    }

    // Apply transform
    const result = transform ? transform(obj) : obj;
    if (result !== null && result !== undefined) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Convert CSV string to JSON objects (alias)
 */
export const toJSON = csv2json;

/**
 * Parse CSV string into array of arrays
 */
export function parseCSVRows(
  csv: string,
  options: { delimiter?: string; quote?: string } = {}
): string[][] {
  const delimiter = options.delimiter || ',';
  const quote = options.quote || '"';
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  // Handle BOM
  if (csv.charCodeAt(0) === 0xFEFF) {
    i = 1;
  }

  while (i < csv.length) {
    const char = csv[i]!;
    const nextChar = csv[i + 1];

    if (inQuotes) {
      if (char === quote) {
        if (nextChar === quote) {
          // Escaped quote
          currentField += quote;
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === quote) {
        // Start of quoted field
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i += 2;
        } else {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
        }
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // Handle last field/row
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

// ============================================
// Schema Verification
// ============================================

/**
 * Verify that all objects match a schema
 */
export function verifySchema(
  data: Record<string, any>[],
  schema: SchemaField[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i]!;

    for (const field of schema) {
      const value = row[field.key];

      // Check required
      if (field.required && (value === null || value === undefined)) {
        errors.push(`Row ${i + 1}: Missing required field "${field.key}"`);
        continue;
      }

      if (value === null || value === undefined) {
        continue;
      }

      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (field.type === 'date') {
        if (!(value instanceof Date) && isNaN(Date.parse(String(value)))) {
          errors.push(`Row ${i + 1}: Field "${field.key}" expected date, got ${actualType}`);
        }
      } else if (actualType !== field.type) {
        errors.push(`Row ${i + 1}: Field "${field.key}" expected ${field.type}, got ${actualType}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Infer schema from data
 */
export function inferJsonSchema(data: Record<string, any>[]): SchemaField[] {
  if (data.length === 0) {
    return [];
  }

  const fieldInfo: Record<string, { types: Set<string>; nullable: boolean }> = {};

  for (const row of data) {
    const flattened = flattenObject(row);
    
    for (const [key, value] of Object.entries(flattened)) {
      if (!fieldInfo[key]) {
        fieldInfo[key] = { types: new Set(), nullable: false };
      }

      if (value === null || value === undefined) {
        fieldInfo[key]!.nullable = true;
      } else if (value instanceof Date) {
        fieldInfo[key]!.types.add('date');
      } else if (Array.isArray(value)) {
        fieldInfo[key]!.types.add('array');
      } else {
        fieldInfo[key]!.types.add(typeof value);
      }
    }
  }

  const schema: SchemaField[] = [];

  for (const [key, info] of Object.entries(fieldInfo)) {
    const types = Array.from(info.types);
    let type: SchemaField['type'] = 'string';

    if (types.length === 1) {
      type = types[0] as SchemaField['type'];
    } else if (types.includes('string')) {
      type = 'string';
    }

    schema.push({
      key,
      type,
      required: !info.nullable,
    });
  }

  return schema;
}

// ============================================
// Streaming Conversion
// ============================================

import { Transform, TransformCallback } from 'stream';

/**
 * Transform stream: JSON objects to CSV rows
 */
export class Json2CsvStream extends Transform {
  private options: Json2CsvOptions;
  private headers: string[] | null = null;
  private headerWritten = false;

  constructor(options: Json2CsvOptions = {}) {
    super({ objectMode: true });
    this.options = options;
  }

  _transform(chunk: Record<string, any>, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      const { delimiter = ',', quote = '"', wrapStrings = false, eol = '\n', flatten = true, flattenDepth = Infinity, emptyFieldValue = '' } = this.options;

      let row = chunk;
      if (this.options.transform) {
        row = this.options.transform(chunk);
      }

      if (flatten) {
        row = flattenObject(row, '', flattenDepth);
      }

      // Initialize headers from first row
      if (!this.headers) {
        this.headers = this.options.keys || Object.keys(row);
        if (this.options.sortKeys) {
          this.headers.sort();
        }
      }

      // Write header
      if (!this.headerWritten && this.options.header !== false) {
        const headerLine = this.headers.map(h => 
          escapeCSVField(h, { delimiter, quote, wrapStrings })
        ).join(delimiter) + eol;
        this.push(headerLine);
        this.headerWritten = true;
      }

      // Write data row
      const values = this.headers.map(col => {
        const value = row[col];
        return escapeCSVField(value, { delimiter, quote, wrapStrings, emptyFieldValue });
      });
      this.push(values.join(delimiter) + eol);

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }
}

/**
 * Transform stream: CSV rows to JSON objects
 */
export class Csv2JsonStream extends Transform {
  private options: Csv2JsonOptions;
  private headers: string[] | null = null;
  private buffer = '';

  constructor(options: Csv2JsonOptions = {}) {
    super({ objectMode: true });
    this.options = options;
    if (options.header === false && options.headerNames) {
      this.headers = options.headerNames;
    }
  }

  _transform(chunk: Buffer | string, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      this.buffer += chunk.toString();
      const lines = this.buffer.split(/\r?\n/);
      
      // Keep last potentially incomplete line
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;

        const row = parseCSVRows(line, { delimiter: this.options.delimiter || ',', quote: this.options.quote || '"' })[0];
        if (!row) continue;

        if (!this.headers && this.options.header !== false) {
          this.headers = row.map(h => this.options.trim ? h.trim() : h);
          continue;
        }

        const obj = this.rowToObject(row);
        if (obj) {
          this.push(obj);
        }
      }

      callback();
    } catch (error) {
      callback(error as Error);
    }
  }

  _flush(callback: TransformCallback): void {
    if (this.buffer.trim()) {
      const row = parseCSVRows(this.buffer, { delimiter: this.options.delimiter || ',', quote: this.options.quote || '"' })[0];
      if (row) {
        const obj = this.rowToObject(row);
        if (obj) {
          this.push(obj);
        }
      }
    }
    callback();
  }

  private rowToObject(row: string[]): Record<string, any> | null {
    if (!this.headers) return null;

    const obj: Record<string, any> = {};
    const { trim = true, emptyFieldValue = '', dynamicTyping = false, parseNested = true, parsers = {}, transform } = this.options;

    for (let i = 0; i < this.headers.length; i++) {
      const key = this.headers[i]!;
      let value: any = row[i] ?? '';

      if (parsers[key]) {
        value = parsers[key]!(value);
      } else {
        value = parseCSVField(value, { trim, emptyFieldValue, dynamicTyping });
      }

      if (parseNested && key.includes('.')) {
        setNestedValue(obj, key, value);
      } else {
        obj[key] = value;
      }
    }

    return transform ? transform(obj) : obj;
  }
}

/**
 * Create a JSON to CSV transform stream
 */
export function createJson2CsvStream(options: Json2CsvOptions = {}): Json2CsvStream {
  return new Json2CsvStream(options);
}

/**
 * Create a CSV to JSON transform stream
 */
export function createCsv2JsonStream(options: Csv2JsonOptions = {}): Csv2JsonStream {
  return new Csv2JsonStream(options);
}

export default { json2csv, csv2json, toCSV, toJSON };
