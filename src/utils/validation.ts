/**
 * Input Validation Utilities
 * 
 * Provides validation helpers for all public API functions to ensure
 * robust error handling and helpful error messages.
 */

import type { ParserOptions, CSVRow } from '../types';

// ============================================
// Validation Error Class
// ============================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly parameter: string,
    public readonly value: any,
    public readonly expected: string
  ) {
    super(message);
    this.name = 'ValidationError';
    Error.captureStackTrace?.(this, ValidationError);
  }
}

// ============================================
// Type Guards
// ============================================

export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: any): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

export function isFunction(value: any): value is Function {
  return typeof value === 'function';
}

export function isNonEmptyString(value: any): value is string {
  return isString(value) && value.trim().length > 0;
}

export function isNonEmptyArray(value: any): value is any[] {
  return isArray(value) && value.length > 0;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate CSV string input
 */
export function validateCsvInput(csv: any, paramName: string = 'csv'): asserts csv is string {
  if (!isString(csv)) {
    throw new ValidationError(
      `${paramName} must be a string`,
      paramName,
      csv,
      'string'
    );
  }
}

/**
 * Validate array of objects input
 */
export function validateArrayInput(data: any, paramName: string = 'data'): asserts data is any[] {
  if (!isArray(data)) {
    throw new ValidationError(
      `${paramName} must be an array`,
      paramName,
      data,
      'array'
    );
  }
}

/**
 * Validate non-empty array
 */
export function validateNonEmptyArray(data: any, paramName: string = 'data'): asserts data is any[] {
  validateArrayInput(data, paramName);
  
  if (data.length === 0) {
    throw new ValidationError(
      `${paramName} must not be empty`,
      paramName,
      data,
      'non-empty array'
    );
  }
}

/**
 * Validate options object
 */
export function validateOptions(options: any, paramName: string = 'options'): void {
  if (options !== undefined && options !== null && !isObject(options)) {
    throw new ValidationError(
      `${paramName} must be an object`,
      paramName,
      options,
      'object'
    );
  }
}

/**
 * Validate delimiter
 */
export function validateDelimiter(delimiter: any, paramName: string = 'delimiter'): void {
  if (delimiter !== undefined && !isString(delimiter)) {
    throw new ValidationError(
      `${paramName} must be a string`,
      paramName,
      delimiter,
      'string'
    );
  }
  
  if (delimiter !== undefined && delimiter.length === 0) {
    throw new ValidationError(
      `${paramName} must not be empty`,
      paramName,
      delimiter,
      'non-empty string'
    );
  }
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: any, paramName: string): void {
  if (value !== undefined && (!isNumber(value) || value < 0 || !Number.isInteger(value))) {
    throw new ValidationError(
      `${paramName} must be a positive integer`,
      paramName,
      value,
      'positive integer'
    );
  }
}

/**
 * Validate parser options
 */
export function validateParserOptions(options: any): asserts options is ParserOptions {
  if (options === undefined || options === null) {
    return;
  }

  validateOptions(options, 'options');

  if (options.delimiter !== undefined) {
    validateDelimiter(options.delimiter, 'options.delimiter');
  }

  if (options.quote !== undefined && !isString(options.quote)) {
    throw new ValidationError(
      'options.quote must be a string',
      'options.quote',
      options.quote,
      'string'
    );
  }

  if (options.maxRows !== undefined) {
    validatePositiveInteger(options.maxRows, 'options.maxRows');
  }

  if (options.skipLines !== undefined) {
    validatePositiveInteger(options.skipLines, 'options.skipLines');
  }

  if (options.header !== undefined && !isBoolean(options.header) && !isArray(options.header)) {
    throw new ValidationError(
      'options.header must be a boolean or array',
      'options.header',
      options.header,
      'boolean | string[]'
    );
  }
}

/**
 * Validate file path
 */
export function validateFilePath(filePath: any, paramName: string = 'filePath'): asserts filePath is string {
  if (!isString(filePath)) {
    throw new ValidationError(
      `${paramName} must be a string`,
      paramName,
      filePath,
      'string'
    );
  }

  if (filePath.trim().length === 0) {
    throw new ValidationError(
      `${paramName} must not be empty`,
      paramName,
      filePath,
      'non-empty string'
    );
  }
}

/**
 * Validate column names array
 */
export function validateColumnNames(columns: any, paramName: string = 'columns'): asserts columns is string[] {
  validateArrayInput(columns, paramName);

  for (let i = 0; i < columns.length; i++) {
    if (!isString(columns[i])) {
      throw new ValidationError(
        `${paramName}[${i}] must be a string`,
        `${paramName}[${i}]`,
        columns[i],
        'string'
      );
    }
  }
}

/**
 * Validate function parameter
 */
export function validateFunction(fn: any, paramName: string): asserts fn is Function {
  if (!isFunction(fn)) {
    throw new ValidationError(
      `${paramName} must be a function`,
      paramName,
      fn,
      'function'
    );
  }
}

/**
 * Validate CSV row
 */
export function validateCsvRow(row: any, paramName: string = 'row'): asserts row is CSVRow {
  if (!isObject(row)) {
    throw new ValidationError(
      `${paramName} must be an object`,
      paramName,
      row,
      'object'
    );
  }
}

/**
 * Validate seed value
 */
export function validateSeed(seed: any, paramName: string = 'seed'): void {
  if (seed !== undefined && !isNumber(seed)) {
    throw new ValidationError(
      `${paramName} must be a number`,
      paramName,
      seed,
      'number'
    );
  }
}

/**
 * Validate range
 */
export function validateRange(min: any, max: any, paramPrefix: string = ''): void {
  if (min !== undefined && !isNumber(min)) {
    throw new ValidationError(
      `${paramPrefix}min must be a number`,
      `${paramPrefix}min`,
      min,
      'number'
    );
  }

  if (max !== undefined && !isNumber(max)) {
    throw new ValidationError(
      `${paramPrefix}max must be a number`,
      `${paramPrefix}max`,
      max,
      'number'
    );
  }

  if (min !== undefined && max !== undefined && min > max) {
    throw new ValidationError(
      `${paramPrefix}min must be less than or equal to max`,
      `${paramPrefix}min`,
      { min, max },
      'min <= max'
    );
  }
}

// ============================================
// Safe Wrappers
// ============================================

/**
 * Safely execute a function with error wrapping
 */
export function safeExecute<T>(
  fn: () => T,
  operation: string,
  onError?: (error: Error) => T
): T {
  try {
    return fn();
  } catch (error) {
    if (onError) {
      return onError(error as Error);
    }

    // Wrap unknown errors
    if (!(error instanceof ValidationError)) {
      const wrappedError = new Error(`${operation} failed: ${(error as Error).message}`);
      wrappedError.cause = error;
      throw wrappedError;
    }

    throw error;
  }
}

/**
 * Safely execute async function with error wrapping
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  operation: string,
  onError?: (error: Error) => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (onError) {
      return await onError(error as Error);
    }

    // Wrap unknown errors
    if (!(error instanceof ValidationError)) {
      const wrappedError = new Error(`${operation} failed: ${(error as Error).message}`);
      wrappedError.cause = error;
      throw wrappedError;
    }

    throw error;
  }
}

export default {
  ValidationError,
  validateCsvInput,
  validateArrayInput,
  validateNonEmptyArray,
  validateOptions,
  validateDelimiter,
  validatePositiveInteger,
  validateParserOptions,
  validateFilePath,
  validateColumnNames,
  validateFunction,
  validateCsvRow,
  validateSeed,
  validateRange,
  safeExecute,
  safeExecuteAsync,
};
