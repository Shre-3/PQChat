// src/ChatApp.js
import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";

const ChatApp = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    await addDoc(collection(db, "messages"), {
      text: newMessage,
      timestamp: serverTimestamp(),
    });

    setNewMessage("");
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "Arial" }}>
      <h2> PQ-Chat</h2>
      <div style={{ border: "1px solid #ccc", padding: "10px", minHeight: "300px", marginBottom: "10px" }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ padding: "4px 0" }}>
            {msg.text}
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={{ flex: 1, padding: "8px" }}
        />
        <button type="submit" style={{ padding: "8px 12px" }}>Send</button>
      </form>
    </div>
  );
};

export default ChatApp;
