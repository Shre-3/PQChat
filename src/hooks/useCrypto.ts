import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import {
  initializeUserKeys,
  sendEncryptedMessage,
  decryptMessage,
} from "../services/cryptoService";
import { UserKeys } from "../services/cryptoService";

export function useCrypto() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserKeys | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize cryptographic keys on mount
  useEffect(() => {
    async function initializeKeys() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userKeys = await initializeUserKeys(user.uid);
        setKeys(userKeys);
        setError(null);
      } catch (err) {
        console.error("Error initializing keys:", err);
        setError("Failed to initialize cryptographic keys");
      } finally {
        setLoading(false);
      }
    }

    initializeKeys();
  }, [user]);

  // Send an encrypted message
  const sendMessage = async (
    message: string,
    recipientId: string
  ): Promise<string> => {
    if (!user || !keys) {
      throw new Error("User not authenticated or keys not initialized");
    }

    try {
      const messageId = await sendEncryptedMessage(
        message,
        user.uid,
        recipientId,
        keys
      );
      return messageId;
    } catch (err) {
      console.error("Error sending message:", err);
      throw new Error("Failed to send encrypted message");
    }
  };

  // Decrypt a received message
  const decryptReceivedMessage = async (
    encryptedMessage: any
  ): Promise<{
    message: string;
    senderId: string;
  }> => {
    if (!keys) {
      throw new Error("Keys not initialized");
    }

    try {
      // Convert Firestore arrays back to Uint8Arrays
      const messageData = {
        ...encryptedMessage,
        ciphertext: new Uint8Array(encryptedMessage.ciphertext),
        iv: new Uint8Array(encryptedMessage.iv),
        tag: new Uint8Array(encryptedMessage.tag),
        signature: new Uint8Array(encryptedMessage.signature),
        encapsulatedKey: new Uint8Array(encryptedMessage.encapsulatedKey),
      };

      const result = await decryptMessage(messageData, keys);
      return result;
    } catch (err) {
      console.error("Error decrypting message:", err);
      throw new Error("Failed to decrypt message");
    }
  };

  return {
    keys,
    loading,
    error,
    sendMessage,
    decryptReceivedMessage,
  };
}
