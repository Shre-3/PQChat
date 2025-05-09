import React, { useState, useEffect } from "react";
import { useCrypto } from "../hooks/useCrypto";
import { useAuth } from "../hooks/useAuth";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
}

export function SecureChat({ recipientId }: { recipientId: string }) {
  const { user } = useAuth();
  const { keys, loading, error, sendMessage, decryptReceivedMessage } =
    useCrypto();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Subscribe to messages
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "messages"),
      where("recipientId", "==", user.uid),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newMessages: Message[] = [];

      for (const doc of snapshot.docs) {
        try {
          const data = doc.data();
          const decrypted = await decryptReceivedMessage(data);
          newMessages.push({
            id: doc.id,
            text: decrypted.message,
            senderId: decrypted.senderId,
            timestamp: data.timestamp,
          });
        } catch (err) {
          console.error("Error decrypting message:", err);
          // Skip messages that can't be decrypted
          continue;
        }
      }

      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [user, decryptReceivedMessage]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    try {
      await sendMessage(newMessage, recipientId);
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div>Initializing cryptographic keys...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.senderId === user?.uid ? "text-right" : "text-left"
            }`}
          >
            <div
              className={`inline-block p-2 rounded-lg ${
                message.senderId === user?.uid
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded-l"
            disabled={sending}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-r"
            disabled={sending}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
