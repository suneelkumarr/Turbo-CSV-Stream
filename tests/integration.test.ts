import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import {
  parseSync,
  stringifySync,
  json2csv,
  csv2json,
  generateCSV,
  nestedJson2Csv,
  TransformPipeline,
  collect,
  CSVParser,
} from '../src/index';

describe('Integration Tests', () => {
  describe('End-to-End CSV Processing', () => {
    it('should parse, transform, and stringify CSV', () => {
      const input = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,Chicago';
      
      // Parse
      const parsed = parseSync(input);
      expect(parsed.data).toHaveLength(3);
      
      // Transform
      const transformed = parsed.data.map(row => ({
        fullName: row.name,
        ageGroup: Number(row.age) >= 30 ? 'Senior' : 'Junior',
      }));
      
      // Stringify
      const output = stringifySync(transformed);
      expect(output).toContain('fullName');
      expect(output).toContain('Senior');
      expect(output).toContain('Junior');
    });

    it('should handle full pipeline with validation', () => {
      const data = [
        { name: 'Alice', age: 30, email: 'alice@test.com' },
        { name: 'Bob', age: 25, email: 'bob@test.com' },
      ];
      
      // Convert to CSV
      const csv = json2csv(data);
      expect(csv).toContain('alice@test.com');
      
      // Parse back
      const parsed = csv2json(csv, { dynamicTyping: true });
      expect(parsed[0]!.age).toBe(30);
      
      // Stringify again
      const csv2 = json2csv(parsed);
      expect(csv2).toBe(csv);
    });
  });

  describe('JSON to CSV Roundtrip', () => {
    it('should maintain data integrity in roundtrip', () => {
      const original = [
        { name: 'Alice', age: 30, active: true },
        { name: 'Bob', age: 25, active: false },
      ];
      
      const csv = json2csv(original);
      const parsed = csv2json(csv, { dynamicTyping: true });
      
      expect(parsed).toEqual(original);
    });

    it('should handle nested data roundtrip', () => {
      const original = [
        { user: { name: 'Alice', profile: { age: 30 } } },
      ];
      
      const csv = json2csv(original, { flatten: true });
      const parsed = csv2json(csv, { parseNested: true, dynamicTyping: true });
      
      expect(parsed[0]).toEqual(original[0]);
    });
  });

  describe('Advanced Nested JSON to CSV', () => {
    it('should handle deeply nested structures', () => {
      const data = [
        {
          id: 1,
          user: {
            name: 'Alice',
            contact: {
              email: 'alice@test.com',
              phone: {
                home: '555-1234',
                mobile: '555-5678',
              },
            },
            preferences: {
              notifications: true,
              theme: 'dark',
            },
          },
          metadata: {
            created: new Date('2024-01-15'),
            tags: ['admin', 'power-user'],
          },
        },
      ];
      
      const result = nestedJson2Csv(data);
      
      expect(result.columns).toContain('user.name');
      expect(result.columns).toContain('user.contact.phone.home');
      expect(result.columns).toContain('metadata.tags');
      expect(result.csv).toContain('Alice');
      expect(result.csv).toContain('555-1234');
      expect(result.csv).toContain('admin,power-user');
    });

    it('should handle arrays with different strategies', () => {
      const data = [
        {
          product: 'Widget',
          variants: [
            { color: 'red', size: 'M' },
            { color: 'blue', size: 'L' },
          ],
        },
      ];
      
      // Join strategy
      const joinResult = nestedJson2Csv(data, { arrayStrategy: 'join' });
      expect(joinResult.csv).toContain('variants');
      
      // Expand columns strategy
      const expandResult = nestedJson2Csv(data, { arrayStrategy: 'expand-columns' });
      expect(expandResult.columns).toContain('variants[0].color');
      expect(expandResult.columns).toContain('variants[1].size');
    });

    it('should filter paths', () => {
      const data = [
        {
          public: { name: 'Alice', email: 'alice@test.com' },
          private: { ssn: '123-45-6789', password: 'secret' },
        },
      ];
      
      const result = nestedJson2Csv(data, {
        excludePaths: ['private.*'],
      });
      
      expect(result.columns).toContain('public.name');
      expect(result.columns).not.toContain('private.ssn');
      expect(result.columns).not.toContain('private.password');
    });

    it('should detect circular references', () => {
      const obj: any = { name: 'test', value: 42 };
      obj.self = obj;
      
      const result = nestedJson2Csv([obj], { detectCircular: true });
      
      expect(result.csv).toContain('[Circular]');
    });
  });

  describe('Stream Processing Pipeline', () => {
    it('should process CSV stream with transformations', async () => {
      const csvData = 'name,age\nAlice,30\nBob,25\nCharlie,35\nDiana,28';
      
      const parser = new CSVParser();
      const result = parser.parse(csvData);
      
      const pipeline = new TransformPipeline()
        .filter((row: any) => Number(row.age) >= 28)
        .map((row: any) => ({ name: row.name, category: 'adult' }))
        .take(2);
      
      const source = Readable.from(result.data);
      const processed = await pipeline.collect(source);
      
      expect(processed).toHaveLength(2);
      expect(processed.every(r => r.category === 'adult')).toBe(true);
    });
  });

  describe('CSV Generation with Validation', () => {
    it('should generate valid CSV with seed', () => {
      const csv1 = generateCSV({ length: 10, seed: 12345 });
      const csv2 = generateCSV({ length: 10, seed: 12345 });
      
      expect(csv1).toBe(csv2); // Idempotence
      
      const lines = csv1.split('\n');
      expect(lines.length).toBeGreaterThan(10); // Header + data
    });

    it('should generate parseable CSV', () => {
      const csv = generateCSV({ length: 5, seed: 42 });
      const parsed = parseSync(csv);
      
      expect(parsed.data).toHaveLength(5);
      expect(parsed.errors).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed CSV gracefully', () => {
      const malformed = 'name,age\nAlice,30\nBob,"25\nCharlie,35';
      
      const parser = new CSVParser({ onError: 'skip' });
      const result = parser.parse(malformed);
      
      // Should skip the malformed row
      expect(result.data.length).toBeLessThan(3);
    });

    it('should validate input types', () => {
      expect(() => parseSync(123 as any)).toThrow();
      expect(() => stringifySync('not an array' as any)).toThrow();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large datasets efficiently', () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        email: `user${i}@test.com`,
        active: i % 2 === 0,
      }));
      
      const csv = json2csv(largeData);
      expect(csv.split('\n').length).toBe(1001); // Header + 1000 rows
      
      const parsed = csv2json(csv, { dynamicTyping: true });
      expect(parsed).toHaveLength(1000);
    });

    it('should handle deeply nested data without stack overflow', () => {
      let nested: any = { value: 0 };
      for (let i = 0; i < 50; i++) {
        nested = { level: i, child: nested };
      }
      
      const result = nestedJson2Csv([nested], { maxDepth: 50 });
      expect(result.rowCount).toBe(1);
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle special characters correctly', () => {
      const data = [
        { name: 'Alice, Bob', message: 'Hello "World"' },
        { name: 'Charlie\nDiana', message: 'Line\nbreak' },
      ];
      
      const csv = json2csv(data);
      const parsed = csv2json(csv);
      
      expect(parsed[0]!.name).toBe('Alice, Bob');
      expect(parsed[0]!.message).toBe('Hello "World"');
      expect(parsed[1]!.name).toBe('Charlie\nDiana');
    });

    it('should handle unicode characters', () => {
      const data = [
        { name: '名前', city: '東京', emoji: '😀' },
        { name: 'Имя', city: 'Москва', emoji: '🎉' },
      ];
      
      const csv = json2csv(data);
      const parsed = csv2json(csv);
      
      expect(parsed[0]!.name).toBe('名前');
      expect(parsed[1]!.city).toBe('Москва');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty datasets', () => {
      expect(json2csv([])).toBe('');
      expect(csv2json('')).toEqual([]);
      expect(nestedJson2Csv([]).rowCount).toBe(0);
    });

    it('should handle single row', () => {
      const data = [{ name: 'Alice' }];
      const csv = json2csv(data);
      const parsed = csv2json(csv);
      
      expect(parsed).toEqual(data);
    });

    it('should handle null and undefined values', () => {
      const data = [
        { name: 'Alice', age: null, city: undefined },
      ];
      
      const csv = json2csv(data, { emptyFieldValue: 'NULL' });
      expect(csv).toContain('NULL');
    });

    it('should handle inconsistent columns', () => {
      const data = [
        { a: 1, b: 2 },
        { b: 3, c: 4 },
        { a: 5, c: 6 },
      ];
      
      const result = nestedJson2Csv(data);
      
      expect(result.columns).toContain('a');
      expect(result.columns).toContain('b');
      expect(result.columns).toContain('c');
      expect(result.rowCount).toBe(3);
    });
  });
});
