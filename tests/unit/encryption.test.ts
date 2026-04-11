/**
 * BitWarp Networking encryption module tests
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
import { SHA256, SHA512, MD5, Shake256 } from '../../src/shared/crypto';

/**
 * Describe tests
 */
describe('BitWrap Encryption Module Tests', () => {
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
});