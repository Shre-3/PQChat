import React, { useState, useEffect } from "react";
import { db } from "./firebase"; // Make sure this imports from your firebase.js
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import './styles.css'; // Import the styles

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // Send message
  const sendMessage = async () => {
    try {
      if (message.trim()) {
        await addDoc(collection(db, "messages"), {
          text: message,
          timestamp: Timestamp.now(), // Use Firestore Timestamp
        });
        setMessage("");
      }
    } catch (err) {
      console.error("Error adding document: ", err);
    }
  };

  // Real-time listener
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => doc.data());
      setMessages(newMessages);
    });
    return () => unsubscribe();
  }, []);

  // Format time like "10:45 AM"
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format date labels smartly
  const formatDateLabel = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (d1, d2) =>
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";

    const diffInDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

    if (diffInDays <= 6) {
      return date.toLocaleDateString(undefined, {
        weekday: "long",
      }); // e.g., Friday
    } else {
      return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }); // e.g., 15 April 2025
    }
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const grouped = {};
    messages.forEach((msg) => {
      const label = formatDateLabel(msg.timestamp);
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(msg);
    });
    return grouped;
  };

  const groupedMessages = groupMessagesByDate();

  return (
    <div className="app-container">
      <div className="chat-header">PQ-Chat App</div>
      <div className="chat-window">
        {Object.entries(groupedMessages).map(([dateLabel, msgs], groupIndex) => (
          <div key={groupIndex}>
            <div className="date-label">{dateLabel}</div>
            {msgs.map((msg, index) => (
              <div key={index} className="message">
                <div className="message-text">{msg.text}</div>
                <div className="timestamp">{formatTime(msg.timestamp)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="message-input-container">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message"
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;
