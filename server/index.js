const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
const { MlKem768 } = require("mlkem");
const crypto = require("crypto");

// Create Express appl̥
const app = express();
app.use(
  cors({
    origin: "*", // In production, replace with specific origin
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

// Create HTTP server using Express app
const server = require("http").createServer(app);

// Configure WebSocket server with error handling
const wss = new WebSocket.Server({
  server,
  clientTracking: true,
  // Simplified protocol handling
  handleProtocols: () => "pqchat",
});

// Store connected clients and rooms
const clients = new Map();
const rooms = new Map();

// Log server status
console.log("Initializing WebSocket server...");

// Handle server-level errors
wss.on("error", (error) => {
  console.error("WebSocket Server Error:", error);
});

// Ping clients every 30 seconds to keep connections alive
const pingInterval = 30000;
const checkInterval = 10000;

const heartbeat = () => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log("Client failed to respond to ping, terminating connection");
      const client = clients.get(ws);
      if (client && client.currentRoom) {
        const roomUsers = rooms.get(client.currentRoom);
        if (roomUsers) {
          roomUsers.delete(client.id);
          broadcastToRoom(client.currentRoom, {
            type: "user_left",
            userId: client.id,
          });
        }
      }
      clients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
};

const interval = setInterval(heartbeat, checkInterval);

wss.on("close", () => {
  clearInterval(interval);
});

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  console.log(`New client connected from ${req.socket.remoteAddress}`);
  let clientId = null;

  // Set up ping-pong
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
    console.log(`Received pong from client ${clientId || "unknown"}`);
  });

  // Handle client errors
  ws.on("error", (error) => {
    console.error(`Client error (${clientId || "unknown"}):`, error);
  });

  // Handle client disconnect
  ws.on("close", () => {
    console.log(`Client disconnected (${clientId || "unknown"})`);
    const client = clients.get(ws);
    if (client && client.currentRoom) {
      const roomUsers = rooms.get(client.currentRoom);
      if (roomUsers) {
        roomUsers.delete(client.id);
        broadcastToRoom(client.currentRoom, {
          type: "user_left",
          userId: client.id,
        });
      }
    }
    clients.delete(ws);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(
        "Received message type:",
        data.type,
        "from client:",
        clientId || "unknown"
      );

      switch (data.type) {
        case "register":
          // Accept clientId from client or generate if not present
          clientId = data.clientId || Math.random().toString(36).substring(7);

          // Store client info
          clients.set(ws, {
            id: clientId,
            kyberPublicKey: new Uint8Array(data.kyberPublicKey),
            currentRoom: null,
          });

          console.log(
            `[REGISTER] Client registered: clientId=${clientId}, socketId=${ws._socket.remotePort}`
          );

          // Send confirmation
          ws.send(
            JSON.stringify({
              type: "registered",
              clientId: clientId,
            })
          );
          break;

        case "join_room":
          const roomId = data.roomId;
          const authToken = data.authToken;
          const client = clients.get(ws);

          if (!client) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Not registered",
              })
            );
            return;
          }

          // Verify room password
          if (!verifyRoomPassword(roomId, authToken)) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid room password",
              })
            );
            return;
          }

          // Leave current room if in one
          if (client.currentRoom) {
            const currentRoomUsers = rooms.get(client.currentRoom);
            if (currentRoomUsers) {
              currentRoomUsers.delete(client.id);
              // Notify others in the room
              broadcastToRoom(
                client.currentRoom,
                {
                  type: "user_left",
                  userId: client.id,
                },
                ws
              );
            }
          }

          // Join new room
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId).add(client.id);
          client.currentRoom = roomId;

          // Send room joined confirmation with current users
          const roomUsers = Array.from(rooms.get(roomId)).map((userId) => {
            const userClient = Array.from(clients.entries()).find(
              ([_, c]) => c.id === userId
            );
            return {
              id: userId,
              publicKey: Array.from(userClient[1].kyberPublicKey),
            };
          });

          ws.send(
            JSON.stringify({
              type: "room_joined",
              roomId: roomId,
              users: roomUsers,
            })
          );

          // Notify others in the room
          broadcastToRoom(
            roomId,
            {
              type: "user_joined",
              userId: client.id,
              publicKey: Array.from(client.kyberPublicKey),
            },
            ws
          );

          break;

        case "key_exchange":
          // Forward key exchange to recipient
          const recipientId = data.recipientId;
          const senderClient = clients.get(ws);

          if (!senderClient) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Not registered",
              })
            );
            return;
          }

          const recipient = Array.from(clients.entries()).find(
            ([_, c]) => c.id === recipientId
          );

          if (recipient) {
            recipient[0].send(
              JSON.stringify({
                type: "key_exchange",
                senderId: senderClient.id,
                publicKey: data.publicKey,
              })
            );
          }
          break;

        case "message":
          // [Fix] Prevent sender from seeing their own message
          // Forward encrypted messages to recipients (not sender)
          const messageRoomId = data.roomId;
          const messages = data.messages;
          const messageSender = clients.get(ws);

          if (!messageSender) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Not registered",
              })
            );
            return;
          }

          for (const msg of messages) {
            const recipientId = msg.recipientId;
            // [Fix] Do not send message to sender
            if (recipientId === messageSender.id) {
              continue;
            }
            const recipient = Array.from(clients.entries()).find(
              ([_, c]) => c.id === recipientId
            );

            if (recipient) {
              // [Fix] Log senderId, recipientId, and socketId
              console.log(
                `[MESSAGE] senderId=${messageSender.id}, recipientId=${recipientId}, senderSocketId=${ws._socket.remotePort}, recipientSocketId=${recipient[0]._socket.remotePort}`
              );
              recipient[0].send(
                JSON.stringify({
                  type: "message",
                  senderId: messageSender.id,
                  encryptedData: msg.encryptedData,
                  timestamp: data.timestamp,
                  publicKey: Array.from(messageSender.kyberPublicKey),
                })
              );
            }
          }
          break;
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Failed to process message: " + error.message,
        })
      );
    }
  });
});

// Helper function to broadcast to room
function broadcastToRoom(roomId, message, excludeWs = null) {
  const roomUsers = rooms.get(roomId);
  if (!roomUsers) return;

  wss.clients.forEach((client) => {
    if (client === excludeWs) return;
    if (client.readyState === WebSocket.OPEN) {
      const clientData = clients.get(client);
      if (clientData && roomUsers.has(clientData.id)) {
        client.send(JSON.stringify(message));
      }
    }
  });
}

// Helper function to verify room password
function verifyRoomPassword(roomId, authToken) {
  // For demonstration purposes, we'll accept any valid hash
  // In a real application, you would verify against a stored password hash
  return typeof authToken === "string" && authToken.length > 0;
}

// Simple hash function for room password (in production, use a proper KDF)
function hashRoomPassword(roomId, password) {
  // This is a simplified version - in production use a proper KDF
  const data = roomId + password;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

// API endpoint to create a new room
app.post("/api/rooms", (req, res) => {
  const { roomId, password } = req.body;

  if (!roomId || !password) {
    return res.status(400).json({ error: "Room ID and password are required" });
  }

  // In a real application, you would store rooms in a database
  // For this demo, we'll just return success
  res.json({ success: true, roomId });
});

// Start server with error handling
const PORT = process.env.PORT || 8080;
server.on("error", (error) => {
  console.error("Server Error:", error);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (HTTP and WebSocket)`);
  console.log(`WebSocket URL: ws://localhost:${PORT}`);
});
