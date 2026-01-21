# turbo-csv-stream - Complete Feature Documentation

Ultra-fast, reliable, and feature-rich CSV processing library for Node.js with comprehensive error handling and validation.

## 🚀 Complete Feature List

### Core CSV Operations
- ✅ Fast CSV parsing with streaming support
- ✅ CSV generation with seed-based randomization
- ✅ CSV writing/stringification
- ✅ Synchronous and asynchronous APIs
- ✅ Worker thread support for parallel processing
- ✅ Schema validation (custom + Zod)
- ✅ SQL-like queries on CSV data
- ✅ MongoDB-style aggregation pipelines

### Advanced Features
- ✅ **Nested JSON to CSV** - Convert deeply nested JSON to flat CSV
- ✅ **Bidirectional JSON-CSV** - Full roundtrip support
- ✅ **Stream Transforms** - Filter, map, batch, reduce operations
- ✅ **Field Selectors** - Dot notation, array access, aliasing
- ✅ **CLI Tools** - Command-line utilities for quick conversions
- ✅ **Input Validation** - Comprehensive error handling
- ✅ **NDJSON Support** - Newline-delimited JSON
- ✅ **Encoding Detection** - BOM handling, UTF-8/16/32
- ✅ **Table Formatting** - Pretty print for console output

## 📦 Installation

```bash
npm install turbo-csv-stream
```

## 🔥 Quick Start

```typescript
import {
  parseSync,
  stringifySync,
  json2csv,
  csv2json,
  nestedJson2Csv,
  generateCSV,
} from 'turbo-csv-stream';

// Parse CSV
const data = parseSync('name,age\nAlice,30\nBob,25');
console.log(data.data); // [{ name: 'Alice', age: '30' }, ...]

// Stringify to CSV
const csv = stringifySync([{ name: 'Alice', age: 30 }]);

// JSON to CSV
const csvFromJson = json2csv([{ name: 'Alice', age: 30 }]);

// Nested JSON to CSV (NEW!)
const nestedData = [{
  user: { name: 'Alice', profile: { age: 30 } },
  tags: ['admin', 'user']
}];
const result = nestedJson2Csv(nestedData);
console.log(result.csv);
// Output: user.name,user.profile.age,tags
//         Alice,30,"admin,user"

// Generate random CSV
const randomCsv = generateCSV({ length: 100, seed: 42 });
```

## 🌟 NEW: Nested JSON to CSV

Convert complex nested JSON structures to CSV with advanced options:

```typescript
import { nestedJson2Csv } from 'turbo-csv-stream';

const complexData = [{
  id: 1,
  user: {
    name: 'Alice',
    contact: {
      email: 'alice@example.com',
      phone: { mobile: '555-1234' }
    }
  },
  orders: [
    { product: 'Widget', price: 29.99 },
    { product: 'Gadget', price: 49.99 }
  ],
  metadata: {
    created: new Date('2024-01-15'),
    tags: ['premium', 'verified']
  }
}];

// Flatten with default options
const result = nestedJson2Csv(complexData);
/*
Columns: id, user.name, user.contact.email, user.contact.phone.mobile,
         orders, metadata.created, metadata.tags
*/

// Expand arrays into separate columns
const expanded = nestedJson2Csv(complexData, {
  arrayStrategy: 'expand-columns'
});
/*
Columns: ..., orders[0].product, orders[0].price,
         orders[1].product, orders[1].price
*/

// Filter sensitive data
const filtered = nestedJson2Csv(complexData, {
  excludePaths: ['user.contact.phone', '*.password']
});

// Custom path separator
const custom = nestedJson2Csv(complexData, {
  pathSeparator: '_',
  arrayIndexNotation: 'underscore'
});
// Columns: user_contact_email, orders_0_product, ...
```

### Nested JSON Options

| Option | Type | Description |
|--------|------|-------------|
| `nestedStrategy` | `'flatten' \| 'expand' \| 'preserve' \| 'ignore'` | How to handle nested objects |
| `arrayStrategy` | `'join' \| 'expand-columns' \| 'expand-rows' \| 'first' \| 'last'` | How to handle arrays |
| `maxDepth` | `number` | Maximum nesting depth (default: Infinity) |
| `pathSeparator` | `string` | Separator for nested paths (default: '.') |
| `arrayIndexNotation` | `'brackets' \| 'underscore' \| 'none'` | Array index format |
| `excludePaths` | `string[]` | Path patterns to exclude (supports wildcards) |
| `includePaths` | `string[]` | Path patterns to include |
| `detectCircular` | `boolean` | Detect circular references (default: true) |
| `sortColumns` | `boolean` | Sort columns alphabetically |
| `onError` | `'throw' \| 'skip' \| 'placeholder'` | Error handling mode |

## 🔄 Stream Processing

