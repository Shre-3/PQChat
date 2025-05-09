// Dilithium implementation using pure JavaScript library
import { Dilithium } from "dilithium-js";

export class DilithiumSignature {
  constructor() {
    this.dilithium = new Dilithium();
  }

  /**
   * Generate a new key pair
   * @returns {Promise<{publicKey: Uint8Array, privateKey: Uint8Array}>}
   */
  async generateKeyPair() {
    try {
      const { publicKey, privateKey } = await this.dilithium.keyPair();
      return {
        publicKey,
        privateKey,
      };
    } catch (error) {
      console.error("Error generating Dilithium key pair:", error);
      throw error;
    }
  }

  /**
   * Sign a message using the private key
   * @param {Uint8Array} message - The message to sign
   * @param {Uint8Array} privateKey - The private key to use for signing
   * @returns {Promise<Uint8Array>} The signature
   */
  async sign(message, privateKey) {
    try {
      const signature = await this.dilithium.sign(message, privateKey);
      return signature;
    } catch (error) {
      console.error("Error during Dilithium signing:", error);
      throw error;
    }
  }

  /**
   * Verify a signature using the public key
   * @param {Uint8Array} message - The original message
   * @param {Uint8Array} signature - The signature to verify
   * @param {Uint8Array} publicKey - The public key to use for verification
   * @returns {Promise<boolean>} True if the signature is valid
   */
  async verify(message, signature, publicKey) {
    try {
      const isValid = await this.dilithium.verify(
        message,
        signature,
        publicKey
      );
      return isValid;
    } catch (error) {
      console.error("Error during Dilithium verification:", error);
      throw error;
    }
  }
}
