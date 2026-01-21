/**
 * Synchronous API Module
 * 
 * Provides synchronous versions of common CSV operations
 * for simpler use cases where async isn't needed.
 * 
 * Features:
 * - Synchronous parsing
 * - Synchronous stringify
 * - File operations
 * - Memory-efficient for small files
 */

import fs from 'fs';
import type { CSVRow, ParseResult, ParserOptions } from '../types';
import { CSVParser } from '../core/parser';
import { CSVLexer } from '../core/lexer';
import { json2csv, csv2json, Json2CsvOptions, Csv2JsonOptions } from '../utils/json-csv';
import { stringifyCSV, CSVWriterOptions } from '../io/writer';
import { SchemaValidator } from '../schema/validator';
import type { SchemaDefinition } from '../types';
import { ValidationError } from '../utils/validation';

// ============================================
// Types
// ============================================

export interface SyncParseOptions extends ParserOptions {
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
}

export interface SyncStringifyOptions extends CSVWriterOptions {
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
}

// ============================================
// Synchronous Parsing
// ============================================

/**
 * Parse CSV string synchronously
 */
export function parseSync(input: string, options: ParserOptions = {}): ParseResult {
  const parser = new CSVParser(options);
  return parser.parse(input);
}

/**
 * Parse CSV file synchronously
 */
export function parseFileSync(filePath: string, options: SyncParseOptions = {}): ParseResult {
  const encoding = options.encoding || 'utf-8';
  const content = fs.readFileSync(filePath, { encoding });
  return parseSync(content, options);
}

/**
 * Parse CSV to array of arrays synchronously (no header processing)
 */
export function parseRawSync(input: string, options: ParserOptions = {}): string[][] {
  const lexer = new CSVLexer(options);
  lexer.init(input);
  return lexer.parseAll();
}

/**
 * Parse CSV file to array of arrays synchronously
 */
export function parseRawFileSync(filePath: string, options: SyncParseOptions = {}): string[][] {
  const encoding = options.encoding || 'utf-8';
  const content = fs.readFileSync(filePath, { encoding });
  return parseRawSync(content, options);
}

// ============================================
// Synchronous Stringify
// ============================================

/**
 * Stringify data to CSV synchronously
 */
export function stringifySync(data: unknown, options: CSVWriterOptions = {}): string {
  if (!Array.isArray(data)) {
    throw new ValidationError(
      'data must be an array',
      'data',
      data,
      'array'
    );
  }
  return stringifyCSV(data, options);
}

/**
 * Write CSV to file synchronously
 */
export function writeFileSync(
  filePath: string,
  data: CSVRow[],
  options: SyncStringifyOptions = {}
): void {
  const encoding = options.encoding || 'utf-8';
  const csv = stringifyCSV(data, options);
  fs.writeFileSync(filePath, csv, { encoding });
}

// ============================================
// JSON Conversion (Sync)
// ============================================

/**
 * Convert JSON to CSV synchronously
 */
export function json2csvSync(data: Record<string, any>[], options: Json2CsvOptions = {}): string {
  return json2csv(data, options);
}

/**
 * Convert CSV to JSON synchronously
 */
export function csv2jsonSync(csv: string, options: Csv2JsonOptions = {}): Record<string, any>[] {
  return csv2json(csv, options);
}

/**
 * Convert JSON file to CSV file synchronously
 */
export function convertJsonToCsvFileSync(
  inputPath: string,
  outputPath: string,
  options: Json2CsvOptions & { encoding?: BufferEncoding } = {}
): void {
  const encoding = options.encoding || 'utf-8';
  const content = fs.readFileSync(inputPath, { encoding });
  const data = JSON.parse(content);
  const csv = json2csv(Array.isArray(data) ? data : [data], options);
  fs.writeFileSync(outputPath, csv, { encoding });
}

/**
 * Convert CSV file to JSON file synchronously
 */
