import { Router } from "express";
import { listDoctorsHandler, matchDoctorHandler } from "../controllers/doctorController.js";

const router = Router();
router.get("/doctors", listDoctorsHandler);
router.post("/doctors/match", matchDoctorHandler);
export default router;
