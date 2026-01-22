import { ParseError, type ParserOptions } from '../types';

export interface Token {
  type: 'field' | 'delimiter' | 'newline' | 'eof';
  value: string;
  line: number;
  column: number;
  quoted: boolean;
}

export interface LexerState {
  position: number;
  line: number;
  column: number;
  lineStart: number;
}

// Character codes for fast comparison
const CHAR_LF = 10;        // \n
const CHAR_CR = 13;        // \r

/**
 * High-performance lexer for CSV tokenization
 * Uses state machine pattern with zero-copy parsing for maximum efficiency
 * 
 * Features:
 * - Zero-copy field extraction using string.slice()
 * - Custom EOL support (\n, \r\n, \r, or custom)
 * - Character code comparison for speed
 * - Lookup table for fast character classification
 * - Minimal memory allocation
 */
export class CSVLexer {
  private input: string = '';
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private lineStart: number = 0;

  private readonly delimiter: number;
  private readonly quote: number;
  private readonly escape: number;
  private readonly comment: number;
  
  // EOL handling
  private readonly customEol: string | null;
  private readonly customEolCharCode: number;
  private readonly customEolLength: number;
  
  // Pre-computed lookup tables for fast character classification (256 entries for ASCII)
  private readonly charType: Uint8Array;
  
  // Character type constants
  private static readonly CHAR_DELIMITER = 1;
  private static readonly CHAR_NEWLINE = 2;
  private static readonly CHAR_QUOTE = 3;

  constructor(private options: ParserOptions = {}) {
    this.delimiter = (options.delimiter ?? ',').charCodeAt(0);
    this.quote = (options.quote ?? '"').charCodeAt(0);
    this.escape = (options.escape ?? '"').charCodeAt(0);
    this.comment = options.comment?.charCodeAt(0) ?? -1;
    
    // Custom EOL support
    const eolOption = options.eol;
    if (eolOption && typeof eolOption === 'string' && eolOption !== 'auto') {
      this.customEol = eolOption;
      this.customEolCharCode = eolOption.charCodeAt(0);
      this.customEolLength = eolOption.length;
    } else {
      this.customEol = null;
      this.customEolCharCode = CHAR_LF;
      this.customEolLength = 1;
    }
    
    // Build lookup table for character classification
    this.charType = new Uint8Array(256);
    this.charType[this.delimiter] = CSVLexer.CHAR_DELIMITER;
    this.charType[CHAR_LF] = CSVLexer.CHAR_NEWLINE;
    this.charType[CHAR_CR] = CSVLexer.CHAR_NEWLINE;
    this.charType[this.quote] = CSVLexer.CHAR_QUOTE;
    
    // If custom EOL, mark its first char as newline
    if (this.customEol) {
      this.charType[this.customEolCharCode] = CSVLexer.CHAR_NEWLINE;
    }
  }

  /**
   * Initialize lexer with input string
   */
  init(input: string): void {
    this.input = input;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.lineStart = 0;
  }

  /**
   * Get current state for backtracking
   */
  saveState(): LexerState {
    return {
      position: this.position,
      line: this.line,
      column: this.column,
      lineStart: this.lineStart,
    };
  }

  /**
   * Restore lexer state
   */
  restoreState(state: LexerState): void {
    this.position = state.position;
    this.line = state.line;
    this.column = state.column;
    this.lineStart = state.lineStart;
  }

  /**
   * Check if at end of input
   */
  isEof(): boolean {
    return this.position >= this.input.length;
  }

  /**
   * Get next token from input
   */
  nextToken(): Token {
    if (this.position >= this.input.length) {
      return {
        type: 'eof',
        value: '',
        line: this.line,
        column: this.column,
        quoted: false,
      };
    }

    const char = this.input.charCodeAt(this.position);

    // Skip comment lines
    if (char === this.comment && this.column === 1) {
      this.skipComment();
      return this.nextToken();
    }

    // Handle newline
    if (this.isNewlineChar(char)) {
      return this.readNewline();
    }

    // Handle delimiter
    if (char === this.delimiter) {
      const token: Token = {
        type: 'delimiter',
        value: this.input[this.position]!,
        line: this.line,
        column: this.column,
        quoted: false,
      };
      this.advance();
      return token;
    }

    // Handle quoted field
    if (char === this.quote) {
      return this.readQuotedField();
    }

    // Handle unquoted field (zero-copy optimized)
    return this.readUnquotedFieldZeroCopy();
  }

  /**
   * Tokenize entire input into array of tokens
   */
  *tokenize(): Generator<Token> {
    while (true) {
      const token = this.nextToken();
      yield token;
      if (token.type === 'eof') break;
    }
  }

