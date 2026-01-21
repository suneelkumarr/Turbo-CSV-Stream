import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkerPool, getGlobalPool, shutdownGlobalPool } from '../src/workers/worker-pool';
import type { ParserOptions, CSVRow } from '../src/types';

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool({ minWorkers: 1, maxWorkers: 2 });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  it('should track pool statistics', () => {
    const stats = pool.stats();

    expect(stats.totalWorkers).toBe(1);
    expect(stats.busyWorkers).toBe(0);
    expect(stats.idleWorkers).toBe(1);
    expect(stats.pendingTasks).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    const pool2 = new WorkerPool({ minWorkers: 1 });
    
    try {
      await pool2.execute('test', { onError: 'throw' });
    } catch (e) {
      expect(e).toBeDefined();
    }

    await pool2.shutdown();
  });
});

describe('Global Pool', () => {
  afterEach(async () => {
    await shutdownGlobalPool();
  });

  it('should return singleton instance', () => {
    const pool1 = getGlobalPool();
    const pool2 = getGlobalPool();
    expect(pool1).toBe(pool2);
  });

  it('should shutdown cleanly', async () => {
    const pool = getGlobalPool();
    await shutdownGlobalPool();
    const pool2 = getGlobalPool();
    expect(pool).not.toBe(pool2);
  });
});
