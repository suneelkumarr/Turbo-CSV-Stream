import type {
  CSVRow,
  CSVData,
  QueryOptions,
  WhereClause,
  AggregateColumn,
  JoinClause,
  Primitive,
} from '../types';
import { Pipeline } from '../transform/pipeline';

/**
 * SQL-like query builder for CSV data
 */
export class QueryBuilder<T extends CSVRow = CSVRow> {
  private data: CSVData<T>;
  private options: QueryOptions = {};
  private aggregates: AggregateColumn[] = [];

  constructor(data: CSVData<T>) {
    this.data = data;
  }

  /**
   * SELECT columns
   */
  select(...columns: (string | '*')[]): this {
    if (columns.includes('*')) {
      this.options.select = [];
    } else {
      this.options.select = columns as string[];
    }
    return this;
  }

  /**
   * SELECT DISTINCT
   */
  selectDistinct(...columns: string[]): this {
    this.options.select = columns;
    this.options.distinct = true;
    return this;
  }

  /**
   * WHERE clause
   */
  where(condition: WhereClause): this {
    this.options.where = condition;
    return this;
  }

  /**
   * WHERE field = value
   */
  whereEquals(field: string, value: unknown): this {
    return this.where({ field, operator: '=', value: value as any });
  }

  /**
   * WHERE field > value
   */
  whereGreaterThan(field: string, value: number): this {
    return this.where({ field, operator: '>', value });
  }

  /**
   * WHERE field < value
   */
  whereLessThan(field: string, value: number): this {
    return this.where({ field, operator: '<', value });
  }

  /**
   * WHERE field LIKE pattern
   */
  whereLike(field: string, pattern: string): this {
    return this.where({ field, operator: 'LIKE', value: pattern });
  }

  /**
   * WHERE field IN values
   */
  whereIn(field: string, values: unknown[]): this {
    return this.where({ field, operator: 'IN', value: values as any });
  }

  /**
   * WHERE field BETWEEN min AND max
   */
  whereBetween(field: string, min: number, max: number): this {
    return this.where({ field, operator: 'BETWEEN', value: [min, max] as any });
  }

  /**
   * WHERE field IS NULL
   */
  whereNull(field: string): this {
    return this.where({ field, operator: 'IS NULL', value: null });
  }

  /**
   * WHERE field IS NOT NULL
   */
  whereNotNull(field: string): this {
    return this.where({ field, operator: 'IS NOT NULL', value: null });
  }

  /**
   * AND condition
   */
  and(condition: WhereClause): this {
    if (this.options.where) {
      this.options.where = {
        operator: 'AND',
        conditions: [this.options.where, condition],
      };
    } else {
      this.options.where = condition;
    }
    return this;
  }

  /**
   * OR condition
   */
  or(condition: WhereClause): this {
    if (this.options.where) {
      this.options.where = {
        operator: 'OR',
        conditions: [this.options.where, condition],
      };
    } else {
      this.options.where = condition;
    }
    return this;
  }

  /**
   * ORDER BY
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.options.orderBy = { field, direction };
    return this;
  }

  /**
   * GROUP BY
   */
  groupBy(...fields: string[]): this {
    this.options.groupBy = fields;
    return this;
  }

  /**
   * HAVING clause
   */
  having(condition: WhereClause): this {
    this.options.having = condition;
    return this;
  }

  /**
   * LIMIT
   */
  limit(n: number): this {
    this.options.limit = n;
    return this;
  }

  /**
   * OFFSET
   */
  offset(n: number): this {
    this.options.offset = n;
    return this;
  }

  /**
   * Add aggregate function
   */
  aggregate(func: AggregateColumn['function'], field: string, alias?: string): this {
    this.aggregates.push({ function: func, field, ...(alias && { alias }) });
    return this;
  }

  /**
   * COUNT(field)
   */
  count(field: string = '*', alias: string = 'count'): this {
    return this.aggregate('COUNT', field, alias);
  }

  /**
   * SUM(field)
   */
  sum(field: string, alias?: string): this {
    return this.aggregate('SUM', field, alias ?? `sum_${field}`);
  }

  /**
   * AVG(field)
   */
  avg(field: string, alias?: string): this {
    return this.aggregate('AVG', field, alias ?? `avg_${field}`);
  }

  /**
   * MIN(field)
   */
  min(field: string, alias?: string): this {
    return this.aggregate('MIN', field, alias ?? `min_${field}`);
  }

  /**
   * MAX(field)
   */
  max(field: string, alias?: string): this {
    return this.aggregate('MAX', field, alias ?? `max_${field}`);
  }

