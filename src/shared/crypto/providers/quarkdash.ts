/**
 * BitWarp Networking QuarkDash Provider
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1028
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               17.04.2026
 */
/* Import required modules */
import { CryptoProvider, CryptoProviderOptions, KeyPair } from '../../proto/crypto';
import { CipherType, IKDF, IKeyExchange, IMAC, QuarkDash } from 'quarkdash';
import { Logger } from '../../debug/logger';

/**
 * QuarkDash Crypto Provider options
 */
export class QuarkDashProviderOptions implements CryptoProviderOptions{
  cipher ? : CipherType
  kdf ? : IKDF
  mac ? : IMAC
  keyExchange ? : IKeyExchange
  maxPacketWindow ? : number
  timestampToleranceMs ? : number
}

/**
 * QuarkDash Crypto Provider
 */
export class QuarkDashProvider implements CryptoProvider {
  private _options : QuarkDashProviderOptions;
  private _instance : QuarkDash;
  private _isDisposed : boolean = false;
  private _isSessionReady : boolean = false;
  private _isKeysReady : boolean = false;

  /**
   * Create new QuarkDash Crypto Provider
   * @param options {QuarkDashProviderOptions} QuarkDash Options
   */
  constructor(options ? : QuarkDashProviderOptions) {
    this._options = {...QuarkDashProvider._defaultOptions, ...options}

    // Create QuarkDash Instance
    this._isDisposed = true;
    this._instance = new QuarkDash({
      ...(this._options?.cipher && { cipher: this._options?.cipher }),
      ...(this._options?.kdf && { kdf: this._options?.kdf }),
      ...(this._options?.mac && { mac: this._options?.mac }),
      ...(this._options?.keyExchange && { keyExchange: this._options?.keyExchange }),
      ...(this._options?.maxPacketWindow && { maxPacketWindow: this._options?.maxPacketWindow }),
      ...(this._options?.timestampToleranceMs && { timestampToleranceMs: this._options?.timestampToleranceMs }),
    });
  }

  /**
   * Generates encryption key pair
   * @returns {Promise<KeyPair>} Returns Key Pair
   */
  public async generateKeyPair(): Promise<KeyPair> {
    Logger.warn("QuarkDash provider generates key pair only for session establishment and doesn't return a private key");
    const publicKey = await this.getPublicKey();
    this._isSessionReady = false;
    return Promise.resolve({ publicKey, privateKey: undefined });
  }

  /**
   * Get (generate) public key
   * @returns {Promise<Uint8Array>} Public key buffer
   */
  public async getPublicKey(): Promise<Uint8Array> {
    this._isSessionReady = false;
    return await this._instance.generateKeyPair();
  }

  /**
   * Get (generate) private key
   * @returns {Promise<Uint8Array>} Private key buffer
   */
  public async getPrivateKey(): Promise<Uint8Array> {
    return Promise.reject(new Error('Failed to get private key. QuarkDash can return only public key. Use a sessions for key exchange.'));
  }

  /**
   * Encrypt data
   * @param decryptedData {Uint8Array} Raw decrypted bytes buffer
   * @returns {Promise<Uint8Array>} Returns encrypted bytes buffer
   */
  public async encrypt(decryptedData: Uint8Array): Promise<Uint8Array> {
    if(this._isDisposed) return Promise.reject(new Error("Failed to encrypt. QuarkDash is disposed. Regenerate keys and try again."));
    if(!this._isSessionReady) return Promise.reject(new Error("Failed to encrypt. QuarkDash session is not initialized."));
    return await this._instance.encrypt(decryptedData);
  }

  /**
   * Decrypt data
   * @param encryptedData {Uint8Array} Raw encrypted bytes buffer
   * @returns {Promise<Uint8Array>} Returns decrypted bytes buffer
   */
  public async decrypt(encryptedData: Uint8Array): Promise<Uint8Array> {
    if(this._isDisposed) return Promise.reject(new Error("Failed to decrypt. QuarkDash is disposed. Regenerate keys and try again."));
    if(!this._isSessionReady) return Promise.reject(new Error("Failed to decrypt. QuarkDash session is not initialized."));
    return this._instance.decrypt(encryptedData);
  }

  /**
   * Initialize session
   * @param publicKey {Uint8Array} Public key
   * @param isInitiator {boolean} Is session initiator?
   * @returns {Uint8Array} Ciphertext bytes buffer
   */
  public async initializeSession(publicKey: Uint8Array, isInitiator: boolean): Promise<Uint8Array | null> {
    this._isSessionReady = true;
    this._isDisposed = false;
    return this._instance.initializeSession(publicKey, isInitiator);
  }

  /**
   * Finalize session
   * @param ciphertext {Uint8Array} Ciphertext
   */
  public async finalizeSession(ciphertext: Uint8Array): Promise<void> {
    if(!this._isSessionReady) return Promise.reject(new Error("Failed to finalize session. QuarkDash session is not initialized."));
    if(this._isDisposed) return Promise.reject(new Error("Failed to finalize session. QuarkDash is disposed. Regenerate keys and try again."));
    return await this._instance.finalizeSession(ciphertext);
  }

  /**
   * Dispose encryptor
   */
  public async dispose(): Promise<void> {
    // Check disposed
    if(this._isDisposed) return Promise.resolve();

    // Dispose
    this._instance.dispose();
    this._isDisposed = true;
    return Promise.resolve();
  }

  /**
   * Default options
   * @private
   */
  private static readonly _defaultOptions : QuarkDashProviderOptions = {
    /* Grab defaults from QuarkDash Crypto */
  }
}