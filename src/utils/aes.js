/**
 * Encrypts data using AES-GCM
 * @param {Uint8Array} data - The data to encrypt
 * @param {Uint8Array} key - The encryption key
 * @returns {Promise<{ciphertext: Uint8Array, iv: Uint8Array}>} The encrypted data and IV
 */
export async function encrypt(data, key) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      data
    );

    return {
      ciphertext: new Uint8Array(ciphertext),
      iv,
    };
  } catch (error) {
    console.error("Error encrypting data:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts data using AES-GCM
 * @param {Uint8Array} ciphertext - The encrypted data
 * @param {Uint8Array} key - The decryption key
 * @param {Uint8Array} iv - The initialization vector
 * @returns {Promise<Uint8Array>} The decrypted data
 */
export async function decrypt(ciphertext, key, iv) {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext
    );

    return new Uint8Array(plaintext);
  } catch (error) {
    console.error("Error decrypting data:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Derives an AES key from a shared secret using HKDF
 * @param {Uint8Array} sharedSecret - The shared secret
 * @param {Uint8Array} salt - The salt for key derivation
 * @returns {Promise<Uint8Array>} The derived AES key
 */
export async function deriveKey(sharedSecret, salt) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      sharedSecret,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    const derivedKey = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        salt,
        info: new Uint8Array(0),
        hash: "SHA-256",
      },
      key,
      256
    );

    return new Uint8Array(derivedKey);
  } catch (error) {
    console.error("Error deriving key:", error);
    throw new Error("Failed to derive key");
  }
}
