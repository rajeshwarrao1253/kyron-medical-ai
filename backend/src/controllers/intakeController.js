import { saveIntake, getIntake } from "../services/intakeService.js";

export function saveIntakeHandler(req, res, next) {
  try {
    const intake = saveIntake(req.sessionId, req.body || {});
    res.json({ sessionId: req.sessionId, intake });
  } catch (error) {
    next(error);
  }
}

export function getIntakeHandler(req, res, next) {
  try {
    const intake = getIntake(req.params.sessionId);
    res.json({ sessionId: req.params.sessionId, intake });
  } catch (error) {
    next(error);
  }
}
