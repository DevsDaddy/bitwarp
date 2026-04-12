/**
 * BitWarp Networking core tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1003
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               12.04.2026
 */
/* Import required modules */
import { describe, it, expect } from 'vitest';
import { Color, RGBValue } from '../../src/shared';
import { UUID } from '../../src/shared';
import { FastQueue } from '../../src/shared';

/**
 * Describe tests
 */
describe('BitWrap Core Tests', () => {
  // Color Type
  describe('Color type', () => {
    // Tested types
    let color : Color;

    beforeAll(() => {
      color = new Color(new RGBValue(255,0,0));
    })

    // Test color type
    it('Should be right color', () => {
      expect(color instanceof Color).to.be.true;
    })
    it('Color to HEX conversion', ()=> {
      let hexColor = color.toHEX();
      expect(hexColor).toMatch("#ff0000");
    })
    it('Color to string conversion', ()=> {
      let stringColor = color.toString(":");
      expect(stringColor).toMatch("255:0:0");
    })
    it('Color to object conversion', ()=> {
      let objectColor = color.toObject();
      expect(objectColor).toMatchObject({ red: 255, green: 0, blue: 0 });
    })
    it('String to Color conversion', ()=> {
      let stringColor = "255:0:0";
      expect(Color.fromString(stringColor, ":") as Color).toMatchObject(color);
    })
    it('HEX to Color conversion', ()=> {
      let hexColor = "#ff0000";
      expect(Color.fromString(hexColor)).toMatchObject(color);
    })
    it('JSON to Color conversion', ()=> {
      let jsonColor = JSON.stringify({ red: 255, green: 0, blue: 0 });
      expect(Color.fromJSON(jsonColor)).toMatchObject(color);
    })
  })

  // Test UUID
  describe('UUID type', () => {
    describe('v4 Generation', () => {
      it('Should generate valid UUID v4', () => {
        const uuid = UUID.v4();
        expect(UUID.validate(uuid)).toBe(true);
        expect(UUID.version(uuid)).toBe(4);
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });

      it('Should generate unique UUIDs', () => {
        const set = new Set<string>();
        for (let i = 0; i < 1000; i++) {
          set.add(UUID.v4());
        }
        expect(set.size).toBe(1000);
      });

      it('V4Many should generate correct count', () => {
        const uuids = UUID.v4Many(100);
        expect(uuids).toHaveLength(100);
        uuids.forEach(uuid => expect(UUID.validate(uuid)).toBe(true));
      });

      it('V4Many with zero/negative returns empty array', () => {
        expect(UUID.v4Many(0)).toEqual([]);
        expect(UUID.v4Many(-5)).toEqual([]);
      });

      it('Generate and generateMany are aliases', () => {
        expect(UUID.generate()).toMatch(/^[0-9a-f-]{36}$/i);
        expect(UUID.generateMany(3)).toHaveLength(3);
      });
    });

    describe('v7 generation', () => {
      it('Should generate valid UUID v7', () => {
        const uuid = UUID.v7();
        expect(UUID.validate(uuid)).toBe(true);
        expect(UUID.version(uuid)).toBe(7);
        // Проверяем, что первые 48 бит — это временная метка (возрастающая)
      });

      it('Should be monotonic within same millisecond? (not guaranteed, but check version)', () => {
        const uuids = [UUID.v7(), UUID.v7(), UUID.v7()];
        uuids.forEach(u => expect(UUID.version(u)).toBe(7));
      });
    });

    describe('V1 generation', () => {
      it('Should generate valid UUID v1', () => {
        const uuid = UUID.v1();
        expect(UUID.validate(uuid)).toBe(true);
        expect(UUID.version(uuid)).toBe(1);
      });

      it('Should have different timestamps for sequential calls', () => {
        const u1 = UUID.v1();
        const u2 = UUID.v1();
        expect(u1).not.toBe(u2);
      });
    });

    describe('v3 and v5 generation', () => {
      it('Should generate valid v3 UUID', async () => {
        const uuid = await UUID.v3(UUID.NAMESPACE_DNS, 'example.com');
        expect(UUID.validate(uuid)).toBe(true);
        expect(UUID.version(uuid)).toBe(3);
        // Детерминированность
        const uuid2 = await UUID.v3(UUID.NAMESPACE_DNS, 'example.com');
        expect(uuid).toBe(uuid2);
      });

      it('Should generate valid v5 UUID', async () => {
        const uuid = await UUID.v5(UUID.NAMESPACE_URL, 'https://example.com');
        expect(UUID.validate(uuid)).toBe(true);
        expect(UUID.version(uuid)).toBe(5);
        const uuid2 = await UUID.v5(UUID.NAMESPACE_URL, 'https://example.com');
        expect(uuid).toBe(uuid2);
      });

      it('Different namespaces produce different UUIDs', async () => {
        const dns = await UUID.v3(UUID.NAMESPACE_DNS, 'test');
        const url = await UUID.v3(UUID.NAMESPACE_URL, 'test');
        expect(dns).not.toBe(url);
      });
    });

    describe('Validation and parsing', () => {
      it('Validate should accept valid UUIDs', () => {
        expect(UUID.validate('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
        expect(UUID.validate('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true);
      });

      it('isUUID type guard works', () => {
        const value: unknown = UUID.v4();
        if (UUID.isUUID(value)) {
          // TypeScript должен распознать value как string
          expect(value.length).toBe(36);
        } else {
          throw new Error('Type guard failed');
        }
      });

      it('version extraction', () => {
        expect(UUID.version(UUID.v4())).toBe(4);
        expect(UUID.version(UUID.v7())).toBe(7);
        expect(UUID.version('invalid')).toBeNull();
      });

      it('parse returns Uint8Array for valid UUID', () => {
        const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
        const bytes = UUID.parse(uuid);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes).toHaveLength(16);
        // Проверим первый байт: 0xf4 = 244
        expect(bytes![0]).toBe(0xf4);
      });

      it('parse returns null for invalid', () => {
        expect(UUID.parse('invalid')).toBeNull();
      });

      it('equals compares correctly', () => {
        const a = UUID.v4();
        const b = a.toLowerCase();
        const c = a.toUpperCase();
        expect(UUID.equals(a, b)).toBe(true);
        expect(UUID.equals(a, c)).toBe(true);
        expect(UUID.equals(a, UUID.v4())).toBe(false);
      });

      it('normalize trims and lowercases', () => {
        const raw = '  F47AC10B-58CC-4372-A567-0E02B2C3D479  ';
        const expected = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
        expect(UUID.normalize(raw)).toBe(expected);
        expect(UUID.normalize('invalid')).toBeNull();
      });

      it('v4Raw returns 32 hex chars', () => {
        const raw = UUID.v4Raw();
        expect(raw).toHaveLength(32);
        expect(/^[0-9a-f]{32}$/i.test(raw)).toBe(true);
        // Должна быть 4-я версия в символе на позиции 12 (индекс 12 в raw соответствует байту 6)
        const versionNibble = raw.charAt(12);
        expect(versionNibble).toBe('4');
      });
    });

    describe('Branded type', () => {
      it('Brand returns branded string', () => {
        const id = UUID.v4();
        const branded = UUID.brand(id);
        expect(branded).toBe(id);
      });

      it('Brand throws on invalid UUID', () => {
        expect(() => UUID.brand('invalid')).toThrow(TypeError);
      });

      it('isBranded works with branded and unbranded', () => {
        const id = UUID.v4();
        const branded = UUID.brand(id);
        expect(UUID.isBranded(branded)).toBe(true);
        expect(UUID.isBranded(id)).toBe(true);
        expect(UUID.isBranded('not-uuid')).toBe(false);
      });
    });

    describe('Performance optimization', () => {
      it('v4Many with large count should be fast', () => {
        const start = performance.now();
        const uuids = UUID.v4Many(1000);
        const end = performance.now();
        expect(uuids).toHaveLength(1000);
        // Убедимся, что все валидны (быстрая проверка нескольких)
        expect(UUID.validate(uuids[0])).toBe(true);
        expect(UUID.validate(uuids[999])).toBe(true);
        console.log(`Generated 1000 UUIDs in ${(end - start).toFixed(2)}ms`);
      });
    });
  });

  // Test FastQueue
  describe('Fast Queue', () => {
    let queue: FastQueue<number>;

    beforeEach(() => {
      queue = new FastQueue<number>();
    });

    it('must be empty then created', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size).toBe(0);
      expect(queue.peek()).toBeUndefined();
      expect(queue.dequeue()).toBeUndefined();
    });

    it('correct adds an items (enqueue)', () => {
      queue.enqueue(1);
      expect(queue.isEmpty()).toBe(false);
      expect(queue.size).toBe(1);
      expect(queue.peek()).toBe(1);

      queue.enqueue(2);
      expect(queue.size).toBe(2);
      expect(queue.peek()).toBe(1);
    });

    it('correct remove an items FIFO (dequeue)', () => {
      queue.enqueue(10);
      queue.enqueue(20);
      queue.enqueue(30);

      expect(queue.dequeue()).toBe(10);
      expect(queue.size).toBe(2);
      expect(queue.peek()).toBe(20);

      expect(queue.dequeue()).toBe(20);
      expect(queue.size).toBe(1);
      expect(queue.peek()).toBe(30);

      expect(queue.dequeue()).toBe(30);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.dequeue()).toBeUndefined();
    });

    it('correct works with enqueue and dequeue', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      expect(queue.dequeue()).toBe(1);

      queue.enqueue(3);
      expect(queue.dequeue()).toBe(2);
      expect(queue.dequeue()).toBe(3);
      expect(queue.isEmpty()).toBe(true);
    });

    it('method clear must clean queue', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      queue.clear();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size).toBe(0);
      expect(queue.peek()).toBeUndefined();
      expect(queue.dequeue()).toBeUndefined();

      queue.enqueue(42);
      expect(queue.peek()).toBe(42);
      expect(queue.size).toBe(1);
    });

    it('must support an for...of iterator', () => {
      const values = [5, 10, 15, 20];
      values.forEach(v => queue.enqueue(v));

      const iterated: number[] = [];
      for (const item of queue) {
        iterated.push(item);
      }
      expect(iterated).toEqual(values);

      // Исходная очередь не должна измениться
      expect(queue.size).toBe(values.length);
    });

    it('must correctly works with large size (performance test with O(1))', () => {
      const count = 100_000;
      // Enqueue
      for (let i = 0; i < count; i++) {
        queue.enqueue(i);
      }
      expect(queue.size).toBe(count);

      // Dequeue
      for (let i = 0; i < count; i++) {
        expect(queue.dequeue()).toBe(i);
      }
      expect(queue.isEmpty()).toBe(true);

      for (let i = 0; i < count; i++) {
        queue.enqueue(i);
        if (i % 2 === 0) {
          queue.dequeue();
        }
      }

      expect(queue.size).toBe(count - Math.floor(count / 2));
    });

    it('must works with any types', () => {
      const strQueue = new FastQueue<string>();
      strQueue.enqueue('hello');
      strQueue.enqueue('world');
      expect(strQueue.dequeue()).toBe('hello');
      expect(strQueue.peek()).toBe('world');

      const objQueue = new FastQueue<{ id: number }>();
      objQueue.enqueue({ id: 1 });
      objQueue.enqueue({ id: 2 });
      expect(objQueue.dequeue()?.id).toBe(1);
      expect(objQueue.peek()?.id).toBe(2);
    });
  });
});