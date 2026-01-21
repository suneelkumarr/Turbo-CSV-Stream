import { describe, it, expect } from 'vitest';
import {
  json2csv,
  csv2json,
  flattenObject,
  unflattenObject,
  extractKeys,
  parseCSVRows,
  verifySchema,
  inferJsonSchema,
} from '../src/utils/json-csv';

describe('JSON-CSV Converter', () => {
  describe('json2csv', () => {
    it('should convert simple JSON array to CSV', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      
      const csv = json2csv(data);
      const lines = csv.trim().split('\n');
      
      expect(lines[0]).toBe('name,age');
      expect(lines[1]).toBe('Alice,30');
      expect(lines[2]).toBe('Bob,25');
    });

    it('should handle nested objects with flatten', () => {
      const data = [
        { user: { name: 'Alice', profile: { age: 30 } } },
      ];
      
      const csv = json2csv(data, { flatten: true });
      const lines = csv.trim().split('\n');
      
      expect(lines[0]).toContain('user.name');
      expect(lines[0]).toContain('user.profile.age');
    });

    it('should respect keys option', () => {
      const data = [
        { name: 'Alice', age: 30, city: 'NYC' },
      ];
      
      const csv = json2csv(data, { keys: ['name', 'city'] });
      const lines = csv.trim().split('\n');
      
      expect(lines[0]).toBe('name,city');
      expect(lines[1]).toBe('Alice,NYC');
    });

    it('should exclude keys', () => {
      const data = [
        { name: 'Alice', age: 30, city: 'NYC' },
      ];
      
      const csv = json2csv(data, { excludeKeys: ['age'] });
      
      expect(csv).not.toContain('age');
    });

    it('should handle special characters with quoting', () => {
      const data = [
        { name: 'Alice, Bob', message: 'Hello "World"' },
      ];
      
      const csv = json2csv(data);
      
      expect(csv).toContain('"Alice, Bob"');
      expect(csv).toContain('""World""');
    });

    it('should use custom delimiter', () => {
      const data = [{ name: 'Alice', age: 30 }];
      
      const csv = json2csv(data, { delimiter: ';' });
      
      expect(csv).toContain('name;age');
    });

    it('should skip header when header=false', () => {
      const data = [{ name: 'Alice', age: 30 }];
      
      const csv = json2csv(data, { header: false });
      const lines = csv.trim().split('\n');
      
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('Alice,30');
    });

    it('should handle null/undefined values', () => {
      const data = [{ name: 'Alice', age: null }];
      
      const csv = json2csv(data, { emptyFieldValue: 'N/A' });
      
      expect(csv).toContain('N/A');
    });

    it('should handle array values', () => {
      const data = [{ tags: ['a', 'b', 'c'] }];
      
      const csv = json2csv(data);
      
      expect(csv).toContain('a,b,c');
    });

    it('should prepend BOM when requested', () => {
      const data = [{ name: 'Alice' }];
      
      const csv = json2csv(data, { prependBom: true });
      
      expect(csv.charCodeAt(0)).toBe(0xFEFF);
    });
  });

  describe('csv2json', () => {
    it('should convert simple CSV to JSON', () => {
      const csv = 'name,age\nAlice,30\nBob,25';
      
      const data = csv2json(csv);
      
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({ name: 'Alice', age: '30' });
      expect(data[1]).toEqual({ name: 'Bob', age: '25' });
    });

    it('should handle dynamic typing', () => {
      const csv = 'name,age,active\nAlice,30,true\nBob,25,false';
      
      const data = csv2json(csv, { dynamicTyping: true });
      
      expect(data[0]!.age).toBe(30);
      expect(data[0]!.active).toBe(true);
      expect(data[1]!.active).toBe(false);
    });

    it('should parse nested keys', () => {
      const csv = 'user.name,user.age\nAlice,30';
      
      const data = csv2json(csv, { parseNested: true });
      
      expect(data[0]).toEqual({ user: { name: 'Alice', age: '30' } });
    });

    it('should respect keys filter', () => {
      const csv = 'name,age,city\nAlice,30,NYC';
      
      const data = csv2json(csv, { keys: ['name', 'city'] });
      
      expect(data[0]).toEqual({ name: 'Alice', city: 'NYC' });
    });

    it('should handle quoted values', () => {
      const csv = 'name,message\n"Alice, Bob","Hello ""World"""';
      
      const data = csv2json(csv);
      
      expect(data[0]!.name).toBe('Alice, Bob');
      expect(data[0]!.message).toBe('Hello "World"');
    });

    it('should use custom delimiter', () => {
      const csv = 'name;age\nAlice;30';
      
      const data = csv2json(csv, { delimiter: ';' });
      
      expect(data[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('should handle no header mode', () => {
      const csv = 'Alice,30\nBob,25';
      
      const data = csv2json(csv, { header: false, headerNames: ['name', 'age'] });
      
      expect(data[0]).toEqual({ name: 'Alice', age: '30' });
    });

    it('should trim values', () => {
      const csv = 'name,age\n  Alice  ,  30  ';
      
      const data = csv2json(csv, { trim: true });
      
      expect(data[0]!.name).toBe('Alice');
      expect(data[0]!.age).toBe('30');
    });

    it('should parse null values', () => {
      const csv = 'name,age\nAlice,null';
      
      const data = csv2json(csv, { dynamicTyping: true });
      
      expect(data[0]!.age).toBeNull();
    });

    it('should parse ISO dates', () => {
      const csv = 'name,date\nAlice,2024-01-15T10:30:00Z';
      
      const data = csv2json(csv, { dynamicTyping: true });
      
      expect(data[0]!.date).toBeInstanceOf(Date);
    });
  });

  describe('flattenObject', () => {
    it('should flatten nested objects', () => {
      const obj = { user: { profile: { name: 'Alice' } } };
      
      const flat = flattenObject(obj);
      
      expect(flat).toEqual({ 'user.profile.name': 'Alice' });
    });

    it('should handle arrays', () => {
      const obj = { tags: ['a', 'b'] };
      
      const flat = flattenObject(obj);
      
      expect(flat.tags).toBe('a,b');
    });

    it('should respect maxDepth', () => {
      const obj = { a: { b: { c: 'deep' } } };
      
      const flat = flattenObject(obj, '', 1);
      
      expect(flat['a.b']).toBeDefined();
      expect(typeof flat['a.b']).toBe('string'); // c is stringified
    });
  });

  describe('unflattenObject', () => {
    it('should unflatten dot notation keys', () => {
      const flat = { 'user.name': 'Alice', 'user.age': 30 };
      
      const obj = unflattenObject(flat);
      
      expect(obj).toEqual({ user: { name: 'Alice', age: 30 } });
    });
  });

  describe('extractKeys', () => {
    it('should extract unique keys from objects', () => {
      const objects = [
        { a: 1, b: 2 },
        { b: 3, c: 4 },
      ];
      
      const keys = extractKeys(objects);
      
      expect(keys).toContain('a');
      expect(keys).toContain('b');
      expect(keys).toContain('c');
    });

    it('should sort keys when requested', () => {
      const objects = [{ c: 1, a: 2, b: 3 }];
      
      const keys = extractKeys(objects, { sortKeys: true });
      
      expect(keys).toEqual(['a', 'b', 'c']);
    });
  });

  describe('parseCSVRows', () => {
    it('should parse CSV into array of arrays', () => {
      const csv = 'a,b,c\n1,2,3\n4,5,6';
      
      const rows = parseCSVRows(csv);
      
      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ]);
    });

    it('should handle quoted values', () => {
      const csv = '"hello, world","test"';
      
      const rows = parseCSVRows(csv);
      
      expect(rows[0]).toEqual(['hello, world', 'test']);
    });

    it('should handle escaped quotes', () => {
      const csv = '"say ""hello"""';
      
      const rows = parseCSVRows(csv);
      
      expect(rows[0]![0]).toBe('say "hello"');
    });

    it('should handle CRLF line endings', () => {
      const csv = 'a,b\r\n1,2\r\n3,4';
      
      const rows = parseCSVRows(csv);
      
      expect(rows).toHaveLength(3);
    });
  });

  describe('verifySchema', () => {
    it('should verify valid data against schema', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      
      const schema = [
        { key: 'name', type: 'string' as const, required: true },
        { key: 'age', type: 'number' as const, required: true },
      ];
      
      const result = verifySchema(data, schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const data = [{ name: 'Alice' }];
      
      const schema = [
        { key: 'name', type: 'string' as const, required: true },
        { key: 'age', type: 'number' as const, required: true },
      ];
      
      const result = verifySchema(data, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('inferJsonSchema', () => {
    it('should infer schema from data', () => {
      const data = [
        { name: 'Alice', age: 30, active: true },
        { name: 'Bob', age: 25, active: false },
      ];
      
      const schema = inferJsonSchema(data);
      
      expect(schema).toContainEqual(expect.objectContaining({ key: 'name', type: 'string' }));
      expect(schema).toContainEqual(expect.objectContaining({ key: 'age', type: 'number' }));
      expect(schema).toContainEqual(expect.objectContaining({ key: 'active', type: 'boolean' }));
    });
  });
});
