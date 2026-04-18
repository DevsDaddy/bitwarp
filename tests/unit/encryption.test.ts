/**
 * BitWarp Networking encryption module tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1002
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               18.04.2026
 */
/* Import required modules */
import { describe, it, expect } from 'vitest';
import { SHA256, SHA512, MD5, Shake256 } from '../../src/shared/crypto';
import { CryptoUtils } from '../../src/shared/crypto/utils';
import { Logger } from '../../src/shared';
import { QuarkDashProvider } from '../../src/shared/crypto/providers/quarkdash';
import { QuarkDashUtils } from 'quarkdash';

/**
 * Describe tests
 */
describe('BitWrap Encryption Module Tests', () => {
  let client : QuarkDashProvider;
  let server : QuarkDashProvider;
  let clientPub : Uint8Array;
  let serverPub : Uint8Array;
  let cipherText : Uint8Array;

  /* Create crypto assets */
  beforeAll(async () => {
    client = new QuarkDashProvider();
    server = new QuarkDashProvider();
    clientPub = await client.getPublicKey();
    serverPub = await server.getPublicKey();
    cipherText = await client.initializeSession(serverPub, true) as Uint8Array;
    await server.initializeSession(clientPub, false);
    await server.finalizeSession(cipherText);
  });

  // Hash Providers test
  it('SHAKE-256 hash provider test', async () => {
    const input = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const output = await Shake256.hash(input, 32);
    expect(output.length).toBe(32);
  })
  it('SHA-256 hash provider test', () => {
    const input = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const output = SHA256.hash(input);
    expect(output.length).toBe(64);
  })
  it('SHA-512 hash provider test', () => {
    const input = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const output = SHA512.hash(input);
    expect(output.length).toBe(128);
  })
  it('MD5 hash provider test', () => {
    const input = "This is a test"
    const output = MD5.hash(input);
    expect(output.length).toBe(32);
  })

  // Crypto utils
  it('Object signature test', () => {
    const object = { name: "Alice", age: 25 };
    const timestamp = Date.now();
    const signature = CryptoUtils.getObjectSignature(object, timestamp);
    expect(signature.length).toBe(128);
  });

  // QuarkDash Crypto Provider
  it('Empty data', async () => {
    const plain = new Uint8Array(0);
    const enc = await client.encrypt(plain);
    const dec = await server.decrypt(enc);
    expect(dec.length).toBe(0);
  });
  it('Large data (64KB)', async () => {
    const plain = QuarkDashUtils.randomBytes(1024 * 64);
    const enc = await client.encrypt(plain);
    const dec = await server.decrypt(enc);
    expect(dec).toEqual(plain);
  });
  it('Replay attack prevention', async () => {
    const plain = QuarkDashUtils.textToBytes('test');
    const enc = await client.encrypt(plain);
    // Pass in first time
    await server.decrypt(enc);
    // Can't pass in second time
    await expect(server.decrypt(enc)).rejects.toThrow('Replay detected');
  });
  it('MAC corruption', async () => {
    const plain = QuarkDashUtils.textToBytes('test');
    const enc = await client.encrypt(plain);
    enc[enc.length - 1] ^= 0xFF;
    await expect(server.decrypt(enc)).rejects.toThrow('MAC verification failed');
  });
  it('Concurrent sessions', async () => {
    const sessions = [];
    for (let i = 0; i < 5; i++) {
      const a = new QuarkDashProvider();
      const b = new QuarkDashProvider();
      const aPub = await a.getPublicKey();
      const bPub = await b.getPublicKey();
      const ct = await a.initializeSession(bPub, true) as Uint8Array;
      await b.initializeSession(aPub, false);
      await b.finalizeSession(ct);
      sessions.push({ a, b });
    }
    await Promise.all(sessions.map(async (s, idx) => {
      const msg = QuarkDashUtils.textToBytes(`msg${idx}`);
      const enc = await s.a.encrypt(msg);
      const dec = await s.b.decrypt(enc);
      expect(QuarkDashUtils.bytesToText(dec)).toBe(`msg${idx}`);
    }));
  });
});