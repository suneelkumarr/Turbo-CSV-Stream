import { parentPort } from 'worker_threads';
import { CSVParser } from '../core/parser';
import type { WorkerTask, WorkerMessage } from '../types';

if (!parentPort) {
  throw new Error('This file must be run as a worker thread');
}

// Cache parser instance for reuse
let cachedParser: CSVParser | null = null;
let cachedOptionsHash: string | null = null;

function hashOptions(options: any): string {
  return JSON.stringify(options);
}

parentPort.on('message', (task: WorkerTask) => {
  try {
    const optionsHash = hashOptions(task.options);
    
    // Reuse parser if options haven't changed
    if (cachedOptionsHash !== optionsHash || !cachedParser) {
      cachedParser = new CSVParser(task.options);
      cachedOptionsHash = optionsHash;
    }

    // Parse chunk
    const input = Buffer.isBuffer(task.chunk) 
      ? task.chunk.toString('utf-8') 
      : task.chunk;
    
    const result = cachedParser.parse(input);

    const message: WorkerMessage = {
      type: 'complete',
      data: result.data,
      meta: result.meta,
    };

    parentPort!.postMessage(message);
  } catch (error: any) {
    const message: WorkerMessage = {
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        line: error.line,
        column: error.column,
      } as any,
    };

    parentPort!.postMessage(message);
  }
});

// Handle termination
process.on('SIGTERM', () => {
  process.exit(0);
});