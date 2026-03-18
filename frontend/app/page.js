"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
import { motion, AnimatePresence } from "framer-motion";
import ChatComposer from "../components/chat/ChatComposer";
import MessageBubble from "../components/chat/MessageBubble";
import TypingDots from "../components/ui/TypingDots";
import SlotPicker from "../components/booking/SlotPicker";
import BookingConfirmation from "../components/booking/BookingConfirmation";
import { sendChat, bookAppointment, continueOnCall } from "../lib/api";
import { streamText } from "../lib/streamText";

const INTAKE_STEPS = [
  { key: "firstName",  label: "First name"  },
  { key: "lastName",   label: "Last name"   },
  { key: "dob",        label: "Date of birth" },
  { key: "phone",      label: "Phone number" },
  { key: "email",      label: "Email address" },
  { key: "smsOptIn",   label: "SMS consent"  },
  { key: "reason",     label: "Reason for visit" },
];

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    content: "Hi there — I'm your Kyron Medical scheduling assistant. I can help you book an appointment, check on a prescription refill, or find clinic information.\n\nHow can I help you today?"
  }
];

function KyronLogo() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="#00B4D8" strokeWidth="1.5"/>
      <path d="M6.5 6.5 L10 10 L13.5 6.5M10 10 L10 14" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5a2 2 0 012-2h1.5a1 1 0 01.97.757l.69 2.758a1 1 0 01-.23.97L6.5 8.914a11.042 11.042 0 005.586 5.586l1.43-1.43a1 1 0 01.97-.23l2.757.69a1 1 0 01.757.97V15a2 2 0 01-2 2h-1C7.163 17 3 12.837 3 7.5V5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function HomePage() {
  const [messages, setMessages]         = useState(initialMessages);
  const [loading, setLoading]           = useState(false);
  const [slots, setSlots]               = useState([]);
  const [matchedDoctor, setMatchedDoctor] = useState(null);
  const [appointment, setAppointment]   = useState(null);
  const [callStatus, setCallStatus]     = useState("");
  const [bookingBusy, setBookingBusy]   = useState(false);
  const [collectedData, setCollectedData] = useState({});
  const threadRef = useRef(null);

  // auto-scroll on new content
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading, slots, appointment]);

  // ── send a chat message ──────────────────────────────────────────
  async function handleSend(text) {
    setLoading(true);
    setMessages(prev => [...prev, { id: uuid(), role: "user", content: text }]);
    setSlots([]);
    setAppointment(null);

    try {
      const data = await sendChat(text);
      if (data.matchedDoctor) setMatchedDoctor(data.matchedDoctor);
      if (data.collectedData) setCollectedData(data.collectedData);
      if (data.slots?.length)  setSlots(data.slots);

      const tempId = uuid();
      setMessages(prev => [...prev, { id: tempId, role: "assistant", content: "" }]);
      await streamText(data.message, (partial) => {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: partial } : m));
      });
    } catch (error) {
      setMessages(prev => [...prev, {
        id: uuid(), role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment."
      }]);
    } finally {
      setLoading(false);
    }
  }

  // ── book a slot ──────────────────────────────────────────────────
  async function handleSlotSelect(slot) {
    if (!matchedDoctor) return;
    setBookingBusy(true);
    try {
      const result = await bookAppointment({ doctorId: matchedDoctor.id, slot: slot.value });
      setAppointment(result.appointment);
      setSlots([]);
      const label = slot.label;
      setMessages(prev => [...prev, {
        id: uuid(), role: "assistant",
        content: `Your appointment is confirmed for ${label} with ${matchedDoctor.name}. A confirmation has been sent to your email.`
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: uuid(), role: "assistant",
        content: error.message || "Unable to book that slot. Please choose another time."
      }]);
    } finally {
      setBookingBusy(false);
    }
  }

  // ── start fresh (post-booking reset) ────────────────────────────
  function handleReset() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sessionId");
    }
    setMessages(initialMessages);
    setSlots([]);
    setMatchedDoctor(null);
    setAppointment(null);
    setCallStatus("");
    setCollectedData({});
  }

  // ── continue on call ─────────────────────────────────────────────
  async function handleContinueOnCall() {
    setCallStatus("Connecting your call…");
    try {
      const result = await continueOnCall();
      if (!result.success) {
        setMessages(prev => [...prev, {
          id: uuid(), role: "assistant", content: result.message
        }]);
        setCallStatus("");
        return;
      }
      const msg = result.result?.message || "Your call is being connected. Our AI will pick up where we left off.";
      setCallStatus(msg);
      setMessages(prev => [...prev, { id: uuid(), role: "assistant", content: msg }]);
    } catch (error) {
      setCallStatus("");
      setMessages(prev => [...prev, {
        id: uuid(), role: "assistant", content: error.message
      }]);
    }
  }

  // ── derived UI state ─────────────────────────────────────────────
  const doctorSummary = useMemo(() => {
    if (!matchedDoctor) return null;
    return { name: matchedDoctor.name, specialty: matchedDoctor.specialty };
  }, [matchedDoctor]);

  const intakeProgress = useMemo(() => {
    return INTAKE_STEPS.map(step => ({
      ...step,
      filled: Boolean(collectedData[step.key])
    }));
  }, [collectedData]);

  const allIntakeDone = intakeProgress.every(s => s.filled);

  return (
    <main className="main-shell">
      <div className="glass-panel">

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="brand-pill">
            <KyronLogo />
            Kyron Medical
          </div>

          <div className="sidebar-card">
            <h3>Assistant capabilities</h3>
            <p>Collect patient intake · Match you to a specialist · Book appointments · Send confirmations · Hand off to a live phone call</p>
          </div>

          {doctorSummary ? (
            <div className="sidebar-card">
              <h3>Matched provider</h3>
              <div className="routing-name">{doctorSummary.name}</div>
              <div className="routing-specialty">{doctorSummary.specialty}</div>
            </div>
          ) : (
            <div className="sidebar-card">
              <h3>Provider matching</h3>
              <p>Tell us your reason for visiting and we'll match you with the right specialist automatically.</p>
            </div>
          )}

          <div className="sidebar-card">
            <h3>Your intake progress</h3>
            <div className="progress-steps">
              {intakeProgress.map((step, idx) => (
                <div
                  key={step.key}
                  className={`step-row ${step.filled ? "done" : idx === intakeProgress.findIndex(s => !s.filled) ? "active" : ""}`}
                >
                  <div className="step-dot">
                    {step.filled ? "✓" : idx + 1}
                  </div>
                  <span>{step.label}</span>
                </div>
              ))}
              {allIntakeDone && (
                <div className="step-row done">
                  <div className="step-dot">✓</div>
                  <span>Intake complete</span>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-card">
            <h3>Safety</h3>
            <p>This assistant does not provide medical diagnoses, treatment recommendations, or medication guidance.</p>
          </div>
        </aside>

        {/* ── Chat area ─────────────────────────────────────────── */}
        <section className="chat-area">
          <div className="chat-header">
            <div className="chat-header-title">
              <h1>Healthcare AI Assistant</h1>
              <p>Powered by Kyron Medical · Secure &amp; HIPAA-aware</p>
            </div>
            <div className="header-actions">
              <AnimatePresence>
                {callStatus && (
                  <motion.span
                    className="status-pill"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                  >
                    {callStatus}
                  </motion.span>
                )}
              </AnimatePresence>
              <button
                className="reset-btn"
                type="button"
                onClick={handleReset}
                title="Start a new conversation"
              >
                Start Over
              </button>
              <button
                className="call-btn"
                type="button"
                onClick={handleContinueOnCall}
                disabled={!!callStatus}
                title="Switch to a live voice call — the AI will remember this conversation"
              >
                <PhoneIcon />
                Continue on Call
              </button>
            </div>
          </div>

          <div className="chat-thread" ref={threadRef}>
            {messages.map(message => (
              <MessageBubble key={message.id} role={message.role}>
                {message.content}
              </MessageBubble>
            ))}

            {loading && (
              <MessageBubble role="assistant">
                <TypingDots />
              </MessageBubble>
            )}

            <AnimatePresence>
              {slots.length > 0 && (
                <motion.div
                  key="slots"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                >
                  <SlotPicker
                    doctor={matchedDoctor}
                    slots={slots}
                    onSelect={handleSlotSelect}
                    disabled={bookingBusy}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {appointment && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <BookingConfirmation
                    appointment={appointment}
                    doctor={matchedDoctor}
                    onReset={handleReset}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="composer-wrap">
            <ChatComposer onSend={handleSend} disabled={loading} />
          </div>
        </section>

      </div>
    </main>
  );
}