  /**
   * JOIN
   */
  join(
    data: CSVData,
    on: { left: string; right: string },
    type: JoinClause['type'] = 'INNER'
  ): this {
    if (!this.options.joins) {
      this.options.joins = [];
    }
    this.options.joins.push({ type, data, on });
    return this;
  }

  /**
   * INNER JOIN
   */
  innerJoin(data: CSVData, on: { left: string; right: string }): this {
    return this.join(data, on, 'INNER');
  }

  /**
   * LEFT JOIN
   */
  leftJoin(data: CSVData, on: { left: string; right: string }): this {
    return this.join(data, on, 'LEFT');
  }

  /**
   * Execute query and return results
   */
  execute(): CSVData {
    let result: CSVData = [...this.data];

    // Apply JOINs
    if (this.options.joins) {
      for (const join of this.options.joins) {
        result = this.applyJoin(result, join);
      }
    }

    // Apply WHERE
    if (this.options.where) {
      result = this.applyWhere(result, this.options.where);
    }

    // Apply GROUP BY and aggregates
    if (this.options.groupBy || this.aggregates.length > 0) {
      result = this.applyGroupBy(result);
    }

    // Apply HAVING
    if (this.options.having) {
      result = this.applyWhere(result, this.options.having);
    }

    // Apply ORDER BY
    if (this.options.orderBy) {
      result = this.applyOrderBy(result);
    }

    // Apply DISTINCT
    if (this.options.distinct && this.options.select) {
      result = this.applyDistinct(result);
    }

    // Apply SELECT
    if (this.options.select) {
      result = this.applySelect(result);
    }

    // Apply OFFSET
    if (this.options.offset) {
      result = result.slice(this.options.offset);
    }

    // Apply LIMIT
    if (this.options.limit) {
      result = result.slice(0, this.options.limit);
    }

    return result;
  }

  /**
   * Get first result
   */
  first(): CSVRow | undefined {
    return this.limit(1).execute()[0];
  }

  /**
   * Get count
   */
  getCount(): number {
    return this.execute().length;
  }

  /**
   * Check if any results exist
   */
  exists(): boolean {
    return this.limit(1).execute().length > 0;
  }

  /**
   * Convert to SQL string (for debugging)
   */
  toSQL(): string {
    const parts: string[] = [];

    // SELECT
    const selectCols = this.options.select ?? ['*'];
    const aggCols = this.aggregates.map(
      a => `${a.function}(${a.field}) AS ${a.alias ?? a.field}`
    );
    parts.push(`SELECT ${[...selectCols, ...aggCols].join(', ')}`);

    // FROM
    parts.push('FROM data');

    // JOINs
    if (this.options.joins) {
      for (const join of this.options.joins) {
        parts.push(
          `${join.type} JOIN table ON ${join.on.left} = ${join.on.right}`
        );
      }
    }

    // WHERE
    if (this.options.where) {
      parts.push(`WHERE ${this.whereToString(this.options.where)}`);
    }

    // GROUP BY
    if (this.options.groupBy) {
      parts.push(`GROUP BY ${this.options.groupBy.join(', ')}`);
    }

    // HAVING
    if (this.options.having) {
      parts.push(`HAVING ${this.whereToString(this.options.having)}`);
    }

    // ORDER BY
    if (this.options.orderBy) {
      parts.push(
        `ORDER BY ${this.options.orderBy.field} ${this.options.orderBy.direction}`
      );
    }

    // LIMIT/OFFSET
    if (this.options.limit) {
      parts.push(`LIMIT ${this.options.limit}`);
    }
    if (this.options.offset) {
      parts.push(`OFFSET ${this.options.offset}`);
    }

    return parts.join('\n');
  }

  private applyWhere(data: CSVData, condition: WhereClause): CSVData {
    const pipe = new Pipeline(data);
    return pipe.match(condition).execute();
  }

