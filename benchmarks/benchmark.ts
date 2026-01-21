import { performance } from 'perf_hooks';
import { CSVLexer } from '../src/core/lexer';
import { CSVParser } from '../src/core/parser';
import { parseNDJSON, stringifyNDJSON } from '../src/utils/ndjson';

/**
 * Performance Benchmarks for turbo-csv-stream
 */

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  opsPerSecond: number;
  rowsPerSecond?: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function benchmark(
  name: string,
  fn: () => void,
  iterations: number = 1000
): BenchmarkResult {
  // Warmup
  for (let i = 0; i < Math.min(100, iterations / 10); i++) {
    fn();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const totalTime = performance.now() - start;

  return {
    name,
    iterations,
    totalTime,
    avgTime: totalTime / iterations,
    opsPerSecond: (iterations / totalTime) * 1000,
  };
}

function printResult(result: BenchmarkResult): void {
  console.log(`\n${result.name}`);
  console.log(`  Iterations: ${formatNumber(result.iterations)}`);
  console.log(`  Total time: ${formatNumber(result.totalTime)}ms`);
  console.log(`  Avg time: ${formatNumber(result.avgTime)}ms`);
  console.log(`  Ops/sec: ${formatNumber(result.opsPerSecond)}`);
  if (result.rowsPerSecond) {
    console.log(`  Rows/sec: ${formatNumber(result.rowsPerSecond)}`);
  }
}

// Generate test data
function generateCSV(rows: number, cols: number): string {
  const headers = Array.from({ length: cols }, (_, i) => `col${i + 1}`);
  const lines = [headers.join(',')];
  
  for (let i = 0; i < rows; i++) {
    const row = Array.from({ length: cols }, (_, j) => 
      j % 3 === 0 ? i * cols + j : 
      j % 3 === 1 ? `"string value ${i}-${j}"` :
      `value-${i}-${j}`
    );
    lines.push(row.join(','));
  }
  
  return lines.join('\n');
}

function generateNDJSON(count: number): string {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(JSON.stringify({
      id: i,
      name: `Item ${i}`,
      value: Math.random() * 1000,
      active: i % 2 === 0,
      tags: ['tag1', 'tag2', 'tag3'],
    }));
  }
  return lines.join('\n');
}

// Run benchmarks
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('turbo-csv-stream Performance Benchmarks');
  console.log('='.repeat(60));

  // CSV Lexer benchmarks
  console.log('\n--- CSV Lexer Benchmarks ---');
  
  const smallCSV = generateCSV(100, 10);
  const mediumCSV = generateCSV(1000, 10);
  const largeCSV = generateCSV(10000, 10);

  printResult(benchmark('Lexer - Small CSV (100 rows x 10 cols)', () => {
    const lexer = new CSVLexer();
    lexer.init(smallCSV);
    lexer.parseAll();
  }, 1000));

  printResult(benchmark('Lexer - Medium CSV (1000 rows x 10 cols)', () => {
    const lexer = new CSVLexer();
    lexer.init(mediumCSV);
    lexer.parseAll();
  }, 100));

  const lexerLargeResult = benchmark('Lexer - Large CSV (10000 rows x 10 cols)', () => {
    const lexer = new CSVLexer();
    lexer.init(largeCSV);
    lexer.parseAll();
  }, 10);
  lexerLargeResult.rowsPerSecond = (10000 * lexerLargeResult.iterations / lexerLargeResult.totalTime) * 1000;
  printResult(lexerLargeResult);

  // CSV Parser benchmarks
  console.log('\n--- CSV Parser Benchmarks ---');

  printResult(benchmark('Parser - Small CSV (100 rows)', () => {
    const parser = new CSVParser();
    parser.parse(smallCSV);
  }, 1000));

  printResult(benchmark('Parser - Medium CSV (1000 rows)', () => {
    const parser = new CSVParser();
    parser.parse(mediumCSV);
  }, 100));

  const parserLargeResult = benchmark('Parser - Large CSV (10000 rows)', () => {
    const parser = new CSVParser();
    parser.parse(largeCSV);
  }, 10);
  parserLargeResult.rowsPerSecond = (10000 * parserLargeResult.iterations / parserLargeResult.totalTime) * 1000;
  printResult(parserLargeResult);

  // NDJSON benchmarks
  console.log('\n--- NDJSON Benchmarks ---');

  const smallNDJSON = generateNDJSON(100);
  const mediumNDJSON = generateNDJSON(1000);
  const largeNDJSON = generateNDJSON(10000);

  printResult(benchmark('NDJSON Parse - Small (100 lines)', () => {
    parseNDJSON(smallNDJSON);
  }, 1000));

  printResult(benchmark('NDJSON Parse - Medium (1000 lines)', () => {
    parseNDJSON(mediumNDJSON);
  }, 100));

  printResult(benchmark('NDJSON Parse - Large (10000 lines)', () => {
    parseNDJSON(largeNDJSON);
  }, 10));

  const sampleData = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: i * 1.5,
  }));

  printResult(benchmark('NDJSON Stringify - 1000 objects', () => {
    stringifyNDJSON(sampleData);
  }, 100));

  // Memory usage
  console.log('\n--- Memory Usage ---');
  const memBefore = process.memoryUsage();
  const hugeCSV = generateCSV(100000, 20);
  const lexer = new CSVLexer();
  lexer.init(hugeCSV);
  const rows = lexer.parseAll();
  const memAfter = process.memoryUsage();

  console.log(`\nParsed ${formatNumber(rows.length)} rows x 20 columns`);
  console.log(`  CSV size: ${formatNumber(hugeCSV.length / 1024)} KB`);
  console.log(`  Heap used before: ${formatNumber(memBefore.heapUsed / 1024 / 1024)} MB`);
  console.log(`  Heap used after: ${formatNumber(memAfter.heapUsed / 1024 / 1024)} MB`);
  console.log(`  Delta: ${formatNumber((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)} MB`);

  console.log('\n' + '='.repeat(60));
  console.log('Benchmarks complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
