#!/usr/bin/env node
/**
 * turbo-csv CLI Tool
 * 
 * Commands:
 * - csv2json: Convert CSV file to JSON
 * - json2csv: Convert JSON file to CSV
 * - generate: Generate random CSV data
 * - parse: Parse and validate CSV file
 * - query: Run SQL-like queries on CSV
 */

import fs from 'fs';
import { json2csv, csv2json } from '../utils/json-csv';
import { generateCSV, GeneratorOptions, ColumnGenerator } from '../generators/csv-generator';
import { CSVParser } from '../core/parser';
import { formatTable } from '../io/table-printer';

// ============================================
// Types
// ============================================

interface CLIOptions {
  [key: string]: string | boolean | undefined;
}

// ============================================
// Argument Parser
// ============================================

function parseArgs(args: string[]): { command: string; positional: string[]; options: CLIOptions } {
  const result: { command: string; positional: string[]; options: CLIOptions } = {
    command: '',
    positional: [],
    options: {},
  };

  let i = 0;

  // First argument is command
  if (args.length > 0 && !args[0]!.startsWith('-')) {
    result.command = args[0]!;
    i = 1;
  }

  while (i < args.length) {
    const arg = args[i]!;

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const eqIndex = key.indexOf('=');
      
      if (eqIndex !== -1) {
        result.options[key.slice(0, eqIndex)] = key.slice(eqIndex + 1);
      } else if (i + 1 < args.length && !args[i + 1]!.startsWith('-')) {
        result.options[key] = args[i + 1]!;
        i++;
      } else {
        result.options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1]!.startsWith('-')) {
        result.options[key] = args[i + 1]!;
        i++;
      } else {
        result.options[key] = true;
      }
    } else {
      result.positional.push(arg);
    }

    i++;
  }

  return result;
}

// ============================================
// Commands
// ============================================

function printHelp(): void {
  console.log(`
turbo-csv - High-performance CSV processing toolkit

Usage:
  turbo-csv <command> [options] [file]

Commands:
  csv2json    Convert CSV file to JSON
  json2csv    Convert JSON file to CSV
  generate    Generate random CSV data
  parse       Parse and display CSV file
  validate    Validate CSV file structure
  help        Show this help message

Examples:
  turbo-csv csv2json input.csv -o output.json
  turbo-csv json2csv input.json -o output.csv
  turbo-csv generate --rows 100 --columns 5 -o data.csv
  turbo-csv parse data.csv --limit 10

Options:
  -o, --output <file>     Output file (defaults to stdout)
  -d, --delimiter <char>  Field delimiter (default: ,)
  -q, --quote <char>      Quote character (default: ")
  -h, --help              Show help for a command
  --header                Include/parse header row
  --no-header             Exclude/skip header row
  --pretty                Pretty print JSON output
  --table                 Display as formatted table

csv2json Options:
  -k, --keys <keys>       Include only specific keys (comma-separated)
  --nested                Parse nested keys from dot notation
  --arrays                Parse array values from delimited strings
  --types                 Auto-detect value types

json2csv Options:
  -k, --keys <keys>       Include only specific keys (comma-separated)
  --flatten               Flatten nested objects
  --wrap                  Wrap all values in quotes
  --bom                   Prepend BOM for Excel compatibility

generate Options:
  -n, --rows <number>     Number of rows to generate (default: 100)
  -c, --columns <number>  Number of columns (default: 5)
  --seed <number>         Seed for reproducible generation
  --schema <file>         Column schema JSON file

parse Options:
  --limit <number>        Limit output rows
  --skip <number>         Skip first N rows
  --columns <cols>        Select specific columns
`);
}

