import type { CSVRow, Primitive } from '../types';

/**
 * Advanced Field Selector System
 * 
 * Features:
 * - Underscore-like property access (nested paths)
 * - Default values for missing fields
 * - Transform functions per field
 * - Custom getters
 * - Field aliasing
 * - Computed fields
 */

export interface FieldSelectorOptions {
  /** Default value for missing fields */
  default?: Primitive;
  /** Transform function applied after extraction */
  transform?: (value: Primitive, row: CSVRow) => Primitive;
  /** Custom getter function */
  getter?: (row: CSVRow) => Primitive;
  /** Output field name (alias) */
  as?: string;
  /** Whether to trim string values */
  trim?: boolean;
  /** Parse as specific type */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'auto';
}

export interface FieldDefinition {
  /** Field name or path */
  field: string;
  /** Selector options */
  options?: FieldSelectorOptions;
}

export type FieldSelectorInput = 
  | string 
  | FieldDefinition 
  | [string, FieldSelectorOptions];

/**
 * Parse field selector string with underscore-like syntax
 * Supports: "field", "nested.path", "field:alias", "field|default"
 */
export function parseFieldSelector(input: string): FieldDefinition {
  let field = input;
  const options: FieldSelectorOptions = {};

  // Handle type hint syntax first: "field::type" (before alias to avoid :: being matched as :)
  const typeMatch = field.match(/^(.+)::(\w+)$/);
  if (typeMatch) {
    field = typeMatch[1]!;
    const typeStr = typeMatch[2];
    if (typeStr === 'string' || typeStr === 'number' || typeStr === 'boolean' || typeStr === 'date' || typeStr === 'auto') {
      options.type = typeStr;
    }
  }

  // Handle alias syntax: "field:alias" (single colon, not double)
  const aliasMatch = field.match(/^([^:]+):([^:]+)$/);
  if (aliasMatch) {
    field = aliasMatch[1]!;
    options.as = aliasMatch[2]!;
  }

  // Handle default value syntax: "field|default"
  const defaultMatch = field.match(/^(.+)\|(.*)$/);
  if (defaultMatch) {
    field = defaultMatch[1]!;
    options.default = defaultMatch[2]!;
  }

  return { field, options };
}

/**
 * Normalize various field selector inputs to a standard format
 */
export function normalizeFieldSelector(input: FieldSelectorInput): FieldDefinition {
  if (typeof input === 'string') {
    return parseFieldSelector(input);
  }
  
  if (Array.isArray(input)) {
    return { field: input[0], options: input[1] };
  }
  
  return input;
}

/**
 * Get a nested value from an object using dot notation path
 */
export function getNestedValue(obj: CSVRow, path: string): Primitive {
  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // Handle array access: "items[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]!];
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2]!, 10)];
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }

  return current as Primitive;
}

/**
 * Set a nested value in an object using dot notation path
 * Supports array index syntax: "items[0].name"
 */
export function setNestedValue(obj: CSVRow, path: string, value: Primitive): void {
  const parts = path.split('.');
  let current: any = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    
    // Handle array access: "items[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arrayKey = arrayMatch[1]!;
      const arrayIndex = parseInt(arrayMatch[2]!, 10);
      
      if (current[arrayKey] === undefined) {
        current[arrayKey] = [];
      }
      if (current[arrayKey][arrayIndex] === undefined) {
        // Determine if next part needs an object or array
        const nextPart = parts[i + 1]!;
        const nextArrayMatch = nextPart.match(/^(\w+)\[(\d+)\]$/);
        current[arrayKey][arrayIndex] = nextArrayMatch || /^\d+$/.test(nextPart) ? [] : {};
      }
      current = current[arrayKey][arrayIndex];
    } else {
      if (current[part] === undefined) {
        // Create nested object or array based on next part
        const nextPart = parts[i + 1]!;
        const nextArrayMatch = nextPart.match(/^(\w+)\[(\d+)\]$/);
        current[part] = nextArrayMatch || /^\d+$/.test(nextPart) ? [] : {};
      }
      current = current[part];
    }
  }

  // Handle final part (also may have array syntax)
  const lastPart = parts[parts.length - 1]!;
  const lastArrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);
  if (lastArrayMatch) {
    const arrayKey = lastArrayMatch[1]!;
    const arrayIndex = parseInt(lastArrayMatch[2]!, 10);
    if (current[arrayKey] === undefined) {
      current[arrayKey] = [];
    }
    current[arrayKey][arrayIndex] = value;
  } else {
    current[lastPart] = value;
  }
}

/**
 * Convert value to specified type
 */
