import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import {
  StreamTransform,
  FilterStream,
  MapStream,
  BatchStream,
  TakeStream,
  SkipStream,
  UniqueStream,
  TapStream,
  TransformPipeline,
  transform,
  filter,
  map,
  batch,
  pipeline,
  compose,
  collect,
  consume,
} from '../src/transform/stream-transform';

describe('Stream Transform', () => {
  // Helper to create a readable stream from array
  function arrayToStream<T>(arr: T[]): Readable {
    return Readable.from(arr);
  }

  describe('StreamTransform', () => {
    it('should transform records', async () => {
      const source = arrayToStream([{ value: 1 }, { value: 2 }, { value: 3 }]);
      const transformer = new StreamTransform((row: any) => ({ value: row.value * 2 }));
      
      const results = await collect(source.pipe(transformer));
      
      expect(results).toEqual([{ value: 2 }, { value: 4 }, { value: 6 }]);
    });

    it('should skip null results', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      const transformer = new StreamTransform((val: number) => val % 2 === 0 ? null : val);
      
      const results = await collect(source.pipe(transformer));
      
      expect(results).toEqual([1, 3, 5]);
    });

    it('should handle errors based on onError option', async () => {
      const source = arrayToStream([1, 2, 3]);
      const transformer = new StreamTransform(
        (val: number) => {
          if (val === 2) throw new Error('test');
          return val;
        },
        { onError: 'skip' }
      );
      
      const results = await collect(source.pipe(transformer));
      
      expect(results).toEqual([1, 3]);
    });
  });

  describe('FilterStream', () => {
    it('should filter records', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      const filtered = new FilterStream((val: number) => val > 2);
      
      const results = await collect(source.pipe(filtered));
      
      expect(results).toEqual([3, 4, 5]);
    });

    it('should support async predicates', async () => {
      const source = arrayToStream([1, 2, 3]);
      const filtered = new FilterStream(async (val: number) => val !== 2);
      
      const results = await collect(source.pipe(filtered));
      
      expect(results).toEqual([1, 3]);
    });
  });

  describe('MapStream', () => {
    it('should map records', async () => {
      const source = arrayToStream([1, 2, 3]);
      const mapped = new MapStream((val: number) => val * 10);
      
      const results = await collect(source.pipe(mapped));
      
      expect(results).toEqual([10, 20, 30]);
    });

    it('should support async mappers', async () => {
      const source = arrayToStream(['a', 'b']);
      const mapped = new MapStream(async (val: string) => val.toUpperCase());
      
      const results = await collect(source.pipe(mapped));
      
      expect(results).toEqual(['A', 'B']);
    });
  });

  describe('BatchStream', () => {
    it('should batch records', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      const batched = new BatchStream(2);
      
      const results = await collect(source.pipe(batched));
      
      expect(results).toEqual([[1, 2], [3, 4], [5]]);
    });
  });

  describe('TakeStream', () => {
    it('should take first N records', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      const taken = new TakeStream(3);
      
      const results = await collect(source.pipe(taken));
      
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('SkipStream', () => {
    it('should skip first N records', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      const skipped = new SkipStream(2);
      
      const results = await collect(source.pipe(skipped));
      
      expect(results).toEqual([3, 4, 5]);
    });
  });

  describe('UniqueStream', () => {
    it('should remove duplicates', async () => {
      const source = arrayToStream([
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' },
      ]);
      const unique = new UniqueStream((row: any) => String(row.id));
      
      const results = await collect(source.pipe(unique));
      
      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ id: 1, name: 'a' });
      expect(results).toContainEqual({ id: 2, name: 'b' });
    });
  });

  describe('TapStream', () => {
    it('should allow side effects without modifying stream', async () => {
      const sideEffects: number[] = [];
      const source = arrayToStream([1, 2, 3]);
      const tapped = new TapStream((val: number) => { sideEffects.push(val); });
      
      const results = await collect(source.pipe(tapped));
      
      expect(results).toEqual([1, 2, 3]);
      expect(sideEffects).toEqual([1, 2, 3]);
    });
  });

  describe('TransformPipeline', () => {
    it('should chain transforms', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      
      const pipe = new TransformPipeline<number, number>()
        .filter((n: number) => n > 2)
        .map((n: number) => n * 10);
      
      const results = await pipe.collect(source);
      
      expect(results).toEqual([30, 40, 50]);
    });

    it('should support take and skip', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      
      const pipe = new TransformPipeline<number, number>()
        .skip(1)
        .take(2);
      
      const results = await pipe.collect(source);
      
      expect(results).toEqual([2, 3]);
    });

    it('should support batching', async () => {
      const source = arrayToStream([1, 2, 3, 4]);
      
      const pipe = new TransformPipeline<number, number>()
        .batch(2);
      
      const results = await pipe.collect(source);
      
      expect(results).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('Convenience functions', () => {
    it('transform() should create StreamTransform', async () => {
      const source = arrayToStream([1, 2]);
      const t = transform((val: number) => val + 1);
      
      const results = await collect(source.pipe(t));
      
      expect(results).toEqual([2, 3]);
    });

    it('filter() should create FilterStream', async () => {
      const source = arrayToStream([1, 2, 3]);
      const f = filter((val: number) => val !== 2);
      
      const results = await collect(source.pipe(f));
      
      expect(results).toEqual([1, 3]);
    });

    it('map() should create MapStream', async () => {
      const source = arrayToStream([1, 2]);
      const m = map((val: number) => val * 2);
      
      const results = await collect(source.pipe(m));
      
      expect(results).toEqual([2, 4]);
    });

    it('batch() should create BatchStream', async () => {
      const source = arrayToStream([1, 2, 3]);
      const b = batch(2);
      
      const results = await collect(source.pipe(b));
      
      expect(results).toEqual([[1, 2], [3]]);
    });

    it('compose() should combine transforms', async () => {
      const composed = compose<number>(
        (val) => val + 1,
        (val) => val! * 2
      );
      
      expect(await composed(5, 0)).toBe(12);
    });

    it('consume() should count records', async () => {
      const source = arrayToStream([1, 2, 3, 4, 5]);
      
      const count = await consume(source);
      
      expect(count).toBe(5);
    });

    it('pipeline() should create TransformPipeline', () => {
      const p = pipeline();
      
      expect(p).toBeInstanceOf(TransformPipeline);
    });
  });
});
