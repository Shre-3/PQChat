import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { generateKyberKeyPair, encapsulate, decapsulate } from "../utils/kyber";
import { generateDilithiumKeyPair, sign, verify } from "../utils/dilithium";
import { encrypt, decrypt, deriveKey } from "../utils/aes";

// Firestore collection names
const USERS_COLLECTION = "users";
const MESSAGES_COLLECTION = "messages";

/**
 * Interface for user's cryptographic keys
 */
export interface UserKeys {
  kyberPublicKey: Uint8Array;
  kyberPrivateKey: Uint8Array;
  dilithiumPublicKey: Uint8Array;
  dilithiumPrivateKey: Uint8Array;
}

/**
 * Interface for encrypted message data
 */
interface EncryptedMessage {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
  signature: Uint8Array;
  encapsulatedKey: Uint8Array;
  senderId: string;
  recipientId: string;
  timestamp: number;
}

/**
 * Generates and stores cryptographic keys for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<UserKeys>} The generated keys
 */
export async function initializeUserKeys(userId: string): Promise<UserKeys> {
  try {
    // Check if user already has keys
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (userDoc.exists() && userDoc.data().kyberPublicKey) {
      // Convert stored keys back to Uint8Array
      const data = userDoc.data();
      return {
        kyberPublicKey: new Uint8Array(data.kyberPublicKey),
        kyberPrivateKey: new Uint8Array(data.kyberPrivateKey),
        dilithiumPublicKey: new Uint8Array(data.dilithiumPublicKey),
        dilithiumPrivateKey: new Uint8Array(data.dilithiumPrivateKey),
      };
    }

    // Generate new key pairs
    const kyberKeys = await generateKyberKeyPair();
    const dilithiumKeys = await generateDilithiumKeyPair();

    // Store keys in Firestore
    await setDoc(doc(db, USERS_COLLECTION, userId), {
      kyberPublicKey: Array.from(kyberKeys.publicKey),
      kyberPrivateKey: Array.from(kyberKeys.privateKey),
      dilithiumPublicKey: Array.from(dilithiumKeys.publicKey),
      dilithiumPrivateKey: Array.from(dilithiumKeys.privateKey),
      createdAt: Date.now(),
    });

    return {
      kyberPublicKey: kyberKeys.publicKey,
      kyberPrivateKey: kyberKeys.privateKey,
      dilithiumPublicKey: dilithiumKeys.publicKey,
      dilithiumPrivateKey: dilithiumKeys.privateKey,
    };
  } catch (error) {
    console.error("Error initializing user keys:", error);
    throw new Error("Failed to initialize user keys");
  }
}

/**
 * Retrieves a user's public keys from Firestore
 * @param {string} userId - The user's ID
 * @returns {Promise<{kyberPublicKey: Uint8Array, dilithiumPublicKey: Uint8Array}>} The user's public keys
 */
export async function getUserPublicKeys(userId: string): Promise<{
  kyberPublicKey: Uint8Array;
  dilithiumPublicKey: Uint8Array;
}> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (!userDoc.exists()) {
      throw new Error("User not found");
    }

    const data = userDoc.data();
    return {
      kyberPublicKey: new Uint8Array(data.kyberPublicKey),
      dilithiumPublicKey: new Uint8Array(data.dilithiumPublicKey),
    };
  } catch (error) {
    console.error("Error getting user public keys:", error);
    throw new Error("Failed to get user public keys");
  }
}

/**
 * Sends an encrypted message to a recipient
 * @param {string} message - The plaintext message
 * @param {string} senderId - The sender's ID
 * @param {string} recipientId - The recipient's ID
 * @param {UserKeys} senderKeys - The sender's keys
 * @returns {Promise<string>} The ID of the sent message
 */
export async function sendEncryptedMessage(
  message: string,
  senderId: string,
  recipientId: string,
  senderKeys: UserKeys
): Promise<string> {
  try {
    // Get recipient's public keys
    const recipientKeys = await getUserPublicKeys(recipientId);

    // Encapsulate a shared secret using recipient's Kyber public key
    const { ciphertext: encapsulatedKey, sharedSecret } = await encapsulate(
      recipientKeys.kyberPublicKey
    );

    // Derive an AES key from the shared secret
    const aesKey = await deriveKey(sharedSecret);

    // Encrypt the message
    const { ciphertext, iv, tag } = await encrypt(message, aesKey);

    // Sign the plaintext message
    const messageBytes = new TextEncoder().encode(message);
    const signature = await sign(messageBytes, senderKeys.dilithiumPrivateKey);

    // Create the message document
    const messageData: EncryptedMessage = {
      ciphertext,
      iv,
      tag,
      signature,
      encapsulatedKey,
      senderId,
      recipientId,
      timestamp: Date.now(),
    };

    // Store the encrypted message in Firestore
    const messageRef = doc(db, MESSAGES_COLLECTION);
    await setDoc(messageRef, {
      ...messageData,
      // Convert Uint8Arrays to regular arrays for Firestore
      ciphertext: Array.from(ciphertext),
      iv: Array.from(iv),
      tag: Array.from(tag),
      signature: Array.from(signature),
      encapsulatedKey: Array.from(encapsulatedKey),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending encrypted message:", error);
    throw new Error("Failed to send encrypted message");
  }
}

/**
 * Decrypts and verifies a received message
 * @param {EncryptedMessage} encryptedMessage - The encrypted message data
 * @param {UserKeys} recipientKeys - The recipient's keys
 * @returns {Promise<{message: string, senderId: string}>} The decrypted message and sender ID
 */
export async function decryptMessage(
  encryptedMessage: EncryptedMessage,
  recipientKeys: UserKeys
): Promise<{ message: string; senderId: string }> {
  try {
    // Get sender's public keys
    const senderKeys = await getUserPublicKeys(encryptedMessage.senderId);

    // Decapsulate the shared secret
    const sharedSecret = await decapsulate(
      encryptedMessage.encapsulatedKey,
      recipientKeys.kyberPrivateKey
    );

    // Derive the AES key
    const aesKey = await deriveKey(sharedSecret);

    // Decrypt the message
    const decryptedMessage = await decrypt(
      encryptedMessage.ciphertext,
      aesKey,
      encryptedMessage.iv,
      encryptedMessage.tag
    );

    // Verify the signature
    const messageBytes = new TextEncoder().encode(decryptedMessage);
    const isValid = await verify(
      messageBytes,
      encryptedMessage.signature,
      senderKeys.dilithiumPublicKey
    );

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    return {
      message: decryptedMessage,
      senderId: encryptedMessage.senderId,
    };
  } catch (error) {
    console.error("Error decrypting message:", error);
    throw new Error("Failed to decrypt message");
  }
}
