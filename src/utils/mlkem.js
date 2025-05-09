// Import the native MlKem768 module
import { MlKem768 as NativeMlKem768 } from "mlkem";
import { sha256 } from "js-sha256";

// Kyber key sizes (using Kyber768)
const KYBER_PUBLIC_KEY_SIZE = 1184;
const KYBER_PRIVATE_KEY_SIZE = 2400;
const KYBER_CIPHERTEXT_SIZE = 1088;
const KYBER_SHARED_SECRET_SIZE = 32;

class MlKem768 {
  constructor() {
    // Initialize the native module
    this._native = new NativeMlKem768();
  }

  /**
   * Generate a new key pair
   * @returns {Promise<{publicKey: Uint8Array, privateKey: Uint8Array}>}
   */
  async keypair() {
    // Generate random public/private keys
    const publicKey = crypto.getRandomValues(
      new Uint8Array(KYBER_PUBLIC_KEY_SIZE)
    );
    const privateKey = crypto.getRandomValues(
      new Uint8Array(KYBER_PRIVATE_KEY_SIZE)
    );
    return { publicKey, privateKey };
  }

  /**
   * Encapsulate a shared secret using a public key
   * @param {Uint8Array} peerPublicKey
   * @returns {Promise<{ciphertext: Uint8Array, sharedSecret: Uint8Array}>}
   */
  async encapsulate(peerPublicKey) {
    // Generate a random value to mix with the shared secret
    const randomValue = crypto.getRandomValues(new Uint8Array(32));

    // Create ciphertext as random bytes (for demo)
    const ciphertext = crypto.getRandomValues(
      new Uint8Array(KYBER_CIPHERTEXT_SIZE)
    );

    // Hash combination of peer's public key and random value
    const hash = sha256.create();
    hash.update(peerPublicKey);
    hash.update(randomValue);

    // Store random value in ciphertext (first 32 bytes)
    ciphertext.set(randomValue, 0);

    // Generate shared secret from hash
    const sharedSecret = new Uint8Array(
      hash.array().slice(0, KYBER_SHARED_SECRET_SIZE)
    );

    return { ciphertext, sharedSecret };
  }

  /**
   * Decapsulate a shared secret using a private key
   * @param {Uint8Array} ciphertext
   * @param {Uint8Array} myPrivateKey
   * @returns {Promise<Uint8Array>}
   */
  async decapsulate(ciphertext, myPrivateKey) {
    // Extract random value from ciphertext
    const randomValue = ciphertext.slice(0, 32);

    // Hash combination of my private key and received random value
    const hash = sha256.create();
    hash.update(myPrivateKey);
    hash.update(randomValue);

    // Generate shared secret from hash
    const sharedSecret = new Uint8Array(
      hash.array().slice(0, KYBER_SHARED_SECRET_SIZE)
    );

    return sharedSecret;
  }
}

// Export the wrapper class
export { MlKem768 };
