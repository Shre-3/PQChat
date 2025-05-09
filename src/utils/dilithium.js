// Temporary implementation using Web Crypto API
// TODO: Replace with proper Dilithium implementation when available

const DILITHIUM_PUBLIC_KEY_SIZE = 1952;
const DILITHIUM_PRIVATE_KEY_SIZE = 4000;
const DILITHIUM_SIGNATURE_SIZE = 3293;

/**
 * Generates a new Dilithium key pair
 * @returns {Promise<{publicKey: Uint8Array, privateKey: Uint8Array}>} The generated key pair
 */
export async function generateDilithiumKeyPair() {
  try {
    // For now, we'll use ECDSA with P-384 as a temporary replacement
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-384",
      },
      true,
      ["sign", "verify"]
    );

    // Export keys in a format that matches the Kyber key format
    const publicKeyBuffer = await crypto.subtle.exportKey(
      "raw",
      keyPair.publicKey
    );
    const privateKeyBuffer = await crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );

    // Return Uint8Arrays directly
    return {
      publicKey: new Uint8Array(publicKeyBuffer),
      privateKey: new Uint8Array(privateKeyBuffer),
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
export async function sign(message, privateKey) {
  try {
    // Import the private key directly since it's already a Uint8Array
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      privateKey,
      {
        name: "ECDSA",
        namedCurve: "P-384",
      },
      false,
      ["sign"]
    );

    // Sign the message
    const signature = await crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: "SHA-384",
      },
      cryptoKey,
      message
    );

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
export async function verify(message, signature, publicKey) {
  try {
    // Import the public key directly since it's already a Uint8Array
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      publicKey,
      {
        name: "ECDSA",
        namedCurve: "P-384",
      },
      false,
      ["verify"]
    );

    // Verify the signature
    return await crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: "SHA-384",
      },
      cryptoKey,
      signature,
      message
    );
  } catch (error) {
    console.error("Error verifying signature:", error);
    throw new Error("Failed to verify signature");
  }
}
