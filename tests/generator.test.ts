import { describe, it, expect } from 'vitest';
import {
  CSVGeneratorStream,
  SeededRandom,
  generateCSV,
  generateObjects,
  createGenerator,
  generateValue,
  ColumnGenerator,
} from '../src/generators/csv-generator';

describe('CSV Generator', () => {
  describe('SeededRandom', () => {
    it('should produce deterministic results with same seed', () => {
      const random1 = new SeededRandom(12345);
      const random2 = new SeededRandom(12345);
      
      expect(random1.next()).toBe(random2.next());
      expect(random1.next()).toBe(random2.next());
      expect(random1.next()).toBe(random2.next());
    });

    it('should produce different results with different seeds', () => {
      const random1 = new SeededRandom(12345);
      const random2 = new SeededRandom(67890);
      
      expect(random1.next()).not.toBe(random2.next());
    });

    it('should generate integers in range', () => {
      const random = new SeededRandom(42);
      
      for (let i = 0; i < 100; i++) {
        const value = random.int(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
      }
    });

    it('should generate floats in range', () => {
      const random = new SeededRandom(42);
      
      for (let i = 0; i < 100; i++) {
        const value = random.float(1.0, 5.0);
        expect(value).toBeGreaterThanOrEqual(1.0);
        expect(value).toBeLessThanOrEqual(5.0);
      }
    });

    it('should generate valid UUIDs', () => {
      const random = new SeededRandom(42);
      const uuid = random.uuid();
      
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should pick from array', () => {
      const random = new SeededRandom(42);
      const choices = ['a', 'b', 'c'];
      
      for (let i = 0; i < 100; i++) {
        const value = random.pick(choices);
        expect(choices).toContain(value);
      }
    });

    it('should reset to initial state', () => {
      const random = new SeededRandom(42);
      const first = random.next();
      random.next();
      random.next();
      
      random.reset();
      expect(random.next()).toBe(first);
    });
  });

  describe('generateValue', () => {
    const random = new SeededRandom(42);

    it('should generate string values', () => {
      const column: ColumnGenerator = { name: 'test', type: 'string', length: 10 };
      const value = generateValue(column, 0, random);
      
      expect(typeof value).toBe('string');
      expect((value as string).length).toBe(10);
    });

    it('should generate integer values', () => {
      const column: ColumnGenerator = { name: 'test', type: 'integer', min: 1, max: 100 };
      const value = generateValue(column, 0, random);
      
      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);
      expect(value as number).toBeGreaterThanOrEqual(1);
      expect(value as number).toBeLessThanOrEqual(100);
    });

    it('should generate boolean values', () => {
      const column: ColumnGenerator = { name: 'test', type: 'boolean' };
      const value = generateValue(column, 0, random);
      
      expect(typeof value).toBe('boolean');
    });

    it('should generate email values', () => {
      const column: ColumnGenerator = { name: 'test', type: 'email' };
      const value = generateValue(column, 0, random);
      
      expect(typeof value).toBe('string');
      expect(value as string).toMatch(/@/);
    });

    it('should generate UUID values', () => {
      const column: ColumnGenerator = { name: 'test', type: 'uuid' };
      const value = generateValue(column, 0, random);
      
      expect(typeof value).toBe('string');
      expect(value as string).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should pick from fixed values', () => {
      const column: ColumnGenerator = { name: 'test', type: 'string', values: ['a', 'b', 'c'] };
      const value = generateValue(column, 0, random);
      
      expect(['a', 'b', 'c']).toContain(value);
    });

    it('should generate null values based on nullable probability', () => {
      const column: ColumnGenerator = { name: 'test', type: 'string', nullable: 1 }; // Always null
      const value = generateValue(column, 0, new SeededRandom(42));
      
      expect(value).toBeNull();
    });
  });

  describe('generateCSV', () => {
    it('should generate CSV with default options', () => {
      const csv = generateCSV({ length: 5, seed: 42 });
      const lines = csv.trim().split('\n');
      
      expect(lines.length).toBe(6); // Header + 5 rows
      expect(lines[0]).toContain(','); // Has delimiter
    });

    it('should generate deterministic CSV with seed', () => {
      const csv1 = generateCSV({ length: 10, seed: 12345 });
      const csv2 = generateCSV({ length: 10, seed: 12345 });
      
      expect(csv1).toBe(csv2);
    });

    it('should respect custom columns', () => {
      const columns: ColumnGenerator[] = [
        { name: 'id', type: 'integer', min: 1, max: 1000 },
        { name: 'name', type: 'name' },
      ];
      
      const csv = generateCSV({ length: 3, columns, seed: 42 });
      const lines = csv.trim().split('\n');
      
      expect(lines[0]).toBe('id,name');
      expect(lines.length).toBe(4);
    });

    it('should exclude header when header=false', () => {
      const csv = generateCSV({ length: 3, header: false, seed: 42 });
      const lines = csv.trim().split('\n');
      
      expect(lines.length).toBe(3);
    });

    it('should use custom delimiter', () => {
      const csv = generateCSV({ length: 2, delimiter: ';', seed: 42 });
      
      expect(csv).toContain(';');
    });
  });

  describe('generateObjects', () => {
    it('should generate array of objects', () => {
      const objects = generateObjects({ length: 5, seed: 42 });
      
      expect(objects).toHaveLength(5);
      expect(typeof objects[0]).toBe('object');
    });

    it('should generate deterministic objects with seed', () => {
      const obj1 = generateObjects({ length: 5, seed: 12345 });
      const obj2 = generateObjects({ length: 5, seed: 12345 });
      
      expect(JSON.stringify(obj1)).toBe(JSON.stringify(obj2));
    });

    it('should respect custom columns', () => {
      const columns: ColumnGenerator[] = [
        { name: 'id', type: 'integer', min: 1, max: 100 },
        { name: 'active', type: 'boolean' },
      ];
      
      const objects = generateObjects({ length: 3, columns, seed: 42 });
      
      expect(objects[0]).toHaveProperty('id');
      expect(objects[0]).toHaveProperty('active');
      expect(typeof objects[0]!.active).toBe('boolean');
    });
  });

  describe('CSVGeneratorStream', () => {
    it('should create a readable stream', async () => {
      const stream = createGenerator({ length: 5, seed: 42 });
      const chunks: string[] = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain(',');
    });

    it('should work in object mode', async () => {
      const stream = createGenerator({ length: 5, seed: 42, objectMode: true });
      const rows: any[] = [];
      
      for await (const row of stream) {
        rows.push(row);
      }
      
      expect(rows.length).toBe(5);
      expect(typeof rows[0]).toBe('object');
    });
  });
});
