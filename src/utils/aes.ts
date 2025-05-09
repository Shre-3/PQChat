/**
 * Encrypts a message using AES-GCM
 * @param {string} message - The message to encrypt
 * @param {Uint8Array} key - The AES key
 * @returns {Promise<{ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array}>} The encrypted data
 */
export async function encrypt(
  message: string,
  key: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
  try {
    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Encrypt the message
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      cryptoKey,
      messageBytes
    );

    // Extract the ciphertext and tag
    const encryptedArray = new Uint8Array(encryptedData);
    const tag = encryptedArray.slice(-16);
    const ciphertext = encryptedArray.slice(0, -16);

    return {
      ciphertext,
      iv,
      tag,
    };
  } catch (error) {
    console.error("Error encrypting message:", error);
    throw new Error("Failed to encrypt message");
  }
}

/**
 * Decrypts a message using AES-GCM
 * @param {Uint8Array} ciphertext - The encrypted message
 * @param {Uint8Array} key - The AES key
 * @param {Uint8Array} iv - The initialization vector
 * @param {Uint8Array} tag - The authentication tag
 * @returns {Promise<string>} The decrypted message
 */
export async function decrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array
): Promise<string> {
  try {
    // Combine ciphertext and tag
    const encryptedData = new Uint8Array(ciphertext.length + tag.length);
    encryptedData.set(ciphertext);
    encryptedData.set(tag, ciphertext.length);

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // Decrypt the message
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      cryptoKey,
      encryptedData
    );

    // Convert bytes to string
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Error decrypting message:", error);
    throw new Error("Failed to decrypt message");
  }
}

/**
 * Derives an AES key from a shared secret using HKDF
 * @param {Uint8Array} sharedSecret - The shared secret from Kyber
 * @returns {Promise<Uint8Array>} The derived AES key
 */
export async function deriveKey(sharedSecret: Uint8Array): Promise<Uint8Array> {
  try {
    // Use a zero-filled salt
    const salt = new Uint8Array(32);

    // Use a specific info string for the application
    const info = new TextEncoder().encode("PQCHAT-AES-KEY");

    // Import the shared secret as a key
    const sharedKey = await crypto.subtle.importKey(
      "raw",
      sharedSecret,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    // Derive the AES key
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "HKDF",
        salt: salt,
        info: info,
        hash: "SHA-256",
      },
      sharedKey,
      256 // 32 bytes = 256 bits
    );

    return new Uint8Array(derivedBits);
  } catch (error) {
    console.error("Error deriving AES key:", error);
    throw new Error("Failed to derive AES key");
  }
}
