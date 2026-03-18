"use client";

import { motion } from "framer-motion";

export default function SlotPicker({ doctor, slots, onSelect, disabled }) {
  if (!slots?.length) return null;

  return (
    <motion.div
      className="slot-section"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="slot-section-label">
        {doctor ? `Available times · ${doctor.name}` : "Available appointment times"}
      </div>
      <div className="slot-grid">
        {slots.map((slot) => {
          const parts = slot.label.split("•");
          const date  = parts[0]?.trim() ?? slot.label;
          const time  = parts[1]?.trim() ?? "";
          return (
            <button
              key={slot.value}
              className="slot-btn"
              onClick={() => onSelect(slot)}
              disabled={disabled}
              type="button"
            >
              <strong>{date}</strong>
              {time && <span>{time}</span>}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
