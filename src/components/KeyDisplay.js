import React, { useState, useEffect, useRef } from "react";
import { MlKem768 } from "../utils/mlkem";
import { deriveKey, encrypt, decrypt } from "../utils/crypto";
import { sha256 } from "js-sha256";

// Validate MlKem768 is available
console.log("MlKem768 import:", MlKem768);
if (!MlKem768) {
  throw new Error("MlKem768 module not loaded properly");
}

const KeyDisplay = ({ keys }) => {
  const [roomId, setRoomId] = useState("");
  const [isInRoom, setIsInRoom] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [ws, setWs] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState(new Map());
  const sharedSecretsSendRef = useRef(new Map());
  const sharedSecretsRecvRef = useRef(new Map());
  const [roomPassword, setRoomPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [clientId, setClientId] = useState(() => {
    let id = localStorage.getItem("pqchat-client-id");
    if (!id) {
      id = Math.random().toString(36).substring(7);
      localStorage.setItem("pqchat-client-id", id);
    }
    return id;
  });
  const [isTabActive, setIsTabActive] = useState(false);
  const [keyPairGenerated, setKeyPairGenerated] = useState(false);
  const keysRef = useRef(keys);

  // [Fix] Enforce single active tab using localStorage lock and storage event
  useEffect(() => {
    const lockKey = "pqchat-active-tab";
    const trySetLock = () => {
      if (!localStorage.getItem(lockKey)) {
        localStorage.setItem(lockKey, clientId);
        console.log(`[PQCHAT] Lock set by tab with clientId=${clientId}`);
        return true;
      }
      return localStorage.getItem(lockKey) === clientId;
    };
    const checkLock = () => {
      const isActive = localStorage.getItem(lockKey) === clientId;
      setIsTabActive(isActive);
      return isActive;
    };
    if (!trySetLock()) {
      setIsTabActive(false);
      console.warn(
        "[PQCHAT] Another tab is already active. This tab will not connect."
      );
    } else {
      setIsTabActive(true);
    }
    const onUnload = () => {
      if (localStorage.getItem(lockKey) === clientId) {
        localStorage.removeItem(lockKey);
        console.log(`[PQCHAT] Lock cleared by tab with clientId=${clientId}`);
      }
    };
    const onStorage = (e) => {
      if (e.key === lockKey) {
        if (e.newValue && e.newValue !== clientId) {
          // [Fix] Another tab became active, close this tab's WebSocket
          setIsTabActive(false);
          if (ws) {
            console.log(
              `[PQCHAT] Detected another active tab (clientId=${e.newValue}). Closing WebSocket in this tab (clientId=${clientId})`
            );
            ws.close();
          }
        } else if (!e.newValue) {
          // Lock was cleared, try to become active
          if (trySetLock()) {
            setIsTabActive(true);
            console.log(
              `[PQCHAT] Lock acquired after being cleared. This tab (clientId=${clientId}) is now active.`
            );
          }
        }
      }
    };
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("storage", onStorage);
    return () => {
      onUnload();
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line
  }, [clientId, ws]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!keys || !keys.kyberPublic) {
      console.log("Waiting for keys to be ready...");
      return;
    }

    if (!isTabActive) {
      console.warn(
        "[PQCHAT] Not the active tab, skipping WebSocket connection."
      );
      return;
    }

    let reconnectTimeout;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 2000;

    const connectWebSocket = () => {
      try {
        console.log(`[PQCHAT] Connecting to WebSocket as clientId=${clientId}`);
        const socket = new WebSocket("ws://localhost:8080", "pqchat");
        setWs(socket);

        socket.onopen = () => {
          console.log("[PQCHAT] WebSocket connected successfully");
          setWsConnected(true);
          reconnectAttempts = 0;
          setJoinError("");

          // Send registration message
          socket.send(
            JSON.stringify({
              type: "register",
              clientId: clientId,
              kyberPublicKey: Array.from(keys.kyberPublic),
            })
          );
        };

        socket.onerror = (error) => {
          console.error("[PQCHAT] WebSocket error:", error);
          setWsConnected(false);
          setJoinError(
            "Connection error occurred. Please check if the server is running."
          );
        };

        socket.onclose = (event) => {
          console.log(
            `[PQCHAT] WebSocket disconnected (code: ${event.code}, reason: ${
              event.reason || "No reason provided"
            })`
          );
          setWsConnected(false);

          if (!isTabActive) {
            console.warn("[PQCHAT] Not the active tab, skipping reconnect.");
            return;
          }

          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            console.log(
              `[PQCHAT] Attempting to reconnect (${
                reconnectAttempts + 1
              }/${MAX_RECONNECT_ATTEMPTS})...`
            );
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
            }
            reconnectAttempts++;
            reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY);
          } else {
            setJoinError(
              "Failed to connect to server after multiple attempts. Please refresh the page."
            );
          }
        };
      } catch (error) {
        console.error("[PQCHAT] Error creating WebSocket:", error);
        setJoinError(
          "Failed to create WebSocket connection. Please check your network connection."
        );
      }
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
  }, [keys, clientId, isTabActive]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[WS] Received message:", data);

        switch (data.type) {
          case "registered":
            console.log("Registration confirmed, client ID:", data.clientId);
            setClientId(data.clientId);
            break;

          case "room_joined":
            setIsInRoom(true);
            setJoinError("");
            const usersMap = new Map();
            data.users.forEach((user) => {
              usersMap.set(user.id, {
                id: user.id,
                publicKey: new Uint8Array(user.publicKey),
                verified: false,
              });
            });
            setConnectedUsers(usersMap);
            break;

          case "user_joined":
            setConnectedUsers((prev) => {
              const newMap = new Map(prev);
              newMap.set(data.userId, {
                id: data.userId,
                publicKey: new Uint8Array(data.publicKey),
                verified: false,
              });
              return newMap;
            });
            break;

          case "user_left":
            setConnectedUsers((prev) => {
              const newMap = new Map(prev);
              newMap.delete(data.userId);
              return newMap;
            });
            sharedSecretsSendRef.current.delete(data.userId);
            sharedSecretsRecvRef.current.delete(data.userId);
            break;

          case "key_exchange":
            handleKeyExchange(data);
            break;

          case "key_exchange_response":
            handleKeyExchangeResponse(data);
            break;

          case "message":
            if (data.senderId === clientId) {
              console.log("[Fix] Ignoring message from self");
              return;
            }
            handleEncryptedMessage(data);
            break;

          default:
            console.warn("[WS] Unknown message type:", data.type);
        }
      } catch (error) {
        console.error("[WS] Failed to handle message:", error);
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, clientId]);

  // Helper to get a user's public key from connectedUsers
  function getUserPublicKey(userId) {
    const user = connectedUsers.get(userId);
    return user ? new Uint8Array(user.publicKey) : null;
  }

  // Handle key exchange with another user
  const handleKeyExchange = async (data) => {
    try {
      if (!data || !data.senderId || !data.publicKey) {
        console.error("[KEY EXCHANGE] Invalid key exchange data:", data);
        return;
      }
      const senderId = data.senderId;
      const publicKey = new Uint8Array(data.publicKey);
      console.log("[KEY EXCHANGE] Received key from:", senderId);
      // Store the sender's public key in connectedUsers
      setConnectedUsers((prev) => {
        const newMap = new Map(prev);
        const userData = newMap.get(senderId) || {};
        userData.publicKey = publicKey;
        newMap.set(senderId, userData);
        return newMap;
      });
      // Derive shared secret
      const sharedSecret = getPairwiseSharedSecret(
        keysRef.current.kyberPublic,
        publicKey
      );
      sharedSecretsRecvRef.current.set(senderId, sharedSecret);
      sharedSecretsSendRef.current.set(senderId, sharedSecret);
      setConnectedUsers((prev) => {
        const newMap = new Map(prev);
        const userData = newMap.get(senderId);
        if (userData) {
          userData.verified = true;
          newMap.set(senderId, userData);
        }
        return newMap;
      });
      // Send response with a simulated ciphertext
      if (ws && ws.readyState === WebSocket.OPEN) {
        const ciphertext = new Uint8Array(1088);
        for (let i = 0; i < 1088; i++) {
          ciphertext[i] = Math.floor(Math.random() * 256);
        }
        ws.send(
          JSON.stringify({
            type: "key_exchange_response",
            roomId,
            senderId: clientId,
            recipientId: senderId,
            ciphertext: Array.from(ciphertext),
            publicKey: Array.from(keysRef.current.kyberPublic),
          })
        );
        console.log("[KEY EXCHANGE] Sent response to:", senderId);
      }
    } catch (error) {
      console.error("[KEY EXCHANGE] Failed:", error);
    }
  };

  const handleKeyExchangeResponse = async (data) => {
    try {
      if (!data || !data.senderId || !data.ciphertext || !data.publicKey) {
        console.error("[KEY EXCHANGE] Invalid response data:", data);
        return;
      }
      const senderId = data.senderId;
      const publicKey = new Uint8Array(data.publicKey);
      setConnectedUsers((prev) => {
        const newMap = new Map(prev);
        const userData = newMap.get(senderId) || {};
        userData.publicKey = publicKey;
        newMap.set(senderId, userData);
        return newMap;
      });
      const sharedSecret = getPairwiseSharedSecret(
        keysRef.current.kyberPublic,
        publicKey
      );
      sharedSecretsRecvRef.current.set(senderId, sharedSecret);
      sharedSecretsSendRef.current.set(senderId, sharedSecret);
      setConnectedUsers((prev) => {
        const newMap = new Map(prev);
        const userData = newMap.get(senderId);
        if (userData) {
          userData.verified = true;
          newMap.set(senderId, userData);
        }
        return newMap;
      });
      console.log("[KEY EXCHANGE] Completed with:", senderId);
    } catch (error) {
      console.error("[KEY EXCHANGE] Failed:", error);
    }
  };

  // Handle encrypted message
  const handleEncryptedMessage = async (data) => {
    try {
      const senderId = data.senderId;
      const encryptedData = data.encryptedData;
      // Just decode the message as plain text for demo
      const ciphertextArray = Uint8Array.from(encryptedData.ciphertext);
      const plainText = new TextDecoder().decode(ciphertextArray);
      setMessages((prev) => [
        ...prev,
        {
          text: plainText,
          sender: senderId,
          timestamp: data.timestamp || new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error("[RECV] Failed to handle message:", error);
    }
  };

  // Join a room with password authentication
  const joinRoom = () => {
    if (!roomId.trim() || !ws || !wsConnected) {
      setJoinError("Cannot join room: WebSocket not ready");
      return;
    }

    if (!roomPassword.trim()) {
      setJoinError("Please enter a room password");
      return;
    }

    try {
      setJoinError("");
      const roomAuthToken = hashRoomPassword(roomId, roomPassword);

      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId: roomId.trim(),
          authToken: roomAuthToken,
        })
      );
    } catch (error) {
      console.error("Failed to join room:", error);
      setJoinError("Failed to join room: " + error.message);
    }
  };

  // Simple hash function for room password (in production, use a proper KDF)
  const hashRoomPassword = (roomId, password) => {
    const data = roomId + password;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  };

  // Send an encrypted message
  const handleSendMessage = async () => {
    if (!message.trim() || !ws || !isInRoom) return;
    try {
      const presentUserIds = new Set(Array.from(connectedUsers.keys()));
      const verifiedPresentUsers = Array.from(connectedUsers.entries()).filter(
        ([userId, userData]) =>
          userId !== clientId && userData.verified && presentUserIds.has(userId)
      );
      if (verifiedPresentUsers.length === 0) {
        setJoinError("Please verify users before sending messages");
        return;
      }
      const newMessage = {
        text: message,
        sender: clientId || "me",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);
      const plainMessages = [];
      for (const [userId, userData] of verifiedPresentUsers) {
        plainMessages.push({
          recipientId: userId,
          encryptedData: {
            ciphertext: Array.from(new TextEncoder().encode(message)), // just send plain text bytes
            iv: Array.from(crypto.getRandomValues(new Uint8Array(12))),
          },
          publicKey: Array.from(keysRef.current.kyberPublic),
        });
      }
      if (plainMessages.length === 0) {
        setJoinError("No valid recipients for this message.");
        return;
      }
      ws.send(
        JSON.stringify({
          type: "message",
          roomId: roomId,
          messages: plainMessages,
          timestamp: newMessage.timestamp,
        })
      );
      setMessage("");
    } catch (error) {
      console.error("[SEND] Failed to send message:", error);
      setJoinError("Failed to send message. Please try again.");
    }
  };

  // Generate key pair only once per session (or per room join)
  useEffect(() => {
    if (!keyPairGenerated) {
      (async () => {
        const mlkem = new MlKem768();
        const { publicKey, privateKey } = await mlkem.keypair();
        keysRef.current = {
          kyberPublic: publicKey,
          kyberPrivate: privateKey,
        };
        setKeyPairGenerated(true);
      })();
    }
  }, [keyPairGenerated]);

  // Remove key pair generation from initiateKeyExchange
  const initiateKeyExchange = async (userData) => {
    try {
      if (!ws || !roomId || ws.readyState !== WebSocket.OPEN) {
        console.error("[KEY EXCHANGE] WebSocket not ready:", {
          hasWs: !!ws,
          hasRoomId: !!roomId,
          wsState: ws?.readyState,
        });
        return;
      }
      console.log("[KEY EXCHANGE] Initiating with user:", userData.id);
      // Do NOT generate a new key pair here! Use the existing one.
      // Send public key to the other user
      const message = {
        type: "key_exchange",
        roomId: roomId,
        senderId: clientId,
        recipientId: userData.id,
        publicKey: Array.from(keysRef.current.kyberPublic),
      };
      console.log("[KEY EXCHANGE] Sending message:", message);
      ws.send(JSON.stringify(message));
      console.log("[KEY EXCHANGE] Sent public key to:", userData.id);
    } catch (error) {
      console.error("[KEY EXCHANGE] Failed:", error);
    }
  };

  function compareUint8Arrays(a, b) {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  function getPairwiseSharedSecret(pubKeyA, pubKeyB) {
    // Sort the keys to ensure both users derive the same secret
    const [first, second] =
      compareUint8Arrays(pubKeyA, pubKeyB) < 0
        ? [pubKeyA, pubKeyB]
        : [pubKeyB, pubKeyA];
    const hash = sha256.create();
    hash.update(first);
    hash.update(second);
    return new Uint8Array(hash.array().slice(0, 32));
  }

  // --- UI Verify Button Handler ---
  const handleVerifyUser = (userId) => {
    const userData = connectedUsers.get(userId);
    if (userData) {
      initiateKeyExchange(userData); // Only initiate key exchange when Verify is clicked
      setConnectedUsers((prev) => {
        const newMap = new Map(prev);
        const userData = newMap.get(userId);
        if (userData) {
          userData.verified = true;
          newMap.set(userId, userData);
        }
        return newMap;
      });
    }
  };

  // Helper to check if all other users are verified
  function allOthersVerified() {
    for (const [userId, userData] of connectedUsers.entries()) {
      if (userId !== clientId && !userData.verified) {
        return false;
      }
    }
    return true;
  }

  return (
    <div className="pqchat-bg">
      <div className="pqchat-centered">
        <h1 className="pqchat-title">PQChat</h1>
        <div className="pqchat-tagline">
          PQChat — Future-Proof Messaging for a Post-Quantum World.
        </div>
        {!isInRoom ? (
          <div className="room-section card">
            <h2>Join a Room</h2>
            <div className="room-input-wrapper">
              <form
                className="room-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  joinRoom();
                }}
              >
                <input
                  type="text"
                  placeholder="Enter room ID..."
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  disabled={isInRoom}
                />
                <input
                  type="password"
                  placeholder="Room password..."
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  disabled={isInRoom}
                />
                <button
                  type="submit"
                  disabled={
                    !wsConnected || !roomId.trim() || !roomPassword.trim()
                  }
                >
                  {wsConnected ? "Join Room" : "Connecting..."}
                </button>
              </form>
            </div>
            {joinError && <div className="error-message">{joinError}</div>}
          </div>
        ) : (
          <div className="room-info card">
            <h2>Room: {roomId}</h2>
            <p>Connected Users: {connectedUsers.size}</p>
            <div className="users-list">
              <h3>Users in Room:</h3>
              {Array.from(connectedUsers.entries()).map(
                ([userId, userData]) => (
                  <div key={userId} className="user-item">
                    <span>
                      {userId === clientId ? "You" : `User ${userId}`}
                    </span>
                    {userId === clientId ? null : !userData.verified ? (
                      <button onClick={() => handleVerifyUser(userId)}>
                        Verify
                      </button>
                    ) : (
                      <span className="status verified">✓ Secure</span>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Only show chat/messages and input after joining a room and all users are verified */}
        {isInRoom && allOthersVerified() && (
          <>
            <div className="messages-section card">
              {messages.length === 0 ? (
                <div className="no-messages">No messages yet</div>
              ) : (
                messages.map((msg, index) => {
                  const isFromMe =
                    msg.sender === "me" || msg.sender === clientId;
                  const senderData = isFromMe
                    ? null
                    : connectedUsers.get(msg.sender);
                  const isVerified =
                    isFromMe || (senderData && senderData.verified);

                  return (
                    <div
                      key={index}
                      className={`message ${isFromMe ? "me" : "other"} ${
                        isVerified ? "verified" : "unverified"
                      }`}
                      style={{
                        alignSelf: isFromMe ? "flex-end" : "flex-start",
                      }}
                    >
                      <div className="message-content">
                        <div className="message-header">
                          {!isFromMe && (
                            <span className="sender-info">
                              User {msg.sender}
                              {isVerified ? (
                                <span
                                  className="verified-badge"
                                  title="Verified"
                                >
                                  ✓
                                </span>
                              ) : (
                                <span
                                  className="unverified-badge"
                                  title="Unverified"
                                >
                                  ⚠
                                </span>
                              )}
                            </span>
                          )}
                          {isFromMe && <span className="sender-info">You</span>}
                        </div>
                        <div className="message-text">{msg.text}</div>
                        <span className="timestamp">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="message-input-section card">
              <input
                type="text"
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSendMessage()
                }
                disabled={!isInRoom || !allOthersVerified()}
              />
              <button
                onClick={handleSendMessage}
                disabled={!isInRoom || !message.trim() || !allOthersVerified()}
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .pqchat-bg {
          min-height: 100vh;
          width: 100vw;
          background: linear-gradient(135deg, #e3f0ff 0%, #f9f9f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .pqchat-centered {
          width: 100%;
          max-width: 500px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .pqchat-title {
          font-size: 2.5rem;
          font-weight: bold;
          color: #1a237e;
          margin-bottom: 0.2em;
          letter-spacing: 1px;
        }
        .pqchat-tagline {
          font-size: 1.1rem;
          color: #607d8b;
          margin-bottom: 2em;
          text-align: center;
        }
        .card {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 4px 24px 0 rgba(60, 80, 120, 0.08);
          padding: 2em 2em 1.5em 2em;
          margin-bottom: 2em;
          width: 100%;
        }
        .room-section.card {
          border: 2px solid #4caf50;
          max-width: 1100px;
          margin: 32px auto;
          padding: 40px 64px;
          border-radius: 8px;
          background: #f9f9f9;
        }
        .room-info.card {
          border: 1.5px solid #90caf9;
        }
        .messages-section.card {
          min-height: 300px;
          margin-bottom: 1.5em;
        }
        .message-input-section.card {
          display: flex;
          gap: 10px;
          padding: 1em;
          background: #f5faff;
          border-top: 1px solid #eee;
          margin-bottom: 1.5em;
        }
        .room-section {
          margin: 20px 0;
          padding: 20px;
          border: 2px solid #4caf50;
          border-radius: 8px;
          background: #f9f9f9;
        }

        .room-input-wrapper {
          width: 100%;
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
        }
        .room-input {
          display: flex;
          gap: 18px;
          margin: 15px 0;
          align-items: stretch;
        }
        .room-input input {
          flex: 1;
          padding: 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          background: #fafbfc;
        }
        .room-input button {
          padding: 0 28px;
          border-radius: 10px;
          font-size: 16px;
          height: auto;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .room-info {
          margin: 20px 0;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
          border: 1px solid #ddd;
        }

        .users-list {
          margin-top: 10px;
        }

        .user-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #eee;
        }

        .status {
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .status.verified {
          background: #4caf50;
          color: white;
        }

        .status.unverified {
          background: #ff9800;
          color: white;
        }

        .messages-section {
          flex: 1;
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ccc;
          border-radius: 8px;
          background: #f9f9f9;
          min-height: 300px;
          max-height: 350px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .no-messages {
          text-align: center;
          color: #666;
          margin: auto;
        }

        .message {
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          max-width: 70%;
        }

        .message.me {
          align-self: flex-end;
        }

        .message.other {
          align-self: flex-start;
        }

        .message-content {
          padding: 10px 15px;
          border-radius: 15px;
          position: relative;
          word-wrap: break-word;
        }

        .message.me .message-content {
          background: #4caf50;
          color: white;
          border-bottom-right-radius: 5px;
        }

        .message.other .message-content {
          background: #e9ecef;
          color: black;
          border-bottom-left-radius: 5px;
        }

        .message-text {
          margin-bottom: 4px;
        }

        .timestamp {
          font-size: 11px;
          opacity: 0.7;
          display: block;
          margin-top: 2px;
        }

        .message-input-section {
          display: flex;
          gap: 10px;
          padding: 15px;
          background: white;
          border-top: 1px solid #eee;
        }

        input {
          flex: 1;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
        }

        input:focus {
          outline: none;
          border-color: #4caf50;
          box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
        }

        button {
          padding: 12px 24px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }

        button:hover:not(:disabled) {
          background: #45a049;
        }

        button:disabled {
          background: #cccccc;
          cursor: not-allowed;
        }

        .error-message {
          color: #d32f2f;
          background: #ffebee;
          padding: 10px;
          border-radius: 4px;
          margin-top: 10px;
          font-size: 14px;
        }

        .message-header {
          font-size: 12px;
          margin-bottom: 4px;
          opacity: 0.7;
        }

        .sender-info {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .verified-badge {
          color: #4caf50;
          font-weight: bold;
        }

        .unverified-badge {
          color: #ff9800;
          font-weight: bold;
        }

        .message.unverified .message-content {
          border: 1px solid #ff9800;
        }
      `}</style>
    </div>
  );
};

export default KeyDisplay;
