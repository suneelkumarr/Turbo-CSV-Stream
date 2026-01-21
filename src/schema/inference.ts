import type { ColumnDefinition, ColumnType, CSVRow, SchemaDefinition } from '../types';
import { TypeDetector } from '../utils/type-detector';

export interface InferenceOptions {
  sampleSize?: number;
  detectDates?: boolean;
  detectJSON?: boolean;
  nullThreshold?: number;
  confidenceThreshold?: number;
}

interface ColumnStats {
  name: string;
  types: Map<ColumnType, number>;
  nullCount: number;
  uniqueValues: Set<string>;
  minLength: number;
  maxLength: number;
  sampleValues: string[];
}

/**
 * Advanced schema inference from CSV data
 */
export class SchemaInference {
  private detector: TypeDetector;
  private options: Required<InferenceOptions>;

  constructor(options: InferenceOptions = {}) {
    this.options = {
      sampleSize: options.sampleSize ?? 1000,
      detectDates: options.detectDates ?? true,
      detectJSON: options.detectJSON ?? true,
      nullThreshold: options.nullThreshold ?? 0.5,
      confidenceThreshold: options.confidenceThreshold ?? 0.9,
    };
    this.detector = new TypeDetector();
  }

  /**
   * Infer schema from CSV data
   */
  infer(rows: CSVRow[]): SchemaDefinition {
    if (rows.length === 0) {
      return { columns: [] };
    }

    const sample = rows.slice(0, this.options.sampleSize);
    const headers = Object.keys(rows[0]!);
    const stats = this.collectStats(sample, headers);
    const columns = this.analyzeColumns(stats, sample.length);

    return {
      columns,
      strict: false,
      coerce: true,
    };
  }

  /**
   * Infer schema and generate TypeScript interface
   */
  inferWithTypeScript(rows: CSVRow[], interfaceName: string = 'CSVRow'): {
    schema: SchemaDefinition;
    typescript: string;
  } {
    const schema = this.infer(rows);
    const typescript = this.generateTypeScript(schema, interfaceName);
    return { schema, typescript };
  }

  /**
   * Collect statistics for each column
   */
  private collectStats(rows: CSVRow[], headers: string[]): Map<string, ColumnStats> {
    const stats = new Map<string, ColumnStats>();

    for (const header of headers) {
      stats.set(header, {
        name: header,
        types: new Map(),
        nullCount: 0,
        uniqueValues: new Set(),
        minLength: Infinity,
        maxLength: 0,
        sampleValues: [],
      });
    }

    for (const row of rows) {
      for (const header of headers) {
        const value = String(row[header] ?? '');
        const stat = stats.get(header)!;

        if (this.detector.isNull(value)) {
          stat.nullCount++;
          continue;
        }

        // Collect type information
        const type = this.detector.detectType(value);
        stat.types.set(type, (stat.types.get(type) ?? 0) + 1);

        // Collect value statistics
        stat.uniqueValues.add(value);
        stat.minLength = Math.min(stat.minLength, value.length);
        stat.maxLength = Math.max(stat.maxLength, value.length);

        // Collect sample values
        if (stat.sampleValues.length < 10) {
          stat.sampleValues.push(value);
        }
      }
    }

    return stats;
  }

  /**
   * Analyze column statistics and determine types
   */
  private analyzeColumns(stats: Map<string, ColumnStats>, rowCount: number): ColumnDefinition[] {
    const columns: ColumnDefinition[] = [];

    for (const [name, stat] of stats) {
      const nonNullCount = rowCount - stat.nullCount;
      const nullable = stat.nullCount / rowCount > this.options.nullThreshold;

      // Determine best type
      let bestType: ColumnType = 'string';
      let bestConfidence = 0;

      for (const [type, count] of stat.types) {
        const confidence = count / nonNullCount;
        if (confidence > bestConfidence && confidence >= this.options.confidenceThreshold) {
          bestType = type;
          bestConfidence = confidence;
        }
      }

      // Check for enum-like columns (limited unique values)
      const isEnum = stat.uniqueValues.size <= 10 && stat.uniqueValues.size < nonNullCount * 0.1;

      columns.push({
        name,
        type: bestType,
        nullable,
        ...(isEnum && { enumValues: Array.from(stat.uniqueValues) }),
      });
    }

    return columns;
  }

  /**
   * Generate TypeScript interface from schema
   */
  private generateTypeScript(schema: SchemaDefinition, interfaceName: string): string {
    const lines: string[] = [`export interface ${interfaceName} {`];

    for (const column of schema.columns) {
      const tsType = this.columnTypeToTS(column);
      const optional = column.nullable ? '?' : '';
      lines.push(`  ${this.escapePropertyName(column.name)}${optional}: ${tsType};`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  private columnTypeToTS(column: ColumnDefinition): string {
    const baseType = (() => {
      switch (column.type) {
        case 'string':
          return 'string';
        case 'number':
        case 'integer':
        case 'float':
          return 'number';
        case 'boolean':
          return 'boolean';
        case 'date':
          return 'Date';
        case 'json':
          return 'unknown';
        default:
          return 'string';
      }
    })();

    if (column.nullable) {
      return `${baseType} | null`;
    }
    return baseType;
  }

  private escapePropertyName(name: string): string {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      return name;
    }
    return `'${name.replace(/'/g, "\\'")}'`;
  }
}

/**
 * Quick inference function
 */
export function inferSchema(
  rows: CSVRow[],
  options?: InferenceOptions
): SchemaDefinition {
  const inference = new SchemaInference(options);
  return inference.infer(rows);
}