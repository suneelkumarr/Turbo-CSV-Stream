import { Worker } from 'worker_threads';
import { join } from 'path';
import { EventEmitter } from 'events';
import type {
  WorkerPoolOptions,
  WorkerTask,
  WorkerMessage,
  ParserOptions,
  CSVRow,
} from '../types';

const DEFAULT_POOL_OPTIONS: Required<WorkerPoolOptions> = {
  minWorkers: 1,
  maxWorkers: Math.max(1, (require('os').cpus().length || 4) - 1),
  idleTimeout: 30000,
  taskTimeout: 60000,
};

interface PooledWorker {
  worker: Worker;
  busy: boolean;
  taskId: number | null;
  createdAt: number;
  lastUsed: number;
}

interface PendingTask {
  task: WorkerTask;
  resolve: (result: CSVRow[]) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Worker pool for parallel CSV parsing
 */
export class WorkerPool extends EventEmitter {
  private workers: PooledWorker[] = [];
  private taskQueue: PendingTask[] = [];
  private taskIdCounter: number = 0;
  private options: Required<WorkerPoolOptions>;
  private isShuttingDown: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;
  private workerPath: string;

  constructor(options: WorkerPoolOptions = {}) {
    super();
    this.options = { ...DEFAULT_POOL_OPTIONS, ...options };
    this.workerPath = join(__dirname, 'parser-worker.js');
    
    // Initialize minimum workers
    for (let i = 0; i < this.options.minWorkers; i++) {
      this.createWorker();
    }

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 10000);
  }

  /**
   * Execute a parsing task
   */
  async execute(
    chunk: Buffer | string,
    parserOptions: ParserOptions,
    isFirst: boolean = false,
    isLast: boolean = false
  ): Promise<CSVRow[]> {
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    const task: WorkerTask = {
      id: ++this.taskIdCounter,
      chunk: Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      options: parserOptions,
      isFirst,
      isLast,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.taskQueue.findIndex(t => t.task.id === task.id);
        if (index !== -1) {
          this.taskQueue.splice(index, 1);
        }
        reject(new Error(`Task ${task.id} timed out`));
      }, this.options.taskTimeout);

      const pendingTask: PendingTask = { task, resolve, reject, timeout };

      // Try to find available worker
      const worker = this.getAvailableWorker();
      
      if (worker) {
        this.assignTask(worker, pendingTask);
      } else if (this.workers.length < this.options.maxWorkers) {
        // Create new worker
        const newWorker = this.createWorker();
        this.assignTask(newWorker, pendingTask);
      } else {
        // Queue task
        this.taskQueue.push(pendingTask);
      }
    });
  }

  /**
   * Execute multiple chunks in parallel
   */
  async executeAll(
    chunks: (Buffer | string)[],
    parserOptions: ParserOptions
  ): Promise<CSVRow[][]> {
    const promises = chunks.map((chunk, index) =>
      this.execute(
        chunk,
        parserOptions,
        index === 0,
        index === chunks.length - 1
      )
    );

    return Promise.all(promises);
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject pending tasks
    for (const pending of this.taskQueue) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker pool shutting down'));
    }
    this.taskQueue = [];

    // Terminate workers
    const terminatePromises = this.workers.map(({ worker }) =>
      worker.terminate()
    );

    await Promise.all(terminatePromises);
    this.workers = [];
  }

  /**
   * Get pool statistics
   */
  stats(): {
    totalWorkers: number;
    busyWorkers: number;
    idleWorkers: number;
    pendingTasks: number;
  } {
    const busyWorkers = this.workers.filter(w => w.busy).length;
    return {
      totalWorkers: this.workers.length,
      busyWorkers,
      idleWorkers: this.workers.length - busyWorkers,
      pendingTasks: this.taskQueue.length,
    };
  }

  private createWorker(): PooledWorker {
    const worker = new Worker(this.workerPath);
    
    const pooledWorker: PooledWorker = {
      worker,
      busy: false,
      taskId: null,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    worker.on('message', (message: WorkerMessage) => {
      this.handleWorkerMessage(pooledWorker, message);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(pooledWorker, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(pooledWorker, code);
    });

    this.workers.push(pooledWorker);
    return pooledWorker;
  }

  private getAvailableWorker(): PooledWorker | null {
    return this.workers.find(w => !w.busy) ?? null;
  }

  private assignTask(pooledWorker: PooledWorker, pending: PendingTask): void {
    pooledWorker.busy = true;
    pooledWorker.taskId = pending.task.id;
    pooledWorker.lastUsed = Date.now();

    // Store pending task reference
    (pooledWorker as any).pendingTask = pending;

    pooledWorker.worker.postMessage(pending.task);
  }

  private handleWorkerMessage(pooledWorker: PooledWorker, message: WorkerMessage): void {
    const pending = (pooledWorker as any).pendingTask as PendingTask | undefined;
    
    if (!pending) return;

    clearTimeout(pending.timeout);
    delete (pooledWorker as any).pendingTask;

    pooledWorker.busy = false;
    pooledWorker.taskId = null;
    pooledWorker.lastUsed = Date.now();

    if (message.type === 'complete' && message.data) {
      pending.resolve(message.data);
    } else if (message.type === 'error' && message.error) {
      pending.reject(message.error as any);
    }

    // Process next task in queue
    this.processQueue();
  }

  private handleWorkerError(pooledWorker: PooledWorker, error: Error): void {
    const pending = (pooledWorker as any).pendingTask as PendingTask | undefined;
    
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      delete (pooledWorker as any).pendingTask;
    }

    // Remove and replace worker
    this.removeWorker(pooledWorker);
    
    if (this.workers.length < this.options.minWorkers && !this.isShuttingDown) {
      this.createWorker();
    }

    this.emit('workerError', error);
  }

  private handleWorkerExit(pooledWorker: PooledWorker, code: number): void {
    this.removeWorker(pooledWorker);
    
    if (code !== 0) {
      this.emit('workerExit', code);
    }

    if (this.workers.length < this.options.minWorkers && !this.isShuttingDown) {
      this.createWorker();
    }
  }

  private removeWorker(pooledWorker: PooledWorker): void {
    const index = this.workers.indexOf(pooledWorker);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    const worker = this.getAvailableWorker();
    if (worker) {
      const pending = this.taskQueue.shift()!;
      this.assignTask(worker, pending);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    
    // Remove idle workers above minimum
    const idleWorkers = this.workers.filter(
      w => !w.busy && now - w.lastUsed > this.options.idleTimeout
    );

    for (const worker of idleWorkers) {
      if (this.workers.length > this.options.minWorkers) {
        worker.worker.terminate();
        this.removeWorker(worker);
      }
    }
  }
}

// Global pool instance
let globalPool: WorkerPool | null = null;

export function getGlobalPool(options?: WorkerPoolOptions): WorkerPool {
  if (!globalPool) {
    globalPool = new WorkerPool(options);
  }
  return globalPool;
}

export async function shutdownGlobalPool(): Promise<void> {
  if (globalPool) {
    await globalPool.shutdown();
    globalPool = null;
  }
}