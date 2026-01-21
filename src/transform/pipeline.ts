import type {
  PipelineStage,
  CSVRow,
  CSVData,
  WhereClause,
  FieldRef,
  ProjectExpression,
  GroupStage,
  Primitive,
} from '../types';

/**
 * Aggregation pipeline for CSV data transformation
 * MongoDB-like syntax for data manipulation
 */
export class Pipeline<T extends CSVRow = CSVRow> {
  private stages: PipelineStage[] = [];
  private data: CSVData<T>;

  constructor(data: CSVData<T>) {
    this.data = [...data];
  }

  /**
   * Add a stage to the pipeline
   */
  addStage(stage: PipelineStage): this {
    this.stages.push(stage);
    return this;
  }

  /**
   * Filter documents
   */
  match(condition: WhereClause): this {
    return this.addStage({ $match: condition });
  }

  /**
   * Select/transform fields
   */
  project(projection: Record<string, boolean | string | ProjectExpression>): this {
    return this.addStage({ $project: projection });
  }

  /**
   * Sort documents
   */
  sort(sortBy: Record<string, 1 | -1>): this {
    return this.addStage({ $sort: sortBy });
  }

  /**
   * Limit number of documents
   */
  limit(n: number): this {
    return this.addStage({ $limit: n });
  }

  /**
   * Skip documents
   */
  skip(n: number): this {
    return this.addStage({ $skip: n });
  }

  /**
   * Group documents
   */
  group(grouping: GroupStage): this {
    return this.addStage({ $group: grouping });
  }

  /**
   * Add new fields
   */
  addFields(fields: Record<string, unknown>): this {
    return this.addStage({ $addFields: fields as Record<string, any> });
  }

  /**
   * Set field values
   */
  set(fields: Record<string, unknown>): this {
    return this.addStage({ $set: fields as Record<string, any> });
  }

  /**
   * Remove fields
   */
  unset(fields: string | string[]): this {
    return this.addStage({ $unset: fields });
  }

  /**
   * Random sample
   */
  sample(n: number): this {
    return this.addStage({ $sample: n });
  }

  /**
   * Get distinct values
   */
  distinct(field: string): this {
    return this.addStage({ $distinct: field });
  }

  /**
   * Execute the pipeline
   */
  execute(): CSVData<T> {
    let result: CSVData<any> = [...this.data];

    for (const stage of this.stages) {
      result = this.executeStage(result, stage);
    }

    return result;
  }

  /**
   * Execute pipeline and return first result
   */
  first(): T | undefined {
    return this.execute()[0];
  }

  /**
   * Execute pipeline and count results
   */
  count(): number {
    return this.execute().length;
  }

  /**
   * Convert to array (alias for execute)
   */
  toArray(): CSVData<T> {
    return this.execute();
  }

  private executeStage(data: CSVData<any>, stage: PipelineStage): CSVData<any> {
    if ('$match' in stage) {
      return this.executeMatch(data, stage.$match);
    }
    if ('$project' in stage) {
      return this.executeProject(data, stage.$project);
    }
    if ('$sort' in stage) {
      return this.executeSort(data, stage.$sort);
    }
    if ('$limit' in stage) {
      return data.slice(0, stage.$limit);
    }
    if ('$skip' in stage) {
      return data.slice(stage.$skip);
    }
    if ('$group' in stage) {
      return this.executeGroup(data, stage.$group);
    }
    if ('$addFields' in stage) {
      return this.executeAddFields(data, stage.$addFields);
    }
    if ('$set' in stage) {
      return this.executeAddFields(data, stage.$set);
    }
    if ('$unset' in stage) {
      return this.executeUnset(data, stage.$unset);
    }
    if ('$sample' in stage) {
      return this.executeSample(data, stage.$sample);
    }
    if ('$distinct' in stage) {
      return this.executeDistinct(data, stage.$distinct);
    }
    return data;
  }

  private executeMatch(data: CSVData<any>, condition: WhereClause): CSVData<any> {
    if (typeof condition === 'function') {
      return data.filter(condition);
    }

    return data.filter(row => this.evaluateCondition(row, condition));
  }