  /**
   * Parse a single row and return field values
   */
  parseRow(): string[] | null {
    const fields: string[] = [];
    let expectField = true;

    while (true) {
      const token = this.nextToken();

      switch (token.type) {
        case 'field':
          fields.push(token.value);
          expectField = false;
          break;

        case 'delimiter':
          if (expectField) {
            fields.push('');
          }
          expectField = true;
          break;

        case 'newline':
          if (expectField && fields.length > 0) {
            fields.push('');
          }
          return fields.length > 0 ? fields : null;

        case 'eof':
          if (expectField && fields.length > 0) {
            fields.push('');
          }
          return fields.length > 0 ? fields : null;
      }
    }
  }

  /**
   * Fast row parsing - returns array of field values
   * Optimized for batch processing
   */
  parseRowFast(): string[] | null {
    const fields: string[] = [];
    let expectField = true;
    const input = this.input;
    const len = input.length;

    while (this.position < len) {
      const char = input.charCodeAt(this.position);
      
      // Handle comment at line start
      if (char === this.comment && this.column === 1) {
        this.skipComment();
        continue;
      }
      
      // Newline - end of row
      if (this.isNewlineChar(char)) {
        if (expectField && fields.length > 0) {
          fields.push('');
        }
        this.consumeNewline();
        return fields.length > 0 ? fields : null;
      }
      
      // Delimiter
      if (char === this.delimiter) {
        if (expectField) {
          fields.push('');
        }
        expectField = true;
        this.advance();
        continue;
      }
      
      // Quoted field
      if (char === this.quote) {
        fields.push(this.readQuotedFieldValue());
        expectField = false;
        continue;
      }
      
      // Unquoted field - zero copy extraction
      const start = this.position;
      while (this.position < len) {
        const c = input.charCodeAt(this.position);
        if (c === this.delimiter || this.isNewlineChar(c)) {
          break;
        }
        this.position++;
        this.column++;
      }
      
      let value = input.slice(start, this.position);
      value = this.trimField(value);
      fields.push(value);
      expectField = false;
    }

    // End of input
    if (expectField && fields.length > 0) {
      fields.push('');
    }
    return fields.length > 0 ? fields : null;
  }

  /**
   * Parse all rows at once - most efficient for complete parsing
   */
  parseAll(): string[][] {
    const rows: string[][] = [];
    let row: string[] | null;
    
    while ((row = this.parseRowFast()) !== null) {
      rows.push(row);
    }
    
    return rows;
  }

  private readQuotedField(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const value = this.readQuotedFieldValue();

    return {
      type: 'field',
      value: this.trimField(value),
      line: startLine,
      column: startColumn,
      quoted: true,
    };
  }

  /**
   * Read quoted field value - handles escapes and embedded newlines
   */
  private readQuotedFieldValue(): string {
    const startLine = this.line;
    const startColumn = this.column;
    const input = this.input;
    const len = input.length;
    
    this.advance(); // Skip opening quote
    
    // Fast path: try to find closing quote without escapes
    const startPos = this.position;
    let hasEscapes = false;
    let pos = this.position;
    
    while (pos < len) {
      const c = input.charCodeAt(pos);
      
      // Check for escape character
      if (this.escape && c === this.escape) {
        hasEscapes = true;
        pos += 2; // Skip escape and next char
        continue;
      }
      
      if (c === this.quote) {
        const nextChar = input.charCodeAt(pos + 1);
        if (nextChar === this.quote) {
          // Escaped quote - need slow path
          hasEscapes = true;
          pos += 2;
          continue;
        }
        // End of quoted field
        break;
      }
      
      if (c === CHAR_CR || c === CHAR_LF) {
        hasEscapes = true; // Has embedded newlines
      }
      pos++;
    }
    
    // Fast path - no escapes, just slice
    if (!hasEscapes) {
      // Check if we found a closing quote
      if (pos >= len && !this.options.relaxQuotes) {
        throw new ParseError(
          'Unclosed quote',
          'UNCLOSED_QUOTE',
          startLine,
          startColumn
        );
      }
      
      const value = input.slice(startPos, pos);
      this.position = pos + 1; // Skip closing quote
      this.column += pos - startPos + 1;
      
      // Handle relaxed quotes
      if (this.options.relaxQuotes) {
        return value + this.readRelaxedQuotesSuffix();
      }
      
      return value;
    }
    
    // Slow path - handle escapes and newlines
    let value = '';
    this.position = startPos;
    
    while (this.position < len) {
      const char = input.charCodeAt(this.position);

      // Check for escape character first
      if (this.escape && char === this.escape) {
        const nextChar = input.charCodeAt(this.position + 1);
        
        // If escape char is followed by quote or another escape, include the next char literally
        if (nextChar === this.quote || nextChar === this.escape) {
          value += input[this.position + 1];
          this.advance();
          this.advance();
          continue;
        }
      }

      if (char === this.quote) {
        const nextChar = input.charCodeAt(this.position + 1);
        
        // Doubled quote (standard CSV escaping)
        if (nextChar === this.quote) {
          value += input[this.position];
          this.advance();
          this.advance();
          continue;
        }
        
        // End of quoted field
        this.advance();
        
        // Handle relaxed quotes
        if (this.options.relaxQuotes) {
          value += this.readRelaxedQuotesSuffix();
        }
        
        return value;
      }

      // Track newlines within quoted fields
      if (this.isNewlineChar(char)) {
        value += this.handleNewlineInField();
        continue;
      }

      value += input[this.position];
      this.advance();
    }

    // Unclosed quote
    if (!this.options.relaxQuotes) {
      throw new ParseError(
        'Unclosed quote',
        'UNCLOSED_QUOTE',
        startLine,
        startColumn
      );
    }

    return value;
  }

