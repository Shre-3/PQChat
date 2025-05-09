// Kyber implementation using pure JavaScript library
import { Kyber } from "kyber-js";

export class KyberKEM {
  constructor() {
    this.kyber = new Kyber();
  }

  /**
   * Generate a new key pair
   * @returns {Promise<{publicKey: Uint8Array, privateKey: Uint8Array}>}
   */
  async generateKeyPair() {
    try {
      const response = await fetch("http://localhost:8080/api/kyber/keypair");
      const { publicKey, privateKey } = await response.json();
      return {
        publicKey,
        privateKey,
      };
    } catch (error) {
      console.error("Error generating Kyber key pair:", error);
      throw error;
    }
  }

  /**
   * Encapsulate a shared secret using the public key
   * @param {Uint8Array} publicKey - The public key to use for encapsulation
   * @returns {Promise<{ciphertext: Uint8Array, sharedSecret: Uint8Array}>}
   */
  async encapsulate(publicKey) {
    try {
      const response = await fetch(
        "http://localhost:8080/api/kyber/encapsulate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientPublicKey: Array.from(publicKey) }),
        }
      );
      const { ciphertext, sharedSecret } = await response.json();
      return {
        ciphertext,
        sharedSecret,
      };
    } catch (error) {
      console.error("Error during Kyber encapsulation:", error);
      throw error;
    }
  }

  /**
   * Decapsulate a shared secret using the private key
   * @param {Uint8Array} ciphertext - The ciphertext to decapsulate
   * @param {Uint8Array} privateKey - The private key to use for decapsulation
   * @returns {Promise<Uint8Array>} The decapsulated shared secret
   */
  async decapsulate(ciphertext, privateKey) {
    try {
      const response = await fetch(
        "http://localhost:8080/api/kyber/decapsulate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ciphertext: Array.from(ciphertext),
            privateKey: Array.from(privateKey),
          }),
        }
      );
      const { sharedSecret } = await response.json();
      return sharedSecret;
    } catch (error) {
      console.error("Error during Kyber decapsulation:", error);
      throw error;
    }
  }
}
