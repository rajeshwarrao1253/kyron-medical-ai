import { z } from "zod";
import { addMessage, getMessages, getSession } from "../services/memoryStore.js";
import { classifyUserMessage, safeResponse, validateAssistantResponse } from "../services/safetyService.js";
import { processConversationState, detectIntent } from "../services/chatFlowService.js";
import { generateAssistantReply, clinicInfoReply, prescriptionReply, notSupportedReply } from "../services/openaiService.js";

const chatSchema = z.object({
  message: z.string().min(1).max(1000)
});

export async function chatHandler(req, res, next) {
  try {
    const { message } = chatSchema.parse(req.body);
    const sessionId   = req.sessionId;

    addMessage(sessionId, "user", message);

    // ── 1. Safety gate ────────────────────────────────────────────
    const safety = classifyUserMessage(message);
    if (safety.blocked) {
      const blocked = safeResponse(safety.category);
      addMessage(sessionId, "assistant", blocked, { blocked: true });
      return res.json({
        sessionId,
        message:      blocked,
        intent:       "OTHER",
        stage:        getSession(sessionId).stage,
        action:       "SAFE_REDIRECT",
        slots:        [],
        matchedDoctor: null,
        collectedData: getSession(sessionId).intake,
        bookingConfirmed: false
      });
    }

    // ── 2. Quick-intent shortcuts (no intake needed) ──────────────
    // Detect intent from this message (don't mutate session yet)
    const session      = getSession(sessionId);
    const quickIntent  = detectIntent(message, session.intent);

    if (quickIntent === "CLINIC_INFO") {
      const reply = clinicInfoReply();
      addMessage(sessionId, "assistant", reply);
      return res.json({
        sessionId,
        message:      reply,
        intent:       "CLINIC_INFO",
        stage:        session.stage,
        action:       "CLINIC_INFO",
        slots:        [],
        matchedDoctor: null,
        collectedData: session.intake,
        bookingConfirmed: false
      });
    }

    if (quickIntent === "PRESCRIPTION") {
      const reply = prescriptionReply();
      addMessage(sessionId, "assistant", reply);
      return res.json({
        sessionId,
        message:      reply,
        intent:       "PRESCRIPTION",
        stage:        session.stage,
        action:       "PRESCRIPTION",
        slots:        [],
        matchedDoctor: null,
        collectedData: session.intake,
        bookingConfirmed: false
      });
    }

    // ── 3. Appointment intake / scheduling flow ───────────────────
    const flow    = processConversationState(sessionId, message);

    // Always pass the current session intake as context so the reply
    // generator knows exactly what has been collected.
    const freshSession = getSession(sessionId);
    const context = {
      ...flow.responseContext,
      intake: flow.collectedData || freshSession.intake
    };

    const history = getMessages(sessionId);
    const raw = await generateAssistantReply({
      intent:  flow.intent,
      stage:   flow.stage,
      context,
      history
    });

    const finalMessage = validateAssistantResponse(raw)
      ? raw
      : safeResponse("medical");

    addMessage(sessionId, "assistant", finalMessage, {
      stage:  flow.stage,
      action: flow.action
    });

    return res.json({
      sessionId,
      message:      finalMessage,
      intent:       flow.intent,
      stage:        flow.stage,
      action:       flow.action,
      collectedData: flow.collectedData || freshSession.intake,
      matchedDoctor: flow.responseContext?.matchedDoctor || null,
      slots:         flow.responseContext?.slots         || [],
      bookingConfirmed: false
    });

  } catch (error) {
    next(error);
  }
}
