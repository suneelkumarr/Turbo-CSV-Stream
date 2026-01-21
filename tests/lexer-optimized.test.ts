import { describe, it, expect } from 'vitest';
import { CSVLexer } from '../src/core/lexer';

describe('CSVLexer - Optimized Features', () => {
  describe('Zero-copy parsing', () => {
    it('should parse simple CSV efficiently', () => {
      const lexer = new CSVLexer();
      lexer.init('a,b,c\n1,2,3\n4,5,6');
      
      const rows = lexer.parseAll();
      
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(['a', 'b', 'c']);
      expect(rows[1]).toEqual(['1', '2', '3']);
      expect(rows[2]).toEqual(['4', '5', '6']);
    });

    it('should handle large fields without performance degradation', () => {
      const largeValue = 'x'.repeat(10000);
      const lexer = new CSVLexer();
      lexer.init(`header\n${largeValue}`);
      
      const rows = lexer.parseAll();
      
      expect(rows[1]![0]).toHaveLength(10000);
    });

    it('should use parseRowFast for batch processing', () => {
      const lexer = new CSVLexer();
      lexer.init('a,b\n1,2\n3,4');
      
      const rows: string[][] = [];
      let row: string[] | null;
      while ((row = lexer.parseRowFast()) !== null) {
        rows.push(row);
      }
      
      expect(rows).toHaveLength(3);
    });
  });

  describe('Custom EOL support', () => {
    it('should parse with Unix line endings (\\n)', () => {
      const lexer = new CSVLexer({ eol: '\n' });
      lexer.init('a,b\n1,2\n3,4');
      
      const rows = lexer.parseAll();
      
      expect(rows).toHaveLength(3);
    });

    it('should parse with Windows line endings (\\r\\n)', () => {
      const lexer = new CSVLexer({ eol: '\r\n' });
      lexer.init('a,b\r\n1,2\r\n3,4');
      
      const rows = lexer.parseAll();
      
      expect(rows).toHaveLength(3);
    });

    it('should parse with Mac Classic line endings (\\r)', () => {
      const lexer = new CSVLexer({ eol: '\r' });
      lexer.init('a,b\r1,2\r3,4');
      
      const rows = lexer.parseAll();
      
      expect(rows).toHaveLength(3);
    });

    it('should auto-detect line endings when not specified', () => {
      const lexer = new CSVLexer();
      
      // Unix
      lexer.init('a\n1');
      expect(lexer.parseAll()).toHaveLength(2);
      
      // Windows
      lexer.init('a\r\n1');
      expect(lexer.parseAll()).toHaveLength(2);
      
      // Mac
      lexer.init('a\r1');
      expect(lexer.parseAll()).toHaveLength(2);
    });

    it('should handle custom multi-character EOL', () => {
      const lexer = new CSVLexer({ eol: '|||' });
      lexer.init('a,b|||1,2|||3,4');
      
      const rows = lexer.parseAll();
      
      expect(rows).toHaveLength(3);
    });
  });

  describe('Quoted fields with newlines', () => {
    it('should preserve newlines in quoted fields', () => {
      const lexer = new CSVLexer();
      lexer.init('name,description\n"John","Line 1\nLine 2"');
      
      const rows = lexer.parseAll();
      
      expect(rows[1]![1]).toBe('Line 1\nLine 2');
    });

    it('should handle Windows newlines in quoted fields', () => {
      const lexer = new CSVLexer();
      lexer.init('name,description\r\n"John","Line 1\r\nLine 2"');
      
      const rows = lexer.parseAll();
      
      expect(rows[1]![1]).toBe('Line 1\r\nLine 2');
    });
  });

  describe('Performance optimizations', () => {
    it('should handle empty fields correctly', () => {
      const lexer = new CSVLexer();
      lexer.init('a,,c\n,2,\n,,');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['a', '', 'c']);
      expect(rows[1]).toEqual(['', '2', '']);
      expect(rows[2]).toEqual(['', '', '']);
    });

    it('should handle trailing delimiters', () => {
      const lexer = new CSVLexer();
      lexer.init('a,b,\n1,2,');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['a', 'b', '']);
      expect(rows[1]).toEqual(['1', '2', '']);
    });

    it('should skip comment lines', () => {
      const lexer = new CSVLexer({ comment: '#' });
      lexer.init('a,b\n# comment\n1,2');
      
      const rows = lexer.parseAll();
      
      expect(rows).toHaveLength(2);
      expect(rows[1]).toEqual(['1', '2']);
    });

    it('should handle mixed quote styles with relaxQuotes', () => {
      const lexer = new CSVLexer({ relaxQuotes: true });
      lexer.init('a,b\n"quoted"extra,normal');
      
      const rows = lexer.parseAll();
      
      expect(rows[1]![0]).toBe('quotedextra');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', () => {
      const lexer = new CSVLexer();
      lexer.init('');
      
      const rows = lexer.parseAll();
      
      expect(rows).toHaveLength(0);
    });

    it('should handle single value', () => {
      const lexer = new CSVLexer();
      lexer.init('value');
      
      const rows = lexer.parseAll();
      
      expect(rows).toEqual([['value']]);
    });

    it('should handle only newlines', () => {
      const lexer = new CSVLexer();
      lexer.init('\n\n\n');
      
      const rows = lexer.parseAll();
      
      // Empty lines are skipped by parseRow returning null
      expect(rows).toHaveLength(0);
    });

    it('should preserve state with saveState/restoreState', () => {
      const lexer = new CSVLexer();
      lexer.init('a,b\n1,2\n3,4');
      
      lexer.parseRow(); // Parse first row
      const state = lexer.saveState();
      
      lexer.parseRow(); // Parse second row
      lexer.restoreState(state);
      
      const row = lexer.parseRow();
      expect(row).toEqual(['1', '2']);
    });

    it('should report EOF correctly', () => {
      const lexer = new CSVLexer();
      lexer.init('a');
      
      expect(lexer.isEof()).toBe(false);
      lexer.parseRow();
      expect(lexer.isEof()).toBe(true);
    });
  });

  describe('Trimming options', () => {
    it('should trim fields when trim: true', () => {
      const lexer = new CSVLexer({ trim: true });
      lexer.init('  a  ,  b  \n  1  ,  2  ');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['a', 'b']);
      expect(rows[1]).toEqual(['1', '2']);
    });

    it('should left-trim with ltrim: true', () => {
      const lexer = new CSVLexer({ ltrim: true });
      lexer.init('  a  ,  b  ');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['a  ', 'b  ']);
    });

    it('should right-trim with rtrim: true', () => {
      const lexer = new CSVLexer({ rtrim: true });
      lexer.init('  a  ,  b  ');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['  a', '  b']);
    });
  });

  describe('Custom delimiters', () => {
    it('should support tab delimiter', () => {
      const lexer = new CSVLexer({ delimiter: '\t' });
      lexer.init('a\tb\tc\n1\t2\t3');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['a', 'b', 'c']);
      expect(rows[1]).toEqual(['1', '2', '3']);
    });

    it('should support semicolon delimiter', () => {
      const lexer = new CSVLexer({ delimiter: ';' });
      lexer.init('a;b;c\n1;2;3');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['a', 'b', 'c']);
    });

    it('should support pipe delimiter', () => {
      const lexer = new CSVLexer({ delimiter: '|' });
      lexer.init('a|b|c\n1|2|3');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Escape handling', () => {
    it('should handle escaped quotes', () => {
      const lexer = new CSVLexer();
      lexer.init('"say ""hello"""');
      
      const rows = lexer.parseAll();
      
      expect(rows[0]![0]).toBe('say "hello"');
    });

    it('should support custom escape character', () => {
      const lexer = new CSVLexer({ escape: '\\' });
      lexer.init('"say \\"hello\\""');
      
      const rows = lexer.parseAll();
      
      // With escape: '\\', the \\ before " should escape the quote
      expect(rows[0]![0]).toContain('hello');
    });
  });
});
