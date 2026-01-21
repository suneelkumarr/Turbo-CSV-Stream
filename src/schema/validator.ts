import { z } from 'zod';
import type {
  SchemaDefinition,
  ColumnDefinition,
  ColumnType,
  CSVRow,
  Primitive,
} from '../types';
import { TypeDetector } from '../utils/type-detector';

export interface ValidationResult {
  valid: boolean;
  data: CSVRow;
  errors: string[];
}

/**
 * Schema validator for CSV data
 * Supports both custom schema and Zod schemas
 */
export class SchemaValidator {
  private zodSchema?: z.ZodSchema;
  private customSchema?: SchemaDefinition;
  private typeDetector: TypeDetector;
  private columnSchemas: Map<string, z.ZodSchema> = new Map();

  constructor(schema: SchemaDefinition | z.ZodSchema) {
    this.typeDetector = new TypeDetector();
    
    if (schema instanceof z.ZodSchema) {
      this.zodSchema = schema;
    } else {
      this.customSchema = schema;
      this.buildColumnSchemas();
    }
  }

  /**
   * Validate a row against the schema
   */
  validate(row: CSVRow): ValidationResult {
    if (this.zodSchema) {
      return this.validateWithZod(row);
    }
    return this.validateWithCustomSchema(row);
  }

  /**
   * Validate multiple rows
   */
  validateAll(rows: CSVRow[]): { valid: CSVRow[]; invalid: { row: CSVRow; errors: string[] }[] } {
    const valid: CSVRow[] = [];
    const invalid: { row: CSVRow; errors: string[] }[] = [];

    for (const row of rows) {
      const result = this.validate(row);
      if (result.valid) {
        valid.push(result.data);
      } else {
        invalid.push({ row, errors: result.errors });
      }
    }

    return { valid, invalid };
  }

  /**
   * Infer schema from data
   */
  static inferSchema(rows: CSVRow[], sampleSize: number = 100): SchemaDefinition {
    if (rows.length === 0) {
      return { columns: [] };
    }

    const sample = rows.slice(0, sampleSize);
    const detector = new TypeDetector();
    const columns: ColumnDefinition[] = [];
    const headers = Object.keys(rows[0]!);

    for (const header of headers) {
      const values = sample.map(row => String(row[header] ?? ''));
      const type = detector.detectColumnType(values, sampleSize);
      const hasNulls = values.some(v => detector.isNull(v));

      columns.push({
        name: header,
        type,
        nullable: hasNulls,
      });
    }

    return { columns };
  }

  /**
   * Generate Zod schema from column definitions
   */
  static toZodSchema(schema: SchemaDefinition): z.ZodSchema {
    const shape: Record<string, z.ZodSchema> = {};

    for (const column of schema.columns) {
      let fieldSchema = SchemaValidator.typeToZod(column.type);

      if (column.nullable) {
        fieldSchema = fieldSchema.nullable();
      }

      if (column.validate) {
        fieldSchema = fieldSchema.refine(column.validate, {
          message: `Validation failed for ${column.name}`,
        });
      }

      shape[column.alias ?? column.name] = fieldSchema;
    }

    if (schema.strict) {
      return z.object(shape).strict();
    }

    return z.object(shape).passthrough();
  }

  private static typeToZod(type: ColumnType): z.ZodSchema {
    switch (type) {
      case 'string':
        return z.string();
      case 'number':
      case 'float':
        return z.number();
      case 'integer':
        return z.number().int();
      case 'boolean':
        return z.boolean();
      case 'date':
        return z.date();
      case 'json':
        return z.unknown();
      default:
        return z.string();
    }
  }

  private buildColumnSchemas(): void {
    if (!this.customSchema) return;

    for (const column of this.customSchema.columns) {
      let schema = SchemaValidator.typeToZod(column.type);

      if (column.nullable) {
        schema = schema.nullable();
      }

      if (column.validate) {
        schema = schema.refine(column.validate, {
          message: `Validation failed for ${column.name}`,
        });
      }

      this.columnSchemas.set(column.name, schema);
    }
  }

  private validateWithZod(row: CSVRow): ValidationResult {
    const result = this.zodSchema!.safeParse(row);
    
    if (result.success) {
      return {
        valid: true,
        data: result.data as CSVRow,
        errors: [],
      };
    }

    return {
      valid: false,
      data: row,
      errors: result.error.errors.map(
        e => `${e.path.join('.')}: ${e.message}`
      ),
    };
  }

  private validateWithCustomSchema(row: CSVRow): ValidationResult {
    if (!this.customSchema) {
      return { valid: true, data: row, errors: [] };
    }

    const errors: string[] = [];
    const data: CSVRow = {};
    const knownColumns = new Set(this.customSchema.columns.map(c => c.name));

    for (const column of this.customSchema.columns) {
      const value = row[column.name];
      const finalName = column.alias ?? column.name;

      // Handle missing values
      if (value === undefined || value === null) {
        if (!column.nullable) {
          if (column.default !== undefined) {
            data[finalName] = column.default;
          } else {
            errors.push(`${column.name}: Required field is missing`);
          }
        } else {
          data[finalName] = null;
        }
        continue;
      }

      // Transform value
      let transformedValue: Primitive;
      
      if (column.transform) {
        transformedValue = column.transform(String(value));
      } else if (this.customSchema.coerce) {
        transformedValue = this.typeDetector.convert(String(value), column.type);
      } else {
        transformedValue = value;
      }

      // Validate with Zod schema
      const schema = this.columnSchemas.get(column.name);
      if (schema) {
        const result = schema.safeParse(transformedValue);
        if (!result.success) {
          errors.push(`${column.name}: ${result.error.errors[0]?.message}`);
          continue;
        }
        data[finalName] = result.data;
      } else {
        data[finalName] = transformedValue;
      }

      // Custom validation
      if (column.validate && !column.validate(data[finalName])) {
        errors.push(`${column.name}: Custom validation failed`);
      }
    }

    // Handle unknown columns
    if (!this.customSchema.skipUnknown) {
      for (const key of Object.keys(row)) {
        if (!knownColumns.has(key)) {
          if (this.customSchema.strict) {
            errors.push(`Unknown column: ${key}`);
          } else {
            data[key] = row[key];
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      data,
      errors,
    };
  }
}

/**
 * Quick validation function
 */
export function validateCSV(
  data: CSVRow[],
  schema: SchemaDefinition | z.ZodSchema
): { valid: CSVRow[]; invalid: { row: CSVRow; errors: string[] }[] } {
  const validator = new SchemaValidator(schema);
  return validator.validateAll(data);
}