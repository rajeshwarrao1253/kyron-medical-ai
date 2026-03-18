"use client";

import { useState } from "react";

export default function ChatComposer({ onSend, disabled }) {
  const [value, setValue] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Tell me what you need help with..."
        disabled={disabled}
      />
      <button className="primary-btn" type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
}
