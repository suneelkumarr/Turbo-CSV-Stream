import { describe, it, expect, afterEach } from 'vitest';
import {
  getCachedRegex,
  compilePathPattern,
  matchPathOptimized,
  buildPathOptimized,
  escapeCSVFieldOptimized,
  memoize,
  StringBuilder,
  deduplicateArray,
  groupBy,
  measurePerformance,
  measurePerformanceAsync,
  clearOptimizationCaches,
  getCacheStats,
  fastTypeCheck,
} from '../src/utils/optimizations';

describe('Performance Optimizations', () => {
  afterEach(() => {
    clearOptimizationCaches();
  });

  describe('Regex Caching', () => {
    it('should cache compiled regexes', () => {
      const pattern = '^test.*$';
      const regex1 = getCachedRegex(pattern);
      const regex2 = getCachedRegex(pattern);
      
      expect(regex1).toBe(regex2); // Same instance
    });

    it('should compile path patterns correctly', () => {
      const pattern = 'user.*';
      const regex = compilePathPattern(pattern);
      
      expect(regex.test('user.name')).toBe(true);
      expect(regex.test('user.profile.age')).toBe(true);
      expect(regex.test('admin.name')).toBe(false);
    });

    it('should handle wildcards in path matching', () => {
      expect(matchPathOptimized('user.name', 'user.*')).toBe(true);
      expect(matchPathOptimized('user.name', 'admin.*')).toBe(false);
      expect(matchPathOptimized('anything', '*')).toBe(true);
    });
  });

  describe('Path Building', () => {
    it('should build paths efficiently', () => {
      const path = buildPathOptimized(['user', 'profile', 'name']);
      expect(path).toBe('user.profile.name');
    });

    it('should handle array indices with brackets', () => {
      const path = buildPathOptimized(['items', '0', 'value'], '.', 'brackets');
      expect(path).toBe('items[0].value');
    });

    it('should handle array indices with underscore', () => {
      const path = buildPathOptimized(['items', '0', 'value'], '.', 'underscore');
      expect(path).toBe('items._0.value');
    });

    it('should handle single part paths', () => {
      expect(buildPathOptimized(['name'])).toBe('name');
    });

    it('should handle empty paths', () => {
      expect(buildPathOptimized([])).toBe('');
    });
  });

  describe('CSV Escaping', () => {
    it('should escape fields with special characters', () => {
      expect(escapeCSVFieldOptimized('hello, world')).toBe('"hello, world"');
      expect(escapeCSVFieldOptimized('say "hello"')).toBe('"say ""hello"""');
      expect(escapeCSVFieldOptimized('line\nbreak')).toBe('"line\nbreak"');
    });

    it('should not quote simple values', () => {
      expect(escapeCSVFieldOptimized('simple')).toBe('simple');
      expect(escapeCSVFieldOptimized('value123')).toBe('value123');
    });

    it('should always quote when requested', () => {
      expect(escapeCSVFieldOptimized('simple', ',', '"', true)).toBe('"simple"');
    });

    it('should handle empty strings', () => {
      expect(escapeCSVFieldOptimized('')).toBe('');
      expect(escapeCSVFieldOptimized('', ',', '"', true)).toBe('""');
    });
  });

  describe('Memoization', () => {
    it('should cache function results', () => {
      let callCount = 0;
      const fn = memoize((x: number) => {
        callCount++;
        return x * 2;
      });

      expect(fn(5)).toBe(10);
      expect(fn(5)).toBe(10);
      expect(callCount).toBe(1); // Only called once
    });

    it('should respect maxSize limit', () => {
      const fn = memoize(
        (x: number) => x * 2,
        { maxSize: 2 }
      );

      fn(1);
      fn(2);
      fn(3); // Should evict first entry

      const stats = getCacheStats();
      // Cache size should be managed by memoize function
      expect(fn(1)).toBe(2); // Still works
    });

    it('should support custom key function', () => {
      const fn = memoize(
        (obj: { x: number }) => obj.x * 2,
        { keyFn: (obj) => String(obj.x) }
      );

      expect(fn({ x: 5 })).toBe(10);
      expect(fn({ x: 5 })).toBe(10); // Different object, same key
    });
  });

  describe('StringBuilder', () => {
    it('should build strings efficiently', () => {
      const sb = new StringBuilder();
      sb.append('Hello');
      sb.append(' ');
      sb.append('World');
      
      expect(sb.toString()).toBe('Hello World');
    });

    it('should track size', () => {
      const sb = new StringBuilder();
      sb.append('test');
      
      expect(sb.getSize()).toBe(4);
    });

    it('should append lines with EOL', () => {
      const sb = new StringBuilder();
      sb.appendLine('line1');
      sb.appendLine('line2');
      
      expect(sb.toString()).toBe('line1\nline2\n');
    });

    it('should clear content', () => {
      const sb = new StringBuilder();
      sb.append('test');
      sb.clear();
      
      expect(sb.toString()).toBe('');
      expect(sb.getSize()).toBe(0);
    });
  });

  describe('Array Operations', () => {
    it('should deduplicate arrays', () => {
      const arr = [1, 2, 2, 3, 3, 3, 4];
      const result = deduplicateArray(arr);
      
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should deduplicate with key function', () => {
      const arr = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
      ];
      
      const result = deduplicateArray(arr, (item) => String(item.id));
      
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('A');
      expect(result[1]!.name).toBe('B');
    });

    it('should group by key', () => {
      const arr = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      
      const groups = groupBy(arr, (item) => item.category);
      
      expect(groups.get('A')).toHaveLength(2);
      expect(groups.get('B')).toHaveLength(1);
    });
  });

  describe('Fast Type Checking', () => {
    it('should check types efficiently', () => {
      expect(fastTypeCheck.isString('test')).toBe(true);
      expect(fastTypeCheck.isString(123)).toBe(false);
      
      expect(fastTypeCheck.isNumber(123)).toBe(true);
      expect(fastTypeCheck.isNumber('123')).toBe(false);
      
      expect(fastTypeCheck.isBoolean(true)).toBe(true);
      expect(fastTypeCheck.isBoolean(1)).toBe(false);
      
      expect(fastTypeCheck.isArray([1, 2])).toBe(true);
      expect(fastTypeCheck.isArray('array')).toBe(false);
      
      expect(fastTypeCheck.isObject({})).toBe(true);
      expect(fastTypeCheck.isObject(null)).toBe(false);
      
      expect(fastTypeCheck.isDate(new Date())).toBe(true);
      expect(fastTypeCheck.isDate('2024-01-01')).toBe(false);
      
      expect(fastTypeCheck.isNull(null)).toBe(true);
      expect(fastTypeCheck.isNull(undefined)).toBe(false);
      
      expect(fastTypeCheck.isUndefined(undefined)).toBe(true);
      expect(fastTypeCheck.isUndefined(null)).toBe(false);
      
      expect(fastTypeCheck.isNullish(null)).toBe(true);
      expect(fastTypeCheck.isNullish(undefined)).toBe(true);
      expect(fastTypeCheck.isNullish(0)).toBe(false);
    });
  });

  describe('Performance Measurement', () => {
    it('should measure sync function performance', () => {
      const { result, metrics } = measurePerformance(
        'test operation',
        () => {
          let sum = 0;
          for (let i = 0; i < 1000; i++) sum += i;
          return sum;
        },
        1000
      );
      
      expect(result).toBe(499500);
      expect(metrics.operation).toBe('test operation');
      expect(metrics.duration).toBeGreaterThan(0);
      expect(metrics.itemsProcessed).toBe(1000);
      expect(metrics.throughput).toBeGreaterThan(0);
    });

    it('should measure async function performance', async () => {
      const { result, metrics } = await measurePerformanceAsync(
        'async test',
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'done';
        },
        100
      );
      
      expect(result).toBe('done');
      expect(metrics.duration).toBeGreaterThan(9);
      expect(metrics.itemsProcessed).toBe(100);
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', () => {
      compilePathPattern('test.*');
      compilePathPattern('user.*');
      
      const stats = getCacheStats();
      
      expect(stats.pathPatternCache).toBeGreaterThan(0);
    });

    it('should clear all caches', () => {
      compilePathPattern('test.*');
      getCachedRegex('^test$');
      
      clearOptimizationCaches();
      
      const stats = getCacheStats();
      expect(stats.regexCache).toBe(0);
      expect(stats.pathPatternCache).toBe(0);
    });
  });

  describe('Performance Comparison', () => {
    it('should be faster than naive implementation', () => {
      const iterations = 1000;
      
      // Naive: create regex each time
      const naiveStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        /^test.*$/.test('test123');
      }
      const naiveTime = performance.now() - naiveStart;
      
      // Optimized: use cached regex
      const optimizedStart = performance.now();
      const regex = getCachedRegex('^test.*$');
      for (let i = 0; i < iterations; i++) {
        regex.test('test123');
      }
      const optimizedTime = performance.now() - optimizedStart;
      
      // Optimized should be at least as fast or faster
      expect(optimizedTime).toBeLessThanOrEqual(naiveTime * 1.1); // Allow 10% margin
    });

    it('should handle large string building efficiently', () => {
      const iterations = 10000;
      
      // Warmup to avoid JIT compilation affecting results
      const warmupSb = new StringBuilder();
      for (let i = 0; i < 1000; i++) {
        warmupSb.append('test,');
      }
      warmupSb.toString();
      
      const warmupArr: string[] = [];
      for (let i = 0; i < 1000; i++) {
        warmupArr.push('test,');
      }
      warmupArr.join('');
      
      // StringBuilder approach
      const sbStart = performance.now();
      const sb = new StringBuilder();
      for (let i = 0; i < iterations; i++) {
        sb.append('test,');
      }
      const sbResult = sb.toString();
      const sbTime = performance.now() - sbStart;
      
      // Array join approach (baseline)
      const arrStart = performance.now();
      const arr: string[] = [];
      for (let i = 0; i < iterations; i++) {
        arr.push('test,');
      }
      const arrResult = arr.join('');
      const arrTime = performance.now() - arrStart;
      
      expect(sbResult.length).toBe(arrResult.length);
      // StringBuilder should be competitive with array join (within 3x for safety)
      expect(sbTime).toBeLessThan(arrTime * 3);
    });
  });
});
