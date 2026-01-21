import type { CSVRow, Primitive } from '../types';

/**
 * Pretty Print Table Format
 * 
 * Features:
 * - ASCII table borders
 * - Auto column width calculation
 * - Text alignment (left, right, center)
 * - Truncation with ellipsis
 * - ANSI color support
 * - Unicode box drawing characters
 */

export interface TablePrintOptions {
  /** Column alignment: 'left' | 'right' | 'center' */
  align?: 'left' | 'right' | 'center' | Record<string, 'left' | 'right' | 'center'>;
  /** Maximum column width */
  maxWidth?: number;
  /** Maximum total table width */
  maxTableWidth?: number;
  /** Use Unicode box drawing characters */
  unicode?: boolean;
  /** Include header row separator */
  headerSeparator?: boolean;
  /** Include row separators */
  rowSeparator?: boolean;
  /** Truncate long values with ellipsis */
  truncate?: boolean;
  /** Custom formatters per column */
  formatters?: Record<string, (value: Primitive) => string>;
  /** Columns to display (and order) */
  columns?: string[];
  /** Whether to include borders */
  borders?: boolean;
  /** Padding between cell content and border */
  padding?: number;
}

interface BorderChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
  leftT: string;
  rightT: string;
  topT: string;
  bottomT: string;
  cross: string;
}

const ASCII_BORDERS: BorderChars = {
  topLeft: '+',
  topRight: '+',
  bottomLeft: '+',
  bottomRight: '+',
  horizontal: '-',
  vertical: '|',
  leftT: '+',
  rightT: '+',
  topT: '+',
  bottomT: '+',
  cross: '+',
};

const UNICODE_BORDERS: BorderChars = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
};

const DEFAULT_OPTIONS: TablePrintOptions = {
  align: 'left',
  maxWidth: 40,
  maxTableWidth: 120,
  unicode: true,
  headerSeparator: true,
  rowSeparator: false,
  truncate: true,
  borders: true,
  padding: 1,
};

/**
 * Format a value for display
 */
function formatValue(value: Primitive, formatter?: (v: Primitive) => string): string {
  if (formatter) {
    return formatter(value);
  }
  
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  
  return String(value);
}

/**
 * Get display width of string (accounting for double-width chars)
 */
function stringWidth(str: string): number {
  // Simple approximation - full implementation would need unicode-width library
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0) || 0;
    // CJK characters and other wide chars
    if ((code >= 0x1100 && code <= 0x115F) ||
        (code >= 0x2E80 && code <= 0x9FFF) ||
        (code >= 0xAC00 && code <= 0xD7AF) ||
        (code >= 0xF900 && code <= 0xFAFF) ||
        (code >= 0xFE10 && code <= 0xFE6F) ||
        (code >= 0xFF00 && code <= 0xFF60) ||
        (code >= 0xFFE0 && code <= 0xFFE6)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Truncate string to max width with ellipsis
 */
function truncateString(str: string, maxWidth: number): string {
  if (stringWidth(str) <= maxWidth) return str;
  
  let width = 0;
  let result = '';
  
  for (const char of str) {
    const charWidth = stringWidth(char);
    if (width + charWidth + 3 > maxWidth) { // 3 for "..."
      return result + '...';
    }
    result += char;
    width += charWidth;
  }
  
  return result;
}

/**
 * Pad string to width with alignment
 */
function padString(str: string, width: number, align: 'left' | 'right' | 'center'): string {
  const strWidth = stringWidth(str);
  const padding = Math.max(0, width - strWidth);
  
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + str;
    case 'center':
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    case 'left':
    default:
      return str + ' '.repeat(padding);
  }
}

/**
 * Calculate column widths
 */
function calculateColumnWidths(
  data: CSVRow[],
  columns: string[],
  options: TablePrintOptions
): Map<string, number> {
  const { maxWidth = 40, formatters = {} } = options;
  const widths = new Map<string, number>();

  // Start with header widths
  for (const col of columns) {
    widths.set(col, stringWidth(col));
  }

  // Check all data
  for (const row of data) {
    for (const col of columns) {
      const formatted = formatValue(row[col], formatters[col]);
      const width = Math.min(stringWidth(formatted), maxWidth);
      const current = widths.get(col) || 0;
      widths.set(col, Math.max(current, width));
    }
  }

  return widths;
}

/**
 * Build horizontal line
 */
function buildHorizontalLine(
  widths: Map<string, number>,
  columns: string[],
  borders: BorderChars,
  leftChar: string,
  midChar: string,
  rightChar: string,
  padding: number
): string {
  const segments = columns.map(col => {
    const width = widths.get(col) || 0;
    return borders.horizontal.repeat(width + padding * 2);
  });
  
  return leftChar + segments.join(midChar) + rightChar;
}

