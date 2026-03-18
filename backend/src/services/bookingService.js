import { v4 as uuidv4 } from "uuid";
import { reserveSlot } from "./slotService.js";
import { getSession, updateSession } from "./memoryStore.js";
import { matchDoctor } from "./doctorMatchingService.js";
import { HttpError } from "../utils/httpError.js";

const appointments = [];

export function bookAppointment(sessionId, { doctorId, slot }) {
  const session = getSession(sessionId);
  const intake = session.intake;

  if (!intake.firstName || !intake.lastName || !intake.dob || !intake.phone) {
    throw new HttpError(400, "Patient intake is incomplete. Need: first name, last name, date of birth, and phone.");
  }

  // Use provided doctorId, or match from reason, or fall back to first doctor
  const finalDoctorId = doctorId || (intake.reason ? matchDoctor(intake.reason).doctor.id : null);
  if (!finalDoctorId) {
    throw new HttpError(400, "No doctor matched. Please provide a reason for the visit.");
  }
  const appointment = {
    id: uuidv4(),
    sessionId,
    patient: { ...intake },
    doctorId: finalDoctorId,
    slot,
    createdAt: new Date().toISOString()
  };

  const reserved = reserveSlot(finalDoctorId, slot, appointment);
  if (!reserved) {
    throw new HttpError(409, "Selected slot is no longer available.");
  }

  appointments.push(appointment);
  updateSession(sessionId, {
    booking: {
      ...session.booking,
      selectedSlot: slot,
      matchedDoctorId: finalDoctorId
    }
  });
  return appointment;
}

export function listAppointments() {
  return appointments;
}
