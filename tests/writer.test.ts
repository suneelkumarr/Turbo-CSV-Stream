import { describe, it, expect } from 'vitest';
import {
  CSVWriter,
  CSVStringifyStream,
  escapeField,
  formatRow,
  formatHeader,
  stringifyCSV,
  toCSV,
} from '../src/io/writer';
import { Readable } from 'stream';

describe('CSV Writer', () => {
  describe('escapeField', () => {
    it('should return simple values unchanged', () => {
      expect(escapeField('hello')).toBe('hello');
      expect(escapeField('123')).toBe('123');
    });

    it('should quote values with commas', () => {
      expect(escapeField('hello, world')).toBe('"hello, world"');
    });

    it('should quote values with quotes and escape them', () => {
      expect(escapeField('say "hello"')).toBe('"say ""hello"""');
    });

    it('should quote values with newlines', () => {
      expect(escapeField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('should handle null/undefined', () => {
      expect(escapeField(null)).toBe('');
      expect(escapeField(undefined)).toBe('');
    });

    it('should handle numbers', () => {
      expect(escapeField(42)).toBe('42');
      expect(escapeField(3.14)).toBe('3.14');
    });

    it('should handle booleans', () => {
      expect(escapeField(true)).toBe('true');
      expect(escapeField(false)).toBe('false');
    });

    it('should handle dates', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      expect(escapeField(date)).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should always quote with quoteStyle: always', () => {
      expect(escapeField('simple', { quoteStyle: 'always' })).toBe('"simple"');
    });

    it('should use custom null value', () => {
      expect(escapeField(null, { nullValue: 'NULL' })).toBe('NULL');
    });
  });

  describe('formatRow', () => {
    it('should format a row with columns', () => {
      const row = { a: 1, b: 2, c: 3 };
      expect(formatRow(row, ['a', 'b', 'c'])).toBe('1,2,3');
    });

    it('should handle missing columns', () => {
      const row = { a: 1 };
      expect(formatRow(row, ['a', 'b'])).toBe('1,');
    });

    it('should use custom delimiter', () => {
      const row = { a: 1, b: 2 };
      expect(formatRow(row, ['a', 'b'], { delimiter: '\t' })).toBe('1\t2');
    });

    it('should apply formatters', () => {
      const row = { price: 10.5 };
      expect(formatRow(row, ['price'], {
        formatters: {
          price: (v) => `$${v}`,
        },
      })).toBe('$10.5');
    });
  });

  describe('formatHeader', () => {
    it('should format headers', () => {
      expect(formatHeader(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('should escape headers with special chars', () => {
      expect(formatHeader(['name', 'value, unit'])).toBe('name,"value, unit"');
    });
  });

  describe('stringifyCSV', () => {
    it('should stringify data with headers', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const result = stringifyCSV(data);
      expect(result).toBe('name,age\nAlice,30\nBob,25\n');
    });

    it('should skip headers when header: false', () => {
      const data = [{ a: 1 }, { a: 2 }];
      const result = stringifyCSV(data, { header: false });
      expect(result).toBe('1\n2\n');
    });

    it('should use custom columns', () => {
      const data = [{ a: 1, b: 2, c: 3 }];
      const result = stringifyCSV(data, { columns: ['c', 'a'] });
      expect(result).toBe('c,a\n3,1\n');
    });

    it('should handle empty data', () => {
      expect(stringifyCSV([])).toBe('');
    });

    it('should use custom record delimiter', () => {
      const data = [{ a: 1 }, { a: 2 }];
      const result = stringifyCSV(data, { recordDelimiter: '\r\n' });
      expect(result).toBe('a\r\n1\r\n2\r\n');
    });
  });

  describe('toCSV', () => {
    it('should be an alias for stringifyCSV', () => {
      const data = [{ a: 1 }];
      expect(toCSV(data)).toBe(stringifyCSV(data));
    });
  });

  describe('CSVWriter class', () => {
    it('should write rows incrementally', () => {
      const writer = new CSVWriter();
      writer.writeRow({ name: 'Alice', age: 30 });
      writer.writeRow({ name: 'Bob', age: 25 });
      
      const result = writer.toString();
      expect(result).toBe('name,age\nAlice,30\nBob,25\n');
    });

    it('should support clear()', () => {
      const writer = new CSVWriter();
      writer.writeRow({ a: 1 });
      writer.clear();
      writer.writeRow({ b: 2 });
      
      const result = writer.toString();
      expect(result).toBe('b\n2\n');
    });

    it('should use predefined columns', () => {
      const writer = new CSVWriter({ columns: ['b', 'a'] });
      writer.writeRow({ a: 1, b: 2, c: 3 });
      
      const result = writer.toString();
      expect(result).toBe('b,a\n2,1\n');
    });
  });

  describe('CSVStringifyStream', () => {
    it('should stringify streaming objects', async () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const input = Readable.from(data);
      const stringifier = new CSVStringifyStream();
      
      input.pipe(stringifier);
      
      const chunks: string[] = [];
      for await (const chunk of stringifier) {
        chunks.push(chunk.toString());
      }
      
      const result = chunks.join('');
      expect(result).toBe('name,age\nAlice,30\nBob,25\n');
    });
  });
});