async function csv2jsonCommand(positional: string[], options: CLIOptions): Promise<void> {
  const inputFile = positional[0];
  
  if (!inputFile) {
    console.error('Error: Input file required');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(inputFile, 'utf-8');

  const jsonOptions: any = {
    delimiter: (options.d || options.delimiter || ',') as string,
    quote: (options.q || options.quote || '"') as string,
    parseNested: options.nested === true,
    parseArrays: options.arrays === true,
    dynamicTyping: options.types === true,
    header: options['no-header'] !== true,
  };

  if (options.k || options.keys) {
    jsonOptions.keys = ((options.k || options.keys) as string).split(',').map(k => k.trim());
  }

  const result = csv2json(csvContent, jsonOptions);

  let output: string;
  if (options.pretty) {
    output = JSON.stringify(result, null, 2);
  } else {
    output = JSON.stringify(result);
  }

  const outputFile = options.o || options.output;
  if (outputFile && typeof outputFile === 'string') {
    fs.writeFileSync(outputFile, output);
    console.log(`Written to ${outputFile}`);
  } else {
    console.log(output);
  }
}

async function json2csvCommand(positional: string[], options: CLIOptions): Promise<void> {
  const inputFile = positional[0];
  
  if (!inputFile) {
    console.error('Error: Input file required');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const jsonContent = fs.readFileSync(inputFile, 'utf-8');
  let data: any[];

  try {
    data = JSON.parse(jsonContent);
    if (!Array.isArray(data)) {
      data = [data];
    }
  } catch (e) {
    console.error('Error: Invalid JSON file');
    process.exit(1);
  }

  const csvOptions: any = {
    delimiter: (options.d || options.delimiter || ',') as string,
    quote: (options.q || options.quote || '"') as string,
    wrapStrings: options.wrap === true || options.W === true,
    flatten: options.flatten !== false,
    header: options['no-header'] !== true,
    prependBom: options.bom === true,
  };

  if (options.k || options.keys) {
    csvOptions.keys = ((options.k || options.keys) as string).split(',').map(k => k.trim());
  }

  const result = json2csv(data, csvOptions);

  const outputFile = options.o || options.output;
  if (outputFile && typeof outputFile === 'string') {
    fs.writeFileSync(outputFile, result);
    console.log(`Written to ${outputFile}`);
  } else {
    console.log(result);
  }
}

async function generateCommand(positional: string[], options: CLIOptions): Promise<void> {
  const genOptions: GeneratorOptions = {
    length: parseInt((options.n || options.rows || '100') as string, 10),
    delimiter: (options.d || options.delimiter || ',') as string,
    header: options['no-header'] !== true,
  };

  if (options.seed) {
    genOptions.seed = parseInt(options.seed as string, 10);
  }

  if (options.c || options.columns) {
    const colCount = parseInt((options.c || options.columns) as string, 10);
    genOptions.columns = colCount;
  }

  if (options.schema && typeof options.schema === 'string') {
    try {
      const schemaContent = fs.readFileSync(options.schema, 'utf-8');
      genOptions.columns = JSON.parse(schemaContent) as ColumnGenerator[];
    } catch (e) {
      console.error('Error: Invalid schema file');
      process.exit(1);
    }
  }

  const result = generateCSV(genOptions);

  const outputFile = options.o || options.output || positional[0];
  if (outputFile && typeof outputFile === 'string') {
    fs.writeFileSync(outputFile, result);
    console.log(`Generated ${genOptions.length} rows to ${outputFile}`);
  } else {
    console.log(result);
  }
}

async function parseCommand(positional: string[], options: CLIOptions): Promise<void> {
  const inputFile = positional[0];
  
  if (!inputFile) {
    console.error('Error: Input file required');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(inputFile, 'utf-8');

  const parser = new CSVParser({
    delimiter: (options.d || options.delimiter || ',') as string,
    header: options['no-header'] !== true,
  });

  const result = parser.parse(csvContent);

  let data = result.data;

  // Apply skip
  if (options.skip) {
    const skip = parseInt(options.skip as string, 10);
    data = data.slice(skip);
  }

  // Apply limit
  if (options.limit) {
    const limit = parseInt(options.limit as string, 10);
    data = data.slice(0, limit);
  }

  // Apply column filter
  if (options.columns && typeof options.columns === 'string') {
    const cols = options.columns.split(',').map(c => c.trim());
    data = data.map(row => {
      const newRow: any = {};
      for (const col of cols) {
        if (col in row) {
          newRow[col] = row[col];
        }
      }
      return newRow;
    });
  }

  // Output
  if (options.table) {
    console.log(formatTable(data));
  } else if (options.pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }

  // Print stats
  console.error(`\nParsed ${result.meta.rowCount} rows, ${result.meta.columnCount} columns`);
  if (result.errors.length > 0) {
    console.error(`Errors: ${result.errors.length}`);
  }
}

async function validateCommand(positional: string[], options: CLIOptions): Promise<void> {
  const inputFile = positional[0];
  
  if (!inputFile) {
    console.error('Error: Input file required');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(inputFile, 'utf-8');

  const parser = new CSVParser({
    delimiter: (options.d || options.delimiter || ',') as string,
    header: options['no-header'] !== true,
  });

  const result = parser.parse(csvContent);

  console.log('Validation Results:');
  console.log('-------------------');
  console.log(`File: ${inputFile}`);
  console.log(`Rows: ${result.meta.rowCount}`);
  console.log(`Columns: ${result.meta.columnCount}`);
  console.log(`Headers: ${result.meta.headers.join(', ')}`);
  console.log(`Delimiter: ${result.meta.delimiter}`);
  console.log(`Line Break: ${result.meta.linebreak === '\r\n' ? 'CRLF' : result.meta.linebreak === '\n' ? 'LF' : 'CR'}`);
  console.log(`Parse Time: ${result.meta.parseTime}ms`);
  
  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    for (const error of result.errors.slice(0, 10)) {
      console.log(`  Line ${error.line}: ${error.message}`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`);
    }
    process.exit(1);
  } else {
    console.log('\n✓ CSV is valid');
  }
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { command, positional, options } = parseArgs(args);

  if (options.h || options.help || command === 'help' || !command) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'csv2json':
        await csv2jsonCommand(positional, options);
        break;
      case 'json2csv':
        await json2csvCommand(positional, options);
        break;
      case 'generate':
        await generateCommand(positional, options);
        break;
      case 'parse':
        await parseCommand(positional, options);
        break;
      case 'validate':
        await validateCommand(positional, options);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