export function convertCsvToJsonFileSync(
  inputPath: string,
  outputPath: string,
  options: Csv2JsonOptions & { encoding?: BufferEncoding; pretty?: boolean } = {}
): void {
  const encoding = options.encoding || 'utf-8';
  const content = fs.readFileSync(inputPath, { encoding });
  const data = csv2json(content, options);
  const json = options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  fs.writeFileSync(outputPath, json, { encoding });
}

// ============================================
// Validation (Sync)
// ============================================

/**
 * Validate CSV against schema synchronously
 */
export function validateSync(
  input: string,
  schema: SchemaDefinition,
  options: ParserOptions = {}
): { valid: boolean; errors: Array<{ row: number; field: string; message: string }> } {
  const parser = new CSVParser(options);
  const result = parser.parse(input);
  
  const validator = new SchemaValidator(schema);
  const errors: Array<{ row: number; field: string; message: string }> = [];

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i]!;
    const validation = validator.validate(row);
    
    if (!validation.valid) {
      for (const err of validation.errors) {
        errors.push({
          row: i + 1,
          field: 'unknown',
          message: err,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate CSV file against schema synchronously
 */
export function validateFileSync(
  filePath: string,
  schema: SchemaDefinition,
  options: SyncParseOptions = {}
): { valid: boolean; errors: Array<{ row: number; field: string; message: string }> } {
  const encoding = options.encoding || 'utf-8';
  const content = fs.readFileSync(filePath, { encoding });
  return validateSync(content, schema, options);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Count rows in CSV synchronously
 */
export function countRowsSync(input: string, options: ParserOptions = {}): number {
  const parser = new CSVParser(options);
  const result = parser.parse(input);
  return result.meta.rowCount;
}

/**
 * Get headers from CSV synchronously
 */
export function getHeadersSync(input: string, options: ParserOptions = {}): string[] {
  const parser = new CSVParser({ ...options, maxRows: 0 });
  const result = parser.parse(input);
  return result.meta.headers;
}

/**
 * Extract specific columns from CSV synchronously
 */
export function extractColumnsSync(
  input: string,
  columns: string[],
  options: ParserOptions = {}
): CSVRow[] {
  const parser = new CSVParser(options);
  const result = parser.parse(input);
  
  return result.data.map(row => {
    const newRow: CSVRow = {};
    for (const col of columns) {
      if (col in row) {
        newRow[col] = row[col];
      }
    }
    return newRow;
  });
}

/**
 * Filter rows from CSV synchronously
 */
export function filterRowsSync(
  input: string,
  predicate: (row: CSVRow, index: number) => boolean,
  options: ParserOptions = {}
): CSVRow[] {
  const parser = new CSVParser(options);
  const result = parser.parse(input);
  return result.data.filter(predicate);
}

/**
 * Transform rows from CSV synchronously
 */
export function transformRowsSync<T = CSVRow>(
  input: string,
  transform: (row: CSVRow, index: number) => T,
  options: ParserOptions = {}
): T[] {
  const parser = new CSVParser(options);
  const result = parser.parse(input);
  return result.data.map(transform);
}

/**
 * Aggregate CSV data synchronously
 */
export function aggregateSync<T>(
  input: string,
  reducer: (acc: T, row: CSVRow, index: number) => T,
  initialValue: T,
  options: ParserOptions = {}
): T {
  const parser = new CSVParser(options);
  const result = parser.parse(input);
  return result.data.reduce(reducer, initialValue);
}

// ============================================
// Quick Parse Functions
// ============================================

/**
 * Quick parse - returns just the data array
 */
export function parse(input: string, options: ParserOptions = {}): CSVRow[] {
  return parseSync(input, options).data;
}

/**
 * Quick parse file - returns just the data array
 */
export function parseFile(filePath: string, options: SyncParseOptions = {}): CSVRow[] {
  return parseFileSync(filePath, options).data;
}

/**
 * Quick stringify - alias for stringifySync
 */
export const stringify = stringifySync;

/**
 * Quick write file - alias for writeFileSync
 */
export const writeFile = writeFileSync;

export default {
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
  parseFile,
  stringify,
  writeFile,
};
