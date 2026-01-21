/**
 * High-performance buffer pool for efficient memory management
 * Reduces GC pressure by reusing buffers
 */
export class BufferPool {
  private pools: Map<number, Buffer[]> = new Map();
  private readonly maxPoolSize: number;
  private readonly defaultSize: number;
  
  constructor(options: { maxPoolSize?: number; defaultSize?: number } = {}) {
    this.maxPoolSize = options.maxPoolSize ?? 100;
    this.defaultSize = options.defaultSize ?? 64 * 1024; // 64KB
  }

  /**
   * Get a buffer from the pool or create a new one
   */
  acquire(size: number = this.defaultSize): Buffer {
    const roundedSize = this.roundUpToPowerOf2(size);
    const pool = this.pools.get(roundedSize);
    
    if (pool && pool.length > 0) {
      return pool.pop()!;
    }
    
    return Buffer.allocUnsafe(roundedSize);
  }

  /**
   * Return a buffer to the pool for reuse
   */
  release(buffer: Buffer): void {
    const size = buffer.length;
    
    let pool = this.pools.get(size);
    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }
    
    if (pool.length < this.maxPoolSize) {
      // Clear sensitive data
      buffer.fill(0);
      pool.push(buffer);
    }
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.pools.clear();
  }

  /**
   * Get pool statistics
   */
  stats(): { size: number; count: number }[] {
    return Array.from(this.pools.entries()).map(([size, pool]) => ({
      size,
      count: pool.length,
    }));
  }

  private roundUpToPowerOf2(n: number): number {
    n--;
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    n++;
    return n;
  }
}

// Global buffer pool instance
export const globalBufferPool = new BufferPool();