  private evaluateCondition(row: CSVRow, condition: WhereClause): boolean {
    if (typeof condition === 'function') {
      return condition(row);
    }

    if ('operator' in condition && 'conditions' in condition) {
      // Compound condition
      const results = condition.conditions.map(c => this.evaluateCondition(row, c));
      
      switch (condition.operator) {
        case 'AND':
          return results.every(Boolean);
        case 'OR':
          return results.some(Boolean);
        case 'NOT':
          return !results[0];
        default:
          return false;
      }
    }

    // Simple condition
    const { field, operator, value } = condition as any;
    const fieldValue = row[field];

    switch (operator) {
      case '=':
        return fieldValue === value;
      case '!=':
      case '<>':
        return fieldValue !== value;
      case '>':
        return (fieldValue as number) > (value as number);
      case '>=':
        return (fieldValue as number) >= (value as number);
      case '<':
        return (fieldValue as number) < (value as number);
      case '<=':
        return (fieldValue as number) <= (value as number);
      case 'LIKE':
        return new RegExp(
          String(value).replace(/%/g, '.*').replace(/_/g, '.'),
          'i'
        ).test(String(fieldValue));
      case 'NOT LIKE':
        return !new RegExp(
          String(value).replace(/%/g, '.*').replace(/_/g, '.'),
          'i'
        ).test(String(fieldValue));
      case 'IN':
        return (value as any[]).includes(fieldValue);
      case 'NOT IN':
        return !(value as any[]).includes(fieldValue);
      case 'BETWEEN':
        const [min, max] = value as [number, number];
        return (fieldValue as number) >= min && (fieldValue as number) <= max;
      case 'IS NULL':
        return fieldValue === null || fieldValue === undefined;
      case 'IS NOT NULL':
        return fieldValue !== null && fieldValue !== undefined;
      default:
        return false;
    }
  }

  private executeProject(
    data: CSVData<any>,
    projection: Record<string, boolean | string | ProjectExpression>
  ): CSVData<any> {
    return data.map(row => {
      const result: CSVRow = {};

      for (const [key, value] of Object.entries(projection)) {
        if (value === false) continue;
        
        if (value === true) {
          result[key] = row[key];
        } else if (typeof value === 'string') {
          // Field reference
          if (value.startsWith('$')) {
            result[key] = row[value.slice(1)];
          } else {
            result[key] = value;
          }
        } else {
          // Expression
          result[key] = this.evaluateExpression(row, value) as Primitive;
        }
      }

      return result;
    });
  }

  private evaluateExpression(row: CSVRow, expr: ProjectExpression): unknown {
    if ('$concat' in expr) {
      return expr.$concat!
        .map(v => (typeof v === 'string' && v.startsWith('$') ? row[v.slice(1)] : v))
        .join('');
    }
    if ('$toUpper' in expr) {
      const val = this.resolveFieldRef(row, expr.$toUpper!);
      return String(val).toUpperCase();
    }
    if ('$toLower' in expr) {
      const val = this.resolveFieldRef(row, expr.$toLower!);
      return String(val).toLowerCase();
    }
    if ('$add' in expr) {
      return expr.$add!.reduce((sum: number, v) => {
        const num = typeof v === 'number' ? v : Number(this.resolveFieldRef(row, v));
        return sum + num;
      }, 0);
    }
    if ('$subtract' in expr) {
      const [a, b] = expr.$subtract!;
      const numA = typeof a === 'number' ? a : Number(this.resolveFieldRef(row, a));
      const numB = typeof b === 'number' ? b : Number(this.resolveFieldRef(row, b));
      return numA - numB;
    }
    if ('$multiply' in expr) {
      return expr.$multiply!.reduce((product: number, v) => {
        const num = typeof v === 'number' ? v : Number(this.resolveFieldRef(row, v));
        return product * num;
      }, 1);
    }
    if ('$divide' in expr) {
      const [a, b] = expr.$divide!;
      const numA = typeof a === 'number' ? a : Number(this.resolveFieldRef(row, a));
      const numB = typeof b === 'number' ? b : Number(this.resolveFieldRef(row, b));
      return numA / numB;
    }
    if ('$cond' in expr) {
      const condition = this.evaluateCondition(row, expr.$cond!.if);
      return condition ? expr.$cond!.then : expr.$cond!.else;
    }
    return null;
  }