  /**
   * Read content after closing quote (for relaxed quotes mode)
   */
  private readRelaxedQuotesSuffix(): string {
    let suffix = '';
    const input = this.input;
    const len = input.length;
    
    while (this.position < len) {
      const c = input.charCodeAt(this.position);
      if (this.isNewlineChar(c) || c === this.delimiter) {
        break;
      }
      suffix += input[this.position];
      this.advance();
    }
    
    return suffix;
  }

  /**
   * Zero-copy unquoted field reading using slice
   */
  private readUnquotedFieldZeroCopy(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const input = this.input;
    const len = input.length;
    const start = this.position;

    // Scan to end of field
    while (this.position < len) {
      const char = input.charCodeAt(this.position);
      if (char === this.delimiter || this.isNewlineChar(char)) {
        break;
      }
      this.position++;
      this.column++;
    }

    // Zero-copy extraction using slice
    let startOffset = start;
    let endOffset = this.position;

    // Optimization: Trim common whitespace (space/tab) before slicing to avoid extra allocation
    // This handles the most common case (99%) without memory penalty
    if (this.options.trim || this.options.ltrim) {
      while (startOffset < endOffset) {
        const c = input.charCodeAt(startOffset);
        if (c !== 32 && c !== 9) break;
        startOffset++;
      }
    }

    if (this.options.trim || this.options.rtrim) {
      while (endOffset > startOffset) {
        const c = input.charCodeAt(endOffset - 1);
        if (c !== 32 && c !== 9) break;
        endOffset--;
      }
    }

    let value = input.slice(startOffset, endOffset);
    
    // Fallback to full trim if needed (for other whitespace characters),
    // but in most cases (space/tab) this will be a no-op returning the same string instance
    value = this.trimField(value);

    return {
      type: 'field',
      value,
      line: startLine,
      column: startColumn,
      quoted: false,
    };
  }

  private readNewline(): Token {
    const token: Token = {
      type: 'newline',
      value: '',
      line: this.line,
      column: this.column,
      quoted: false,
    };

    token.value = this.consumeNewline();
    return token;
  }

  /**
   * Consume newline characters and return the actual newline string
   */
  private consumeNewline(): string {
    const char = this.input.charCodeAt(this.position);
    let newline: string;
    
    // Check for custom EOL first
    if (this.customEol && char === this.customEolCharCode) {
      // Verify full custom EOL matches
      if (this.customEolLength === 1 || 
          this.input.slice(this.position, this.position + this.customEolLength) === this.customEol) {
        newline = this.customEol;
        this.position += this.customEolLength;
        this.line++;
        this.column = 1;
        this.lineStart = this.position;
        return newline;
      }
    }
    
    // Handle standard \r\n
    if (char === CHAR_CR && this.input.charCodeAt(this.position + 1) === CHAR_LF) {
      newline = '\r\n';
      this.position += 2;
    } else {
      newline = this.input[this.position]!;
      this.position++;
    }

    this.line++;
    this.column = 1;
    this.lineStart = this.position;

    return newline;
  }

  private handleNewlineInField(): string {
    return this.consumeNewline();
  }

  private skipComment(): void {
    const input = this.input;
    const len = input.length;
    
    while (this.position < len) {
      const char = input.charCodeAt(this.position);
      if (this.isNewlineChar(char)) {
        this.consumeNewline();
        break;
      }
      this.advance();
    }
  }

  /**
   * Fast newline character check using lookup table
   */
  private isNewlineChar(char: number): boolean {
    // Custom EOL check
    if (this.customEol && char === this.customEolCharCode) {
      return true;
    }
    // Use lookup table for standard newlines (faster than multiple comparisons)
    // Safety check for non-ASCII characters
    return char < 256 && this.charType[char] === CSVLexer.CHAR_NEWLINE;
  }

  private advance(): void {
    this.position++;
    this.column++;
  }

  private trimField(value: string): string {
    if (this.options.trim) {
      return value.trim();
    }
    if (this.options.ltrim) {
      value = value.trimStart();
    }
    if (this.options.rtrim) {
      value = value.trimEnd();
    }
    return value;
  }
}
