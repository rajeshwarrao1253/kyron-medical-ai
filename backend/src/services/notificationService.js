import nodemailer from "nodemailer";
import twilio from "twilio";
import dayjs from "dayjs";
import { env } from "../config/env.js";
import { DOCTORS } from "../constants/doctors.js";

const transporter = env.smtp.host && env.smtp.user && env.smtp.pass
  ? nodemailer.createTransport({
      host:   env.smtp.host,
      port:   env.smtp.port,
      secure: env.smtp.secure,
      auth:   { user: env.smtp.user, pass: env.smtp.pass }
    })
  : null;

const twilioClient = env.twilio.sid && env.twilio.token
  ? twilio(env.twilio.sid, env.twilio.token)
  : null;

function doctorLabel(doctorId) {
  const d = DOCTORS.find(x => x.id === doctorId);
  return d ? `${d.name} (${d.specialty})` : doctorId;
}

export function buildEmailTemplate({ patientName, doctorId, slot }) {
  const formatted = dayjs(slot).format("dddd, MMMM D, YYYY [at] h:mm A");
  const doctor    = doctorLabel(doctorId);
  return {
    subject: `Appointment Confirmed — ${env.clinic.name}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#050F20;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:540px;margin:40px auto;background:#0A1628;border-radius:16px;border:1px solid rgba(0,180,216,0.2);overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0369a1,#0EA5E9);padding:28px 32px;">
      <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.01em;">${env.clinic.name}</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px;">Patient Care Scheduling</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <h2 style="color:#22D3EE;font-size:18px;margin:0 0 8px;">Appointment Confirmed ✓</h2>
      <p style="color:rgba(186,230,253,0.75);font-size:14px;margin:0 0 24px;">Hi ${patientName}, your appointment has been successfully booked.</p>

      <div style="background:rgba(0,180,216,0.08);border:1px solid rgba(0,180,216,0.2);border-radius:12px;padding:18px 20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:rgba(186,230,253,0.6);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:12px;width:90px;">Provider</td>
            <td style="color:#F0F9FF;font-size:14px;font-weight:600;padding-bottom:12px;">${doctor}</td>
          </tr>
          <tr>
            <td style="color:rgba(186,230,253,0.6);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Date &amp; Time</td>
            <td style="color:#F0F9FF;font-size:14px;font-weight:600;">${formatted}</td>
          </tr>
        </table>
      </div>

      <p style="color:rgba(186,230,253,0.55);font-size:13px;margin:24px 0 0;line-height:1.6;">
        Please arrive 10 minutes before your appointment. If you need to reschedule or have questions, call us at <strong style="color:#22D3EE;">${env.clinic.phone}</strong>.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid rgba(0,180,216,0.12);">
      <p style="color:rgba(186,230,253,0.35);font-size:12px;margin:0;">${env.clinic.name} · ${env.clinic.email}</p>
    </div>
  </div>
</body>
</html>`
  };
}

export function buildSmsTemplate({ patientName, doctorId, slot }) {
  const formatted = dayjs(slot).format("MMM D [at] h:mm A");
  return `${env.clinic.name}: Hi ${patientName}, your appt with ${doctorLabel(doctorId)} is confirmed for ${formatted}. Reply STOP to opt out.`;
}

export async function sendBookingNotifications({ email, phone, smsOptIn, patientName, doctorId, slot }) {
  const results = { email: null, sms: null };

  if (transporter && email) {
    try {
      const template = buildEmailTemplate({ patientName, doctorId, slot });
      results.email = await transporter.sendMail({
        from:    env.smtp.from,
        to:      email,
        subject: template.subject,
        html:    template.html
      });
    } catch (err) {
      results.email = { error: err.message };
    }
  }

  // SMS only if patient opted in and Twilio is configured
  if (smsOptIn && env.twilio.enableSms && twilioClient && env.twilio.from && phone) {
    try {
      results.sms = await twilioClient.messages.create({
        from: env.twilio.from,
        to:   phone,
        body: buildSmsTemplate({ patientName, doctorId, slot })
      });
    } catch (err) {
      results.sms = { error: err.message };
    }
  }

  return results;
}