  private resolveFieldRef(row: CSVRow, ref: FieldRef): unknown {
    if (ref.startsWith('$')) {
      return row[ref.slice(1)];
    }
    return ref;
  }

  private executeSort(data: CSVData<any>, sortBy: Record<string, 1 | -1>): CSVData<any> {
    return [...data].sort((a, b) => {
      for (const [field, direction] of Object.entries(sortBy)) {
        const aVal = a[field];
        const bVal = b[field];

        if (aVal === bVal) continue;
        if (aVal === null || aVal === undefined) return direction;
        if (bVal === null || bVal === undefined) return -direction;

        const comparison = aVal < bVal ? -1 : 1;
        return comparison * direction;
      }
      return 0;
    });
  }

  private executeGroup(data: CSVData<any>, grouping: GroupStage): CSVData<any> {
    const groups = new Map<string, CSVRow[]>();
    const { _id, ...aggregations } = grouping;

    // Group data
    for (const row of data) {
      const key = this.getGroupKey(row, _id);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    // Apply aggregations
    const result: CSVRow[] = [];

    for (const [key, rows] of groups) {
      const groupResult: CSVRow = { _id: key === 'null' ? null : key };

      for (const [field, aggExpr] of Object.entries(aggregations)) {
        groupResult[field] = this.executeAggregation(rows, aggExpr as any) as Primitive;
      }

      result.push(groupResult);
    }

    return result;
  }

  private getGroupKey(row: CSVRow, groupId: string | string[] | null): string {
    if (groupId === null) return 'null';
    if (typeof groupId === 'string') {
      const field = groupId.startsWith('$') ? groupId.slice(1) : groupId;
      return String(row[field]);
    }
    return groupId
      .map(id => {
        const field = id.startsWith('$') ? id.slice(1) : id;
        return String(row[field]);
      })
      .join('|');
  }

  private executeAggregation(rows: CSVRow[], expr: any): unknown {
    if (typeof expr === 'object') {
      const [op, field] = Object.entries(expr)[0] as [string, string];
      const fieldName = field.startsWith('$') ? field.slice(1) : field;
      const values = rows.map(r => r[fieldName]).filter(v => v !== null && v !== undefined);

      switch (op) {
        case '$sum':
          return values.reduce((sum: number, v) => sum + Number(v), 0);
        case '$avg':
          return values.reduce((sum: number, v) => sum + Number(v), 0) / values.length;
        case '$min':
          return Math.min(...values.map(Number));
        case '$max':
          return Math.max(...values.map(Number));
        case '$first':
          return values[0];
        case '$last':
          return values[values.length - 1];
        case '$count':
          return values.length;
        case '$push':
          return values;
        case '$addToSet':
          return [...new Set(values)];
        default:
          return null;
      }
    }
    return expr;
  }

  private executeAddFields(
    data: CSVData<any>,
    fields: Record<string, unknown>
  ): CSVData<any> {
    return data.map(row => {
      const newRow = { ...row };
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value === 'string' && value.startsWith('$')) {
          newRow[key] = row[value.slice(1)];
        } else if (typeof value === 'object' && value !== null) {
          newRow[key] = this.evaluateExpression(row, value as ProjectExpression);
        } else {
          newRow[key] = value;
        }
      }
      return newRow;
    });
  }

  private executeUnset(data: CSVData<any>, fields: string | string[]): CSVData<any> {
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    return data.map(row => {
      const newRow = { ...row };
      for (const field of fieldsArray) {
        delete newRow[field];
      }
      return newRow;
    });
  }

  private executeSample(data: CSVData<any>, n: number): CSVData<any> {
    const shuffled = [...data];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.slice(0, n);
  }

  private executeDistinct(data: CSVData<any>, field: string): CSVData<any> {
    const seen = new Set<unknown>();
    return data.filter(row => {
      const value = row[field];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
}

/**
 * Create a new pipeline
 */
export function pipeline<T extends CSVRow = CSVRow>(data: CSVData<T>): Pipeline<T> {
  return new Pipeline(data);
}