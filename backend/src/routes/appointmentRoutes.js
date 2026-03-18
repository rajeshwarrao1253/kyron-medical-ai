import { Router } from "express";
import { bookAppointmentHandler } from "../controllers/appointmentController.js";

const router = Router();
router.post("/appointments/book", bookAppointmentHandler);
export default router;
