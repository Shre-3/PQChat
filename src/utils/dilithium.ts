image.pngimport { Dilithium } from "dilithium-js";

// Dilithium key sizes (using Dilithium3)
const DILITHIUM_PUBLIC_KEY_SIZE = 1952;
const DILITHIUM_PRIVATE_KEY_SIZE = 4000;
const DILITHIUM_SIGNATURE_SIZE = 3293;

/**
 * Generates a new Dilithium key pair
 * @returns {Promise<{publicKey: Uint8Array, privateKey: Uint8Array}>} The generated key pair
 */
export async function generateDilithiumKeyPair(): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  try {
    const dilithium = new Dilithium();
    const keyPair = await dilithium.keyPair();
    return {
      publicKey: new Uint8Array(keyPair.publicKey),
      privateKey: new Uint8Array(keyPair.privateKey),
    };
  } catch (error) {
    console.error("Error generating Dilithium key pair:", error);
    throw new Error("Failed to generate Dilithium key pair");
  }
}

/**
 * Signs a message using Dilithium
 * @param {Uint8Array} message - The message to sign
 * @param {Uint8Array} privateKey - The signer's private key
 * @returns {Promise<Uint8Array>} The signature
 */
export async function sign(
  message: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  try {
    if (privateKey.length !== DILITHIUM_PRIVATE_KEY_SIZE) {
      throw new Error("Invalid private key size");
    }

    const dilithium = new Dilithium();
    const signature = await dilithium.sign(message, privateKey);
    return new Uint8Array(signature);
  } catch (error) {
    console.error("Error signing message:", error);
    throw new Error("Failed to sign message");
  }
}

/**
 * Verifies a Dilithium signature
 * @param {Uint8Array} message - The original message
 * @param {Uint8Array} signature - The signature to verify
 * @param {Uint8Array} publicKey - The signer's public key
 * @returns {Promise<boolean>} Whether the signature is valid
 */
export async function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  try {
    if (signature.length !== DILITHIUM_SIGNATURE_SIZE) {
      throw new Error("Invalid signature size");
    }
    if (publicKey.length !== DILITHIUM_PUBLIC_KEY_SIZE) {
      throw new Error("Invalid public key size");
    }

    const dilithium = new Dilithium();
    return await dilithium.verify(message, signature, publicKey);
  } catch (error) {
    console.error("Error verifying signature:", error);
    throw new Error("Failed to verify signature");
  }
}