/**
 * Build data row
 */
function buildRow(
  row: CSVRow | Record<string, string>,
  columns: string[],
  widths: Map<string, number>,
  borders: BorderChars,
  options: TablePrintOptions
): string {
  const { align = 'left', padding = 1, truncate = true, formatters = {}, maxWidth = 40 } = options;
  
  const cells = columns.map(col => {
    let value = formatValue((row as CSVRow)[col], formatters[col]);
    const width = widths.get(col) || 0;
    
    if (truncate) {
      value = truncateString(value, Math.min(width, maxWidth));
    }
    
    const colAlign = typeof align === 'object' ? (align[col] || 'left') : align;
    const padded = padString(value, width, colAlign);
    
    return ' '.repeat(padding) + padded + ' '.repeat(padding);
  });
  
  return borders.vertical + cells.join(borders.vertical) + borders.vertical;
}

/**
 * Format data as a pretty printed table
 */
export function formatTable(data: CSVRow[], options: TablePrintOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { unicode = true, headerSeparator = true, rowSeparator = false, borders = true, padding = 1 } = opts;

  if (data.length === 0) {
    return '(empty)';
  }

  // Determine columns
  const columns = opts.columns || Object.keys(data[0]!);
  
  if (columns.length === 0) {
    return '(no columns)';
  }

  const borderChars = unicode ? UNICODE_BORDERS : ASCII_BORDERS;
  const widths = calculateColumnWidths(data, columns, opts);
  
  const lines: string[] = [];

  // Top border
  if (borders) {
    lines.push(buildHorizontalLine(
      widths, columns, borderChars,
      borderChars.topLeft, borderChars.topT, borderChars.topRight, padding
    ));
  }

  // Header row
  const headerRow: Record<string, string> = {};
  for (const col of columns) {
    headerRow[col] = col;
  }
  lines.push(buildRow(headerRow as CSVRow, columns, widths, borderChars, { ...opts, align: 'center' }));

  // Header separator
  if (headerSeparator && borders) {
    lines.push(buildHorizontalLine(
      widths, columns, borderChars,
      borderChars.leftT, borderChars.cross, borderChars.rightT, padding
    ));
  }

  // Data rows
  for (let i = 0; i < data.length; i++) {
    lines.push(buildRow(data[i]!, columns, widths, borderChars, opts));
    
    if (rowSeparator && i < data.length - 1 && borders) {
      lines.push(buildHorizontalLine(
        widths, columns, borderChars,
        borderChars.leftT, borderChars.cross, borderChars.rightT, padding
      ));
    }
  }

  // Bottom border
  if (borders) {
    lines.push(buildHorizontalLine(
      widths, columns, borderChars,
      borderChars.bottomLeft, borderChars.bottomT, borderChars.bottomRight, padding
    ));
  }

  return lines.join('\n');
}

/**
 * Print table to console
 */
export function printTable(data: CSVRow[], options: TablePrintOptions = {}): void {
  console.log(formatTable(data, options));
}

/**
 * Create a simple markdown table
 */
export function formatMarkdownTable(data: CSVRow[], options: TablePrintOptions = {}): string {
  if (data.length === 0) return '';

  const columns = options.columns || Object.keys(data[0]!);
  const { align = 'left', formatters = {} } = options;
  
  const lines: string[] = [];

  // Header
  lines.push('| ' + columns.join(' | ') + ' |');

  // Alignment row
  const alignRow = columns.map(col => {
    const colAlign = typeof align === 'object' ? (align[col] || 'left') : align;
    switch (colAlign) {
      case 'right': return '---:';
      case 'center': return ':---:';
      default: return ':---';
    }
  });
  lines.push('| ' + alignRow.join(' | ') + ' |');

  // Data rows
  for (const row of data) {
    const cells = columns.map(col => {
      const value = formatValue(row[col], formatters[col]);
      // Escape pipes in markdown
      return value.replace(/\|/g, '\\|');
    });
    lines.push('| ' + cells.join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * TablePrinter class for reusable table formatting
 */
export class TablePrinter {
  private options: TablePrintOptions;

  constructor(options: TablePrintOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  format(data: CSVRow[]): string {
    return formatTable(data, this.options);
  }

  print(data: CSVRow[]): void {
    printTable(data, this.options);
  }

  markdown(data: CSVRow[]): string {
    return formatMarkdownTable(data, this.options);
  }
}
