/**
 * BitWarp Networking Crypto module
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1037
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               19.04.2026
 */
/**
 * Hash Provider
 */
export interface HashProvider {}

/**
 * Key Pair
 */
export interface KeyPair {
  publicKey ? : Uint8Array;
  privateKey ? : Uint8Array;
}

/**
 * Crypto provider options
 */
export interface CryptoProviderOptions {}

/**
 * Crypto Provider
 */
export interface CryptoProvider {
  // Key fields
  generateKeyPair() : Promise<KeyPair>;
  getPublicKey() : Promise<Uint8Array>;
  getPrivateKey() : Promise<Uint8Array>;

  // Work with sessions
  initializeSession(peerPublicKey: Uint8Array, isInitiator: boolean): Promise<Uint8Array | null>;
  finalizeSession(ciphertext : Uint8Array) : Promise<void>;

  // Encrypt / Decrypt
  encrypt(decryptedData: Uint8Array): Promise<Uint8Array>;
  decrypt(encryptedData: Uint8Array): Promise<Uint8Array>;
  encryptSync(decryptedData: Uint8Array) : Uint8Array;
  decryptSync(encryptedData: Uint8Array) : Uint8Array;

  // Dispose
  dispose() : Promise<void>;

  // Get new Instance
  getNewInstance(options ? : CryptoProviderOptions) : CryptoProvider;
}