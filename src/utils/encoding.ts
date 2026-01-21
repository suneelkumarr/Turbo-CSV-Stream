/**
 * Unicode BOM Detection and Encoding Support
 * 
 * Features:
 * - Detect BOM (Byte Order Mark) from buffer
 * - Support multiple encodings (UTF-8, UTF-16 LE/BE, UTF-32 LE/BE)
 * - Strip BOM from content
 * - Add BOM to output
 */

export type EncodingType = 
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'utf-32le'
  | 'utf-32be'
  | 'ascii'
  | 'latin1'
  | 'unknown';

export interface BOMInfo {
  /** Detected encoding */
  encoding: EncodingType;
  /** BOM byte sequence */
  bom: Buffer | null;
  /** Length of BOM in bytes */
  length: number;
  /** Whether BOM was detected */
  hasBOM: boolean;
}

// BOM byte sequences
const BOM_SEQUENCES: { encoding: EncodingType; bom: number[]; }[] = [
  { encoding: 'utf-32be', bom: [0x00, 0x00, 0xFE, 0xFF] },
  { encoding: 'utf-32le', bom: [0xFF, 0xFE, 0x00, 0x00] },
  { encoding: 'utf-8', bom: [0xEF, 0xBB, 0xBF] },
  { encoding: 'utf-16be', bom: [0xFE, 0xFF] },
  { encoding: 'utf-16le', bom: [0xFF, 0xFE] },
];

/**
 * Detect BOM from buffer
 */
