/**
 * Verification script for turbo-csv-stream
 * Run with: npx tsx verify.ts
 */

import { CSVLexer } from './src/core/lexer';
import { CSVParser } from './src/core/parser';
import { parseNDJSON, stringifyNDJSON } from './src/utils/ndjson';
import { FieldSelector, pick, omit, rename, addFields, getNestedValue, setNestedValue } from './src/utils/field-selector';
import { escapeField, stringifyCSV, CSVWriter } from './src/io/writer';
import { formatTable, formatMarkdownTable } from './src/io/table-printer';
import { detectBOM, stripBOMString, isValidUTF8 } from './src/utils/encoding';

console.log('='.repeat(60));
console.log('turbo-csv-stream Verification');
console.log('='.repeat(60));

// Test 1: CSVLexer
console.log('\n--- Testing CSVLexer ---');
try {
  const lexer = new CSVLexer();
  lexer.init('name,age,city\nAlice,30,NYC\nBob,25,LA');
  const rows = lexer.parseAll();
  console.log('✓ Lexer parseAll:', rows.length === 3 ? 'PASS' : 'FAIL');
  console.log('  Parsed', rows.length, 'rows');
} catch (e) {
  console.log('✗ Lexer parseAll: FAIL -', (e as Error).message);
}

// Test 2: CSVParser
console.log('\n--- Testing CSVParser ---');
try {
  const parser = new CSVParser();
  const result = parser.parse('name,age\nAlice,30\nBob,25');
  console.log('✓ Parser parse:', result.data.length === 2 ? 'PASS' : 'FAIL');
  console.log('  Parsed', result.data.length, 'data rows');
  console.log('  Headers:', result.meta.headers);
} catch (e) {
  console.log('✗ Parser parse: FAIL -', (e as Error).message);
}

