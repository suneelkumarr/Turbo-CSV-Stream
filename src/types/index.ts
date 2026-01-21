import { z } from 'zod';

// ============================================
// Core Types
// ============================================

export type Primitive = string | number | boolean | null | undefined | Date;

export type CSVRow = Record<string, Primitive>;

export type CSVData<T = CSVRow> = T[];

export type ColumnType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'integer' 
  | 'float' 
  | 'json' 
  | 'null'
  | 'auto';

export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  default?: Primitive;
  transform?: (value: string) => Primitive;
  validate?: (value: Primitive) => boolean;
  alias?: string;
}

export interface SchemaDefinition {
  columns: ColumnDefinition[];
  strict?: boolean;
  skipUnknown?: boolean;
  coerce?: boolean;
}

// ============================================
// Parser Options
// ============================================

export interface ParserOptions {
  // Delimiter options
  delimiter?: string;
  quote?: string;
  escape?: string;
  comment?: string;
  
  // EOL options
  eol?: string | 'auto';  // Custom line ending: '\n', '\r\n', '\r', or custom
  
  // Header options
  header?: boolean | string[];
  skipHeader?: boolean;
  renameHeaders?: Record<string, string>;
  
  // Row options
  skipEmptyLines?: boolean;
  skipLines?: number;
  maxRows?: number;
  fromLine?: number;
  toLine?: number;
  
  // Type handling
  dynamicTyping?: boolean | string[] | ((header: string) => boolean);
  dateFormats?: string[];
  nullValues?: string[];
  booleanValues?: { true: string[]; false: string[] };
  
  // Error handling
  relaxColumnCount?: boolean;
  relaxQuotes?: boolean;
  onError?: 'throw' | 'skip' | 'recover' | ErrorHandler;
  maxErrors?: number;
  errorThreshold?: number;
  
  // Encoding
  encoding?: BufferEncoding;
  bom?: boolean;
  
  // Performance
  chunkSize?: number;
  highWaterMark?: number;
  
  // Schema
  schema?: SchemaDefinition | z.ZodSchema;
  
  // Transformations
  transform?: TransformFunction;
  filter?: FilterFunction;
  
  // Advanced
  ltrim?: boolean;
  rtrim?: boolean;
  trim?: boolean;
  cast?: CastFunction;
  columns?: string[] | boolean | ColumnsFunction;
  
  // Worker options
  workers?: number;
  workerData?: unknown;
  
  // Batch processing
  batchSize?: number;
}

export type ErrorHandler = (error: ParseError, row: number) => 'skip' | 'recover' | void;
export type TransformFunction = (row: CSVRow, index: number) => CSVRow | null;
export type FilterFunction = (row: CSVRow, index: number) => boolean;
export type CastFunction = (value: string, context: CastContext) => Primitive;
export type ColumnsFunction = (headers: string[]) => string[];

export interface CastContext {
  column: string | number;
  header: string;
  index: number;
  lines: number;
  quoting: boolean;
}

// ============================================
// Error Types
// ============================================

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly line: number,
    public readonly column: number,
    public row?: number,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ParseError';
    Error.captureStackTrace?.(this, ParseError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      line: this.line,
      column: this.column,
      row: this.row,
      field: this.field,
    };
  }
}

export type ErrorCode =
  | 'INVALID_QUOTE'
  | 'UNCLOSED_QUOTE'
  | 'INVALID_ESCAPE'
  | 'COLUMN_MISMATCH'
  | 'INVALID_TYPE'
  | 'VALIDATION_ERROR'
  | 'SCHEMA_ERROR'
  | 'IO_ERROR'
  | 'ENCODING_ERROR'
  | 'WORKER_ERROR'
  | 'TIMEOUT_ERROR'
  | 'MEMORY_ERROR';

// ============================================
// Stream Types
// ============================================

export interface StreamOptions extends ParserOptions {
  objectMode?: boolean;
  signal?: AbortSignal;
}

export interface ParseResult<T = CSVRow> {
  data: T[];
  meta: ParseMeta;
  errors: ParseError[];
}

export interface ParseMeta {
  delimiter: string;
  linebreak: string;
  headers: string[];
  rowCount: number;
  columnCount: number;
  truncated: boolean;
  encoding: string;
  parseTime: number;
  bytesProcessed: number;
}

export interface BatchResult<T = CSVRow> {
  data: T[];
  errors: RowError[];
  processedCount: number;
}

