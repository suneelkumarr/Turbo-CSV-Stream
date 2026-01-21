/**
 * Enhanced Nested JSON to CSV Converter
 * 
 * Advanced features for handling deeply nested JSON structures:
 * - Multiple nesting strategies (flatten, expand, preserve)
 * - Array handling (expand columns, join values, create rows)
 * - Deep object traversal with configurable depth
 * - Type preservation and custom transformers
 * - Path-based column naming
 * - Circular reference detection
 * - Memory-efficient streaming for large datasets
 */

import type { Primitive } from '../types';
import { Transform, TransformCallback } from 'stream';

// ============================================
// Types
// ============================================

export type NestedStrategy = 'flatten' | 'expand' | 'preserve' | 'ignore';
export type ArrayStrategy = 'join' | 'expand-columns' | 'expand-rows' | 'first' | 'last';

export interface NestedJsonToCsvOptions {
  /** Strategy for nested objects (default: 'flatten') */
  nestedStrategy?: NestedStrategy;
  
  /** Strategy for array values (default: 'join') */
  arrayStrategy?: ArrayStrategy;
  
  /** Maximum depth to traverse (default: Infinity) */
  maxDepth?: number;
  
  /** Path separator for flattened keys (default: '.') */
  pathSeparator?: string;
  
  /** Array join separator (default: ',') */
  arrayJoinSeparator?: string;
  
  /** Array index notation (default: 'brackets') - brackets: [0], underscore: _0, none */
  arrayIndexNotation?: 'brackets' | 'underscore' | 'none';
  
  /** CSV delimiter (default: ',') */
  delimiter?: string;
  
  /** Quote character (default: '"') */
  quote?: string;
  
  /** Include header (default: true) */
  header?: boolean;
  
  /** End of line (default: '\n') */
  eol?: string;
  
  /** Exclude specific paths (glob patterns supported) */
  excludePaths?: string[];
  
  /** Include only specific paths */
  includePaths?: string[];
  
  /** Custom type handlers */
  typeHandlers?: Record<string, (value: any, path: string) => Primitive>;
  
  /** Null/undefined representation (default: '') */
  nullValue?: string;
  
  /** Handle circular references (default: true) */
  detectCircular?: boolean;
  
  /** Circular reference placeholder */
  circularValue?: string;
  
  /** Sort columns alphabetically */
  sortColumns?: boolean;
  
  /** Preserve column order from first object */
  preserveOrder?: boolean;
  
  /** Wrap all values in quotes */
  alwaysQuote?: boolean;
  
  /** Skip empty objects/arrays */
  skipEmpty?: boolean;
  
  /** Custom column name transformer */
  columnNameTransform?: (path: string) => string;
  
  /** Include type suffix in column names */
  includeTypeSuffix?: boolean;
  
  /** Validate JSON structure before conversion */
  validate?: boolean;
  
  /** Error handling mode */
  onError?: 'throw' | 'skip' | 'placeholder';
  
  /** Placeholder for error values */
  errorPlaceholder?: string;
}

export interface NestedPath {
  path: string;
  type: string;
  depth: number;
  isArray: boolean;
  arrayIndex?: number;
}

export interface ConversionResult {
  csv: string;
  columns: string[];
  rowCount: number;
  errors: Array<{ row: number; path: string; error: string }>;
  skipped: number;
  warnings: string[];
}

// ============================================
// Error Classes
// ============================================

export class NestedConversionError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly value: any,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NestedConversionError';
  }
}

export class CircularReferenceError extends Error {
  constructor(public readonly path: string) {
    super(`Circular reference detected at path: ${path}`);
    this.name = 'CircularReferenceError';
  }
}

// ============================================
// Path Utilities
// ============================================

/**
 * Build a path string with proper notation
 */
export function buildPath(
  parts: string[],
  separator: string = '.',
  arrayNotation: 'brackets' | 'underscore' | 'none' = 'brackets'
): string {
  let result = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    
    if (i === 0) {
      result = part;
      continue;
    }
    
    // Check if part is array index
    if (/^\d+$/.test(part)) {
      if (arrayNotation === 'brackets') {
        result += `[${part}]`;
      } else if (arrayNotation === 'underscore') {
        result += `_${part}`;
      } else {
        result += separator + part;
      }
    } else {
      result += separator + part;
    }
  }
  
  return result;
}

