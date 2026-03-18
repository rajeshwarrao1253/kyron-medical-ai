import { getAvailableSlots } from "../services/slotService.js";

export function getSlotsHandler(req, res, next) {
  try {
    const doctorId = req.query.doctorId;
    if (!doctorId) {
      return res.status(400).json({ error: "doctorId query parameter is required." });
    }
    const q      = req.query.q || "";
    const result = getAvailableSlots(doctorId, q);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
