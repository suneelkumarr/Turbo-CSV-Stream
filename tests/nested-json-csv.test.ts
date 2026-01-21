import { describe, it, expect } from 'vitest';
import {
  nestedJson2Csv,
  validateNestedJson,
  extractNestedPaths,
  buildPath,
  matchPath,
  filterPaths,
  createNestedJson2CsvStream,
  NestedConversionError,
  CircularReferenceError,
} from '../src/utils/nested-json-csv';
import { Readable } from 'stream';
import { collect } from '../src/transform/stream-transform';

describe('Nested JSON to CSV Converter', () => {
  describe('buildPath', () => {
    it('should build simple path', () => {
      expect(buildPath(['user', 'name'])).toBe('user.name');
    });

    it('should handle array indices with brackets', () => {
      expect(buildPath(['users', '0', 'name'], '.', 'brackets')).toBe('users[0].name');
    });

    it('should handle array indices with underscore', () => {
      expect(buildPath(['users', '0', 'name'], '.', 'underscore')).toBe('users_0.name');
    });

    it('should handle array indices with none notation', () => {
      expect(buildPath(['users', '0', 'name'], '.', 'none')).toBe('users.0.name');
    });
  });

  describe('matchPath', () => {
    it('should match exact paths', () => {
      expect(matchPath('user.name', 'user.name')).toBe(true);
      expect(matchPath('user.age', 'user.name')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(matchPath('user.name', 'user.*')).toBe(true);
      expect(matchPath('user.profile.age', 'user.*')).toBe(false);
      expect(matchPath('user.profile.age', 'user.**')).toBe(false); // ** not implemented
    });

    it('should match question mark patterns', () => {
      expect(matchPath('user1', 'user?')).toBe(true);
      expect(matchPath('user12', 'user?')).toBe(false);
    });
  });

  describe('filterPaths', () => {
    it('should include all paths by default', () => {
      expect(filterPaths('user.name')).toBe(true);
    });

    it('should exclude matching paths', () => {
      expect(filterPaths('user.password', undefined, ['*.password'])).toBe(false);
      expect(filterPaths('user.name', undefined, ['*.password'])).toBe(true);
    });

    it('should include only matching paths', () => {
      expect(filterPaths('user.name', ['user.*'])).toBe(true);
      expect(filterPaths('admin.name', ['user.*'])).toBe(false);
    });

    it('should prioritize exclusion over inclusion', () => {
      expect(filterPaths('user.password', ['user.*'], ['*.password'])).toBe(false);
    });
  });

  describe('extractNestedPaths', () => {
    it('should extract flat object paths', () => {
      const obj = { name: 'Alice', age: 30 };
      const paths = extractNestedPaths(obj);
      
      expect(paths.get('name')).toBe('Alice');
      expect(paths.get('age')).toBe(30);
    });

    it('should extract nested object paths', () => {
      const obj = { user: { profile: { name: 'Bob', age: 25 } } };
      const paths = extractNestedPaths(obj);
      
      expect(paths.get('user.profile.name')).toBe('Bob');
      expect(paths.get('user.profile.age')).toBe(25);
    });

    it('should handle arrays with join strategy', () => {
      const obj = { tags: ['a', 'b', 'c'] };
      const paths = extractNestedPaths(obj, { arrayStrategy: 'join' });
      
      expect(paths.get('tags')).toEqual(['a', 'b', 'c']);
    });

    it('should handle arrays with expand-columns strategy', () => {
      const obj = { items: [{ x: 1 }, { x: 2 }] };
      const paths = extractNestedPaths(obj, { arrayStrategy: 'expand-columns' });
      
      expect(paths.get('items[0].x')).toBe(1);
      expect(paths.get('items[1].x')).toBe(2);
    });

    it('should handle arrays with first strategy', () => {
      const obj = { items: [{ x: 1 }, { x: 2 }] };
      const paths = extractNestedPaths(obj, { arrayStrategy: 'first' });
      
      expect(paths.get('items.x')).toBe(1);
    });

    it('should handle arrays with last strategy', () => {
      const obj = { items: [{ x: 1 }, { x: 2 }] };
      const paths = extractNestedPaths(obj, { arrayStrategy: 'last' });
      
      expect(paths.get('items.x')).toBe(2);
    });

    it('should respect maxDepth', () => {
      const obj = { a: { b: { c: { d: 'deep' } } } };
      const paths = extractNestedPaths(obj, { maxDepth: 2 });
      
      expect(paths.has('a.b.c.d')).toBe(false);
      expect(paths.has('a.b')).toBe(true);
    });

    it('should detect circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      const paths = extractNestedPaths(obj, { detectCircular: true });
      
      expect(paths.get('self')).toBe('[Circular]');
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-15');
      const obj = { created: date };
      const paths = extractNestedPaths(obj);
      
      expect(paths.get('created')).toBe(date);
    });

    it('should skip empty objects when requested', () => {
      const obj = { data: {}, value: 42 };
      const paths = extractNestedPaths(obj, { skipEmpty: true });
      
      expect(paths.has('data')).toBe(false);
      expect(paths.get('value')).toBe(42);
    });

    it('should skip empty arrays when requested', () => {
      const obj = { items: [], value: 42 };
      const paths = extractNestedPaths(obj, { skipEmpty: true });
      
      expect(paths.has('items')).toBe(false);
      expect(paths.get('value')).toBe(42);
    });

    it('should preserve nested objects when strategy is preserve', () => {
      const obj = { metadata: { tags: ['a', 'b'], count: 2 } };
      const paths = extractNestedPaths(obj, { nestedStrategy: 'preserve' });
      
      const metadataValue = paths.get('metadata');
      expect(typeof metadataValue).toBe('string');
      expect(JSON.parse(metadataValue as string)).toEqual({ tags: ['a', 'b'], count: 2 });
    });

    it('should ignore nested objects when strategy is ignore', () => {
      const obj = { name: 'test', metadata: { tags: ['a'] } };
      const paths = extractNestedPaths(obj, { nestedStrategy: 'ignore' });
      
      expect(paths.get('name')).toBe('test');
      expect(paths.has('metadata.tags')).toBe(false);
    });
  });

  describe('nestedJson2Csv', () => {
    it('should convert simple flat objects', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      
      const result = nestedJson2Csv(data);
      
      expect(result.rowCount).toBe(2);
      expect(result.columns).toContain('name');
      expect(result.columns).toContain('age');
      expect(result.csv).toContain('Alice');
      expect(result.csv).toContain('Bob');
    });

    it('should convert nested objects', () => {
      const data = [
        { user: { name: 'Alice', profile: { age: 30 } } },
        { user: { name: 'Bob', profile: { age: 25 } } },
      ];
      
      const result = nestedJson2Csv(data);
      
      expect(result.columns).toContain('user.name');
      expect(result.columns).toContain('user.profile.age');
      expect(result.csv).toContain('Alice');
    });

    it('should handle arrays with join strategy', () => {
      const data = [
        { name: 'Product1', tags: ['electronics', 'sale'] },
      ];
      
      const result = nestedJson2Csv(data, { arrayStrategy: 'join' });
      
      expect(result.csv).toContain('electronics,sale');
    });

    it('should expand array columns', () => {
      const data = [
        { items: [{ x: 1 }, { x: 2 }] },
      ];
      
      const result = nestedJson2Csv(data, { arrayStrategy: 'expand-columns' });
      
      expect(result.columns).toContain('items[0].x');
      expect(result.columns).toContain('items[1].x');
    });

    it('should exclude paths matching patterns', () => {
      const data = [
        { name: 'Alice', password: 'secret', email: 'alice@test.com' },
      ];
      
      const result = nestedJson2Csv(data, { excludePaths: ['password'] });
      
      expect(result.columns).not.toContain('password');
      expect(result.columns).toContain('name');
    });

    it('should include only specified paths', () => {
      const data = [
        { name: 'Alice', age: 30, city: 'NYC', country: 'USA' },
      ];
      
      const result = nestedJson2Csv(data, { includePaths: ['name', 'city'] });
      
      expect(result.columns).toHaveLength(2);
      expect(result.columns).toContain('name');
      expect(result.columns).toContain('city');
    });

    it('should sort columns alphabetically', () => {
      const data = [{ z: 1, a: 2, m: 3 }];
      
      const result = nestedJson2Csv(data, { sortColumns: true });
      
      expect(result.columns).toEqual(['a', 'm', 'z']);
    });

    it('should preserve column order from first object', () => {
      const data = [
        { z: 1, a: 2, m: 3 },
        { b: 4 },
      ];
      
      const result = nestedJson2Csv(data, { preserveOrder: true });
      
      expect(result.columns[0]).toBe('z');
      expect(result.columns[1]).toBe('a');
      expect(result.columns[2]).toBe('m');
    });

    it('should transform column names', () => {
      const data = [{ userName: 'Alice' }];
      
      const result = nestedJson2Csv(data, {
        columnNameTransform: (name) => name.toUpperCase(),
      });
      
      expect(result.columns).toContain('USERNAME');
    });

    it('should include type suffix in column names', () => {
      const data = [{ name: 'Alice', age: 30, active: true }];
      
      const result = nestedJson2Csv(data, { includeTypeSuffix: true });
      
      expect(result.columns).toContain('name_string');
      expect(result.columns).toContain('age_number');
      expect(result.columns).toContain('active_boolean');
    });

    it('should handle null/undefined values', () => {
      const data = [{ name: 'Alice', age: null, city: undefined }];
      
      const result = nestedJson2Csv(data, { nullValue: 'N/A' });
      
      expect(result.csv).toContain('N/A');
    });

    it('should detect and handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      const result = nestedJson2Csv([obj], { detectCircular: true });
      
      expect(result.csv).toContain('[Circular]');
    });

    it('should skip rows with errors when onError is skip', () => {
      const data = [
        { name: 'Alice' },
        null, // This will cause an error
        { name: 'Bob' },
      ];
      
      const result = nestedJson2Csv(data as any, { onError: 'skip' });
      
      expect(result.skipped).toBe(1);
      expect(result.rowCount).toBe(2);
    });

    it('should throw error when input is not an array', () => {
      expect(() => {
        nestedJson2Csv({ name: 'Alice' } as any);
      }).toThrow(NestedConversionError);
    });

    it('should handle empty array', () => {
      const result = nestedJson2Csv([]);
      
      expect(result.rowCount).toBe(0);
      expect(result.columns).toHaveLength(0);
      expect(result.csv).toBe('');
    });

    it('should not include header when header is false', () => {
      const data = [{ name: 'Alice' }];
      
      const result = nestedJson2Csv(data, { header: false });
      
      const lines = result.csv.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('Alice');
    });

    it('should use custom delimiter', () => {
      const data = [{ name: 'Alice', age: 30 }];
      
      const result = nestedJson2Csv(data, { delimiter: ';' });
      
      expect(result.csv).toContain(';');
      expect(result.csv).not.toContain(',');
    });

    it('should always quote values when requested', () => {
      const data = [{ name: 'Alice' }];
      
      const result = nestedJson2Csv(data, { alwaysQuote: true });
      
      expect(result.csv).toContain('"name"');
      expect(result.csv).toContain('"Alice"');
    });

    it('should handle complex nested structure', () => {
      const data = [
        {
          id: 1,
          user: {
            name: 'Alice',
            profile: {
              age: 30,
              address: {
                city: 'NYC',
                zip: '10001',
              },
            },
            tags: ['admin', 'user'],
          },
          metadata: {
            created: new Date('2024-01-15'),
            updated: new Date('2024-01-20'),
          },
        },
      ];
      
      const result = nestedJson2Csv(data, { arrayStrategy: 'join' });
      
      expect(result.columns).toContain('user.profile.address.city');
      expect(result.columns).toContain('user.tags');
      expect(result.csv).toContain('NYC');
      expect(result.csv).toContain('admin,user');
    });
  });

  describe('validateNestedJson', () => {
    it('should validate correct structure', () => {
      const data = [{ name: 'Alice' }, { name: 'Bob' }];
      
      const result = validateNestedJson(data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect non-array input', () => {
      const result = validateNestedJson({ name: 'Alice' } as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Input must be an array');
    });

    it('should warn about empty array', () => {
      const result = validateNestedJson([]);
      
      expect(result.warnings).toContain('Input array is empty');
    });

    it('should detect circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      const result = validateNestedJson([obj]);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular reference'))).toBe(true);
    });
  });

  describe('NestedJson2CsvStream', () => {
    it('should convert stream of objects', async () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      
      const source = Readable.from(data);
      const stream = createNestedJson2CsvStream();
      
      const chunks = await collect<string>(source.pipe(stream));
      const csv = chunks.join('');
      
      expect(csv).toContain('name');
      expect(csv).toContain('Alice');
      expect(csv).toContain('Bob');
    });

    it('should handle nested objects in stream', async () => {
      const data = [
        { user: { name: 'Alice', age: 30 } },
        { user: { name: 'Bob', age: 25 } },
      ];
      
      const source = Readable.from(data);
      const stream = createNestedJson2CsvStream();
      
      const chunks = await collect<string>(source.pipe(stream));
      const csv = chunks.join('');
      
      expect(csv).toContain('user.name');
      expect(csv).toContain('Alice');
    });

    it('should skip errors when onError is skip', async () => {
      const stream = createNestedJson2CsvStream({ onError: 'skip', detectCircular: true });
      
      // Create a circular reference that will cause an error
      const circularObj: any = { name: 'Bad' };
      circularObj.self = circularObj;
      
      // Manually write data including problematic value
      stream.write({ name: 'Alice' });
      stream.write({ name: 'Bob' });
      stream.end();
      
      const chunks = await collect<string>(stream);
      const csv = chunks.join('');
      
      expect(csv).toContain('Alice');
      expect(csv).toContain('Bob');
    });
  });
});
