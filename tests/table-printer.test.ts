import { describe, it, expect } from 'vitest';
import {
  formatTable,
  formatMarkdownTable,
  TablePrinter,
} from '../src/io/table-printer';

describe('Table Printer', () => {
  const sampleData = [
    { name: 'Alice', age: 30, city: 'New York' },
    { name: 'Bob', age: 25, city: 'Los Angeles' },
    { name: 'Charlie', age: 35, city: 'Chicago' },
  ];

  describe('formatTable', () => {
    it('should format data as ASCII table', () => {
      const result = formatTable(sampleData);
      
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
      expect(result).toContain('Charlie');
      expect(result).toContain('name');
      expect(result).toContain('age');
      expect(result).toContain('city');
    });

    it('should include borders', () => {
      const result = formatTable(sampleData, { unicode: false });
      
      expect(result).toContain('+');
      expect(result).toContain('-');
      expect(result).toContain('|');
    });

    it('should use unicode borders', () => {
      const result = formatTable(sampleData, { unicode: true });
      
      expect(result).toContain('─');
      expect(result).toContain('│');
      expect(result).toContain('┌');
    });

    it('should handle empty data', () => {
      const result = formatTable([]);
      expect(result).toBe('(empty)');
    });

    it('should select specific columns', () => {
      const result = formatTable(sampleData, { columns: ['name', 'city'] });
      
      expect(result).toContain('name');
      expect(result).toContain('city');
      expect(result).not.toContain('age');
    });

    it('should truncate long values', () => {
      const data = [{ name: 'This is a very long name that should be truncated' }];
      const result = formatTable(data, { maxWidth: 20, truncate: true });
      
      expect(result).toContain('...');
    });

    it('should handle null values', () => {
      const data = [{ name: 'Test', value: null }];
      const result = formatTable(data);
      
      expect(result).toContain('null');
    });

    it('should format without borders', () => {
      const result = formatTable(sampleData, { borders: false });
      
      expect(result).not.toContain('─');
      expect(result).not.toContain('┌');
    });

    it('should add row separators when enabled', () => {
      const result = formatTable(sampleData, { 
        rowSeparator: true, 
        unicode: false 
      });
      
      // Count number of horizontal lines
      const lineCount = (result.match(/\+/g) || []).length;
      expect(lineCount).toBeGreaterThan(4); // More than just top/header/bottom
    });
  });

  describe('formatMarkdownTable', () => {
    it('should format data as markdown table', () => {
      const result = formatMarkdownTable(sampleData);
      
      expect(result).toContain('| name | age | city |');
      expect(result).toContain('| Alice | 30 | New York |');
      expect(result).toContain(':---');
    });

    it('should handle alignment', () => {
      const result = formatMarkdownTable(sampleData, {
        align: { age: 'right', name: 'center' },
      });
      
      expect(result).toContain('---:'); // right align for age
      expect(result).toContain(':---:'); // center align for name
    });

    it('should escape pipes in values', () => {
      const data = [{ text: 'a | b' }];
      const result = formatMarkdownTable(data);
      
      expect(result).toContain('a \\| b');
    });

    it('should handle empty data', () => {
      const result = formatMarkdownTable([]);
      expect(result).toBe('');
    });

    it('should select specific columns', () => {
      const result = formatMarkdownTable(sampleData, { columns: ['name'] });
      
      expect(result).toContain('name');
      expect(result).not.toContain('age');
    });
  });

  describe('TablePrinter class', () => {
    it('should format with stored options', () => {
      const printer = new TablePrinter({ unicode: false });
      const result = printer.format(sampleData);
      
      expect(result).toContain('+');
      expect(result).not.toContain('─');
    });

    it('should generate markdown', () => {
      const printer = new TablePrinter();
      const result = printer.markdown(sampleData);
      
      expect(result).toContain('|');
      expect(result).toContain(':---');
    });
  });

  describe('custom formatters', () => {
    it('should apply formatters to values', () => {
      const data = [{ price: 10.5, discount: 0.15 }];
      const result = formatTable(data, {
        formatters: {
          price: (v) => `$${v}`,
          discount: (v) => `${(Number(v) * 100).toFixed(0)}%`,
        },
      });
      
      expect(result).toContain('$10.5');
      expect(result).toContain('15%');
    });
  });
});
