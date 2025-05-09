const pqcrypto = require("../../build/Release/pqcrypto.node");

class KyberKEM {
  /**
   * Generate a new Kyber key pair
   * @returns {Promise<{publicKey: Buffer, privateKey: Buffer}>}
   */
  static async generateKeyPair() {
    return pqcrypto.kyberGenerateKeyPair();
  }

  /**
   * Encapsulate a shared secret using a public key
   * @param {Buffer} publicKey - The public key to use for encapsulation
   * @returns {Promise<{ciphertext: Buffer, sharedSecret: Buffer}>}
   */
  static async encapsulate(publicKey) {
    return pqcrypto.kyberEncapsulate(publicKey);
  }

  /**
   * Decapsulate a shared secret using a private key
   * @param {Buffer} ciphertext - The ciphertext to decapsulate
   * @param {Buffer} privateKey - The private key to use for decapsulation
   * @returns {Promise<Buffer>} The decapsulated shared secret
   */
  static async decapsulate(ciphertext, privateKey) {
    return pqcrypto.kyberDecapsulate(ciphertext, privateKey);
  }
}

class DilithiumSignature {
  /**
   * Generate a new Dilithium key pair
   * @returns {Promise<{publicKey: Buffer, privateKey: Buffer}>}
   */
  static async generateKeyPair() {
    return pqcrypto.dilithiumGenerateKeyPair();
  }

  /**
   * Sign a message using a private key
   * @param {Buffer} message - The message to sign
   * @param {Buffer} privateKey - The private key to use for signing
   * @returns {Promise<Buffer>} The signature
   */
  static async sign(message, privateKey) {
    return pqcrypto.dilithiumSign(message, privateKey);
  }

  /**
   * Verify a signature using a public key
   * @param {Buffer} message - The original message
   * @param {Buffer} signature - The signature to verify
   * @param {Buffer} publicKey - The public key to use for verification
   * @returns {Promise<boolean>} True if the signature is valid
   */
  static async verify(message, signature, publicKey) {
    return pqcrypto.dilithiumVerify(message, signature, publicKey);
  }
}

module.exports = {
  KyberKEM,
  DilithiumSignature,
};
