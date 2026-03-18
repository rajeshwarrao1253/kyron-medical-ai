import { z } from "zod";
import { listDoctors, matchDoctor } from "../services/doctorMatchingService.js";

const matchSchema = z.object({
  reason: z.string().optional().default(""),
  bodyPart: z.string().optional().default("")
});

export function listDoctorsHandler(req, res) {
  res.json({ doctors: listDoctors() });
}

export function matchDoctorHandler(req, res, next) {
  try {
    const payload = matchSchema.parse(req.body || {});
    const result = matchDoctor(payload.reason, payload.bodyPart);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
