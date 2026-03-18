import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { sessionMiddleware } from "./middleware/sessionMiddleware.js";
import { errorMiddleware } from "./middleware/errorMiddleware.js";
import chatRoutes from "./routes/chatRoutes.js";
import intakeRoutes from "./routes/intakeRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
import voiceWebhook from "./routes/voice.webhook.js";

const app = express();

app.use(cors({
  origin: env.frontendOrigin,
  credentials: true,
  exposedHeaders: ["x-session-id"]
}));

app.use(express.json());
app.use(sessionMiddleware);

// Rate limiting — chat endpoint
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages — please slow down and try again shortly." }
});

// Voice webhook bypasses rate limiting (server-to-server)
app.use(voiceWebhook);

app.get("/health", (_req, res) => res.json({ ok: true, name: env.clinic.name }));

app.use("/api", chatLimiter, chatRoutes);
app.use("/api", intakeRoutes);
app.use("/api", doctorRoutes);
app.use("/api", slotRoutes);
app.use("/api", appointmentRoutes);
app.use("/api", voiceRoutes);

app.use(errorMiddleware);

export default app;