/**
 * Check if path matches pattern (supports wildcards)
 */
export function matchPath(path: string, pattern: string): boolean {
  // Exact match
  if (path === pattern) return true;
  
  // Convert glob pattern to regex
  // * matches any characters except dot (single level)
  // ? matches single character
  const regexPattern = pattern
    .replace(/\./g, '\.')
    .replace(/\*/g, '[^.]*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Check if a path should be included based on include/exclude patterns
 */
export function shouldIncludePath(
  path: string,
  includePaths?: string[],
  excludePaths?: string[]
)
: boolean {
  if (excludePaths && excludePaths.some(pattern => matchPath(path, pattern))) {
    return false;
  }
  
  if (includePaths && includePaths.length > 0) {
    return includePaths.some(pattern => matchPath(path, pattern));
  }
  
  return true;
}

/**
 * Alias for shouldIncludePath for backwards compatibility
 */
export const filterPaths = shouldIncludePath;

// ============================================
// Value Extraction
// ============================================

/**
 * Extract all paths and values from nested object
 */
export function extractNestedPaths(
  obj: any,
  options: NestedJsonToCsvOptions = {},
  visited: Set<any> = new Set(),
  currentPath: string[] = [],
  currentDepth: number = 0
): Map<string, any> {
  const {
    maxDepth = Infinity,
    pathSeparator = '.',
    arrayIndexNotation = 'brackets',
    detectCircular = true,
    circularValue = '[Circular]',
    skipEmpty = false,
    arrayStrategy = 'join',
    nestedStrategy = 'flatten',
  } = options;

  const result = new Map<string, any>();

  // Check depth limit
  if (currentDepth >= maxDepth) {
    const path = buildPath(currentPath, pathSeparator, arrayIndexNotation);
    result.set(path, obj);
    return result;
  }

  // Check for null/undefined
  if (obj === null || obj === undefined) {
    const path = buildPath(currentPath, pathSeparator, arrayIndexNotation);
    result.set(path, obj);
    return result;
  }

  // Check for circular reference
  if (detectCircular && typeof obj === 'object' && visited.has(obj)) {
    const path = buildPath(currentPath, pathSeparator, arrayIndexNotation);
    result.set(path, circularValue);
    return result;
  }

  // Add to visited set
  if (typeof obj === 'object') {
    visited.add(obj);
  }

  // Handle primitives and dates
  if (typeof obj !== 'object' || obj instanceof Date) {
    const path = buildPath(currentPath, pathSeparator, arrayIndexNotation);
    result.set(path, obj);
    return result;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    if (skipEmpty && obj.length === 0) {
      return result;
    }

    if (arrayStrategy === 'join') {
      const path = buildPath(currentPath, pathSeparator, arrayIndexNotation);
      result.set(path, obj);
      return result;
    } else if (arrayStrategy === 'first') {
      if (obj.length > 0) {
        return extractNestedPaths(obj[0], options, visited, currentPath, currentDepth);
      }
      return result;
    } else if (arrayStrategy === 'last') {
      if (obj.length > 0) {
        return extractNestedPaths(obj[obj.length - 1], options, visited, currentPath, currentDepth);
      }
      return result;
    } else if (arrayStrategy === 'expand-columns') {
      // Expand array elements into separate columns
      for (let i = 0; i < obj.length; i++) {
        const element = obj[i];
        const elementPaths = extractNestedPaths(
          element,
          options,
          new Set(visited),
          [...currentPath, String(i)],
          currentDepth + 1
        );
        
        for (const [p, v] of elementPaths) {
          result.set(p, v);
        }
      }
      return result;
    }
  }

  // Handle objects
  if (skipEmpty && Object.keys(obj).length === 0) {
    return result;
  }

  if (nestedStrategy === 'preserve' && currentDepth > 0) {
    const path = buildPath(currentPath, pathSeparator, arrayIndexNotation);
    result.set(path, JSON.stringify(obj));
    return result;
  }

  if (nestedStrategy === 'ignore' && currentDepth > 0) {
    return result;
  }

  // Flatten object
  for (const [key, value] of Object.entries(obj)) {
    const newPath = [...currentPath, key];
    const valuePaths = extractNestedPaths(
      value,
      options,
      new Set(visited),
      newPath,
      currentDepth + 1
    );
    
    for (const [p, v] of valuePaths) {
      result.set(p, v);
    }
  }

  return result;
}

/**
 * Convert value to CSV-safe string
 */
export function valueToString(
  value: any,
  options: NestedJsonToCsvOptions = {}
): string {
  const {
    nullValue = '',
    arrayJoinSeparator = ',',
    typeHandlers = {},
  } = options;

  if (value === null || value === undefined) {
    return nullValue;
  }

  // Check custom type handlers
  const valueType = typeof value;
  if (typeHandlers[valueType]) {
    try {
      return String(typeHandlers[valueType]!(value, ''));
    } catch (e) {
      return String(value);
    }
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(v => valueToString(v, options)).join(arrayJoinSeparator);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Escape CSV field
 */
export function escapeCSVField(
  value: string,
  delimiter: string = ',',
  quote: string = '"',
  alwaysQuote: boolean = false
): string {
  const needsQuoting = alwaysQuote ||
    value.includes(delimiter) ||
    value.includes(quote) ||
    value.includes('\n') ||
    value.includes('\r');

  if (needsQuoting) {
    return quote + value.replace(new RegExp(quote, 'g'), quote + quote) + quote;
  }

  return value;
}

// ============================================
// Main Conversion Function
// ============================================

/**
 * Convert nested JSON array to CSV with advanced options
 */
export function nestedJson2Csv(
  data: any[],
  options: NestedJsonToCsvOptions = {}
): ConversionResult {
  const errors: Array<{ row: number; path: string; error: string }> = [];
  const warnings: string[] = [];
  let skipped = 0;

  try {
    // Validate input
    if (!Array.isArray(data)) {
      throw new NestedConversionError(
        'Input must be an array',
        '',
        data
      );
    }

    if (data.length === 0) {
      return {
        csv: options.header !== false ? '' : '',
        columns: [],
        rowCount: 0,
        errors: [],
        skipped: 0,
        warnings: [],
      };
    }

    const {
      delimiter = ',',
      quote = '"',
      eol = '\n',
      header = true,
      alwaysQuote = false,
      sortColumns = false,
      preserveOrder = true,
      columnNameTransform,
      includeTypeSuffix = false,
      onError = 'throw',
      errorPlaceholder = '[ERROR]',
    } = options;

    // Extract all unique columns from all objects
    const allColumns = new Set<string>();
    const processedRows: Map<string, string>[] = [];

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      try {
        const obj = data[rowIndex];
        
        // Skip null/undefined rows when onError is 'skip'
        if ((obj === null || obj === undefined) && onError === 'skip') {
          skipped++;
          warnings.push(`Skipped row ${rowIndex}: null or undefined value`);
          continue;
        }
        
        const paths = extractNestedPaths(obj, options);
        const rowData = new Map<string, string>();

        for (const [path, value] of paths) {
          // Filter paths
          if (!filterPaths(path, options.includePaths, options.excludePaths)) {
            continue;
          }

          let columnName = path;
          
          // Transform column name
          if (columnNameTransform) {
            columnName = columnNameTransform(columnName);
          }

          // Add type suffix
          if (includeTypeSuffix && value !== null && value !== undefined) {
            const type = Array.isArray(value) ? 'array' : 
                        value instanceof Date ? 'date' :
                        typeof value;
            columnName = `${columnName}_${type}`;
          }

          allColumns.add(columnName);
          rowData.set(columnName, valueToString(value, options));
        }

        processedRows.push(rowData);
      } catch (error) {
        if (onError === 'throw') {
          throw error;
        } else if (onError === 'skip') {
          skipped++;
          warnings.push(`Skipped row ${rowIndex}: ${(error as Error).message}`);
        } else {
          // placeholder mode
          errors.push({
            row: rowIndex,
            path: '',
            error: (error as Error).message,
          });
          processedRows.push(new Map([['_error', errorPlaceholder]]));
        }
      }
    }

    // Sort or preserve column order
    let columns = Array.from(allColumns);
    
    if (sortColumns) {
      columns.sort();
    } else if (preserveOrder) {
      // Preserve order from first object
      const firstRow = processedRows[0];
      if (firstRow) {
        const firstRowCols = Array.from(firstRow.keys());
        columns = [...firstRowCols, ...columns.filter(c => !firstRowCols.includes(c))];
      }
    }

    // Build CSV
    const lines: string[] = [];

    // Header
    if (header) {
      const headerLine = columns
        .map(col => escapeCSVField(col, delimiter, quote, alwaysQuote))
        .join(delimiter);
      lines.push(headerLine);
    }

    // Data rows
    for (const rowData of processedRows) {
      const values = columns.map(col => {
        const value = rowData.get(col) || options.nullValue || '';
        return escapeCSVField(value, delimiter, quote, alwaysQuote);
      });
      lines.push(values.join(delimiter));
    }

    return {
      csv: lines.join(eol) + (lines.length > 0 ? eol : ''),
      columns,
      rowCount: processedRows.length,
      errors,
      skipped,
      warnings,
    };

  } catch (error) {
    if (error instanceof NestedConversionError || error instanceof CircularReferenceError) {
      throw error;
    }
    throw new NestedConversionError(
      `Conversion failed: ${(error as Error).message}`,
      '',
      data,
      error as Error
    );
  }
}

/**
 * Validate nested JSON structure
 */
export function validateNestedJson(
  data: any[],
  options: NestedJsonToCsvOptions = {}
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!Array.isArray(data)) {
      errors.push('Input must be an array');
      return { valid: false, errors, warnings };
    }

    if (data.length === 0) {
      warnings.push('Input array is empty');
    }

    // Check for circular references if enabled
    if (options.detectCircular !== false) {
      for (let i = 0; i < data.length; i++) {
        const visited = new Set();
        
        const checkCircular = (obj: any, path: string = `[${i}]`): void => {
          if (obj === null || typeof obj !== 'object') return;
          
          if (visited.has(obj)) {
            errors.push(`Circular reference detected at ${path}`);
            return;
          }
          
          visited.add(obj);
          
          if (Array.isArray(obj)) {
            obj.forEach((item, idx) => checkCircular(item, `${path}[${idx}]`));
          } else {
            for (const [key, value] of Object.entries(obj)) {
              checkCircular(value, `${path}.${key}`);
            }
          }
        };
        
        checkCircular(data[i]);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };

  } catch (error) {
    errors.push(`Validation failed: ${(error as Error).message}`);
    return { valid: false, errors, warnings };
  }
}

// ============================================
// Streaming Converter
// ============================================

/**
 * Transform stream for nested JSON to CSV
 */
export class NestedJson2CsvStream extends Transform {
  private options: NestedJsonToCsvOptions;
  private columns: string[] | null = null;
  private headerWritten = false;
  private rowIndex = 0;

  constructor(options: NestedJsonToCsvOptions = {}) {
    super({ objectMode: true });
    this.options = options;
  }

  _transform(chunk: any, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      // Skip null/undefined chunks when onError is 'skip'
      if ((chunk === null || chunk === undefined) && this.options.onError === 'skip') {
        callback();
        return;
      }
      
      const result = nestedJson2Csv([chunk], { ...this.options, header: false });
      if (!this.columns) {
        this.columns = result.columns;
        
        // Write header
        if (this.options.header !== false && !this.headerWritten) {
          const headerLine = this.columns
            .map(col => escapeCSVField(col, this.options.delimiter || ',', this.options.quote || '"', this.options.alwaysQuote))
            .join(this.options.delimiter || ',');
          this.push(headerLine + (this.options.eol || '\n'));
          this.headerWritten = true;
        }
      }

      // Write data row
      if (result.csv.trim()) {
        this.push(result.csv);
      }

      this.rowIndex++;
      callback();

    } catch (error) {
      if (this.options.onError === 'skip') {
        callback();
      } else {
        callback(error as Error);
      }
    }
  }
}

/**
 * Create nested JSON to CSV stream
 */
export function createNestedJson2CsvStream(options: NestedJsonToCsvOptions = {}): NestedJson2CsvStream {
  return new NestedJson2CsvStream(options);
}

export default {
  nestedJson2Csv,
  validateNestedJson,
  createNestedJson2CsvStream,
  extractNestedPaths,
  buildPath,
  matchPath,
  filterPaths,
};