```typescript
import {
  TransformPipeline,
  FilterStream,
  MapStream,
  BatchStream,
} from 'turbo-csv-stream';
import { Readable } from 'stream';

// Create a processing pipeline
const pipeline = new TransformPipeline()
  .filter((row) => Number(row.age) >= 18)
  .map((row) => ({ ...row, category: 'adult' }))
  .batch(100)
  .take(1000);

const source = Readable.from(data);
const results = await pipeline.collect(source);
```

## 🎲 CSV Generation

Generate realistic test data with seeded randomization:

```typescript
import { generateCSV, generateObjects } from 'turbo-csv-stream';

// Generate CSV string
const csv = generateCSV({
  length: 1000,
  seed: 12345, // Reproducible results
  columns: [
    { name: 'id', type: 'integer', min: 1, max: 1000000 },
    { name: 'email', type: 'email' },
    { name: 'name', type: 'name' },
    { name: 'created', type: 'datetime' },
    { name: 'active', type: 'boolean' },
    { name: 'score', type: 'float', min: 0, max: 100 },
  ]
});

// Generate as objects
const objects = generateObjects({
  length: 100,
  seed: 42
});
```

### Supported Generator Types

- `string`, `integer`, `float`, `boolean`
- `date`, `datetime`, `uuid`
- `email`, `name`, `phone`, `url`, `ip`
- `word`, `sentence`, `paragraph`
- `custom` - with custom generator function

## 🛡️ Input Validation & Error Handling

All public functions now include comprehensive input validation:

```typescript
import {
  ValidationError,
  validateCsvInput,
  validateArrayInput,
  safeExecute,
} from 'turbo-csv-stream';

// Automatic validation
try {
  parseSync(123); // Throws ValidationError
} catch (e) {
  if (e instanceof ValidationError) {
    console.log(e.parameter); // 'csv'
    console.log(e.expected);  // 'string'
    console.log(e.value);     // 123
  }
}

// Safe execution wrapper
const result = safeExecute(
  () => parseSync(data),
  'CSV parsing',
  (error) => ({ data: [], meta: {}, errors: [error] })
);
```

## 🖥️ CLI Tools

```bash
# Convert CSV to JSON
turbo-csv csv2json data.csv -o output.json --pretty

# Convert JSON to CSV
turbo-csv json2csv data.json -o output.csv --flatten

# Generate random CSV
turbo-csv generate --rows 1000 --columns 10 -o data.csv

# Parse and display
turbo-csv parse data.csv --limit 100 --table

# Validate CSV
turbo-csv validate data.csv
```

## 📝 All Available Modules

### Core
- `parseSync`, `parseFileSync` - Synchronous parsing
- `stringifySync`, `writeFileSync` - Synchronous writing
- `CSVParser`, `CSVLexer` - Core parsers
- `CSVParseStream` - Streaming parser

### JSON-CSV Conversion
- `json2csv`, `csv2json` - Basic conversion
- `nestedJson2Csv` - Advanced nested conversion
- `Json2CsvStream`, `Csv2JsonStream` - Streaming converters
- `flattenObject`, `unflattenObject` - Object utilities

### Generation
- `generateCSV`, `generateObjects` - Data generation
- `CSVGeneratorStream` - Streaming generator
- `SeededRandom` - Reproducible randomness

### Transformation
- `TransformPipeline` - Chainable transforms
- `FilterStream`, `MapStream`, `BatchStream` - Stream operators
- `TakeStream`, `SkipStream`, `UniqueStream` - Utilities

### Field Selection
- `FieldSelector` - Advanced field extraction
- `getNestedValue`, `setNestedValue` - Nested access
- `pick`, `omit`, `rename`, `addFields` - Object utilities

### Validation
- `ValidationError` - Typed validation errors
- `validateCsvInput`, `validateArrayInput` - Input validators
- `safeExecute`, `safeExecuteAsync` - Safe wrappers

### Utilities
- `NDJSON` - Newline-delimited JSON support
- `Encoding` - BOM detection and handling
- `TablePrinter` - Console table formatting
- `Schema` - Validation and inference

## 🔍 Error Handling Features

1. **Input Validation** - All functions validate inputs
2. **Type Safety** - TypeScript types throughout
3. **Detailed Errors** - ValidationError with parameter info
4. **Circular Detection** - Prevents infinite loops
5. **Error Recovery** - Skip/placeholder modes
6. **Safe Wrappers** - `safeExecute` for error handling

## 📊 Performance

- Zero-copy parsing where possible
- Streaming for large files
- Worker thread support
- Memory-efficient algorithms
- Lookup tables for fast character classification

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:coverage       # With coverage
npx tsx verify.ts          # Quick verification
```

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! All new features include:
- Comprehensive tests
- Input validation
- Error handling
- TypeScript types
- Documentation
