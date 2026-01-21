import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { CSVParseStream, createParseStream, parseStream } from '../src/core/streaming-parser';

describe('CSVParseStream', () => {
  it('should emit data events', async () => {
    const stream = new CSVParseStream({ header: true });
    const results: any[] = [];

    await new Promise<void>((resolve) => {
      stream.on('data', (row) => results.push(row));
      stream.on('end', () => {
        expect(results.length).toBeGreaterThanOrEqual(2);
        resolve();
      });

      stream.write('name,age\nJohn,30\nJane,25');
      stream.end();
    });
  });

  it('should emit header event', async () => {
    const stream = new CSVParseStream({ header: true });
    let headers: string[] = [];

    await new Promise<void>((resolve) => {
      stream.on('header', (h) => headers = h);
      stream.on('end', () => {
        expect(headers).toEqual(['name', 'age']);
        resolve();
      });

      stream.write('name,age\nJohn,30');
      stream.end();
    });
  });

  it('should emit error event', async () => {
    const stream = new CSVParseStream({ onError: 'throw' });
    let errorEmitted = false;

    await new Promise<void>((resolve) => {
      stream.on('error', (err) => {
        errorEmitted = true;
        resolve();
      });

      stream.on('end', () => {
        if (!errorEmitted) {
          expect.fail('Expected error to be emitted');
        }
        resolve();
      });

      stream.write('invalid');
      stream.end();
    });

    expect(errorEmitted).toBe(true);
  });

  it('should emit progress events', async () => {
    const stream = new CSVParseStream({ header: true });
    let progressCount = 0;

    stream.on('progress', () => progressCount++);
    stream.on('end', () => {
      expect(progressCount).toBeGreaterThan(0);
    });

    stream.write('name,age\nJohn,30\nJane,25');
    stream.end();
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it('should support dynamic typing', async () => {
    const stream = new CSVParseStream({ header: true, dynamicTyping: true });
    const results: any[] = [];

    stream.on('data', (row) => results.push(row));
    stream.on('end', () => {
      expect(results[0].age).toBe(30);
      expect(typeof results[0].age).toBe('number');
    });

    stream.write('name,age\nJohn,30');
    stream.end();
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it('should handle quoted fields', async () => {
    const stream = new CSVParseStream({ header: true });
    const results: any[] = [];

    stream.on('data', (row) => results.push(row));
    stream.on('end', () => {
      expect(results[0].name).toBe('John, Jr.');
    });

    stream.write('name,age\n"John, Jr.",30');
    stream.end();
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it('should support custom delimiters', async () => {
    const stream = new CSVParseStream({ header: true, delimiter: '|' });
    const results: any[] = [];

    stream.on('data', (row) => results.push(row));
    stream.on('end', () => {
      expect(results[0]).toEqual({ name: 'John', age: '30' });
    });

    stream.write('name|age\nJohn|30');
    stream.end();
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it('should set total bytes for progress', () => {
    const stream = new CSVParseStream();
    stream.setTotalBytes(1000);
    expect((stream as any).totalBytes).toBe(1000);
  });

  it('should use createParseStream factory', () => {
    const stream = createParseStream({ header: true });
    expect(stream).toBeInstanceOf(CSVParseStream);
  });

  it('should use parseStream helper', async () => {
    const input = Readable.from(['name,age\nJohn,30\nJane,25']);
    const results = await parseStream(input, { header: true });
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
