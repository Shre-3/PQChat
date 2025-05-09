import { MlKem768 } from "./mlkem";

// Kyber key sizes (using Kyber768)
const KYBER_PUBLIC_KEY_SIZE = 1184;
const KYBER_PRIVATE_KEY_SIZE = 2400;
const KYBER_CIPHERTEXT_SIZE = 1088;
const KYBER_SHARED_SECRET_SIZE = 32;

/**
 * Generate a new Kyber key pair
 * @returns {Promise<[Uint8Array, Uint8Array]>} The generated key pair [publicKey, privateKey]
 */
export async function generateKyberKeyPair() {
  try {
    console.log("Generating Kyber key pair...");
    const mlkem = new MlKem768();
    const keys = await mlkem.keypair();

    console.log("Public key size:", keys.publicKey.length);
    console.log("Private key size:", keys.privateKey.length);

    return [keys.publicKey, keys.privateKey];
  } catch (error) {
    console.error("Error generating Kyber key pair:", error);
    throw error;
  }
}

/**
 * Encapsulate a shared secret using a public key
 * @param {Uint8Array} publicKey - The public key to use for encapsulation
 * @returns {Promise<[Uint8Array, Uint8Array]>} The ciphertext and shared secret
 */
export async function encapsulate(publicKey) {
  try {
    if (publicKey.length !== KYBER_PUBLIC_KEY_SIZE) {
      throw new Error(
        `Invalid public key size: ${publicKey.length}, expected ${KYBER_PUBLIC_KEY_SIZE}`
      );
    }

    console.log("Encapsulating shared secret...");
    const mlkem = new MlKem768();
    const result = await mlkem.enc(publicKey);

    console.log("Encapsulation successful");
    return [result.ciphertext, result.sharedSecret];
  } catch (error) {
    console.error("Error in encapsulate:", error);
    throw error;
  }
}

/**
 * Decapsulate a shared secret using a private key
 * @param {Uint8Array} ciphertext - The ciphertext to decapsulate
 * @param {Uint8Array} privateKey - The private key to use for decapsulation
 * @returns {Promise<Uint8Array>} The decapsulated shared secret
 */
export async function decapsulate(ciphertext, privateKey) {
  try {
    if (ciphertext.length !== KYBER_CIPHERTEXT_SIZE) {
      throw new Error(
        `Invalid ciphertext size: ${ciphertext.length}, expected ${KYBER_CIPHERTEXT_SIZE}`
      );
    }
    if (privateKey.length !== KYBER_PRIVATE_KEY_SIZE) {
      throw new Error(
        `Invalid private key size: ${privateKey.length}, expected ${KYBER_PRIVATE_KEY_SIZE}`
      );
    }

    console.log("Decapsulating shared secret...");
    const mlkem = new MlKem768();
    const sharedSecret = await mlkem.dec(ciphertext, privateKey);

    console.log("Decapsulation successful");
    return sharedSecret;
  } catch (error) {
    console.error("Error in decapsulate:", error);
    throw error;
  }
}
