"use client";

import { motion } from "framer-motion";

export default function MessageBubble({ role, children }) {
  return (
    <motion.div
      className={`message-row ${role}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {role === "assistant" && (
        <div className="assistant-avatar" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8.5" stroke="#00B4D8" strokeWidth="1.5"/>
            <path d="M6.5 7 L10 10.5 L13.5 7M10 10.5 L10 14"
              stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div className="message-bubble">{children}</div>
    </motion.div>
  );
}