  private applyOrderBy(data: CSVData): CSVData {
    const { field, direction } = this.options.orderBy!;
    return [...data].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = aVal < bVal ? -1 : 1;
      return direction === 'DESC' ? -cmp : cmp;
    });
  }

  private applySelect(data: CSVData): CSVData {
    const fields = this.options.select!;
    return data.map(row => {
      const result: CSVRow = {};
      for (const field of fields) {
        result[field] = row[field];
      }
      return result;
    });
  }

  private applyDistinct(data: CSVData): CSVData {
    const fields = this.options.select!;
    const seen = new Set<string>();
    return data.filter(row => {
      const key = fields.map(f => JSON.stringify(row[f])).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private applyGroupBy(data: CSVData): CSVData {
    const groupBy = this.options.groupBy ?? [];
    const groups = new Map<string, CSVRow[]>();

    for (const row of data) {
      const key = groupBy.map(f => JSON.stringify(row[f])).join('|') || 'all';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    const result: CSVRow[] = [];

    for (const [, rows] of groups) {
      const groupRow: CSVRow = {};

      // Copy group by fields
      for (const field of groupBy) {
        groupRow[field] = rows[0]![field];
      }

      // Apply aggregates
      for (const agg of this.aggregates) {
        const alias = agg.alias ?? agg.field;
        groupRow[alias] = this.computeAggregate(rows, agg) as Primitive;
      }

      result.push(groupRow);
    }

    return result;
  }

  private computeAggregate(rows: CSVRow[], agg: AggregateColumn): unknown {
    const values = rows
      .map(r => r[agg.field])
      .filter(v => v !== null && v !== undefined);

    switch (agg.function) {
      case 'COUNT':
        return agg.distinct ? new Set(values).size : values.length;
      case 'SUM':
        return values.reduce((sum: number, v) => sum + Number(v), 0);
      case 'AVG':
        return values.reduce((sum: number, v) => sum + Number(v), 0) / values.length;
      case 'MIN':
        return Math.min(...values.map(Number));
      case 'MAX':
        return Math.max(...values.map(Number));
      case 'FIRST':
        return values[0];
      case 'LAST':
        return values[values.length - 1];
      default:
        return null;
    }
  }

  private applyJoin(data: CSVData, join: JoinClause): CSVData {
    const result: CSVRow[] = [];
    const rightIndex = new Map<unknown, CSVRow[]>();

    // Build index on right side
    for (const row of join.data) {
      const key = row[join.on.right];
      if (!rightIndex.has(key)) {
        rightIndex.set(key, []);
      }
      rightIndex.get(key)!.push(row);
    }

    for (const leftRow of data) {
      const key = leftRow[join.on.left];
      const rightRows = rightIndex.get(key) ?? [];

      if (rightRows.length > 0) {
        for (const rightRow of rightRows) {
          result.push({ ...leftRow, ...rightRow });
        }
      } else if (join.type === 'LEFT' || join.type === 'FULL') {
        result.push(leftRow);
      }
    }

    // Handle RIGHT and FULL joins
    if (join.type === 'RIGHT' || join.type === 'FULL') {
      const leftKeys = new Set(data.map(r => r[join.on.left]));
      for (const rightRow of join.data) {
        if (!leftKeys.has(rightRow[join.on.right])) {
          result.push(rightRow);
        }
      }
    }

    return result;
  }

  private whereToString(condition: WhereClause): string {
    if (typeof condition === 'function') {
      return '<function>';
    }

    if ('operator' in condition && 'conditions' in condition) {
      const parts = condition.conditions.map(c => this.whereToString(c));
      return `(${parts.join(` ${condition.operator} `)})`;
    }

    const { field, operator, value } = condition as any;
    return `${field} ${operator} ${JSON.stringify(value)}`;
  }
}

/**
 * Create a new query builder
 */
export function query<T extends CSVRow = CSVRow>(data: CSVData<T>): QueryBuilder<T> {
  return new QueryBuilder(data);
}

/**
 * Execute a SQL-like query string
 */
export function sql<T extends CSVRow = CSVRow>(
  data: CSVData<T>,
  queryString: string
): CSVData {
  // Simple SQL parser (basic implementation)
  const selectMatch = queryString.match(/SELECT\s+(.+?)\s+FROM/i);
  const whereMatch = queryString.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+GROUP|\s+LIMIT|$)/i);
  if (whereMatch) {
    // parse where clause
  }
  const orderMatch = queryString.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
  const limitMatch = queryString.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = queryString.match(/OFFSET\s+(\d+)/i);

  let q = query(data);

  if (selectMatch && selectMatch[1]!.trim() !== '*') {
    const columns = selectMatch[1]!.split(',').map(c => c.trim());
    q = q.select(...columns);
  }

  if (orderMatch) {
    q = q.orderBy(orderMatch[1]!, (orderMatch[2] as 'ASC' | 'DESC') ?? 'ASC');
  }

  if (limitMatch) {
    q = q.limit(parseInt(limitMatch[1]!, 10));
  }

  if (offsetMatch) {
    q = q.offset(parseInt(offsetMatch[1]!, 10));
  }

  return q.execute();
}