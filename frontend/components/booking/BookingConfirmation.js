"use client";

import { motion } from "framer-motion";

function formatSlot(isoString) {
  if (!isoString) return isoString;
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      weekday: "long",
      month:   "long",
      day:     "numeric",
      year:    "numeric",
      hour:    "numeric",
      minute:  "2-digit",
      hour12:  true
    });
  } catch {
    return isoString;
  }
}

export default function BookingConfirmation({ appointment, doctor, onReset }) {
  if (!appointment) return null;

  const doctorName     = doctor?.name     || appointment.doctorId;
  const doctorSpecialty = doctor?.specialty || "";
  const slotLabel      = formatSlot(appointment.slot);

  return (
    <motion.div
      className="confirm-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="confirm-card-header">
        <div className="confirm-icon">✓</div>
        <strong>Appointment Confirmed</strong>
      </div>

      <div className="confirm-detail-row">
        <span className="confirm-detail-label">Provider</span>
        <span>{doctorName}{doctorSpecialty ? ` · ${doctorSpecialty}` : ""}</span>
      </div>

      <div className="confirm-detail-row">
        <span className="confirm-detail-label">Date &amp; Time</span>
        <span>{slotLabel}</span>
      </div>

      {appointment.patient?.email && (
        <div className="confirm-detail-row">
          <span className="confirm-detail-label">Sent to</span>
          <span>{appointment.patient.email}</span>
        </div>
      )}

      <div className="confirm-booking-id">
        Booking ID: {appointment.id}
      </div>

      {onReset && (
        <button className="new-appt-btn" type="button" onClick={onReset}>
          Book Another Appointment
        </button>
      )}
    </motion.div>
  );
}
