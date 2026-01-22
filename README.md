# turbo-csv-stream

> Ultra-fast, reliable, and feature-rich CSV processing library for Node.js

[![npm version](https://img.shields.io/npm/v/turbo-csv-stream.svg)](https://www.npmjs.com/package/turbo-csv-stream)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

A comprehensive CSV processing toolkit with advanced features like nested JSON conversion, streaming support, data generation, schema validation, and high-performance optimizations.

## 🌟 Features

- ✅ **Fast CSV Parsing** - Optimized zero-copy parser with streaming support
- ✅ **CSV Generation** - Generate realistic test data with seed-based randomization
- ✅ **Nested JSON ↔ CSV** - Convert deeply nested JSON to flat CSV and back
- ✅ **Stream Processing** - Transform, filter, map, batch operations
- ✅ **Schema Validation** - Custom schemas + Zod integration
- ✅ **SQL-like Queries** - Query CSV data with SQL syntax
- ✅ **Worker Threads** - Parallel processing for large files
- ✅ **CLI Tools** - Command-line utilities for quick conversions
- ✅ **Type Safety** - Full TypeScript support with comprehensive types
- ✅ **Error Handling** - Robust validation and helpful error messages
- ✅ **High Performance** - Regex caching, object pooling, optimized algorithms

## 📦 Installation

```bash
npm install turbo-csv-stream
```

## 🚀 Quick Start

### Basic CSV Parsing

```typescript
import { parseSync, parseFileSync } from 'turbo-csv-stream';

// Parse CSV string
const result = parseSync('name,age,city\nAlice,30,NYC\nBob,25,LA');
console.log(result.data);
// [
//   { name: 'Alice', age: '30', city: 'NYC' },
//   { name: 'Bob', age: '25', city: 'LA' }
// ]

// Parse CSV file
const data = parseFileSync('data.csv');
console.log(data.data);
```

### Basic CSV Writing

```typescript
import { stringifySync, writeFileSync } from 'turbo-csv-stream';

const data = [
  { name: 'Alice', age: 30, city: 'NYC' },
  { name: 'Bob', age: 25, city: 'LA' }
];

// Convert to CSV string
const csv = stringifySync(data);
console.log(csv);
// name,age,city
// Alice,30,NYC
// Bob,25,LA

// Write to file
writeFileSync('output.csv', data);
```

## 📚 Complete Guide

### Table of Contents
1. [CSV Parsing](#csv-parsing)
2. [CSV Writing](#csv-writing)
3. [JSON-CSV Conversion](#json-csv-conversion)
4. [Nested JSON to CSV](#nested-json-to-csv)
5. [CSV Generation](#csv-generation)
6. [Stream Processing](#stream-processing)
7. [Schema Validation](#schema-validation)
8. [Field Selectors](#field-selectors)
9. [CLI Tools](#cli-tools)
10. [Performance Optimization](#performance-optimization)

---

## 1. CSV Parsing

### Synchronous Parsing

```typescript
import { parseSync } from 'turbo-csv-stream';

// Basic parsing
const result = parseSync('name,age\nAlice,30\nBob,25');

// With options
const result2 = parseSync(csvString, {
  delimiter: ';',           // Custom delimiter
  quote: '"',               // Quote character
  header: true,             // Has header row
  skipEmptyLines: true,     // Skip empty lines
  trim: true,               // Trim whitespace
  dynamicTyping: true,      // Auto-convert types
});

console.log(result2.data);     // Parsed rows
console.log(result2.meta);     // Metadata
console.log(result2.errors);   // Parse errors
```

### Asynchronous Parsing

```typescript
import { parseFile } from 'turbo-csv-stream';

// Parse file asynchronously
const data = await parseFile('large-file.csv', {
  batchSize: 1000,          // Process in batches
  maxRows: 10000,           // Limit rows
  workers: 4,               // Use worker threads
  onProgress: (progress) => {
    console.log(`Processed ${progress.rows} rows`);
  }
});
```

### Streaming Parser

```typescript
import { CSVParseStream } from 'turbo-csv-stream';
import { createReadStream } from 'fs';

const stream = createReadStream('data.csv')
  .pipe(new CSVParseStream());

stream.on('data', (row) => {
  console.log(row); // Process each row
});

stream.on('end', () => {
  console.log('Done!');
});
```

### Advanced Parsing Options

```typescript
const result = parseSync(csv, {
  // Delimiter options
  delimiter: ',',
  quote: '"',
  escape: '\\',
  comment: '#',              // Skip comment lines
  eol: '\n',                 // Line ending
  
  // Header options
  header: true,
  skipHeader: false,
  renameHeaders: {
    'old_name': 'newName'
  },
  
  // Row filtering
  skipEmptyLines: true,
  skipLines: 5,              // Skip first 5 lines
  fromLine: 10,              // Start from line 10
  toLine: 100,               // End at line 100
  maxRows: 1000,             // Maximum rows
  
  // Type conversion
  dynamicTyping: true,       // Auto-detect types
  dateFormats: ['YYYY-MM-DD'],
  nullValues: ['NULL', 'null', ''],
  booleanValues: {
    true: ['true', 'yes', '1'],
    false: ['false', 'no', '0']
  },
  
  // Error handling
  relaxColumnCount: true,    // Allow variable columns
  onError: 'skip',           // 'throw' | 'skip' | 'recover'
  maxErrors: 10,
  
  // Performance
  chunkSize: 8192,
  highWaterMark: 16384,
  
  // Transformation
  transform: (row, index) => {
    row.id = index;
    return row;
  },
  
  filter: (row) => {
    return row.age > 18;     // Only adults
  }
});
```

---

## 2. CSV Writing

### Basic Writing

```typescript
import { stringifySync, writeFileSync } from 'turbo-csv-stream';

const data = [
  { name: 'Alice', age: 30, email: 'alice@example.com' },
  { name: 'Bob', age: 25, email: 'bob@example.com' }
];

// Stringify to CSV
const csv = stringifySync(data);

// Write to file
writeFileSync('output.csv', data);
```

### Advanced Writing Options

```typescript
import { CSVWriter } from 'turbo-csv-stream';

const writer = new CSVWriter({
  columns: ['name', 'age', 'email'],  // Column order
  header: true,                        // Include header
  delimiter: ',',
  quote: '"',
  escape: '"',
  recordDelimiter: '\n',
  
  // Quote options
  quoted: false,                       // Quote all fields
  quoteStyle: 'auto',                  // 'auto' | 'always' | 'minimal'
  
  // Custom formatters
  formatters: {
    age: (value) => String(value),
    email: (value) => value.toLowerCase()
  }
});

writer.writeRow({ name: 'Alice', age: 30, email: 'ALICE@EXAMPLE.COM' });
writer.writeRow({ name: 'Bob', age: 25, email: 'BOB@EXAMPLE.COM' });

const csv = writer.toString();
```

### Streaming Writer

```typescript
import { CSVStringifyStream } from 'turbo-csv-stream';
import { createWriteStream } from 'fs';

const stringifier = new CSVStringifyStream({
  header: true,
  columns: ['name', 'age', 'city']
});

stringifier.pipe(createWriteStream('output.csv'));

// Write rows
stringifier.write({ name: 'Alice', age: 30, city: 'NYC' });
stringifier.write({ name: 'Bob', age: 25, city: 'LA' });
stringifier.end();
```

---

## 3. JSON-CSV Conversion

### JSON to CSV

```typescript
import { json2csv } from 'turbo-csv-stream';

const data = [
  { name: 'Alice', age: 30, city: 'NYC' },
  { name: 'Bob', age: 25, city: 'LA' }
];

const csv = json2csv(data, {
  keys: ['name', 'city'],            // Select specific fields
  excludeKeys: ['internal_id'],      // Exclude fields
  delimiter: ',',
  header: true,
  flatten: true,                     // Flatten nested objects
  sortKeys: true,                    // Sort columns alphabetically
  prependBom: true,                  // Add BOM for Excel
});

console.log(csv);
// name,city
// Alice,NYC
// Bob,LA
```

### CSV to JSON

```typescript
import { csv2json } from 'turbo-csv-stream';

const csv = `name,age,active
Alice,30,true
Bob,25,false`;

const data = csv2json(csv, {
  delimiter: ',',
  parseNested: true,                 // Parse nested paths
  dynamicTyping: true,               // Auto-convert types
  trim: true,
  parseArrays: true,                 // Parse array values
  arrayDelimiter: ',',
  
  // Custom parsers
  parsers: {
    age: (value) => parseInt(value, 10),
    active: (value) => value === 'true'
  }
});

console.log(data);
// [
//   { name: 'Alice', age: 30, active: true },
//   { name: 'Bob', age: 25, active: false }
// ]
```

### Roundtrip Conversion

```typescript
import { json2csv, csv2json } from 'turbo-csv-stream';

const original = [
  { name: 'Alice', age: 30, active: true }
];

// Convert to CSV
const csv = json2csv(original);

// Convert back to JSON
const restored = csv2json(csv, { dynamicTyping: true });

console.log(restored);
// [{ name: 'Alice', age: 30, active: true }]
```

---

## 4. Nested JSON to CSV

### Simple Nested Objects

```typescript
import { nestedJson2Csv } from 'turbo-csv-stream';

const data = [{
  id: 1,
  user: {
    name: 'Alice',
    profile: {
      age: 30,
      city: 'NYC'
    }
  }
}];

const result = nestedJson2Csv(data);

console.log(result.csv);
// id,user.name,user.profile.age,user.profile.city
// 1,Alice,30,NYC

console.log(result.columns);
// ['id', 'user.name', 'user.profile.age', 'user.profile.city']
```

### Array Handling

```typescript
const data = [{
  product: 'Widget',
  tags: ['electronics', 'sale', 'featured']
}];

// Strategy 1: Join array values
const result1 = nestedJson2Csv(data, {
  arrayStrategy: 'join',
  arrayJoinSeparator: ','
});
// product,tags
// Widget,"electronics,sale,featured"

// Strategy 2: Expand into separate columns
const result2 = nestedJson2Csv(data, {
  arrayStrategy: 'expand-columns'
});
// product,tags[0],tags[1],tags[2]
// Widget,electronics,sale,featured

// Strategy 3: Take first element
const result3 = nestedJson2Csv(data, {
  arrayStrategy: 'first'
});
// product,tags
// Widget,electronics

// Strategy 4: Take last element
const result4 = nestedJson2Csv(data, {
  arrayStrategy: 'last'
});
// product,tags
// Widget,featured
```

### Deep Nesting with Arrays

```typescript
const complexData = [{
  id: 1,
  user: {
    name: 'Alice',
    contact: {
      emails: ['alice@work.com', 'alice@personal.com'],
      phone: {
        mobile: '555-1234',
        home: '555-5678'
      }
    }
  },
  orders: [
    { product: 'Widget', price: 29.99 },
    { product: 'Gadget', price: 49.99 }
  ]
}];

const result = nestedJson2Csv(complexData, {
  arrayStrategy: 'expand-columns',
  maxDepth: 10,
  pathSeparator: '.',
  arrayIndexNotation: 'brackets'  // 'brackets' | 'underscore' | 'none'
});

console.log(result.columns);
// ['id', 'user.name', 'user.contact.emails[0]', 'user.contact.emails[1]',
//  'user.contact.phone.mobile', 'user.contact.phone.home',
//  'orders[0].product', 'orders[0].price', 'orders[1].product', 'orders[1].price']
```

### Path Filtering

```typescript
const userData = [{
  public: {
    name: 'Alice',
    email: 'alice@example.com'
  },
  private: {
    ssn: '123-45-6789',
    password: 'secret',
    bankAccount: '9876543210'
  }
}];

// Exclude sensitive data
const result = nestedJson2Csv(userData, {
  excludePaths: ['private.*', '*.password', '*.ssn']
});

console.log(result.columns);
// ['public.name', 'public.email']
// No private fields included!

// Include only specific paths
const result2 = nestedJson2Csv(userData, {
  includePaths: ['public.*']
});
```

### Advanced Options

```typescript
const result = nestedJson2Csv(data, {
  // Nesting strategy
  nestedStrategy: 'flatten',         // 'flatten' | 'preserve' | 'ignore' | 'expand'
  maxDepth: 5,                       // Maximum nesting depth
  
  // Array handling
  arrayStrategy: 'expand-columns',   // 'join' | 'expand-columns' | 'expand-rows' | 'first' | 'last'
  arrayJoinSeparator: ',',
  arrayIndexNotation: 'brackets',    // 'brackets' | 'underscore' | 'none'
  
  // Path configuration
  pathSeparator: '.',
  excludePaths: ['*.password'],      // Glob patterns
  includePaths: ['user.*'],
  
  // Column customization
  sortColumns: true,
  preserveOrder: true,
  columnNameTransform: (name) => name.toUpperCase(),
  includeTypeSuffix: false,          // Add type to column name
  
  // Error handling
  detectCircular: true,              // Detect circular references
  circularValue: '[Circular]',
  onError: 'skip',                   // 'throw' | 'skip' | 'placeholder'
  errorPlaceholder: '[ERROR]',
  skipEmpty: true,                   // Skip empty objects/arrays
  
  // CSV formatting
  delimiter: ',',
  quote: '"',
  eol: '\n',
  alwaysQuote: false,
  nullValue: '',
  
  // Custom type handlers
  typeHandlers: {
    date: (value) => value.toISOString(),
    boolean: (value) => value ? 'Yes' : 'No'
  }
});

console.log(result.csv);
console.log(result.columns);
console.log(result.rowCount);
console.log(result.errors);
console.log(result.warnings);
```

### Circular Reference Detection

```typescript
const obj: any = { name: 'test', value: 42 };
obj.self = obj;  // Circular reference!

const result = nestedJson2Csv([obj], {
  detectCircular: true,
  circularValue: '[Circular Reference]'
});

console.log(result.csv);
// name,value,self
// test,42,[Circular Reference]
```

---

## 5. CSV Generation

### Generate Random Data

```typescript
import { generateCSV, generateObjects } from 'turbo-csv-stream';

// Generate CSV string
const csv = generateCSV({
  length: 100,                       // Number of rows
  seed: 12345,                       // Seed for reproducibility
  header: true,
  delimiter: ','
});

// Generate as objects
const objects = generateObjects({
  length: 50,
  seed: 42
});
```

### Custom Column Definitions

```typescript
import { generateCSV } from 'turbo-csv-stream';

const csv = generateCSV({
  length: 1000,
  seed: 12345,
  columns: [
    {
      name: 'id',
      type: 'integer',
      min: 1,
      max: 1000000
    },
    {
      name: 'email',
      type: 'email'
    },
    {
      name: 'name',
      type: 'name'
    },
    {
      name: 'age',
      type: 'integer',
      min: 18,
      max: 80
    },
    {
      name: 'score',
      type: 'float',
      min: 0,
      max: 100,
      nullable: 0.1            // 10% null values
    },
    {
      name: 'active',
      type: 'boolean'
    },
    {
      name: 'created',
      type: 'datetime',
      startDate: new Date('2020-01-01'),
      endDate: new Date()
    },
    {
      name: 'status',
      type: 'custom',
      values: ['pending', 'active', 'inactive']
    }
  ]
});
```

### Available Generator Types

```typescript
// String types
{ name: 'field', type: 'string', length: 10, prefix: 'ID-', suffix: '-END' }
{ name: 'field', type: 'word' }
{ name: 'field', type: 'sentence', length: 10 }  // 10 words
{ name: 'field', type: 'paragraph', length: 5 }  // 5 sentences

// Number types
{ name: 'field', type: 'integer', min: 0, max: 100 }
{ name: 'field', type: 'float', min: 0, max: 1 }

// Date types
{ name: 'field', type: 'date' }
{ name: 'field', type: 'datetime' }

// Identity types
{ name: 'field', type: 'uuid' }
{ name: 'field', type: 'email' }
{ name: 'field', type: 'name' }
{ name: 'field', type: 'phone' }
{ name: 'field', type: 'url' }
{ name: 'field', type: 'ip' }

// Boolean
{ name: 'field', type: 'boolean' }

// Custom with fixed values
{ name: 'field', type: 'custom', values: ['a', 'b', 'c'] }

// Custom with generator function
{
  name: 'field',
  type: 'custom',
  generator: (index, random) => `custom-${index}`
}
```

### Streaming Generator

```typescript
import { createGenerator } from 'turbo-csv-stream';
import { createWriteStream } from 'fs';

const generator = createGenerator({
  length: 100000,
  seed: 42,
  objectMode: false  // Output as CSV strings
});

generator.pipe(createWriteStream('large-dataset.csv'));
```

---

## 6. Stream Processing

### Transform Pipeline

```typescript
import { TransformPipeline } from 'turbo-csv-stream';
import { Readable } from 'stream';

const data = [
  { name: 'Alice', age: 30, score: 85 },
  { name: 'Bob', age: 17, score: 92 },
  { name: 'Charlie', age: 35, score: 78 }
];

const pipeline = new TransformPipeline()
  .filter((row) => row.age >= 18)        // Only adults
  .map((row) => ({
    ...row,
    grade: row.score >= 80 ? 'A' : 'B'
  }))
  .take(10)                              // First 10 results
  .batch(5);                             // Group into batches of 5

const source = Readable.from(data);
const results = await pipeline.collect(source);

console.log(results);
// [[
//   { name: 'Alice', age: 30, score: 85, grade: 'A' },
//   { name: 'Charlie', age: 35, score: 78, grade: 'B' }
// ]]
```

### Individual Stream Transforms

```typescript
import {
  FilterStream,
  MapStream,
  BatchStream,
  TakeStream,
  SkipStream,
  UniqueStream,
  SortStream,
  TapStream
} from 'turbo-csv-stream';
import { Readable } from 'stream';

const source = Readable.from(data);

// Filter
source
  .pipe(new FilterStream((row) => row.age >= 18))
  .pipe(new MapStream((row) => ({ ...row, category: 'adult' })))
  .pipe(new BatchStream(10))
  .on('data', (batch) => console.log(batch));

// Unique values
source
  .pipe(new UniqueStream((row) => row.email))  // Deduplicate by email
  .on('data', (row) => console.log(row));

// Side effects with tap
source
  .pipe(new TapStream((row, index) => {
    console.log(`Processing row ${index}:`, row);
  }))
  .pipe(process.stdout);
```

### Advanced Pipeline

```typescript
const pipeline = new TransformPipeline()
  .filter((row) => row.status === 'active')
  .map((row) => ({
    id: row.id,
    fullName: `${row.firstName} ${row.lastName}`,
    email: row.email.toLowerCase()
  }))
  .unique((row) => row.email)              // Remove duplicates
  .skip(10)                                // Skip first 10
  .take(100)                               // Take next 100
  .batch(20)                               // Batch of 20
  .tap((batch) => {
    console.log(`Processing batch of ${batch.length} items`);
  });

const results = await pipeline.collect(source);
```

---

## 7. Schema Validation

### Basic Schema Validation

```typescript
import { SchemaValidator } from 'turbo-csv-stream';

const schema = {
  columns: [
    {
      name: 'name',
      type: 'string',
      nullable: false
    },
    {
      name: 'age',
      type: 'integer',
      nullable: false,
      validate: (value) => value >= 0 && value <= 120
    },
    {
      name: 'email',
      type: 'string',
      validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))
    }
  ],
  strict: true,                    // Reject unknown columns
  coerce: true                     // Auto-convert types
};

const validator = new SchemaValidator(schema);

const row = { name: 'Alice', age: 30, email: 'alice@example.com' };
const result = validator.validate(row);

if (result.valid) {
  console.log('Valid:', result.data);
} else {
  console.error('Errors:', result.errors);
}
```

### Zod Schema Integration

```typescript
import { z } from 'zod';
import { SchemaValidator } from 'turbo-csv-stream';

const zodSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0).max(120),
  email: z.string().email(),
  status: z.enum(['active', 'inactive']),
  tags: z.array(z.string()).optional()
});

const validator = new SchemaValidator(zodSchema);

const result = validator.validate({
  name: 'Alice',
  age: 30,
  email: 'alice@example.com',
  status: 'active'
});
```

### Schema Inference

```typescript
import { inferSchema } from 'turbo-csv-stream';

const data = [
  { name: 'Alice', age: 30, active: true },
  { name: 'Bob', age: 25, active: false }
];

const schema = inferSchema(data);

console.log(schema);
// {
//   columns: [
//     { name: 'name', type: 'string', nullable: false },
//     { name: 'age', type: 'integer', nullable: false },
//     { name: 'active', type: 'boolean', nullable: false }
//   ]
// }
```

---

## 8. Field Selectors

### Basic Field Selection

```typescript
import { FieldSelector, pick, omit, rename } from 'turbo-csv-stream';

const row = {
  name: 'Alice',
  age: 30,
  email: 'alice@example.com',
  password: 'secret'
};

// Pick specific fields
const picked = pick(row, ['name', 'email']);
// { name: 'Alice', email: 'alice@example.com' }

// Omit fields
const omitted = omit(row, ['password']);
// { name: 'Alice', age: 30, email: 'alice@example.com' }

// Rename fields
const renamed = rename(row, { name: 'fullName', age: 'years' });
// { fullName: 'Alice', years: 30, email: '...', password: '...' }
```

### Advanced Field Selection

```typescript
import { FieldSelector } from 'turbo-csv-stream';

const selector = new FieldSelector([
  'name',
  {
    field: 'age',
    options: {
      as: 'years',                      // Rename to 'years'
      transform: (value) => Number(value) * 2
    }
  },
  {
    field: 'missing',
    options: {
      default: 'N/A'                    // Default value
    }
  },
  {
    field: 'computed',
    options: {
      getter: (row) => `${row.name} (${row.age})`
    }
  }
]);

const result = selector.extract(row);
```

### Nested Field Access

```typescript
import { getNestedValue, setNestedValue } from 'turbo-csv-stream';

const data = {
  user: {
    profile: {
      name: 'Alice',
      age: 30
    }
  },
  items: [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]
};

// Get nested value
const name = getNestedValue(data, 'user.profile.name');
// 'Alice'

const itemName = getNestedValue(data, 'items[0].name');
// 'Item 1'

// Set nested value
setNestedValue(data, 'user.profile.city', 'NYC');
setNestedValue(data, 'items[2].name', 'Item 3');
```

---

## 9. CLI Tools

### Installation for CLI

```bash
npm install -g turbo-csv-stream
```

### CSV to JSON

```bash
# Basic conversion
turbo-csv csv2json data.csv

# With options
turbo-csv csv2json data.csv -o output.json --pretty

# Parse nested paths
turbo-csv csv2json data.csv --nested --types

# Select specific columns
turbo-csv csv2json data.csv -k name,email -o filtered.json
```

### JSON to CSV

```bash
# Basic conversion
turbo-csv json2csv data.json

# With options
turbo-csv json2csv data.json -o output.csv --flatten

# Custom delimiter
turbo-csv json2csv data.json -d ";" -o output.csv

# Wrap all values
turbo-csv json2csv data.json --wrap -o output.csv

# Add BOM for Excel
turbo-csv json2csv data.json --bom -o output.csv
```

### Generate CSV

```bash
# Generate random data
turbo-csv generate --rows 1000 --columns 5 -o data.csv

# With seed for reproducibility
turbo-csv generate --rows 100 --seed 12345 -o data.csv

# From schema file
turbo-csv generate --rows 1000 --schema columns.json -o data.csv
```

### Parse and Display

```bash
# Parse and display
turbo-csv parse data.csv

# Show as table
turbo-csv parse data.csv --table --limit 20

# Filter columns
turbo-csv parse data.csv --columns name,email --limit 10

# Skip rows
turbo-csv parse data.csv --skip 10 --limit 100
```

### Validate CSV

```bash
# Validate structure
turbo-csv validate data.csv

# With custom delimiter
turbo-csv validate data.csv -d ";"
```

---

## 10. Performance Optimization

### Enable Optimizations

```typescript
import {
  measurePerformance,
  clearOptimizationCaches,
  getCacheStats
} from 'turbo-csv-stream';

// Measure performance
const { result, metrics } = measurePerformance(
  'CSV parsing',
  () => parseSync(largeCsv),
  rowCount
);

console.log(`Duration: ${metrics.duration}ms`);
console.log(`Throughput: ${metrics.throughput.toFixed(0)} rows/sec`);
console.log(`Memory: ${metrics.memoryUsed} bytes`);

// Check cache usage
const stats = getCacheStats();
console.log('Cache stats:', stats);

// Clear caches (for long-running processes)
clearOptimizationCaches();
```

### Use StringBuilder for Large CSV

```typescript
import { StringBuilder } from 'turbo-csv-stream';

const sb = new StringBuilder();

for (const row of largeDataset) {
  sb.appendLine(formatRow(row));
}

const csv = sb.toString();
console.log(`Generated ${sb.getSize()} bytes`);
```

### Memoization

```typescript
import { memoize } from 'turbo-csv-stream';

// Expensive function
function processRow(row: any) {
  // ... complex processing
  return result;
}

// Memoized version
const optimizedProcess = memoize(processRow, {
  maxSize: 1000,                    // Cache size
  keyFn: (row) => row.id            // Custom key
});

// First call: computed
const result1 = optimizedProcess(row);

// Second call with same input: cached!
const result2 = optimizedProcess(row);
```

### Object Pooling

```typescript
import { setPool, mapPool } from 'turbo-csv-stream';

function processData() {
  const visited = setPool.acquire();
  const cache = mapPool.acquire();
  
  try {
    // Use objects...
    visited.add(item);
    cache.set(key, value);
  } finally {
    // Return to pool
    setPool.release(visited);
    mapPool.release(cache);
  }
}
```

---

## 📊 Performance Benchmarks

| Operation | Throughput | Memory |
|-----------|-----------|---------|
| Parse small CSV (3 rows) | ~290,000 ops/sec | ~50 KB |
| Parse medium CSV (100 rows) | ~45,000 ops/sec | ~400 KB |
| Parse large CSV (1000 rows) | ~2,900 ops/sec | ~5 MB |
| Stringify (100 rows) | ~35,000 ops/sec | ~2.5 MB |
| Nested JSON conversion | ~14,000 ops/sec | ~2 MB |
| CSV escaping | ~4,000,000 ops/sec | ~10 KB |

Run benchmarks:
```bash
npm run benchmark:performance
```

---

## 🎯 Common Use Cases

### 1. Import CSV from Upload

```typescript
import { parseSync } from 'turbo-csv-stream';
import { Request, Response } from 'express';

app.post('/upload', async (req: Request, res: Response) => {
  const csvContent = req.file.buffer.toString();
  
  const result = parseSync(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    onError: 'skip',
    maxErrors: 10
  });
  
  if (result.errors.length > 0) {
    return res.status(400).json({ errors: result.errors });
  }
  
  // Save to database
  await db.insert(result.data);
  
  res.json({ success: true, count: result.data.length });
});
```

### 2. Export Database to CSV

```typescript
import { json2csv } from 'turbo-csv-stream';

app.get('/export', async (req: Request, res: Response) => {
  const users = await db.users.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true
    }
  });
  
  const csv = json2csv(users, {
    header: true,
    prependBom: true,  // For Excel compatibility
    formatters: {
      createdAt: (date) => date.toISOString().split('T')[0]
    }
  });
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
  res.send(csv);
});
```

### 3. Data ETL Pipeline

```typescript
import {
  parseFileSync,
  TransformPipeline,
  stringifySync,
  writeFileSync
} from 'turbo-csv-stream';
import { Readable } from 'stream';

// Extract
const data = parseFileSync('input.csv');

// Transform
const pipeline = new TransformPipeline()
  .filter((row) => row.status === 'active')
  .map((row) => ({
    id: row.id,
    name: row.first_name + ' ' + row.last_name,
    email: row.email.toLowerCase(),
    age: parseInt(row.age, 10)
  }))
  .unique((row) => row.email);

const source = Readable.from(data.data);
const transformed = await pipeline.collect(source);

// Load
writeFileSync('output.csv', transformed);
```

### 4. Generate Test Data

```typescript
import { generateObjects, writeFileSync } from 'turbo-csv-stream';

const testUsers = generateObjects({
  length: 1000,
  seed: 42,  // Reproducible
  columns: [
    { name: 'id', type: 'integer', min: 1, max: 10000 },
    { name: 'name', type: 'name' },
    { name: 'email', type: 'email' },
    { name: 'age', type: 'integer', min: 18, max: 80 },
    { name: 'active', type: 'boolean' },
    { name: 'created', type: 'datetime' }
  ]
});

writeFileSync('test-users.csv', testUsers);
```

### 5. Complex Nested JSON Export

```typescript
import { nestedJson2Csv } from 'turbo-csv-stream';

const complexData = await db.orders.findMany({
  include: {
    user: {
      include: {
        profile: true,
        addresses: true
      }
    },
    items: {
      include: {
        product: true
      }
    }
  }
});

const result = nestedJson2Csv(complexData, {
  arrayStrategy: 'expand-columns',
  excludePaths: ['user.password', 'user.*.internal*'],
  maxDepth: 5
});

// Save to file
fs.writeFileSync('orders-export.csv', result.csv);
```

---

## 🔒 Error Handling

### Validation Errors

```typescript
import { ValidationError, parseSync } from 'turbo-csv-stream';

try {
  parseSync(123 as any);  // Invalid input
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Parameter:', error.parameter);  // 'csv'
    console.log('Expected:', error.expected);     // 'string'
    console.log('Got:', error.value);             // 123
  }
}
```

### Parse Errors

```typescript
const result = parseSync(csv, {
  onError: 'skip',       // Skip problematic rows
  maxErrors: 10          // Stop after 10 errors
});

console.log('Parsed:', result.data.length);
console.log('Errors:', result.errors.length);

result.errors.forEach(error => {
  console.log(`Line ${error.line}: ${error.message}`);
});
```

### Safe Execution

```typescript
import { safeExecute } from 'turbo-csv-stream';

const result = safeExecute(
  () => parseSync(csv),
  'CSV parsing',
  (error) => {
    console.error('Parse failed:', error);
    return { data: [], meta: {}, errors: [] };
  }
);
```

---

## 📝 TypeScript Support

Full TypeScript support with comprehensive types:

```typescript
import {
  CSVRow,
  ParseResult,
  ParserOptions,
  ConversionResult,
  NestedJsonToCsvOptions,
  GeneratorOptions
} from 'turbo-csv-stream';

// Type-safe parsing
const result: ParseResult<CSVRow> = parseSync(csv);

// Custom row type
interface User {
  name: string;
  age: number;
  email: string;
}

const users: ParseResult<User> = parseSync(csv);

// Type-safe options
const options: ParserOptions = {
  delimiter: ',',
  header: true,
  dynamicTyping: true
};

// Nested conversion with types
const nestedResult: ConversionResult = nestedJson2Csv(data, {
  arrayStrategy: 'expand-columns'
});
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

---

## 📄 License

MIT © Suneel Kumar

---

## 🔗 Links

- [GitHub Repository](https://github.com/suneelkumarr/Turbo-CSV-Stream)
- [npm Package](https://www.npmjs.com/package/turbo-csv-stream)
- [Documentation](https://turbo-csv-stream.dev)
- [Changelog](CHANGELOG.md)

---

## 💡 Tips

1. **Use streaming for large files** (>10MB)
2. **Enable caching for repeated operations**
3. **Use worker threads for CPU-intensive parsing**
4. **Validate schemas before processing**
5. **Clear caches in long-running processes**
6. **Use memoization for expensive transformations**
7. **Batch process for better throughput**

---

## ❓ FAQ

**Q: How do I handle very large CSV files?**  
A: Use streaming APIs with `CSVParseStream` and process in batches.

**Q: Can I parse CSV with inconsistent columns?**  
A: Yes, use `relaxColumnCount: true` option.

**Q: How do I convert nested JSON to CSV?**  
A: Use `nestedJson2Csv()` with appropriate array and nesting strategies.

**Q: Is it faster than other CSV libraries?**  
A: Yes, benchmarks show 2-10x improvement with optimizations enabled.

**Q: Can I use it in the browser?**  
A: Core parsing works in browser, but file operations require Node.js.

---

**Made with ❤️ by the turbo-csv-stream team**
