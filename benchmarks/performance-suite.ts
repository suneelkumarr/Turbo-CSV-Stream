/**
 * Performance Benchmark Suite
 * 
 * Run with: npm run benchmark
 */

import { performance } from 'perf_hooks';
import {
  parseSync,
  stringifySync,
  json2csv,
  csv2json,
  nestedJson2Csv,
  generateCSV,
  generateObjects,
} from '../src/index';
import {
  StringBuilder,
  escapeCSVFieldOptimized,
  clearOptimizationCaches,
} from '../src/utils/optimizations';

// ============================================
// Benchmark Infrastructure
// ============================================

interface BenchmarkResult {
  name: string;
  operations: number;
  duration: number;
  opsPerSecond: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  memoryUsed?: number;
}

function benchmark(
  name: string,
  fn: () => void,
  operations: number = 1000
): BenchmarkResult {
  // Warm up
  for (let i = 0; i < Math.min(10, operations); i++) {
    fn();
  }

  // Clear caches for fair comparison
  clearOptimizationCaches();
  if (global.gc) global.gc();

  const startMemory = process.memoryUsage().heapUsed;
  const times: number[] = [];
  
  const start = performance.now();
  
  for (let i = 0; i < operations; i++) {
    const opStart = performance.now();
    fn();
    times.push(performance.now() - opStart);
  }
  
  const end = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  const duration = end - start;
  const opsPerSecond = (operations / duration) * 1000;

  return {
    name,
    operations,
    duration,
    opsPerSecond,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    memoryUsed: endMemory - startMemory,
  };
}

