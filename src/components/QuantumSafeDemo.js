import React, { useState } from "react";
import { KyberKEM, DilithiumSignature } from "../utils/quantum-safe";

const QuantumSafeDemo = () => {
  const [kyberStatus, setKyberStatus] = useState("Not tested");
  const [dilithiumStatus, setDilithiumStatus] = useState("Not tested");
  const [message, setMessage] = useState("Hello, quantum-safe world!");
  const [signature, setSignature] = useState("");
  const [verificationResult, setVerificationResult] = useState("");
  const [loading, setLoading] = useState(false);

  const testKyber = async () => {
    setLoading(true);
    setKyberStatus("Testing...");
    try {
      const kyber = new KyberKEM();

      // Generate key pair
      const { publicKey, privateKey } = await kyber.generateKeyPair();
      console.log("Kyber public key size:", publicKey.length, "bytes");
      console.log("Kyber private key size:", privateKey.length, "bytes");

      // Encapsulate a shared secret
      const { ciphertext, sharedSecret } = await kyber.encapsulate(publicKey);
      console.log("Kyber ciphertext size:", ciphertext.length, "bytes");
      console.log("Kyber shared secret size:", sharedSecret.length, "bytes");

      // Decapsulate the shared secret
      const decapsulatedSecret = await kyber.decapsulate(
        ciphertext,
        privateKey
      );

      // Verify that the shared secrets match
      const secretsMatch =
        sharedSecret.length === decapsulatedSecret.length &&
        sharedSecret.every((byte, index) => byte === decapsulatedSecret[index]);

      if (secretsMatch) {
        setKyberStatus("✅ Kyber KEM is working correctly");
      } else {
        setKyberStatus("❌ Kyber KEM test failed");
      }
    } catch (error) {
      console.error("Kyber test error:", error);
      setKyberStatus(`❌ Kyber KEM error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testDilithium = async () => {
    setLoading(true);
    setDilithiumStatus("Testing...");
    try {
      const dilithium = new DilithiumSignature();

      // Generate key pair
      const { publicKey, privateKey } = await dilithium.generateKeyPair();
      console.log("Dilithium public key size:", publicKey.length, "bytes");
      console.log("Dilithium private key size:", privateKey.length, "bytes");

      // Sign a message
      const messageBytes = new TextEncoder().encode(message);
      const sig = await dilithium.sign(messageBytes, privateKey);
      console.log("Dilithium signature size:", sig.length, "bytes");
      setSignature(sig);

      // Verify the signature
      const isValid = await dilithium.verify(messageBytes, sig, publicKey);
      setVerificationResult(
        isValid ? "✅ Signature is valid" : "❌ Signature is invalid"
      );

      if (isValid) {
        setDilithiumStatus("✅ Dilithium signature is working correctly");
      } else {
        setDilithiumStatus("❌ Dilithium signature test failed");
      }
    } catch (error) {
      console.error("Dilithium test error:", error);
      setDilithiumStatus(`❌ Dilithium signature error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-6">
        Quantum-Safe Cryptography Demo
      </h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">
          Kyber Key Encapsulation Mechanism (KEM)
        </h2>
        <p className="mb-4">
          Kyber is a key encapsulation mechanism that is resistant to attacks
          from both classical and quantum computers. It was selected by NIST for
          standardization in the post-quantum cryptography process.
        </p>
        <button
          onClick={testKyber}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Test Kyber KEM
        </button>
        <p className="mt-2">{kyberStatus}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">
          Dilithium Digital Signature
        </h2>
        <p className="mb-4">
          Dilithium is a digital signature scheme that is resistant to quantum
          attacks. It was also selected by NIST for standardization.
        </p>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Message to sign:
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>
        <button
          onClick={testDilithium}
          disabled={loading}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Test Dilithium Signature
        </button>
        <p className="mt-2">{dilithiumStatus}</p>
        {verificationResult && <p className="mt-2">{verificationResult}</p>}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">
          Quantum-Safety Verification
        </h2>
        <p className="mb-2">This implementation is quantum-safe because:</p>
        <ul className="list-disc pl-5">
          <li>
            It uses NIST-approved post-quantum cryptography algorithms (Kyber
            and Dilithium)
          </li>
          <li>
            These algorithms are based on mathematical problems that are
            believed to be hard even for quantum computers
          </li>
          <li>The implementations follow the NIST specifications</li>
          <li>
            The key sizes and security parameters match the NIST recommendations
          </li>
        </ul>
        <p className="mt-4">
          For more information, visit the{" "}
          <a
            href="https://csrc.nist.gov/projects/post-quantum-cryptography"
            className="text-blue-500 hover:underline"
          >
            NIST Post-Quantum Cryptography page
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default QuantumSafeDemo;
