import React, { useState, useEffect } from "react";
import { generateKyberKeyPair, encapsulate, decapsulate } from "../utils/kyber";

const KeyExchange = ({ socket, roomId, userId, onKeyExchangeComplete }) => {
  const [publicKey, setPublicKey] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState("unverified");
  const [error, setError] = useState(null);

  useEffect(() => {
    // Generate key pair when component mounts
    const initializeKeyPair = async () => {
      try {
        console.log("Initializing key pair...");
        const [pubKey, privKey] = await generateKyberKeyPair();
        setPublicKey(pubKey);
        setPrivateKey(privKey);
        console.log("Key pair generated successfully");
      } catch (err) {
        console.error("Failed to generate key pair:", err);
        setError("Failed to generate key pair");
      }
    };

    initializeKeyPair();

    // Listen for public key from other user
    socket.on("public_key", async (data) => {
      if (data.userId !== userId) {
        try {
          console.log("Received public key from:", data.userId);
          const [ciphertext, secret] = await encapsulate(data.publicKey);
          onKeyExchangeComplete(secret);

          // Send ciphertext back to the other user
          socket.emit("ciphertext", {
            roomId,
            userId,
            targetUserId: data.userId,
            ciphertext,
          });

          console.log("Key exchange completed successfully");
          setVerificationStatus("verified");
        } catch (err) {
          console.error("Failed to encapsulate:", err);
          setError("Failed to complete key exchange");
        }
      }
    });

    // Listen for ciphertext from other user
    socket.on("ciphertext", async (data) => {
      if (data.userId !== userId) {
        try {
          console.log("Received ciphertext from:", data.userId);
          const secret = await decapsulate(data.ciphertext, privateKey);
          onKeyExchangeComplete(secret);

          console.log("Key exchange completed successfully");
          setVerificationStatus("verified");
        } catch (err) {
          console.error("Failed to decapsulate:", err);
          setError("Failed to complete key exchange");
        }
      }
    });

    return () => {
      socket.off("public_key");
      socket.off("ciphertext");
    };
  }, [socket, roomId, userId, privateKey, onKeyExchangeComplete]);

  const handleVerify = () => {
    if (publicKey) {
      console.log("Sending public key to room:", roomId);
      socket.emit("public_key", {
        roomId,
        userId,
        publicKey,
      });
    }
  };

  return (
    <div className="key-exchange">
      <div className="verification-status">Status: {verificationStatus}</div>
      {error && <div className="error">{error}</div>}
      <button
        onClick={handleVerify}
        disabled={!publicKey || verificationStatus === "verified"}
      >
        Verify
      </button>
    </div>
  );
};

export default KeyExchange;
