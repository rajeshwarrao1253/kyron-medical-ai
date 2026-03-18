import { Router } from "express";
import { getSlotsHandler } from "../controllers/slotController.js";

const router = Router();
router.get("/slots", getSlotsHandler);
export default router;
