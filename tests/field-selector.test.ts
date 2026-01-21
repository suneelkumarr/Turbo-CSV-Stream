import { describe, it, expect } from 'vitest';
import {
  FieldSelector,
  createFieldSelector,
  selectFields,
  pick,
  omit,
  rename,
  addFields,
  parseFieldSelector,
  getNestedValue,
  setNestedValue,
  coerceType,
  autoCoerce,
} from '../src/utils/field-selector';

describe('Field Selector', () => {
  describe('getNestedValue', () => {
    it('should get simple property', () => {
      const obj = { name: 'test' };
      expect(getNestedValue(obj, 'name')).toBe('test');
    });

    it('should get nested property', () => {
      const obj = { user: { name: 'test' } };
      expect(getNestedValue(obj as any, 'user.name')).toBe('test');
    });

    it('should get deeply nested property', () => {
      const obj = { user: { profile: { address: { city: 'New York' } } } };
      expect(getNestedValue(obj as any, 'user.profile.address.city')).toBe('New York');
    });

    it('should return undefined for missing path', () => {
      const obj = { name: 'test' };
      expect(getNestedValue(obj, 'missing')).toBeUndefined();
    });

    it('should handle null in path', () => {
      const obj = { user: null };
      expect(getNestedValue(obj as any, 'user.name')).toBeUndefined();
    });

    it('should get array element by index', () => {
      const obj = { items: ['a', 'b', 'c'] };
      expect(getNestedValue(obj as any, 'items[0]')).toBe('a');
      expect(getNestedValue(obj as any, 'items[1]')).toBe('b');
      expect(getNestedValue(obj as any, 'items[2]')).toBe('c');
    });

    it('should get nested property from array element', () => {
      const obj = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
      expect(getNestedValue(obj as any, 'users[0].name')).toBe('Alice');
      expect(getNestedValue(obj as any, 'users[1].name')).toBe('Bob');
    });

    it('should handle complex nested paths with arrays', () => {
      const obj = {
        data: {
          results: [
            { items: [{ value: 100 }, { value: 200 }] },
            { items: [{ value: 300 }] }
          ]
        }
      };
      expect(getNestedValue(obj as any, 'data.results[0].items[1].value')).toBe(200);
      expect(getNestedValue(obj as any, 'data.results[1].items[0].value')).toBe(300);
    });

    it('should return undefined for out of bounds array index', () => {
      const obj = { items: ['a'] };
      expect(getNestedValue(obj as any, 'items[5]')).toBeUndefined();
    });

    it('should return undefined when accessing array index on non-array', () => {
      const obj = { items: 'not-an-array' };
      expect(getNestedValue(obj as any, 'items[0]')).toBeUndefined();
    });
  });

  describe('setNestedValue', () => {
    it('should set simple property', () => {
      const obj: any = {};
      setNestedValue(obj, 'name', 'test');
      expect(obj.name).toBe('test');
    });

    it('should set nested property', () => {
      const obj: any = {};
      setNestedValue(obj, 'user.name', 'test');
      expect(obj.user.name).toBe('test');
    });

    it('should create intermediate objects', () => {
      const obj: any = {};
      setNestedValue(obj, 'a.b.c', 'value');
      expect(obj.a.b.c).toBe('value');
    });

    it('should set array element by index', () => {
      const obj: any = {};
      setNestedValue(obj, 'items[0]', 'first');
      expect(obj.items[0]).toBe('first');
    });

    it('should set nested property in array element', () => {
      const obj: any = {};
      setNestedValue(obj, 'users[0].name', 'Alice');
      expect(obj.users[0].name).toBe('Alice');
    });

    it('should set multiple array elements', () => {
      const obj: any = {};
      setNestedValue(obj, 'items[0]', 'a');
      setNestedValue(obj, 'items[1]', 'b');
      setNestedValue(obj, 'items[2]', 'c');
      expect(obj.items).toEqual(['a', 'b', 'c']);
    });

    it('should handle complex nested paths with arrays', () => {
      const obj: any = {};
      setNestedValue(obj, 'data.results[0].items[0].value', 100);
      setNestedValue(obj, 'data.results[0].items[1].value', 200);
      expect(obj.data.results[0].items[0].value).toBe(100);
      expect(obj.data.results[0].items[1].value).toBe(200);
    });

    it('should preserve existing values when setting new paths', () => {
      const obj: any = { existing: 'value' };
      setNestedValue(obj, 'user.name', 'test');
      expect(obj.existing).toBe('value');
      expect(obj.user.name).toBe('test');
    });

    it('should overwrite existing values', () => {
      const obj: any = { user: { name: 'old' } };
      setNestedValue(obj, 'user.name', 'new');
      expect(obj.user.name).toBe('new');
    });
  });

  describe('parseFieldSelector', () => {
    it('should parse simple field', () => {
      const result = parseFieldSelector('name');
      expect(result.field).toBe('name');
      expect(result.options).toEqual({});
    });

    it('should parse alias syntax', () => {
      const result = parseFieldSelector('name:displayName');
      expect(result.field).toBe('name');
      expect(result.options?.as).toBe('displayName');
    });

    it('should parse default value syntax', () => {
      const result = parseFieldSelector('name|unknown');
      expect(result.field).toBe('name');
      expect(result.options?.default).toBe('unknown');
    });

    it('should parse type hint syntax', () => {
      const result = parseFieldSelector('age::number');
      expect(result.field).toBe('age');
      expect(result.options?.type).toBe('number');
    });
  });

  describe('coerceType', () => {
    it('should coerce to string', () => {
      expect(coerceType(42, 'string')).toBe('42');
      expect(coerceType(true, 'string')).toBe('true');
    });

    it('should coerce to number', () => {
      expect(coerceType('42', 'number')).toBe(42);
      expect(coerceType('3.14', 'number')).toBe(3.14);
      expect(coerceType('not a number', 'number')).toBe('not a number');
    });

    it('should coerce to boolean', () => {
      expect(coerceType('true', 'boolean')).toBe(true);
      expect(coerceType('false', 'boolean')).toBe(false);
      expect(coerceType('yes', 'boolean')).toBe(true);
      expect(coerceType('no', 'boolean')).toBe(false);
      expect(coerceType('1', 'boolean')).toBe(true);
      expect(coerceType('0', 'boolean')).toBe(false);
    });

    it('should coerce to date', () => {
      const result = coerceType('2024-01-15', 'date');
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle null/undefined', () => {
      expect(coerceType(null, 'string')).toBe(null);
      expect(coerceType(undefined, 'number')).toBe(undefined);
    });
  });

  describe('autoCoerce', () => {
    it('should auto-detect number', () => {
      expect(autoCoerce('42')).toBe(42);
      expect(autoCoerce('-3.14')).toBe(-3.14);
    });

    it('should auto-detect boolean', () => {
      expect(autoCoerce('true')).toBe(true);
      expect(autoCoerce('false')).toBe(false);
    });

    it('should auto-detect null', () => {
      expect(autoCoerce('null')).toBe(null);
    });

    it('should auto-detect date', () => {
      const result = autoCoerce('2024-01-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
    });

    it('should preserve strings', () => {
      expect(autoCoerce('hello')).toBe('hello');
      expect(autoCoerce('')).toBe('');
    });
  });

  describe('FieldSelector', () => {
    const sampleRow = {
      name: 'John',
      age: 30,
      email: 'john@example.com',
      active: true,
    };

    it('should extract simple fields', () => {
      const selector = new FieldSelector(['name', 'age']);
      const result = selector.extract(sampleRow);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should apply default values', () => {
      const selector = new FieldSelector([
        { field: 'missing', options: { default: 'N/A' } },
      ]);
      const result = selector.extract(sampleRow);
      expect(result.missing).toBe('N/A');
    });

    it('should apply transforms', () => {
      const selector = new FieldSelector([
        { field: 'name', options: { transform: (v) => String(v).toUpperCase() } },
      ]);
      const result = selector.extract(sampleRow);
      expect(result.name).toBe('JOHN');
    });

    it('should use aliases', () => {
      const selector = new FieldSelector([
        { field: 'name', options: { as: 'fullName' } },
      ]);
      const result = selector.extract(sampleRow);
      expect(result.fullName).toBe('John');
      expect(result.name).toBeUndefined();
    });

    it('should use custom getters', () => {
      const selector = new FieldSelector([
        { field: 'computed', options: { getter: (row) => `${row.name}-${row.age}` } },
      ]);
      const result = selector.extract(sampleRow);
      expect(result.computed).toBe('John-30');
    });

    it('should extract from multiple rows', () => {
      const rows = [
        { name: 'A', value: 1 },
        { name: 'B', value: 2 },
      ];
      const selector = new FieldSelector(['name']);
      const results = selector.extractAll(rows);
      expect(results).toEqual([{ name: 'A' }, { name: 'B' }]);
    });

    it('should extract nested fields', () => {
      const nestedRow = {
        user: { profile: { name: 'John', age: 30 } },
        meta: { created: '2024-01-01' }
      };
      const selector = new FieldSelector(['user.profile.name', 'meta.created']);
      const result = selector.extract(nestedRow as any);
      expect(result).toEqual({
        user: { profile: { name: 'John' } },
        meta: { created: '2024-01-01' }
      });
    });

    it('should extract from array indices', () => {
      const arrayRow = {
        items: [
          { name: 'First', value: 100 },
          { name: 'Second', value: 200 }
        ]
      };
      const selector = new FieldSelector(['items[0].name', 'items[1].value']);
      const result = selector.extract(arrayRow as any);
      expect(result).toEqual({
        items: [{ name: 'First' }, { value: 200 }]
      });
    });

    it('should alias nested fields to flat output', () => {
      const nestedRow = { user: { profile: { name: 'Alice' } } };
      const selector = new FieldSelector([
        { field: 'user.profile.name', options: { as: 'userName' } }
      ]);
      const result = selector.extract(nestedRow as any);
      expect(result.userName).toBe('Alice');
    });

    it('should apply defaults to nested fields', () => {
      const row = { user: { profile: {} } };
      const selector = new FieldSelector([
        { field: 'user.profile.bio', options: { default: 'No bio provided' } }
      ]);
      const result = selector.extract(row as any);
      expect((result as any).user.profile.bio).toBe('No bio provided');
    });
  });

  describe('selectFields', () => {
    it('should select fields from rows', () => {
      const rows = [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
      ];
      const result = selectFields(rows, ['a', 'c']);
      expect(result).toEqual([
        { a: 1, c: 3 },
        { a: 4, c: 6 },
      ]);
    });
  });

  describe('pick', () => {
    it('should pick specified fields', () => {
      const row = { a: 1, b: 2, c: 3 };
      expect(pick(row, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('should ignore missing fields', () => {
      const row = { a: 1 };
      expect(pick(row, ['a', 'b'])).toEqual({ a: 1 });
    });
  });

  describe('omit', () => {
    it('should omit specified fields', () => {
      const row = { a: 1, b: 2, c: 3 };
      expect(omit(row, ['b'])).toEqual({ a: 1, c: 3 });
    });
  });

  describe('rename', () => {
    it('should rename fields', () => {
      const row = { oldName: 'value', other: 'keep' };
      expect(rename(row, { oldName: 'newName' })).toEqual({ newName: 'value', other: 'keep' });
    });
  });

  describe('addFields', () => {
    it('should add computed fields', () => {
      const row = { a: 10, b: 5 };
      const result = addFields(row, {
        sum: (r) => (r.a as number) + (r.b as number),
        product: (r) => (r.a as number) * (r.b as number),
      });
      expect(result.sum).toBe(15);
      expect(result.product).toBe(50);
    });
  });
});
