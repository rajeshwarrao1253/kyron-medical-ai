import { Router } from "express";
import { getIntakeHandler, saveIntakeHandler } from "../controllers/intakeController.js";

const router = Router();
router.post("/intake", saveIntakeHandler);
router.get("/intake/:sessionId", getIntakeHandler);
export default router;
