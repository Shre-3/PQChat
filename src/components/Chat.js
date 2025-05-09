import React, { useState, useEffect, useRef } from "react";
import { generateKyberKeyPair, encapsulate, decapsulate } from "../utils/kyber";
import { encrypt, decrypt, deriveKey } from "../utils/aes";

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [keyPair, setKeyPair] = useState(null);
  const [recipientPublicKey, setRecipientPublicKey] = useState(null);
  const [sharedSecrets, setSharedSecrets] = useState(new Map());
  const [ws, setWs] = useState(null);
  const [myPublicKey, setMyPublicKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef(null);

  // Initialize WebSocket connection and keys
  useEffect(() => {
    const initializeKeys = async () => {
      try {
        const kyberKeys = await generateKyberKeyPair();
        console.log("Generated Kyber keys");
        setKeyPair(kyberKeys);
        setMyPublicKey(Buffer.from(kyberKeys.publicKey).toString("base64"));
      } catch (error) {
        console.error("Failed to initialize keys:", error);
      }
    };
    initializeKeys();
  }, []);

  useEffect(() => {
    if (!keyPair) return;

    let reconnectTimeout;
    const connectWebSocket = () => {
      console.log("Connecting to WebSocket...");
      const socket = new WebSocket("ws://localhost:8080");

      socket.onopen = () => {
        console.log("WebSocket connected");
        // Register with server using our public key
        socket.send(
          JSON.stringify({
            type: "register",
            kyberPublicKey: Array.from(keyPair.publicKey),
          })
        );
      };

      socket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received message type:", data.type);

          switch (data.type) {
            case "key_exchange":
              await handleKeyExchange(data);
              break;
            case "key_exchange_response":
              await handleKeyExchangeResponse(data);
              break;
            case "message":
              await handleReceiveMessage(data);
              break;
          }
        } catch (error) {
          console.error("Error processing message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected, attempting to reconnect...");
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        reconnectTimeout = setTimeout(connectWebSocket, 2000);
      };

      setWs(socket);
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [keyPair]);

  const handleKeyExchange = async (data) => {
    try {
      const senderPublicKey = new Uint8Array(data.senderPublicKey);
      const kyberCiphertext = new Uint8Array(data.kyberCiphertext);

      // Decapsulate the shared secret
      const sharedSecret = await decapsulate(
        kyberCiphertext,
        keyPair.privateKey
      );

      // Store the shared secret
      setSharedSecrets((prev) =>
        new Map(prev).set(
          Buffer.from(senderPublicKey).toString("base64"),
          sharedSecret
        )
      );

      // Send response back to sender
      ws.send(
        JSON.stringify({
          type: "key_exchange_response",
          originalSenderPublicKey:
            Buffer.from(senderPublicKey).toString("base64"),
          sharedSecret: Array.from(sharedSecret),
        })
      );
    } catch (error) {
      console.error("Error handling key exchange:", error);
    }
  };

  const handleKeyExchangeResponse = async (data) => {
    try {
      const senderPublicKey = new Uint8Array(data.senderPublicKey);
      const sharedSecret = new Uint8Array(data.sharedSecret);

      // Store the shared secret
      setSharedSecrets((prev) =>
        new Map(prev).set(
          Buffer.from(senderPublicKey).toString("base64"),
          sharedSecret
        )
      );
    } catch (error) {
      console.error("Error handling key exchange response:", error);
    }
  };

  const initiateKeyExchange = async (recipientKey) => {
    try {
      // Encapsulate a shared secret with recipient's public key
      const { ciphertext: kyberCiphertext, sharedSecret } = await encapsulate(
        new Uint8Array(recipientKey)
      );

      // Store the shared secret
      setSharedSecrets((prev) =>
        new Map(prev).set(
          Buffer.from(recipientKey).toString("base64"),
          sharedSecret
        )
      );

      // Send key exchange message
      ws.send(
        JSON.stringify({
          type: "key_exchange",
          recipientPublicKey: Buffer.from(recipientKey).toString("base64"),
          kyberCiphertext: Array.from(kyberCiphertext),
        })
      );
    } catch (error) {
      console.error("Error initiating key exchange:", error);
    }
  };

  const handleSetRecipientKey = async (value) => {
    try {
      const recipientKey = new Uint8Array(JSON.parse(value));
      setRecipientPublicKey(recipientKey);

      // Automatically initiate key exchange
      await initiateKeyExchange(recipientKey);
    } catch (error) {
      console.error("Invalid public key format:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !recipientPublicKey || !ws) return;

    try {
      const recipientKeyBase64 =
        Buffer.from(recipientPublicKey).toString("base64");
      const sharedSecret = sharedSecrets.get(recipientKeyBase64);

      if (!sharedSecret) {
        console.error("No shared secret available for recipient");
        return;
      }

      console.log("🔒 Encrypting message:", newMessage);
      console.log(
        "Using shared secret:",
        Buffer.from(sharedSecret).toString("base64").slice(0, 32) + "..."
      );

      // Encrypt message with AES-GCM using the shared secret
      const messageBytes = new TextEncoder().encode(newMessage);
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const aesKey = await deriveKey(sharedSecret, salt);
      const { ciphertext, iv } = await encrypt(messageBytes, aesKey);

      console.log("🔐 Encrypted data:", {
        ciphertextLength: ciphertext.length,
        ivLength: iv.length,
        saltLength: salt.length,
      });

      // Send encrypted message
      ws.send(
        JSON.stringify({
          type: "message",
          recipientPublicKey: Array.from(recipientPublicKey),
          encryptedData: {
            ciphertext: Array.from(ciphertext),
            iv: Array.from(iv),
            salt: Array.from(salt),
          },
        })
      );

      // Add message to chat
      setMessages((prev) => [
        ...prev,
        {
          text: newMessage,
          sender: "me",
          timestamp: new Date().toISOString(),
        },
      ]);

      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleReceiveMessage = async (data) => {
    try {
      const senderPublicKey = new Uint8Array(data.senderPublicKey);
      const senderKeyBase64 = Buffer.from(senderPublicKey).toString("base64");
      const sharedSecret = sharedSecrets.get(senderKeyBase64);

      if (!sharedSecret) {
        console.error("No shared secret available for sender");
        return;
      }

      console.log(
        "🔑 Using shared secret for decryption:",
        Buffer.from(sharedSecret).toString("base64").slice(0, 32) + "..."
      );

      const encryptedData = {
        ciphertext: new Uint8Array(data.encryptedData.ciphertext),
        iv: new Uint8Array(data.encryptedData.iv),
        salt: new Uint8Array(data.encryptedData.salt),
      };

      console.log("📦 Received encrypted data:", {
        ciphertextLength: encryptedData.ciphertext.length,
        ivLength: encryptedData.iv.length,
        saltLength: encryptedData.salt.length,
      });

      // Derive AES key and decrypt the message
      const aesKey = await deriveKey(sharedSecret, encryptedData.salt);
      const decryptedBytes = await decrypt(
        encryptedData.ciphertext,
        aesKey,
        encryptedData.iv
      );
      const decryptedText = new TextDecoder().decode(decryptedBytes);

      console.log("🔓 Decrypted message:", decryptedText);

      // Add decrypted message to chat
      setMessages((prev) => [
        ...prev,
        {
          text: decryptedText,
          sender: "other",
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Failed to receive message:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCopyPublicKey = () => {
    navigator.clipboard.writeText(myPublicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">PQChat</h1>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">
                Your Public Key
              </h2>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={myPublicKey || ""}
                  readOnly
                  className="flex-1 p-2 text-sm bg-white border border-gray-300 rounded-md font-mono"
                />
                <button
                  onClick={handleCopyPublicKey}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">
                Recipient's Public Key
              </h2>
              <textarea
                placeholder="Paste recipient's public key here..."
                className="w-full p-2 text-sm bg-white border border-gray-300 rounded-md font-mono"
                rows="2"
                onChange={(e) => handleSetRecipientKey(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.sender === "me" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-sm p-3 rounded-lg shadow-sm ${
                  message.sender === "me"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-800"
                }`}
              >
                <p className="text-sm">{message.text}</p>
                <span className="text-xs opacity-75 mt-1 block">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
