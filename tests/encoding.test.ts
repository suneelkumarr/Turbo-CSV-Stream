import { describe, it, expect } from 'vitest';
import {
  detectBOM,
  stripBOM,
  stripBOMString,
  getBOM,
  addBOM,
  addBOMString,
  decodeBuffer,
  detectEncodingHeuristic,
  isValidUTF8,
} from '../src/utils/encoding';

describe('Encoding Utilities', () => {
  describe('detectBOM', () => {
    it('should detect UTF-8 BOM', () => {
      const buffer = Buffer.from([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
      const result = detectBOM(buffer);
      
      expect(result.hasBOM).toBe(true);
      expect(result.encoding).toBe('utf-8');
      expect(result.length).toBe(3);
    });

    it('should detect UTF-16 LE BOM', () => {
      const buffer = Buffer.from([0xFF, 0xFE, 0x48, 0x00, 0x65, 0x00]);
      const result = detectBOM(buffer);
      
      expect(result.hasBOM).toBe(true);
      expect(result.encoding).toBe('utf-16le');
      expect(result.length).toBe(2);
    });

    it('should detect UTF-16 BE BOM', () => {
      const buffer = Buffer.from([0xFE, 0xFF, 0x00, 0x48, 0x00, 0x65]);
      const result = detectBOM(buffer);
      
      expect(result.hasBOM).toBe(true);
      expect(result.encoding).toBe('utf-16be');
      expect(result.length).toBe(2);
    });

    it('should detect no BOM', () => {
      const buffer = Buffer.from('Hello');
      const result = detectBOM(buffer);
      
      expect(result.hasBOM).toBe(false);
      expect(result.encoding).toBe('unknown');
      expect(result.length).toBe(0);
    });
  });

  describe('stripBOM', () => {
    it('should strip UTF-8 BOM', () => {
      const buffer = Buffer.from([0xEF, 0xBB, 0xBF, ...Buffer.from('Hello')]);
      const { content, bomInfo } = stripBOM(buffer);
      
      expect(content.toString()).toBe('Hello');
      expect(bomInfo.encoding).toBe('utf-8');
    });

    it('should return unchanged buffer without BOM', () => {
      const buffer = Buffer.from('Hello');
      const { content, bomInfo } = stripBOM(buffer);
      
      expect(content.toString()).toBe('Hello');
      expect(bomInfo.hasBOM).toBe(false);
    });
  });

  describe('stripBOMString', () => {
    it('should strip UTF-8 BOM character', () => {
      const str = '\uFEFFHello';
      expect(stripBOMString(str)).toBe('Hello');
    });

    it('should return unchanged string without BOM', () => {
      expect(stripBOMString('Hello')).toBe('Hello');
    });
  });

  describe('getBOM', () => {
    it('should return correct BOM for UTF-8', () => {
      const bom = getBOM('utf-8');
      expect(bom).toEqual(Buffer.from([0xEF, 0xBB, 0xBF]));
    });

    it('should return correct BOM for UTF-16 LE', () => {
      const bom = getBOM('utf-16le');
      expect(bom).toEqual(Buffer.from([0xFF, 0xFE]));
    });

    it('should return null for unknown encoding', () => {
      const bom = getBOM('ascii');
      expect(bom).toBeNull();
    });
  });

  describe('addBOM', () => {
    it('should add BOM to buffer', () => {
      const buffer = Buffer.from('Hello');
      const result = addBOM(buffer, 'utf-8');
      
      expect(result.slice(0, 3)).toEqual(Buffer.from([0xEF, 0xBB, 0xBF]));
      expect(result.slice(3).toString()).toBe('Hello');
    });

    it('should return unchanged buffer for unknown encoding', () => {
      const buffer = Buffer.from('Hello');
      const result = addBOM(buffer, 'ascii');
      
      expect(result.toString()).toBe('Hello');
    });
  });

  describe('addBOMString', () => {
    it('should add BOM character to string', () => {
      const result = addBOMString('Hello');
      expect(result.charCodeAt(0)).toBe(0xFEFF);
      expect(result.slice(1)).toBe('Hello');
    });
  });

  describe('decodeBuffer', () => {
    it('should decode UTF-8 buffer with BOM', () => {
      const buffer = Buffer.from([0xEF, 0xBB, 0xBF, ...Buffer.from('Hello')]);
      const { content, encoding } = decodeBuffer(buffer);
      
      expect(content).toBe('Hello');
      expect(encoding).toBe('utf-8');
    });

    it('should decode buffer without BOM', () => {
      const buffer = Buffer.from('Hello');
      const { content, encoding } = decodeBuffer(buffer);
      
      expect(content).toBe('Hello');
      expect(encoding).toBe('utf-8');
    });
  });

  describe('isValidUTF8', () => {
    it('should return true for valid UTF-8', () => {
      const buffer = Buffer.from('Hello, 世界!');
      expect(isValidUTF8(buffer)).toBe(true);
    });

    it('should return true for ASCII', () => {
      const buffer = Buffer.from('Hello');
      expect(isValidUTF8(buffer)).toBe(true);
    });

    it('should return false for invalid UTF-8', () => {
      const buffer = Buffer.from([0xFF, 0xFE, 0x00, 0x48]);
      expect(isValidUTF8(buffer)).toBe(false);
    });
  });

  describe('detectEncodingHeuristic', () => {
    it('should detect UTF-8 from valid content', () => {
      const buffer = Buffer.from('Hello, 世界!');
      expect(detectEncodingHeuristic(buffer)).toBe('utf-8');
    });

    it('should detect ASCII', () => {
      const buffer = Buffer.from('Hello World');
      // ASCII is also valid UTF-8, might return either
      const result = detectEncodingHeuristic(buffer);
      expect(['utf-8', 'ascii']).toContain(result);
    });

    it('should detect from BOM if present', () => {
      const buffer = Buffer.from([0xEF, 0xBB, 0xBF, ...Buffer.from('Hello')]);
      expect(detectEncodingHeuristic(buffer)).toBe('utf-8');
    });
  });
});
