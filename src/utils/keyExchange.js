import { kyberEncapsulate, kyberDecapsulate } from "./kyber";
import { dilithiumSign, dilithiumVerify } from "./dilithium";
import { generateAESKey } from "./crypto";

// Constants for key sizes
const KYBER_PUBLIC_KEY_SIZE = 1568; // For Kyber768
const KYBER_CIPHERTEXT_SIZE = 1632; // For Kyber768
const DILITHIUM_SIGNATURE_SIZE = 2701; // For Dilithium3
const DILITHIUM_PUBLIC_KEY_SIZE = 1952; // For Dilithium3

/**
 * Prepares the key exchange data from Alice to Bob
 * @param {Uint8Array} bobKyberPublicKey - Bob's Kyber public key
 * @param {Uint8Array} aliceKyberPublicKey - Alice's Kyber public key
 * @param {Uint8Array} aliceDilithiumPrivateKey - Alice's Dilithium private key
 * @param {Uint8Array} aliceDilithiumPublicKey - Alice's Dilithium public key
 * @returns {Object} The key exchange data to be sent to Bob
 */
export async function prepareKeyExchange(
  bobKyberPublicKey,
  aliceKyberPublicKey,
  aliceDilithiumPrivateKey,
  aliceDilithiumPublicKey
) {
  // Step 1: Generate ciphertext and shared secret using Bob's public key
  const { ciphertext, sharedSecret } = await kyberEncapsulate(
    bobKyberPublicKey
  );

  // Step 2: Sign the ciphertext using Alice's Dilithium private key
  const signature = await dilithiumSign(ciphertext, aliceDilithiumPrivateKey);

  // Step 3: Prepare the data to send to Bob
  return {
    ciphertext,
    signature,
    aliceKyberPublicKey,
    aliceDilithiumPublicKey,
    sharedSecret, // This will be used to derive the AES key
  };
}

/**
 * Processes the key exchange data received by Bob
 * @param {Object} keyExchangeData - The data received from Alice
 * @param {Uint8Array} bobKyberPrivateKey - Bob's Kyber private key
 * @returns {Object} The processed key exchange result
 */
export async function processKeyExchange(keyExchangeData, bobKyberPrivateKey) {
  const { ciphertext, signature, aliceDilithiumPublicKey } = keyExchangeData;

  // Step 1: Verify the signature using Alice's Dilithium public key
  const isValid = await dilithiumVerify(
    ciphertext,
    signature,
    aliceDilithiumPublicKey
  );

  if (!isValid) {
    throw new Error("Invalid signature in key exchange");
  }

  // Step 2: Derive the shared secret using Bob's private key
  const sharedSecret = await kyberDecapsulate(ciphertext, bobKyberPrivateKey);

  return {
    sharedSecret,
    isValid,
  };
}

/**
 * Derives an AES key from the shared secret
 * @param {Uint8Array} sharedSecret - The shared secret from key exchange
 * @returns {Object} The derived AES key and initialization vector
 */
export async function deriveAESKey(sharedSecret) {
  return generateAESKey(sharedSecret);
}

/**
 * Encrypts a message using AES-GCM
 * @param {string} message - The message to encrypt
 * @param {Object} aesKey - The AES key object from deriveAESKey
 * @returns {Object} The encrypted message and authentication tag
 */
export async function encryptMessage(message, aesKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: aesKey.iv,
    },
    aesKey.key,
    data
  );

  return {
    encryptedData: new Uint8Array(encryptedData),
    iv: aesKey.iv,
  };
}

/**
 * Decrypts a message using AES-GCM
 * @param {Uint8Array} encryptedData - The encrypted message
 * @param {Object} aesKey - The AES key object from deriveAESKey
 * @returns {string} The decrypted message
 */
export async function decryptMessage(encryptedData, aesKey) {
  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: aesKey.iv,
    },
    aesKey.key,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}
