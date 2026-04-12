/**
 * BitWarp Networking utils tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required modules */
import { describe, it, expect } from 'vitest';
import { FormatUtils, ParseUtils } from '../../src/shared';
import { BinaryConverter } from '../../src/shared';

/**
 * Describe tests
 */
describe('BitWrap Utils Tests', () => {
  // Format Utils
  describe('Format Utils', () => {
    it('Range min test', ()=> {
      let num = 100;
      expect(FormatUtils.range(num, 0, 50)).to.eq(50);
    });
    it('Range max test', ()=> {
      let num = 1;
      expect(FormatUtils.range(num, 10, 50)).to.eq(10);
    });
    it('Date format test', ()=> {
      let date = new Date("04.11.2026");
      expect(FormatUtils.formatDate(date, "{{dd}}.{{mm}}.{{YYYY}}")).toMatch("11.04.2026");
    })
  })

  // Parsing utils
  describe('Parsing Utils', () => {
    it('Parse boolean test', ()=> {
      let sbool = "true";
      expect(ParseUtils.bool(sbool)).to.eq(true);
    })
  })

  // Converter utils
  describe('Converter Utils', () => {
    // Equal Uint8 Arrays
    const uint8ArraysEqual = (a: Uint8Array, b: Uint8Array) => {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    };

    describe('toUint8Array', () => {
      it('Convert string to Uint8Array (UTF-8)', () => {
        const input = 'Hello, 世界!';
        const result = BinaryConverter.toUint8Array(input);
        const expected = new Uint8Array([
          72, 101, 108, 108, 111, 44, 32, 228, 184, 150, 231, 149, 140, 33,
        ]);
        expect(uint8ArraysEqual(result, expected)).toBe(true);
      });

      it('Convert ArrayBuffer to Uint8Array without copy', () => {
        const buffer = new ArrayBuffer(5);
        const view = new Uint8Array(buffer);
        view[0] = 10;
        const result = BinaryConverter.toUint8Array(buffer);
        expect(result.buffer).toBe(buffer); // тот же буфер
        expect(result[0]).toBe(10);
      });

      it('Convert ArrayBuffer to Uint8Array with copy', () => {
        const buffer = new ArrayBuffer(5);
        const result = BinaryConverter.toUint8Array(buffer, true);
        expect(result.buffer).not.toBe(buffer);
        expect(result.buffer.byteLength).toBe(5);
      });

      it('Returns Uint8Array without copy (copy=false)', () => {
        const original = new Uint8Array([1, 2, 3]);
        const result = BinaryConverter.toUint8Array(original);
        expect(result).toBe(original); // ссылка та же
      });

      it('Returns a copy of Uint8Array when copy=true', () => {
        const original = new Uint8Array([1, 2, 3]);
        const result = BinaryConverter.toUint8Array(original, true);
        expect(result).not.toBe(original);
        expect(uint8ArraysEqual(result, original)).toBe(true);
        result[0] = 99;
        expect(original[0]).toBe(1); // оригинал не изменился
      });

      it('Convert Buffer to Uint8Array (Buffer is a subclass of Uint8Array)', () => {
        const buf = Buffer.from([10, 20, 30]);
        const result = BinaryConverter.toUint8Array(buf);
        expect(result instanceof Uint8Array).toBe(true);
        expect(result).toBe(buf); // без копирования
        expect(result[0]).toBe(10);
      });

      it('Covert Buffer[] to Uint8Array using Buffer.concat', () => {
        const chunks = [Buffer.from([1, 2]), Buffer.from([3, 4]), Buffer.from([5])];
        const result = BinaryConverter.toUint8Array(chunks);
        const expected = new Uint8Array([1, 2, 3, 4, 5]);
        expect(uint8ArraysEqual(result, expected)).toBe(true);
        expect(result instanceof Uint8Array).toBe(true);
      });

      it('Throw TypeError for unsupported type', () => {
        // @ts-expect-error test of invalid input
        expect(() => BinaryConverter.toUint8Array(123)).toThrow(TypeError);
      });
    });

    describe('toString', () => {
      it('From Uint8Array to unicode simple string', () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]);
        expect(BinaryConverter.toString(bytes)).toBe('Hello');
      });

      it('works with Unicode', () => {
        const bytes = new Uint8Array([240, 159, 152, 138]); // 😊
        expect(BinaryConverter.toString(bytes)).toBe('😊');
      });

      it('Returns an empty string for empty array', () => {
        const empty = new Uint8Array(0);
        expect(BinaryConverter.toString(empty)).toBe('');
      });
    });

    describe('toArrayBuffer', () => {
      it('Returns original ArrayBuffer if offset 0 and length is equals', () => {
        const buffer = new ArrayBuffer(8);
        const view = new Uint8Array(buffer);
        const result = BinaryConverter.toArrayBuffer(view);
        expect(result).toBe(buffer);
      });

      it('Returns a copy for ArrayBuffer when copy=true', () => {
        const buffer = new ArrayBuffer(8);
        const view = new Uint8Array(buffer);
        view[0] = 42;
        const result = BinaryConverter.toArrayBuffer(view, true);
        expect(result).not.toBe(buffer);
        expect(result.byteLength).toBe(8);
        expect(new Uint8Array(result)[0]).toBe(42);
      });

      it('Returns a slice of ArrayBuffer when Uint8Array is a part of buffer', () => {
        const buffer = new ArrayBuffer(10);
        const fullView = new Uint8Array(buffer);
        fullView.fill(1);
        const subView = fullView.subarray(2, 7);
        const result = BinaryConverter.toArrayBuffer(subView);
        expect(result).not.toBe(buffer);
        expect(result.byteLength).toBe(5);
        const resultView = new Uint8Array(result);
        expect(resultView[0]).toBe(1);
        expect(resultView[4]).toBe(1);
      });
    });

    describe('toBuffer', () => {
      it('Covert Uint8Array into Buffer', () => {
        const arr = new Uint8Array([10, 20, 30]);
        const buf = BinaryConverter.toBuffer(arr);
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.length).toBe(3);
        expect(buf[0]).toBe(10);
      });

      it('Save offset when creates Buffer', () => {
        const buffer = new ArrayBuffer(10);
        const full = new Uint8Array(buffer);
        full.fill(9);
        const sub = full.subarray(2, 5);
        const buf = BinaryConverter.toBuffer(sub);

        expect(buf.length).toBe(3);
        expect(buf[0]).toBe(9);

        buf[0] = 100;
        expect(full[2]).toBe(100);
      });
    });

    describe('toBufferArray', () => {
      it('without chunkSize returns array with one Buffer', () => {
        const arr = new Uint8Array([1, 2, 3]);
        const result = BinaryConverter.toBufferArray(arr);
        expect(result).toHaveLength(1);
        expect(Buffer.isBuffer(result[0])).toBe(true);
        expect(result[0].length).toBe(3);
      });

      it('Brick on chunks with length', () => {
        const arr = new Uint8Array([1, 2, 3, 4, 5]);
        const result = BinaryConverter.toBufferArray(arr, 2);
        expect(result).toHaveLength(3);
        expect(result[0]).toEqual(Buffer.from([1, 2]));
        expect(result[1]).toEqual(Buffer.from([3, 4]));
        expect(result[2]).toEqual(Buffer.from([5]));
      });

      it('With chunkSize = 0 returns one Buffer', () => {
        const arr = new Uint8Array([1, 2, 3]);
        const result = BinaryConverter.toBufferArray(arr, 0);
        expect(result).toHaveLength(1);
      });
    });

    describe('toHex', () => {
      it('Convert Uint8Array into hex string without separator', () => {
        const data = new Uint8Array([10, 31, 255]);
        expect(BinaryConverter.toHex(data)).toBe('0a1fff');
      });

      it('Convert with separators', () => {
        const data = new Uint8Array([10, 31, 255]);
        expect(BinaryConverter.toHex(data, ':')).toBe('0a:1f:ff');
      });

      it('Works with empty arrays', () => {
        const data = new Uint8Array(0);
        expect(BinaryConverter.toHex(data)).toBe('');
        expect(BinaryConverter.toHex(data, '-')).toBe('');
      });

      it('Correct with bytes less 16', () => {
        const data = new Uint8Array([0, 1, 15]);
        expect(BinaryConverter.toHex(data)).toBe('00010f');
      });

      it('Performance: Large array (500+ bytes) using join optimization', () => {
        const large = new Uint8Array(1000);
        for (let i = 0; i < large.length; i++) large[i] = i % 256;
        const hex = BinaryConverter.toHex(large);
        expect(hex.length).toBe(2000);
      });
    });

    describe('fromHex', () => {
      it('convert hex string into Uint8Array', () => {
        const hex = '0a1fff';
        const result = BinaryConverter.fromHex(hex);
        const expected = new Uint8Array([10, 31, 255]);
        expect(uint8ArraysEqual(result, expected)).toBe(true);
      });

      it('ignore separators', () => {
        const hex = '0a:1f-ff';
        const result = BinaryConverter.fromHex(hex);
        expect(uint8ArraysEqual(result, new Uint8Array([10, 31, 255]))).toBe(true);
      });

      it('supports any register', () => {
        const hex = 'aB Cd';
        const result = BinaryConverter.fromHex(hex);
        expect(uint8ArraysEqual(result, new Uint8Array([0xab, 0xcd]))).toBe(true);
      });

      it('returns empty Uint8Array for empty string', () => {
        const result = BinaryConverter.fromHex('');
        expect(result.length).toBe(0);
      });

      it('works with string only with separators (returns an empty array', () => {
        const result = BinaryConverter.fromHex(' : - ');
        expect(result.length).toBe(0);
      });
    });

    describe('Integration tests', () => {
      it('string -> Uint8Array -> string (roundtrip)', () => {
        const original = 'Hello, BitWarp!';
        const uint8 = BinaryConverter.toUint8Array(original);
        const back = BinaryConverter.toString(uint8);
        expect(back).toBe(original);
      });

      it('hex -> Uint8Array -> hex (roundtrip)', () => {
        const originalHex = 'a1b2c3d4e5f6';
        const uint8 = BinaryConverter.fromHex(originalHex);
        const back = BinaryConverter.toHex(uint8);
        expect(back).toBe(originalHex);
      });

      it('Buffer[] -> Uint8Array -> Buffer[] with chunks', () => {
        const chunks = [Buffer.from('Hello'), Buffer.from('World')];
        const combined = BinaryConverter.toUint8Array(chunks);
        const splitAgain = BinaryConverter.toBufferArray(combined, 5);
        expect(splitAgain).toHaveLength(2);
        expect(splitAgain[0].toString()).toBe('Hello');
        expect(splitAgain[1].toString()).toBe('World');
      });
    });
  })
});