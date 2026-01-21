import { describe, it, expect } from 'vitest';
import {
  parseSync,
  parseRawSync,
  stringifySync,
  json2csvSync,
  csv2jsonSync,
  countRowsSync,
  getHeadersSync,
  extractColumnsSync,
  filterRowsSync,
  transformRowsSync,
  aggregateSync,
  parse,
  stringify,
} from '../src/core/sync';

describe('Synchronous API', () => {
  const sampleCSV = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,Chicago';

  describe('parseSync', () => {
    it('should parse CSV string', () => {
      const result = parseSync(sampleCSV);
      
      expect(result.data).toHaveLength(3);
      expect(result.meta.headers).toEqual(['name', 'age', 'city']);
      expect(result.meta.rowCount).toBe(3);
    });

    it('should include parse errors', () => {
      const result = parseSync(sampleCSV);
      
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('parseRawSync', () => {
    it('should parse CSV to array of arrays', () => {
      const rows = parseRawSync(sampleCSV);
      
      expect(rows).toHaveLength(4); // Including header
      expect(rows[0]).toEqual(['name', 'age', 'city']);
      expect(rows[1]).toEqual(['Alice', '30', 'NYC']);
    });
  });

  describe('stringifySync', () => {
    it('should stringify data to CSV', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      
      const csv = stringifySync(data);
      
      expect(csv).toContain('name,age');
      expect(csv).toContain('Alice,30');
      expect(csv).toContain('Bob,25');
    });
  });

  describe('json2csvSync', () => {
    it('should convert JSON to CSV', () => {
      const data = [{ name: 'Alice' }];
      
      const csv = json2csvSync(data);
      
      expect(csv).toContain('name');
      expect(csv).toContain('Alice');
    });
  });

  describe('csv2jsonSync', () => {
    it('should convert CSV to JSON', () => {
      const data = csv2jsonSync(sampleCSV);
      
      expect(data).toHaveLength(3);
      expect(data[0]).toHaveProperty('name', 'Alice');
    });
  });

  describe('countRowsSync', () => {
    it('should count data rows', () => {
      const count = countRowsSync(sampleCSV);
      
      expect(count).toBe(3);
    });
  });

  describe('getHeadersSync', () => {
    it('should get headers', () => {
      const headers = getHeadersSync(sampleCSV);
      
      expect(headers).toEqual(['name', 'age', 'city']);
    });
  });

  describe('extractColumnsSync', () => {
    it('should extract specific columns', () => {
      const data = extractColumnsSync(sampleCSV, ['name', 'city']);
      
      expect(data[0]).toEqual({ name: 'Alice', city: 'NYC' });
      expect(data[0]).not.toHaveProperty('age');
    });
  });

  describe('filterRowsSync', () => {
    it('should filter rows', () => {
      const data = filterRowsSync(sampleCSV, (row) => Number(row.age) >= 30);
      
      expect(data).toHaveLength(2);
      expect(data[0]!.name).toBe('Alice');
      expect(data[1]!.name).toBe('Charlie');
    });
  });

  describe('transformRowsSync', () => {
    it('should transform rows', () => {
      const data = transformRowsSync(sampleCSV, (row) => ({
        fullName: row.name,
        location: row.city,
      }));
      
      expect(data[0]).toEqual({ fullName: 'Alice', location: 'NYC' });
    });
  });

  describe('aggregateSync', () => {
    it('should aggregate rows', () => {
      const total = aggregateSync(
        sampleCSV,
        (acc, row) => acc + Number(row.age),
        0
      );
      
      expect(total).toBe(90); // 30 + 25 + 35
    });

    it('should count rows with aggregate', () => {
      const count = aggregateSync(sampleCSV, (acc) => acc + 1, 0);
      
      expect(count).toBe(3);
    });
  });

  describe('Quick API', () => {
    it('parse() should return data array', () => {
      const data = parse(sampleCSV);
      
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(3);
    });

    it('stringify() should be alias for stringifySync', () => {
      const data = [{ a: 1 }];
      
      expect(stringify(data)).toBe(stringifySync(data));
    });
  });
});
