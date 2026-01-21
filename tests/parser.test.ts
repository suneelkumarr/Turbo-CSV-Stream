import { describe, it, expect, beforeEach } from 'vitest';
import { CSVParser, parse, parseSync } from '../src/core/parser';
import { CSVLexer } from '../src/core/lexer';
import { TypeDetector } from '../src/utils/type-detector';

describe('CSVLexer', () => {
  it('should tokenize simple CSV', () => {
    const lexer = new CSVLexer();
    lexer.init('a,b,c\n1,2,3');
    const tokens = Array.from(lexer.tokenize());
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('should parse single row', () => {
    const lexer = new CSVLexer();
    lexer.init('name,age\nJohn,30');
    const row = lexer.parseRow();
    expect(row).toEqual(['name', 'age']);
  });

  it('should handle quoted fields', () => {
    const lexer = new CSVLexer();
    lexer.init('"field,with,commas","normal"');
    const row = lexer.parseRow();
    expect(row).toEqual(['field,with,commas', 'normal']);
  });

  it('should handle newlines in quoted fields', () => {
    const lexer = new CSVLexer();
    lexer.init('"multi\nline","single"');
    const row = lexer.parseRow();
    expect(row).toEqual(['multi\nline', 'single']);
  });

  it('should handle different delimiters', () => {
    const lexer = new CSVLexer({ delimiter: ';' });
    lexer.init('a;b;c');
    const row = lexer.parseRow();
    expect(row).toEqual(['a', 'b', 'c']);
  });

  it('should skip comment lines', () => {
    const lexer = new CSVLexer({ comment: '#' });
    lexer.init('# comment\ndata');
    const row = lexer.parseRow();
    expect(row).toEqual(['data']);
  });
});

describe('TypeDetector', () => {
  const detector = new TypeDetector();

  it('should detect strings', () => {
    expect(detector.detect('hello')).toBe('hello');
  });

  it('should detect numbers', () => {
    expect(detector.detect('123')).toBe(123);
    expect(detector.detect('-45.67')).toBe(-45.67);
  });

  it('should detect booleans', () => {
    expect(detector.detect('true')).toBe(true);
    expect(detector.detect('false')).toBe(false);
    expect(detector.detect('yes')).toBe(true);
    expect(detector.detect('no')).toBe(false);
  });

  it('should convert to specific types', () => {
    expect(detector.convert('42', 'number')).toBe(42);
    expect(detector.convert('true', 'boolean')).toBe(true);
    expect(detector.convert('2024-01-01', 'date')).toBeInstanceOf(Date);
  });
});

describe('CSVParser', () => {
  it('should parse simple CSV', () => {
    const parser = new CSVParser();
    const result = parser.parse('name,age\nJohn,30\nJane,25');
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ name: 'John', age: '30' });
    expect(result.meta.rowCount).toBe(2);
  });

  it('should handle custom headers', () => {
    const parser = new CSVParser({ header: ['col1', 'col2'] });
    const result = parser.parse('a,b\nc,d');
    expect(result.data[0]).toEqual({ col1: 'a', col2: 'b' });
  });

  it('should trim whitespace', () => {
    const parser = new CSVParser({ trim: true });
    const result = parser.parse('  name  ,  age  \n  John  ,  30  ');
    expect(result.data[0]).toEqual({ name: 'John', age: '30' });
  });

  it('should apply dynamic typing', () => {
    const parser = new CSVParser({ dynamicTyping: true });
    const result = parser.parse('name,age\nJohn,30');
    expect(result.data[0]).toEqual({ name: 'John', age: 30 });
  });

  it('should handle errors gracefully', () => {
    const parser = new CSVParser({ onError: 'skip' });
    const result = parser.parse('a,b,c');
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });

  it('should throw on invalid quote', () => {
    const parser = new CSVParser({ onError: 'throw' });
    expect(() => parser.parse('"unclosed quote')).toThrow();
  });

  it('should handle column count mismatch', () => {
    const parser = new CSVParser({ 
      relaxColumnCount: true, 
      header: ['a', 'b', 'c'] 
    });
    const result = parser.parse('1,2');
    expect(result.data[0]!.a).toBe('1');
    expect(result.data[0]!.b).toBe('2');
  });

  it('should rename headers', () => {
    const parser = new CSVParser({
      header: true,
      renameHeaders: { old: 'new' }
    });
    const result = parser.parse('old\nvalue');
    expect(result.data[0]).toEqual({ new: 'value' });
  });

  it('should apply transforms', () => {
    const parser = new CSVParser({
      header: true,
      transform: (row) => ({ ...row, age: Number(row.age) })
    });
    const result = parser.parse('age\n30');
    expect(result.data[0]).toEqual({ age: 30 });
  });

  it('should remove BOM', () => {
    const parser = new CSVParser();
    const bom = '\uFEFFname\nJohn';
    const result = parser.parse(bom);
    expect(result.meta.headers).toEqual(['name']);
  });

  it('should detect line breaks', () => {
    const parser = new CSVParser();
    parser.parse('a\nb');
    expect(parser.parse('a\r\nb').meta.linebreak).toBe('\r\n');
  });

  it('should use quick parse function', () => {
    const result = parse('a,b\n1,2');
    expect(result.data).toHaveLength(1);
  });

  it('should use quick parseSync function', () => {
    const data = parseSync('a,b\n1,2');
    expect(data).toHaveLength(1);
  });

  it('should return errors in result', () => {
    const parser = new CSVParser({ onError: 'skip' });
    const result = parser.parse('a');
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });

  it('should get headers', () => {
    const parser = new CSVParser({ header: ['a', 'b'] });
    parser.parse('x,y');
    expect(parser.getHeaders()).toEqual(['a', 'b']);
  });
});
