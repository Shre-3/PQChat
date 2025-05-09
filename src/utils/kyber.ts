import { mlkem } from "mlkem";

// Kyber key sizes (using Kyber768)
const KYBER_PUBLIC_KEY_SIZE = 1568;
const KYBER_PRIVATE_KEY_SIZE = 2400;
const KYBER_CIPHERTEXT_SIZE = 1632;
const KYBER_SHARED_SECRET_SIZE = 32;

/**
 * Generates a new Kyber key pair
 * @returns {Promise<{publicKey: Uint8Array, privateKey: Uint8Array}>} The generated key pair
 */
export async function generateKyberKeyPair(): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  try {
    const keyPair = await mlkem.keyPair();
    return {
      publicKey: new Uint8Array(keyPair.publicKey),
      privateKey: new Uint8Array(keyPair.privateKey),
    };
  } catch (error) {
    console.error("Error generating Kyber key pair:", error);
    throw new Error("Failed to generate Kyber key pair");
  }
}

/**
 * Encapsulates a shared secret using the recipient's public key
 * @param {Uint8Array} recipientPublicKey - The recipient's Kyber public key
 * @returns {Promise<{ciphertext: Uint8Array, sharedSecret: Uint8Array}>} The ciphertext and shared secret
 */
export async function encapsulate(
  recipientPublicKey: Uint8Array
): Promise<{ ciphertext: Uint8Array; sharedSecret: Uint8Array }> {
  try {
    if (recipientPublicKey.length !== KYBER_PUBLIC_KEY_SIZE) {
      throw new Error("Invalid public key size");
    }

    const result = await mlkem.encapsulate(recipientPublicKey);
    return {
      ciphertext: new Uint8Array(result.ciphertext),
      sharedSecret: new Uint8Array(result.sharedSecret),
    };
  } catch (error) {
    console.error("Error encapsulating shared secret:", error);
    throw new Error("Failed to encapsulate shared secret");
  }
}

/**
 * Decapsulates a shared secret using the recipient's private key
 * @param {Uint8Array} ciphertext - The received ciphertext
 * @param {Uint8Array} privateKey - The recipient's private key
 * @returns {Promise<Uint8Array>} The decapsulated shared secret
 */
export async function decapsulate(
  ciphertext: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  try {
    if (ciphertext.length !== KYBER_CIPHERTEXT_SIZE) {
      throw new Error("Invalid ciphertext size");
    }
    if (privateKey.length !== KYBER_PRIVATE_KEY_SIZE) {
      throw new Error("Invalid private key size");
    }

    const sharedSecret = await mlkem.decapsulate(ciphertext, privateKey);
    return new Uint8Array(sharedSecret);
  } catch (error) {
    console.error("Error decapsulating shared secret:", error);
    throw new Error("Failed to decapsulate shared secret");
  }
}