async function benchmarkAsync(
  name: string,
  fn: () => Promise<void>,
  operations: number = 100
): Promise<BenchmarkResult> {
  // Warm up
  for (let i = 0; i < Math.min(5, operations); i++) {
    await fn();
  }

  clearOptimizationCaches();
  if (global.gc) global.gc();

  const startMemory = process.memoryUsage().heapUsed;
  const times: number[] = [];
  
  const start = performance.now();
  
  for (let i = 0; i < operations; i++) {
    const opStart = performance.now();
    await fn();
    times.push(performance.now() - opStart);
  }
  
  const end = performance.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  const duration = end - start;
  const opsPerSecond = (operations / duration) * 1000;

  return {
    name,
    operations,
    duration,
    opsPerSecond,
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    memoryUsed: endMemory - startMemory,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function printResult(result: BenchmarkResult): void {
  console.log(`\n${result.name}`);
  console.log(`  Operations: ${result.operations.toLocaleString()}`);
  console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
  console.log(`  Ops/sec: ${result.opsPerSecond.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
  console.log(`  Avg time: ${result.avgTime.toFixed(3)}ms`);
  console.log(`  Min/Max: ${result.minTime.toFixed(3)}ms / ${result.maxTime.toFixed(3)}ms`);
  if (result.memoryUsed !== undefined) {
    console.log(`  Memory: ${formatBytes(result.memoryUsed)}`);
  }
}

// ============================================
// Benchmark Suites
// ============================================

async function runParsingBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('CSV PARSING BENCHMARKS');
  console.log('='.repeat(60));

  // Small CSV
  const smallCsv = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,Chicago';
  printResult(benchmark('Parse small CSV (3 rows)', () => {
    parseSync(smallCsv);
  }, 10000));

  // Medium CSV
  const mediumData = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `User${i}`,
    email: `user${i}@test.com`,
    age: 20 + (i % 50),
  }));
  const mediumCsv = json2csv(mediumData);
  
  printResult(benchmark('Parse medium CSV (100 rows)', () => {
    parseSync(mediumCsv);
  }, 1000));

  // Large CSV
  const largeData = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `User${i}`,
    email: `user${i}@test.com`,
    age: 20 + (i % 50),
    city: ['NYC', 'LA', 'Chicago', 'Boston'][i % 4],
    active: i % 2 === 0,
  }));
  const largeCsv = json2csv(largeData);
  
  printResult(benchmark('Parse large CSV (1000 rows)', () => {
    parseSync(largeCsv);
  }, 100));
}

async function runStringifyBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('CSV STRINGIFY BENCHMARKS');
  console.log('='.repeat(60));

  const smallData = [
    { name: 'Alice', age: 30, city: 'NYC' },
    { name: 'Bob', age: 25, city: 'LA' },
  ];

  printResult(benchmark('Stringify small data (2 rows)', () => {
    stringifySync(smallData);
  }, 10000));

  const mediumData = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `User${i}`,
    email: `user${i}@test.com`,
  }));

  printResult(benchmark('Stringify medium data (100 rows)', () => {
    stringifySync(mediumData);
  }, 1000));

  const largeData = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `User${i}`,
    email: `user${i}@test.com`,
    age: 20 + (i % 50),
  }));

  printResult(benchmark('Stringify large data (1000 rows)', () => {
    stringifySync(largeData);
  }, 100));
}

async function runNestedJsonBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('NESTED JSON TO CSV BENCHMARKS');
  console.log('='.repeat(60));

  const simpleNested = [{
    user: { name: 'Alice', profile: { age: 30 } },
  }];

  printResult(benchmark('Simple nested (1 row, depth 2)', () => {
    nestedJson2Csv(simpleNested);
  }, 5000));

  const deeplyNested = [{
    level1: {
      level2: {
        level3: {
          level4: {
            level5: 'deep value',
          },
        },
      },
    },
  }];

  printResult(benchmark('Deeply nested (1 row, depth 5)', () => {
    nestedJson2Csv(deeplyNested);
  }, 5000));

  const manyNested = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    user: {
      name: `User${i}`,
      profile: {
        age: 20 + (i % 50),
        address: {
          city: 'NYC',
          zip: '10001',
        },
      },
    },
    metadata: {
      created: new Date(),
      tags: ['tag1', 'tag2'],
    },
  }));

  printResult(benchmark('Many nested (100 rows, depth 3)', () => {
    nestedJson2Csv(manyNested);
  }, 100));

  const withArrays = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    items: [
      { product: 'A', price: 10 },
      { product: 'B', price: 20 },
      { product: 'C', price: 30 },
    ],
  }));

  printResult(benchmark('With arrays (50 rows, expand columns)', () => {
    nestedJson2Csv(withArrays, { arrayStrategy: 'expand-columns' });
  }, 100));
}

async function runGeneratorBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('CSV GENERATOR BENCHMARKS');
  console.log('='.repeat(60));

  printResult(benchmark('Generate 100 rows (5 columns)', () => {
    generateCSV({ length: 100, seed: 42 });
  }, 100));

  printResult(benchmark('Generate 1000 rows (5 columns)', () => {
    generateCSV({ length: 1000, seed: 42 });
  }, 10));

  printResult(benchmark('Generate objects (100 rows)', () => {
    generateObjects({ length: 100, seed: 42 });
  }, 100));
}

async function runConversionBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('JSON-CSV CONVERSION BENCHMARKS');
  console.log('='.repeat(60));

  const data = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `User${i}`,
    email: `user${i}@test.com`,
    active: i % 2 === 0,
  }));

  printResult(benchmark('JSON to CSV (100 rows)', () => {
    json2csv(data);
  }, 1000));

  const csv = json2csv(data);

  printResult(benchmark('CSV to JSON (100 rows)', () => {
    csv2json(csv);
  }, 1000));

  printResult(benchmark('Roundtrip JSON->CSV->JSON (100 rows)', () => {
    const csvOut = json2csv(data);
    csv2json(csvOut);
  }, 500));
}

async function runOptimizationBenchmarks(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('OPTIMIZATION BENCHMARKS');
  console.log('='.repeat(60));

  // String building comparison
  const iterations = 1000;
  
  printResult(benchmark('StringBuilder (1000 appends)', () => {
    const sb = new StringBuilder();
    for (let i = 0; i < iterations; i++) {
      sb.append('test,');
    }
    sb.toString();
  }, 100));

  printResult(benchmark('Array join (1000 appends)', () => {
    const arr: string[] = [];
    for (let i = 0; i < iterations; i++) {
      arr.push('test,');
    }
    arr.join('');
  }, 100));

  printResult(benchmark('String concat (1000 appends)', () => {
    let str = '';
    for (let i = 0; i < iterations; i++) {
      str += 'test,';
    }
  }, 100));

  // CSV escaping
  const testValue = 'hello, "world"';
  
  printResult(benchmark('Optimized CSV escaping', () => {
    escapeCSVFieldOptimized(testValue);
  }, 10000));
}

// ============================================
// Main Execution
// ============================================

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('TURBO-CSV-STREAM PERFORMANCE BENCHMARKS');
  console.log('='.repeat(60));
  console.log(`Node.js ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`Memory: ${formatBytes(process.memoryUsage().heapTotal)}`);

  await runParsingBenchmarks();
  await runStringifyBenchmarks();
  await runNestedJsonBenchmarks();
  await runGeneratorBenchmarks();
  await runConversionBenchmarks();
  await runOptimizationBenchmarks();

  console.log('\n' + '='.repeat(60));
  console.log('BENCHMARKS COMPLETE');
  console.log('='.repeat(60));
  
  const memUsage = process.memoryUsage();
  console.log('\nFinal Memory Usage:');
  console.log(`  Heap Used: ${formatBytes(memUsage.heapUsed)}`);
  console.log(`  Heap Total: ${formatBytes(memUsage.heapTotal)}`);
  console.log(`  External: ${formatBytes(memUsage.external)}`);
}

// Run benchmarks
if (require.main === module) {
  main().catch(console.error);
}

export { benchmark, benchmarkAsync, BenchmarkResult };