export function detectBOM(buffer: Buffer): BOMInfo {
  for (const { encoding, bom } of BOM_SEQUENCES) {
    if (buffer.length >= bom.length) {
      let match = true;
      for (let i = 0; i < bom.length; i++) {
        if (buffer[i] !== bom[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return {
          encoding,
          bom: Buffer.from(bom),
          length: bom.length,
          hasBOM: true,
        };
      }
    }
  }

  return {
    encoding: 'unknown',
    bom: null,
    length: 0,
    hasBOM: false,
  };
}

/**
 * Strip BOM from buffer and return content
 */
export function stripBOM(buffer: Buffer): { content: Buffer; bomInfo: BOMInfo } {
  const bomInfo = detectBOM(buffer);
  
  if (bomInfo.hasBOM) {
    return {
      content: buffer.slice(bomInfo.length),
      bomInfo,
    };
  }

  return { content: buffer, bomInfo };
}

/**
 * Strip BOM from string (UTF-8 BOM character)
 */
export function stripBOMString(str: string): string {
  // UTF-8 BOM appears as \uFEFF at the start of string
  if (str.charCodeAt(0) === 0xFEFF) {
    return str.slice(1);
  }
  return str;
}

/**
 * Get BOM bytes for encoding
 */
export function getBOM(encoding: EncodingType): Buffer | null {
  const entry = BOM_SEQUENCES.find(e => e.encoding === encoding);
  return entry ? Buffer.from(entry.bom) : null;
}

/**
 * Add BOM to buffer
 */
export function addBOM(buffer: Buffer, encoding: EncodingType): Buffer {
  const bom = getBOM(encoding);
  if (bom) {
    return Buffer.concat([bom, buffer]);
  }
  return buffer;
}

/**
 * Add BOM to string (UTF-8)
 */
export function addBOMString(str: string): string {
  return '\uFEFF' + str;
}

/**
 * Decode buffer to string with auto-detection
 */
export function decodeBuffer(buffer: Buffer, encoding?: BufferEncoding): { content: string; encoding: EncodingType } {
  const { content, bomInfo } = stripBOM(buffer);
  
  // Use detected encoding or fallback to specified/utf-8
  let enc: BufferEncoding;
  let detectedEncoding: EncodingType;

  if (bomInfo.hasBOM && bomInfo.encoding !== 'unknown') {
    detectedEncoding = bomInfo.encoding;
    // Map to Node.js encoding names
    switch (bomInfo.encoding) {
      case 'utf-16le':
        enc = 'utf16le';
        break;
      case 'utf-16be':
        // Node doesn't directly support utf-16be, need to swap bytes
        enc = 'utf16le';
        const swapped = Buffer.alloc(content.length);
        for (let i = 0; i < content.length - 1; i += 2) {
          swapped[i] = content[i + 1]!;
          swapped[i + 1] = content[i]!;
        }
        return { content: swapped.toString('utf16le'), encoding: detectedEncoding };
      case 'utf-8':
      default:
        enc = 'utf8';
    }
  } else {
    enc = encoding || 'utf8';
    detectedEncoding = encoding as EncodingType || 'utf-8';
  }

  return { content: content.toString(enc), encoding: detectedEncoding };
}

/**
 * Encode string to buffer with optional BOM
 */
export function encodeString(
  str: string,
  encoding: BufferEncoding = 'utf8',
  includeBOM: boolean = false
): Buffer {
  const buffer = Buffer.from(str, encoding);
  
  if (includeBOM) {
    let bomEncoding: EncodingType;
    switch (encoding) {
      case 'utf16le':
        bomEncoding = 'utf-16le';
        break;
      case 'utf8':
      default:
        bomEncoding = 'utf-8';
    }
    return addBOM(buffer, bomEncoding);
  }

  return buffer;
}

/**
 * Try to detect encoding from content heuristics (when no BOM)
 */
export function detectEncodingHeuristic(buffer: Buffer): EncodingType {
  // Check for BOM first
  const bomInfo = detectBOM(buffer);
  if (bomInfo.hasBOM) {
    return bomInfo.encoding;
  }

  // Simple heuristics for common encodings
  const len = Math.min(buffer.length, 1024);
  
  // Check for null bytes (common in UTF-16/32)
  let nullCount = 0;
  let highByteCount = 0;
  
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) nullCount++;
    if ((buffer[i] ?? 0) > 127) highByteCount++;
  }

  // Many null bytes suggest UTF-16 or UTF-32
  if (nullCount > len * 0.1) {
    // Check pattern for UTF-16 LE (null byte after each char)
    let utf16lePattern = 0;
    for (let i = 1; i < len; i += 2) {
      if (buffer[i] === 0) utf16lePattern++;
    }
    if (utf16lePattern > len * 0.4) {
      return 'utf-16le';
    }
    
    // Check pattern for UTF-16 BE (null byte before each char)
    let utf16bePattern = 0;
    for (let i = 0; i < len; i += 2) {
      if (buffer[i] === 0) utf16bePattern++;
    }
    if (utf16bePattern > len * 0.4) {
      return 'utf-16be';
    }
  }

  // Check if valid UTF-8
  if (isValidUTF8(buffer.slice(0, len))) {
    return 'utf-8';
  }

  // High bytes but invalid UTF-8 might be Latin-1
  if (highByteCount > 0) {
    return 'latin1';
  }

  // ASCII compatible
  return 'ascii';
}

/**
 * Check if buffer is valid UTF-8
 */
export function isValidUTF8(buffer: Buffer): boolean {
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i]!;
    
    if (byte < 0x80) {
      // ASCII
      i++;
    } else if ((byte & 0xE0) === 0xC0) {
      // 2-byte sequence
      if (i + 1 >= buffer.length || (buffer[i + 1]! & 0xC0) !== 0x80) {
        return false;
      }
      i += 2;
    } else if ((byte & 0xF0) === 0xE0) {
      // 3-byte sequence
      if (i + 2 >= buffer.length ||
          (buffer[i + 1]! & 0xC0) !== 0x80 ||
          (buffer[i + 2]! & 0xC0) !== 0x80) {
        return false;
      }
      i += 3;
    } else if ((byte & 0xF8) === 0xF0) {
      // 4-byte sequence
      if (i + 3 >= buffer.length ||
          (buffer[i + 1]! & 0xC0) !== 0x80 ||
          (buffer[i + 2]! & 0xC0) !== 0x80 ||
          (buffer[i + 3]! & 0xC0) !== 0x80) {
        return false;
      }
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Convert buffer between encodings
 */
export function convertEncoding(
  buffer: Buffer,
  fromEncoding: BufferEncoding,
  toEncoding: BufferEncoding
): Buffer {
  const str = buffer.toString(fromEncoding);
  return Buffer.from(str, toEncoding);
}
