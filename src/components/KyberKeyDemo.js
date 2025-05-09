import React, { useState, useEffect } from "react";
import { MlKem768 } from "../utils/mlkem";
import KeyDisplay from "./KeyDisplay";

const KyberKeyDemo = () => {
  const [keys, setKeys] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("pqchat-kyber-keys");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setKeys({
          kyberPublic: new Uint8Array(parsed.kyberPublic),
          kyberPrivate: new Uint8Array(parsed.kyberPrivate),
        });
        return;
      } catch (e) {
        // If parsing fails, fall through to generate new keys
        localStorage.removeItem("pqchat-kyber-keys");
      }
    }
    generateKeyPair();
  }, []);

  const generateKeyPair = async () => {
    try {
      const mlkem = new MlKem768();
      const result = await mlkem.keypair();
      const keyObj = {
        kyberPublic: Array.from(result.publicKey),
        kyberPrivate: Array.from(result.privateKey),
      };
      setKeys({
        kyberPublic: result.publicKey,
        kyberPrivate: result.privateKey,
      });
      localStorage.setItem("pqchat-kyber-keys", JSON.stringify(keyObj));
    } catch (err) {
      console.error("Error generating ML-KEM key pair:", err);
    }
  };

  if (!keys) {
    return <div>Generating keys...</div>;
  }

  return <KeyDisplay keys={keys} />;
};

export default KyberKeyDemo;