export interface RowError {
  line: number;
  raw: CSVRow;
  error: any;
}

export interface ProgressReport {
  rows: number;
  bytes: number;
  percentage: number;
}

export interface WriterOptions {
  header?: boolean;
  columns?: string[];
  delimiter?: string;
  quote?: string;
  escape?: string;
  recordDelimiter?: string;
  quoted?: boolean;
}

// ============================================
// Worker Types
// ============================================

export interface WorkerMessage {
  type: 'chunk' | 'complete' | 'error' | 'progress';
  data?: CSVRow[];
  error?: ParseError;
  progress?: number;
  meta?: Partial<ParseMeta>;
}

export interface WorkerTask {
  id: number;
  chunk: Buffer | string;
  options: ParserOptions;
  isFirst: boolean;
  isLast: boolean;
}

export interface WorkerPoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
  taskTimeout?: number;
}

// ============================================
// Query Types
// ============================================

export interface QueryOptions {
  select?: string[];
  where?: WhereClause;
  orderBy?: OrderByClause;
  groupBy?: string[];
  having?: WhereClause;
  limit?: number;
  offset?: number;
  distinct?: boolean;
  joins?: JoinClause[];
}

export type WhereClause = 
  | SimpleCondition
  | CompoundCondition
  | ((row: CSVRow) => boolean);

export interface SimpleCondition {
  field: string;
  operator: ComparisonOperator;
  value: Primitive;
}

export interface CompoundCondition {
  operator: 'AND' | 'OR' | 'NOT';
  conditions: WhereClause[];
}

export type ComparisonOperator = 
  | '=' | '!=' | '<>' 
  | '>' | '>=' | '<' | '<=' 
  | 'LIKE' | 'NOT LIKE' 
  | 'IN' | 'NOT IN' 
  | 'BETWEEN' | 'IS NULL' | 'IS NOT NULL';

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
  nulls?: 'FIRST' | 'LAST';
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  data: CSVData;
  on: { left: string; right: string };
}

// ============================================
// Aggregation Types
// ============================================

export type AggregateFunction = 
  | 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' 
  | 'FIRST' | 'LAST' | 'STDDEV' | 'VARIANCE'
  | 'MEDIAN' | 'MODE' | 'PERCENTILE';

export interface AggregateColumn {
  function: AggregateFunction;
  field: string;
  alias?: string;
  distinct?: boolean;
  percentile?: number;
}

// ============================================
// Pipeline Types
// ============================================

export type PipelineStage = 
  | { $match: WhereClause }
  | { $project: Record<string, boolean | string | ProjectExpression> }
  | { $sort: Record<string, 1 | -1> }
  | { $limit: number }
  | { $skip: number }
  | { $group: GroupStage }
  | { $unwind: string }
  | { $lookup: LookupStage }
  | { $addFields: Record<string, FieldExpression> }
  | { $set: Record<string, Primitive | FieldExpression> }
  | { $unset: string | string[] }
  | { $sample: number }
  | { $distinct: string };

export interface ProjectExpression {
  $concat?: (string | FieldRef)[];
  $substring?: [FieldRef, number, number];
  $toUpper?: FieldRef;
  $toLower?: FieldRef;
  $add?: (number | FieldRef)[];
  $subtract?: [number | FieldRef, number | FieldRef];
  $multiply?: (number | FieldRef)[];
  $divide?: [number | FieldRef, number | FieldRef];
  $cond?: { if: WhereClause; then: Primitive; else: Primitive };
}

export type FieldRef = `$${string}`;

export interface GroupStage {
  _id: string | string[] | null;
  [key: string]: unknown;
}

export interface LookupStage {
  from: CSVData;
  localField: string;
  foreignField: string;
  as: string;
}

export type FieldExpression = 
  | Primitive 
  | FieldRef 
  | ProjectExpression;

// ============================================
// Event Types
// ============================================

export interface ParserEvents {
  data: (row: CSVRow, index: number) => void;
  header: (headers: string[]) => void;
  error: (error: ParseError) => void;
  end: (meta: ParseMeta) => void;
  progress: (progress: ProgressInfo) => void;
}

export interface ProgressInfo {
  rowsProcessed: number;
  bytesProcessed: number;
  totalBytes?: number;
  percentage?: number;
  rowsPerSecond: number;
  estimatedTimeRemaining?: number;
}