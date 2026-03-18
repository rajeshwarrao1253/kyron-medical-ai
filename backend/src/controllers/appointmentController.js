import { z } from "zod";
import { bookAppointment } from "../services/bookingService.js";
import { getSession, addMessage } from "../services/memoryStore.js";
import { sendBookingNotifications } from "../services/notificationService.js";

const bookSchema = z.object({
  doctorId: z.string().min(1),
  slot: z.string().min(1)
});

export async function bookAppointmentHandler(req, res, next) {
  try {
    const payload = bookSchema.parse(req.body);
    const appointment = bookAppointment(req.sessionId, payload);
    const session = getSession(req.sessionId);
    const patientName = `${session.intake.firstName} ${session.intake.lastName}`.trim();

    const notifications = await sendBookingNotifications({
      email:       session.intake.email,
      phone:       session.intake.phone,
      smsOptIn:    session.intake.smsOptIn,
      patientName,
      doctorId:    appointment.doctorId,
      slot:        appointment.slot
    }).catch((error) => ({ error: error.message }));

    // Mark as notified so the voice webhook doesn't send a duplicate email
    // if the patient continues on a call after booking via web chat
    session.booking.notifiedAfterCall = true;

    const confirmationText = `Your appointment is confirmed for ${appointment.slot}.`;
    addMessage(req.sessionId, "assistant", confirmationText, { bookingConfirmed: true });

    res.json({
      success: true,
      appointment,
      notifications
    });
  } catch (error) {
    next(error);
  }
}
