import { Router } from "express";
import { continueOnCallHandler } from "../controllers/voiceController.js";

const router = Router();
router.post("/voice/continue-call", continueOnCallHandler);
export default router;
