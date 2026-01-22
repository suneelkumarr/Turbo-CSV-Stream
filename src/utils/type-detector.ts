import type { Primitive, ColumnType } from '../types';

/**
 * High-performance type detection and conversion for CSV values
 * Automatically infers data types from string values
 */
export class TypeDetector {
  private readonly trueValues = new Set(['true', '1', 'yes', 'on', 'y']);
  private readonly falseValues = new Set(['false', '0', 'no', 'off', 'n', '']);
  private nullValues: Set<string>; // Changed to Set for O(1) lookup
  private booleanValues: { true: Set<string>; false: Set<string> };
  private dateFormats: string[] = [];

  // Pre-compiled regex for number detection
  // Optimization: Allow scientific notation (e.g. 1e10) which is standard JSON number format
  private static readonly NUMBER_REGEX = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

  constructor(options: { nullValues?: string[]; booleanValues?: { true: string[]; false: string[] }; dateFormats?: string[] } = {}) {
    // Optimization: Use Set for nullValues
    this.nullValues = options.nullValues 
      ? new Set(options.nullValues.map(v => v.toLowerCase())) 
      : new Set();

    if (options.booleanValues) {
      this.booleanValues = {
        true: new Set(options.booleanValues.true.map(v => v.toLowerCase())),
        false: new Set(options.booleanValues.false.map(v => v.toLowerCase())),
      };
    } else {
      // Default boolean values
      this.booleanValues = { true: this.trueValues, false: this.falseValues };
    }

    if (options.dateFormats) {
      this.dateFormats = options.dateFormats;
    }
  }

  /**
   * Detect the type of a value and convert it
   */
  detect(value: string): Primitive {
    // Fast path for empty string
    if (!value) {
      if (this.nullValues.has('')) return null;
      if (this.booleanValues.false.has('')) return false;
      return value;
    }

    // Optimization: Check for nulls first
    const lowerValue = value.toLowerCase();
    if (this.nullValues.size > 0 && this.nullValues.has(lowerValue)) {
      return null;
    }

    // Optimization: Try number first (most common non-string type)
    // and use regex test before Number() to avoid overhead of creating Number object for non-numbers
    if (TypeDetector.NUMBER_REGEX.test(value)) {
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
    }

    // Try boolean - reuse lowerValue
    if (this.booleanValues.true.has(lowerValue)) {
      return true;
    }
    if (this.booleanValues.false.has(lowerValue)) {
      return false;
    }

    // Try date - slowest check last
    if (this.dateFormats.length > 0) {
      for (const _format of this.dateFormats) {
        // Simple date parsing, can be improved
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Default to string
    return value;
  }


  /**
   * Alias for detect
   */
  autoConvert(value: string): Primitive {
    return this.detect(value);
  }

  /**
   * Detect type without conversion (for schema inference)
   */
  detectType(value: string): 'string' | 'number' | 'boolean' | 'date' | 'null' {
    if (this.isNull(value)) {
      return 'null';
    }

    if (/^-?\d+(\.\d+)?$/.test(value)) {
      const num = Number(value);
      if (!isNaN(num)) {
        return 'number';
      }
    }

    const lowerValue = value.toLowerCase();
    if (this.booleanValues.true.has(lowerValue) || this.booleanValues.false.has(lowerValue)) {
      return 'boolean';
    }

    for (const _format of this.dateFormats) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return 'date';
      }
    }

    return 'string';
  }

  /**
   * Check if a value represents null
   */
  isNull(value: string): boolean {
    return !value || this.nullValues.has(value.toLowerCase());
  }

  /**
   * Convert a value to a specific type
   */
  convert(value: string, type: string): Primitive {
    switch (type) {
      case 'number':
        const num = Number(value);
        return isNaN(num) ? null : num;
      case 'boolean':
        const lower = value.toLowerCase();
        if (this.booleanValues.true.has(lower)) return true;
        if (this.booleanValues.false.has(lower)) return false;
        return null;
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Detect column type from sample values
   */
  detectColumnType(values: string[], sampleSize: number = 100): ColumnType {
    const sample = values.slice(0, sampleSize);
    const types = new Map<string, number>();

    for (const value of sample) {
      const type = this.detectType(value);
      types.set(type, (types.get(type) ?? 0) + 1);
    }

    // Return the most common type
    let maxType: ColumnType = 'string';
    let maxCount = 0;
    for (const [type, count] of types) {
      if (count > maxCount) {
        maxCount = count;
        maxType = type as ColumnType;
      }
    }

    return maxType;
  }
}