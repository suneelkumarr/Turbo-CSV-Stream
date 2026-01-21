import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  validateCsvInput,
  validateArrayInput,
  validateNonEmptyArray,
  validateParserOptions,
  validateDelimiter,
  validateFilePath,
  validateColumnNames,
  validateFunction,
  validateCsvRow,
  validateSeed,
  validateRange,
  safeExecute,
  safeExecuteAsync,
} from '../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateCsvInput', () => {
    it('should accept valid CSV string', () => {
      expect(() => validateCsvInput('a,b,c')).not.toThrow();
    });

    it('should reject non-string values', () => {
      expect(() => validateCsvInput(123)).toThrow(ValidationError);
      expect(() => validateCsvInput(null)).toThrow(ValidationError);
      expect(() => validateCsvInput(undefined)).toThrow(ValidationError);
      expect(() => validateCsvInput({})).toThrow(ValidationError);
    });

    it('should include parameter name in error', () => {
      try {
        validateCsvInput(123, 'myParam');
      } catch (e) {
        expect((e as ValidationError).parameter).toBe('myParam');
      }
    });
  });

  describe('validateArrayInput', () => {
    it('should accept arrays', () => {
      expect(() => validateArrayInput([])).not.toThrow();
      expect(() => validateArrayInput([1, 2, 3])).not.toThrow();
    });

    it('should reject non-arrays', () => {
      expect(() => validateArrayInput('string')).toThrow(ValidationError);
      expect(() => validateArrayInput(123)).toThrow(ValidationError);
      expect(() => validateArrayInput({})).toThrow(ValidationError);
    });
  });

  describe('validateNonEmptyArray', () => {
    it('should accept non-empty arrays', () => {
      expect(() => validateNonEmptyArray([1])).not.toThrow();
    });

    it('should reject empty arrays', () => {
      expect(() => validateNonEmptyArray([])).toThrow(ValidationError);
    });

    it('should reject non-arrays', () => {
      expect(() => validateNonEmptyArray('string')).toThrow(ValidationError);
    });
  });

  describe('validateDelimiter', () => {
    it('should accept valid delimiters', () => {
      expect(() => validateDelimiter(',')).not.toThrow();
      expect(() => validateDelimiter(';')).not.toThrow();
      expect(() => validateDelimiter('|')).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => validateDelimiter(undefined)).not.toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateDelimiter('')).toThrow(ValidationError);
    });

    it('should reject non-strings', () => {
      expect(() => validateDelimiter(123)).toThrow(ValidationError);
    });
  });

  describe('validateParserOptions', () => {
    it('should accept valid options', () => {
      expect(() => validateParserOptions({})).not.toThrow();
      expect(() => validateParserOptions({ delimiter: ',' })).not.toThrow();
      expect(() => validateParserOptions({ maxRows: 100 })).not.toThrow();
      expect(() => validateParserOptions({ header: true })).not.toThrow();
      expect(() => validateParserOptions({ header: ['a', 'b'] })).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => validateParserOptions(undefined)).not.toThrow();
    });

    it('should reject invalid options', () => {
      expect(() => validateParserOptions('string' as any)).toThrow(ValidationError);
      expect(() => validateParserOptions({ delimiter: 123 } as any)).toThrow(ValidationError);
      expect(() => validateParserOptions({ maxRows: -1 } as any)).toThrow(ValidationError);
      expect(() => validateParserOptions({ maxRows: 1.5 } as any)).toThrow(ValidationError);
    });
  });

  describe('validateFilePath', () => {
    it('should accept valid file paths', () => {
      expect(() => validateFilePath('/path/to/file.csv')).not.toThrow();
      expect(() => validateFilePath('relative/path.csv')).not.toThrow();
      expect(() => validateFilePath('C:\\Windows\\file.csv')).not.toThrow();
    });

    it('should reject empty strings', () => {
      expect(() => validateFilePath('')).toThrow(ValidationError);
      expect(() => validateFilePath('   ')).toThrow(ValidationError);
    });

    it('should reject non-strings', () => {
      expect(() => validateFilePath(123 as any)).toThrow(ValidationError);
    });
  });

  describe('validateColumnNames', () => {
    it('should accept valid column arrays', () => {
      expect(() => validateColumnNames(['a', 'b', 'c'])).not.toThrow();
      expect(() => validateColumnNames(['name'])).not.toThrow();
    });

    it('should reject non-arrays', () => {
      expect(() => validateColumnNames('string' as any)).toThrow(ValidationError);
    });

    it('should reject arrays with non-string elements', () => {
      expect(() => validateColumnNames(['a', 123, 'c'] as any)).toThrow(ValidationError);
      expect(() => validateColumnNames([null] as any)).toThrow(ValidationError);
    });
  });

  describe('validateFunction', () => {
    it('should accept functions', () => {
      expect(() => validateFunction(() => {}, 'fn')).not.toThrow();
      expect(() => validateFunction(function() {}, 'fn')).not.toThrow();
    });

    it('should reject non-functions', () => {
      expect(() => validateFunction('string', 'fn')).toThrow(ValidationError);
      expect(() => validateFunction(123, 'fn')).toThrow(ValidationError);
      expect(() => validateFunction({}, 'fn')).toThrow(ValidationError);
    });
  });

  describe('validateCsvRow', () => {
    it('should accept valid row objects', () => {
      expect(() => validateCsvRow({ name: 'Alice', age: 30 })).not.toThrow();
      expect(() => validateCsvRow({})).not.toThrow();
    });

    it('should reject non-objects', () => {
      expect(() => validateCsvRow('string')).toThrow(ValidationError);
      expect(() => validateCsvRow([])).toThrow(ValidationError);
      expect(() => validateCsvRow(null)).toThrow(ValidationError);
    });
  });

  describe('validateSeed', () => {
    it('should accept numbers', () => {
      expect(() => validateSeed(12345)).not.toThrow();
      expect(() => validateSeed(0)).not.toThrow();
      expect(() => validateSeed(-1)).not.toThrow();
    });

    it('should accept undefined', () => {
      expect(() => validateSeed(undefined)).not.toThrow();
    });

    it('should reject non-numbers', () => {
      expect(() => validateSeed('123')).toThrow(ValidationError);
      expect(() => validateSeed({})).toThrow(ValidationError);
    });

    it('should reject NaN and Infinity', () => {
      expect(() => validateSeed(NaN)).toThrow(ValidationError);
      expect(() => validateSeed(Infinity)).toThrow(ValidationError);
    });
  });

  describe('validateRange', () => {
    it('should accept valid ranges', () => {
      expect(() => validateRange(0, 100)).not.toThrow();
      expect(() => validateRange(10, 10)).not.toThrow();
      expect(() => validateRange(undefined, undefined)).not.toThrow();
    });

    it('should reject invalid ranges', () => {
      expect(() => validateRange(100, 10)).toThrow(ValidationError);
    });

    it('should reject non-numeric values', () => {
      expect(() => validateRange('10', 100)).toThrow(ValidationError);
      expect(() => validateRange(10, '100')).toThrow(ValidationError);
    });
  });

  describe('safeExecute', () => {
    it('should execute function and return result', () => {
      const result = safeExecute(() => 42, 'test operation');
      expect(result).toBe(42);
    });

    it('should wrap errors with operation context', () => {
      try {
        safeExecute(() => {
          throw new Error('Original error');
        }, 'test operation');
      } catch (e) {
        expect((e as Error).message).toContain('test operation failed');
        expect((e as Error).message).toContain('Original error');
      }
    });

    it('should use custom error handler', () => {
      const result = safeExecute(
        () => {
          throw new Error('Test');
        },
        'test operation',
        () => 'fallback'
      );
      
      expect(result).toBe('fallback');
    });

    it('should not wrap ValidationError', () => {
      try {
        safeExecute(() => {
          throw new ValidationError('Test', 'param', 123, 'string');
        }, 'test operation');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as Error).message).toBe('Test');
      }
    });
  });

  describe('safeExecuteAsync', () => {
    it('should execute async function and return result', async () => {
      const result = await safeExecuteAsync(async () => 42, 'test operation');
      expect(result).toBe(42);
    });

    it('should wrap async errors with operation context', async () => {
      try {
        await safeExecuteAsync(async () => {
          throw new Error('Original error');
        }, 'test operation');
      } catch (e) {
        expect((e as Error).message).toContain('test operation failed');
        expect((e as Error).message).toContain('Original error');
      }
    });

    it('should use custom async error handler', async () => {
      const result = await safeExecuteAsync(
        async () => {
          throw new Error('Test');
        },
        'test operation',
        async () => 'fallback'
      );
      
      expect(result).toBe('fallback');
    });
  });

  describe('ValidationError', () => {
    it('should contain all expected properties', () => {
      const error = new ValidationError('Test message', 'testParam', 123, 'string');
      
      expect(error.message).toBe('Test message');
      expect(error.parameter).toBe('testParam');
      expect(error.value).toBe(123);
      expect(error.expected).toBe('string');
      expect(error.name).toBe('ValidationError');
    });

    it('should be instanceof Error', () => {
      const error = new ValidationError('Test', 'param', null, 'value');
      expect(error instanceof Error).toBe(true);
    });
  });
});
