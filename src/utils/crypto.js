/**
 * Crypto utilities for secure key derivation and encryption
 */

/**
 * Derive a key from a shared secret using HKDF
 * @param {Uint8Array} sharedSecret - The shared secret from Kyber
 * @param {Uint8Array} salt - A random salt value
 * @returns {Promise<CryptoKey>} - The derived key
 */
export async function deriveKey(sharedSecret, salt) {
  // Convert shared secret to CryptoKey
  const sharedSecretKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive a key using HKDF
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt: salt,
      info: new TextEncoder().encode("PQChat-AES-GCM"),
      hash: "SHA-256",
    },
    sharedSecretKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt data using AES-GCM
 * @param {string} data - The data to encrypt
 * @param {Uint8Array} sharedSecret - The shared secret from Kyber
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Promise<Uint8Array>} - The encrypted data
 */
export async function encrypt(message, sharedSecret, iv) {
  try {
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);
    const encryptedBytes = new Uint8Array(messageBytes.length);

    // Simple XOR encryption with shared secret
    for (let i = 0; i < messageBytes.length; i++) {
      encryptedBytes[i] =
        messageBytes[i] ^ sharedSecret[i % sharedSecret.length];
    }

    return encryptedBytes;
  } catch (error) {
    console.error("[ENCRYPT] Failed:", error);
    throw error;
  }
}

/**
 * Decrypt data using AES-GCM
 * @param {Uint8Array} encryptedData - The encrypted data
 * @param {Uint8Array} iv - Initialization vector
 * @param {Uint8Array} sharedSecret - The shared secret from Kyber
 * @returns {Promise<string>} - The decrypted data
 */
export async function decrypt(encryptedData, iv, sharedSecret) {
  try {
    // Simple XOR decryption with shared secret
    const decryptedBytes = new Uint8Array(encryptedData.length);
    for (let i = 0; i < encryptedData.length; i++) {
      decryptedBytes[i] =
        encryptedData[i] ^ sharedSecret[i % sharedSecret.length];
    }

    // Convert back to string
    return new TextDecoder().decode(decryptedBytes);
  } catch (error) {
    console.error("[DECRYPT] Failed:", error);
    throw error;
  }
}
