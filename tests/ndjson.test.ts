import { describe, it, expect } from 'vitest';
import {
  parseNDJSON,
  stringifyNDJSON,
  parseNDJSONLine,
  stringifyNDJSONLine,
  NDJSONParseStream,
  NDJSONStringifyStream,
  collectNDJSON,
  createNDJSONReadStream,
} from '../src/utils/ndjson';
import { Readable } from 'stream';

describe('NDJSON', () => {
  describe('parseNDJSONLine', () => {
    it('should parse a single JSON line', () => {
      const result = parseNDJSONLine('{"name": "test", "value": 42}');
      expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should handle arrays', () => {
      const result = parseNDJSONLine('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle primitives', () => {
      expect(parseNDJSONLine('"hello"')).toBe('hello');
      expect(parseNDJSONLine('123')).toBe(123);
      expect(parseNDJSONLine('true')).toBe(true);
      expect(parseNDJSONLine('null')).toBe(null);
    });

    it('should use reviver function', () => {
      const result = parseNDJSONLine(
        '{"date": "2024-01-01"}',
        (key, value) => key === 'date' ? new Date(value) : value
      );
      expect(result.date).toBeInstanceOf(Date);
    });
  });

  describe('stringifyNDJSONLine', () => {
    it('should stringify an object to single line', () => {
      const result = stringifyNDJSONLine({ name: 'test', value: 42 });
      expect(result).toBe('{"name":"test","value":42}');
    });

    it('should collapse formatted JSON to single line', () => {
      const result = stringifyNDJSONLine({ a: 1, b: 2 }, undefined, 2);
      expect(result).not.toContain('\n');
      expect(result).toContain('"a"');
    });

    it('should handle arrays', () => {
      const result = stringifyNDJSONLine([1, 2, 3]);
      expect(result).toBe('[1,2,3]');
    });
  });

  describe('parseNDJSON', () => {
    it('should parse multiple lines', () => {
      const input = '{"a": 1}\n{"a": 2}\n{"a": 3}';
      const result = parseNDJSON(input);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ a: 1 });
      expect(result[1]).toEqual({ a: 2 });
      expect(result[2]).toEqual({ a: 3 });
    });

    it('should skip empty lines by default', () => {
      const input = '{"a": 1}\n\n{"a": 2}\n\n';
      const result = parseNDJSON(input);
      expect(result).toHaveLength(2);
    });

    it('should handle Windows line endings', () => {
      const input = '{"a": 1}\r\n{"a": 2}\r\n';
      const result = parseNDJSON(input);
      expect(result).toHaveLength(2);
    });

    it('should throw on invalid JSON by default', () => {
      const input = '{"a": 1}\ninvalid\n{"a": 2}';
      expect(() => parseNDJSON(input)).toThrow();
    });

    it('should skip invalid lines with onError: skip', () => {
      const input = '{"a": 1}\ninvalid\n{"a": 2}';
      const result = parseNDJSON(input, { onError: 'skip' });
      expect(result).toHaveLength(2);
    });
  });

  describe('stringifyNDJSON', () => {
    it('should stringify array to NDJSON', () => {
      const data = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const result = stringifyNDJSON(data);
      expect(result).toBe('{"a":1}\n{"a":2}\n{"a":3}\n');
    });

    it('should use custom EOL', () => {
      const data = [{ a: 1 }, { a: 2 }];
      const result = stringifyNDJSON(data, { eol: '\r\n' });
      expect(result).toBe('{"a":1}\r\n{"a":2}\r\n');
    });

    it('should handle empty array', () => {
      const result = stringifyNDJSON([]);
      expect(result).toBe('\n');
    });
  });

  describe('NDJSONParseStream', () => {
    it('should parse streaming NDJSON', async () => {
      const input = '{"a": 1}\n{"a": 2}\n{"a": 3}';
      const stream = Readable.from([input]);
      const parser = new NDJSONParseStream();
      
      stream.pipe(parser);
      const results = await collectNDJSON(parser);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ a: 1 });
    });

    it('should handle chunked input', async () => {
      const chunks = ['{"a":', ' 1}\n{"a"', ': 2}\n'];
      const stream = Readable.from(chunks);
      const parser = new NDJSONParseStream();
      
      stream.pipe(parser);
      const results = await collectNDJSON(parser);
      
      expect(results).toHaveLength(2);
    });
  });

  describe('NDJSONStringifyStream', () => {
    it('should stringify streaming objects', async () => {
      const data = [{ a: 1 }, { a: 2 }, { a: 3 }];
      const stream = Readable.from(data);
      const stringifier = new NDJSONStringifyStream();
      
      stream.pipe(stringifier);
      
      const chunks: string[] = [];
      for await (const chunk of stringifier) {
        chunks.push(chunk.toString());
      }
      
      expect(chunks.join('')).toBe('{"a":1}\n{"a":2}\n{"a":3}\n');
    });
  });

  describe('createNDJSONReadStream', () => {
    it('should create readable stream from array', async () => {
      const data = [{ a: 1 }, { a: 2 }];
      const stream = createNDJSONReadStream(data);
      
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk.toString());
      }
      
      expect(chunks.join('')).toBe('{"a":1}\n{"a":2}\n');
    });
  });
});