export function coerceType(value: Primitive, type: FieldSelectorOptions['type']): Primitive {
  if (value === null || value === undefined) {
    return value;
  }

  switch (type) {
    case 'string':
      return String(value);
    
    case 'number':
      const num = Number(value);
      return isNaN(num) ? value : num;
    
    case 'boolean':
      if (typeof value === 'boolean') return value;
      const str = String(value).toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(str)) return true;
      if (['false', '0', 'no', 'off', ''].includes(str)) return false;
      return value;
    
    case 'date':
      if (value instanceof Date) return value;
      const date = new Date(value as string | number);
      return isNaN(date.getTime()) ? value : date;
    
    case 'auto':
      return autoCoerce(value);
    
    default:
      return value;
  }
}

/**
 * Auto-detect and coerce value type
 */
export function autoCoerce(value: Primitive): Primitive {
  if (value === null || value === undefined || typeof value !== 'string') {
    return value;
  }

  const str = value.trim();
  
  // Empty string
  if (str === '') return '';
  
  // Boolean
  if (str.toLowerCase() === 'true') return true;
  if (str.toLowerCase() === 'false') return false;
  
  // Null
  if (str.toLowerCase() === 'null') return null;
  
  // Number (integer or float)
  if (/^-?\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (!isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER) {
      return num;
    }
  }
  
  if (/^-?\d+\.?\d*(?:e[+-]?\d+)?$/i.test(str)) {
    const num = parseFloat(str);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  
  // ISO Date
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(str)) {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return value;
}

/**
 * Field Selector class for extracting and transforming fields
 */
export class FieldSelector {
  private selectors: FieldDefinition[];

  constructor(selectors: FieldSelectorInput[]) {
    this.selectors = selectors.map(normalizeFieldSelector);
  }

  /**
   * Extract a single field from a row
   */
  extractField(row: CSVRow, selector: FieldDefinition): Primitive {
    const { field, options = {} } = selector;
    let value: Primitive;

    // Use custom getter if provided
    if (options.getter) {
      value = options.getter(row);
    } else {
      value = getNestedValue(row, field);
    }

    // Apply default value if missing
    if ((value === undefined || value === null) && options.default !== undefined) {
      value = options.default;
    }

    // Trim strings
    if (options.trim && typeof value === 'string') {
      value = value.trim();
    }

    // Coerce type
    if (options.type) {
      value = coerceType(value, options.type);
    }

    // Apply transform
    if (options.transform) {
      value = options.transform(value, row);
    }

    return value;
  }

  /**
   * Extract selected fields from a row
   */
  extract(row: CSVRow): CSVRow {
    const result: CSVRow = {};

    for (const selector of this.selectors) {
      const value = this.extractField(row, selector);
      const outputKey = selector.options?.as || selector.field;
      setNestedValue(result, outputKey, value);
    }

    return result;
  }

  /**
   * Extract fields from multiple rows
   */
  extractAll(rows: CSVRow[]): CSVRow[] {
    return rows.map(row => this.extract(row));
  }
}

/**
 * Create a field selector from various input formats
 */
export function createFieldSelector(selectors: FieldSelectorInput[]): FieldSelector {
  return new FieldSelector(selectors);
}

/**
 * Quick select function for simple field extraction
 */
export function selectFields(
  rows: CSVRow[],
  fields: FieldSelectorInput[]
): CSVRow[] {
  const selector = new FieldSelector(fields);
  return selector.extractAll(rows);
}

/**
 * Pick specific fields from a row (simple version)
 */
export function pick(row: CSVRow, fields: string[]): CSVRow {
  const result: CSVRow = {};
  for (const field of fields) {
    if (field in row) {
      result[field] = row[field];
    }
  }
  return result;
}

/**
 * Omit specific fields from a row
 */
export function omit(row: CSVRow, fields: string[]): CSVRow {
  const result: CSVRow = { ...row };
  for (const field of fields) {
    delete result[field];
  }
  return result;
}

/**
 * Rename fields in a row
 */
export function rename(row: CSVRow, mapping: Record<string, string>): CSVRow {
  const result: CSVRow = { ...row };
  for (const [oldKey, newKey] of Object.entries(mapping)) {
    if (oldKey in result) {
      result[newKey] = result[oldKey];
      delete result[oldKey];
    }
  }
  return result;
}

/**
 * Add computed fields to a row
 */
export function addFields(
  row: CSVRow,
  computedFields: Record<string, (row: CSVRow) => Primitive>
): CSVRow {
  const result: CSVRow = { ...row };
  for (const [key, compute] of Object.entries(computedFields)) {
    result[key] = compute(row);
  }
  return result;
}