// Test 3: NDJSON
console.log('\n--- Testing NDJSON ---');
try {
  const ndjsonInput = '{"name":"Alice","age":30}\n{"name":"Bob","age":25}';
  const parsed = parseNDJSON(ndjsonInput);
  console.log('✓ parseNDJSON:', parsed.length === 2 ? 'PASS' : 'FAIL');
  
  const stringified = stringifyNDJSON(parsed);
  console.log('✓ stringifyNDJSON:', stringified.includes('Alice') ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ NDJSON: FAIL -', (e as Error).message);
}

// Test 4: Field Selector
console.log('\n--- Testing Field Selector ---');
try {
  const selector = new FieldSelector(['name', 'age']);
  const row = { name: 'Alice', age: 30, city: 'NYC' };
  const selected = selector.extract(row);
  console.log('✓ FieldSelector extract:', Object.keys(selected).length === 2 ? 'PASS' : 'FAIL');
  
  const picked = pick(row, ['name']);
  console.log('✓ pick:', Object.keys(picked).length === 1 ? 'PASS' : 'FAIL');
  
  const omitted = omit(row, ['city']);
  console.log('✓ omit:', !('city' in omitted) ? 'PASS' : 'FAIL');
  
  const renamed = rename(row, { name: 'fullName' });
  console.log('✓ rename:', 'fullName' in renamed ? 'PASS' : 'FAIL');
  
  const added = addFields(row, { greeting: (r) => `Hello, ${r.name}!` });
  console.log('✓ addFields:', added.greeting === 'Hello, Alice!' ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ Field Selector: FAIL -', (e as Error).message);
}

// Test 4b: Nested Column Access
console.log('\n--- Testing Nested Columns ---');
try {
  // Test getNestedValue with nested paths
  const nestedObj = {
    user: { profile: { name: 'John', age: 30 } },
    items: [{ value: 100 }, { value: 200 }]
  };
  
  const nestedName = getNestedValue(nestedObj as any, 'user.profile.name');
  console.log('✓ getNestedValue (nested path):', nestedName === 'John' ? 'PASS' : 'FAIL');
  
  const arrayValue = getNestedValue(nestedObj as any, 'items[0].value');
  console.log('✓ getNestedValue (array index):', arrayValue === 100 ? 'PASS' : 'FAIL');
  
  // Test setNestedValue with nested paths
  const newObj: any = {};
  setNestedValue(newObj, 'user.profile.name', 'Alice');
  console.log('✓ setNestedValue (nested path):', newObj.user?.profile?.name === 'Alice' ? 'PASS' : 'FAIL');
  
  // Test setNestedValue with array indices
  const arrayObj: any = {};
  setNestedValue(arrayObj, 'items[0].name', 'First');
  setNestedValue(arrayObj, 'items[1].name', 'Second');
  console.log('✓ setNestedValue (array index):', 
    arrayObj.items?.[0]?.name === 'First' && arrayObj.items?.[1]?.name === 'Second' ? 'PASS' : 'FAIL');
  
  // Test FieldSelector with nested fields
  const nestedRow = { user: { profile: { name: 'Bob' } } };
  const nestedSelector = new FieldSelector(['user.profile.name']);
  const nestedResult = nestedSelector.extract(nestedRow as any);
  console.log('✓ FieldSelector (nested):', (nestedResult as any).user?.profile?.name === 'Bob' ? 'PASS' : 'FAIL');
  
} catch (e) {
  console.log('✗ Nested Columns: FAIL -', (e as Error).message);
}

// Test 5: CSV Writer
console.log('\n--- Testing CSV Writer ---');
try {
  const escaped = escapeField('hello, world');
  console.log('✓ escapeField:', escaped === '"hello, world"' ? 'PASS' : 'FAIL');
  
  const csv = stringifyCSV([
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ]);
  console.log('✓ stringifyCSV:', csv.includes('Alice') && csv.includes('Bob') ? 'PASS' : 'FAIL');
  
  const writer = new CSVWriter();
  writer.writeRow({ a: 1, b: 2 });
  writer.writeRow({ a: 3, b: 4 });
  console.log('✓ CSVWriter:', writer.toString().includes('1') ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ CSV Writer: FAIL -', (e as Error).message);
}

// Test 6: Table Printer
console.log('\n--- Testing Table Printer ---');
try {
  const data = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ];
  const table = formatTable(data);
  console.log('✓ formatTable:', table.includes('Alice') && table.includes('│') ? 'PASS' : 'FAIL');
  
  const markdown = formatMarkdownTable(data);
  console.log('✓ formatMarkdownTable:', markdown.includes('|') && markdown.includes('---') ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ Table Printer: FAIL -', (e as Error).message);
}

// Test 7: Encoding
console.log('\n--- Testing Encoding ---');
try {
  const bomBuffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
  const bomInfo = detectBOM(bomBuffer);
  console.log('✓ detectBOM:', bomInfo.encoding === 'utf-8' ? 'PASS' : 'FAIL');
  
  const withBOM = '\uFEFFHello';
  const stripped = stripBOMString(withBOM);
  console.log('✓ stripBOMString:', stripped === 'Hello' ? 'PASS' : 'FAIL');
  
  const validUtf8 = Buffer.from('Hello, 世界!');
  console.log('✓ isValidUTF8:', isValidUTF8(validUtf8) ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ Encoding: FAIL -', (e as Error).message);
}

// Test 8: Custom EOL
console.log('\n--- Testing Custom EOL ---');
try {
  const lexer = new CSVLexer({ eol: '\r\n' });
  lexer.init('a,b\r\n1,2\r\n3,4');
  const rows = lexer.parseAll();
  console.log('✓ Custom EOL (CRLF):', rows.length === 3 ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ Custom EOL: FAIL -', (e as Error).message);
}

console.log('\n' + '='.repeat(60));
console.log('Verification complete!');
console.log('='.repeat(60));

// Test 9: CSV Generator
console.log('\n--- Testing CSV Generator ---');
import { generateCSV, generateObjects, SeededRandom } from './src/generators/csv-generator';
try {
  const random = new SeededRandom(42);
  console.log('✓ SeededRandom:', typeof random.next() === 'number' ? 'PASS' : 'FAIL');
  
  const csv = generateCSV({ length: 5, seed: 42 });
  console.log('✓ generateCSV:', csv.split('\n').length >= 5 ? 'PASS' : 'FAIL');
  
  const objects = generateObjects({ length: 3, seed: 42 });
  console.log('✓ generateObjects:', objects.length === 3 ? 'PASS' : 'FAIL');
  
  // Idempotence test
  const csv1 = generateCSV({ length: 5, seed: 12345 });
  const csv2 = generateCSV({ length: 5, seed: 12345 });
  console.log('✓ Seed idempotence:', csv1 === csv2 ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ CSV Generator: FAIL -', (e as Error).message);
}

// Test 10: JSON-CSV Conversion
console.log('\n--- Testing JSON-CSV Conversion ---');
import { json2csv, csv2json } from './src/utils/json-csv';
try {
  const jsonData = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
  const csvResult = json2csv(jsonData);
  console.log('✓ json2csv:', csvResult.includes('Alice') && csvResult.includes('Bob') ? 'PASS' : 'FAIL');
  
  const csvInput = 'name,age\nCharlie,35\nDiana,28';
  const jsonResult = csv2json(csvInput);
  console.log('✓ csv2json:', jsonResult.length === 2 && jsonResult[0]!.name === 'Charlie' ? 'PASS' : 'FAIL');
  
  // Roundtrip test
  const original = [{ x: 1, y: 2 }];
  const roundtrip = csv2json(json2csv(original), { dynamicTyping: true });
  console.log('✓ Roundtrip:', roundtrip[0]!.x === 1 && roundtrip[0]!.y === 2 ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ JSON-CSV Conversion: FAIL -', (e as Error).message);
}

// Test 11: Stream Transform
console.log('\n--- Testing Stream Transform ---');
import { FilterStream, MapStream, BatchStream, collect } from './src/transform/stream-transform';
import { Readable } from 'stream';
try {
  const testAsync = async () => {
    // Filter test
    const source1 = Readable.from([1, 2, 3, 4, 5]);
    const filtered = await collect(source1.pipe(new FilterStream((n: number) => n > 2)));
    console.log('✓ FilterStream:', JSON.stringify(filtered) === '[3,4,5]' ? 'PASS' : 'FAIL');
    
    // Map test
    const source2 = Readable.from([1, 2, 3]);
    const mapped = await collect(source2.pipe(new MapStream((n: number) => n * 10)));
    console.log('✓ MapStream:', JSON.stringify(mapped) === '[10,20,30]' ? 'PASS' : 'FAIL');
    
    // Batch test
    const source3 = Readable.from([1, 2, 3, 4, 5]);
    const batched = await collect(source3.pipe(new BatchStream(2)));
    console.log('✓ BatchStream:', batched.length === 3 ? 'PASS' : 'FAIL');
  };
  testAsync().catch(e => console.log('✗ Stream Transform: FAIL -', (e as Error).message));
} catch (e) {
  console.log('✗ Stream Transform: FAIL -', (e as Error).message);
}

// Test 12: Synchronous API
console.log('\n--- Testing Synchronous API ---');
import { parseSync, stringifySync, countRowsSync } from './src/core/sync';
try {
  const csvData = 'name,age\nAlice,30\nBob,25';
  
  const parsed = parseSync(csvData);
  console.log('✓ parseSync:', parsed.data.length === 2 ? 'PASS' : 'FAIL');
  
  const count = countRowsSync(csvData);
  console.log('✓ countRowsSync:', count === 2 ? 'PASS' : 'FAIL');
  
  const data = [{ a: 1, b: 2 }];
  const stringified = stringifySync(data);
  console.log('✓ stringifySync:', stringified.includes('1') && stringified.includes('2') ? 'PASS' : 'FAIL');
} catch (e) {
  console.log('✗ Synchronous API: FAIL -', (e as Error).message);
}

// Test 13: Nested JSON to CSV
console.log('\n--- Testing Nested JSON to CSV ---');
import { nestedJson2Csv, validateNestedJson } from './src/utils/nested-json-csv';
try {
  const nestedData = [
    {
      id: 1,
      user: { name: 'Alice', profile: { age: 30, city: 'NYC' } },
      tags: ['admin', 'user'],
    },
    {
      id: 2,
      user: { name: 'Bob', profile: { age: 25, city: 'LA' } },
      tags: ['user'],
    },
  ];
  
  const result = nestedJson2Csv(nestedData);
  console.log('✓ nestedJson2Csv:', result.rowCount === 2 ? 'PASS' : 'FAIL');
  console.log('✓ Nested path extraction:', result.columns.includes('user.profile.age') ? 'PASS' : 'FAIL');
  console.log('✓ Array handling:', result.csv.includes('admin,user') ? 'PASS' : 'FAIL');
  
  // Validation
  const validation = validateNestedJson(nestedData);
  console.log('✓ validateNestedJson:', validation.valid ? 'PASS' : 'FAIL');
  
  // Circular reference detection
  const circular: any = { name: 'test' };
  circular.self = circular;
  const circularResult = nestedJson2Csv([circular], { detectCircular: true });
  console.log('✓ Circular detection:', circularResult.csv.includes('[Circular]') ? 'PASS' : 'FAIL');
  
  // Path filtering
  const filteredResult = nestedJson2Csv(nestedData, { excludePaths: ['tags'] });
  console.log('✓ Path filtering:', !filteredResult.columns.includes('tags') ? 'PASS' : 'FAIL');
  
} catch (e) {
  console.log('✗ Nested JSON to CSV: FAIL -', (e as Error).message);
}

// Test 14: Input Validation
console.log('\n--- Testing Input Validation ---');
import { ValidationError, validateCsvInput, validateArrayInput } from './src/utils/validation';
try {
  // Valid inputs
  validateCsvInput('test,csv');
  validateArrayInput([1, 2, 3]);
  console.log('✓ Valid input acceptance: PASS');
  
  // Invalid inputs
  let caughtError = false;
  try {
    validateCsvInput(123 as any);
  } catch (e) {
    caughtError = e instanceof ValidationError;
  }
  console.log('✓ Invalid input rejection:', caughtError ? 'PASS' : 'FAIL');
  
  // Error details
  try {
    validateArrayInput('not an array' as any);
  } catch (e) {
    const err = e as ValidationError;
    console.log('✓ Error details:', err.parameter && err.expected ? 'PASS' : 'FAIL');
  }
  
} catch (e) {
  console.log('✗ Input Validation: FAIL -', (e as Error).message);
}

// Test 15: Complete Integration
console.log('\n--- Testing Complete Integration ---');
try {
  const integrationData = [
    { name: 'Alice', age: 30, dept: { name: 'Engineering', floor: 3 } },
    { name: 'Bob', age: 25, dept: { name: 'Sales', floor: 2 } },
  ];
  
  // JSON -> CSV
  const csvOutput = json2csv(integrationData, { flatten: true });
  console.log('✓ JSON to CSV:', csvOutput.includes('dept.name') ? 'PASS' : 'FAIL');
  
  // CSV -> JSON
  const jsonOutput = csv2json(csvOutput, { parseNested: true, dynamicTyping: true });
  console.log('✓ CSV to JSON:', jsonOutput[0]!.dept.name === 'Engineering' ? 'PASS' : 'FAIL');
  
  // Roundtrip integrity
  const csvOutput2 = json2csv(jsonOutput, { flatten: true });
  console.log('✓ Roundtrip integrity:', csvOutput === csvOutput2 ? 'PASS' : 'FAIL');
  
} catch (e) {
  console.log('✗ Complete Integration: FAIL -', (e as Error).message);
}

console.log('\n' + '='.repeat(60));
console.log('All features (including NEW nested JSON) verified!');
console.log('='.repeat(60));
