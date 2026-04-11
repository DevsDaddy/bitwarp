/**
 * BitWarp Networking Crypto Utils
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1000
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               10.04.2026
 */
/* Import required */
import { FlashBuffer } from 'flash-buffer';
import { SHA512 } from './hash/sha';

/**
 * Crypto Utils
 */
export class CryptoUtils {
  /**
   * Get object signature
   * @param obj {any} Object to get signature
   * @param timestamp {number} Timestamp of signature
   * @returns {string} HEX string signature of object
   */
  public static getObjectSignature(obj : any, timestamp : number) : string {
    const serialized = JSON.stringify(obj);
    const signatureBuffer = new FlashBuffer({
      growthStrategy: 'powerOfTwo'
    });

    // Write signature buffer
    signatureBuffer.writeBigInt64(BigInt(timestamp));
    signatureBuffer.writeString(serialized);

    // Get SHA-512 Signature
    return SHA512.hash(new Uint8Array(signatureBuffer.buffer), false) as string;
  }
}