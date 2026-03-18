import { v4 as uuidv4 } from "uuid";

export function sessionMiddleware(req, res, next) {
  let sessionId = req.headers["x-session-id"];
  if (!sessionId) {
    sessionId = uuidv4();
    res.setHeader("x-session-id", sessionId);
  }
  req.sessionId = sessionId;
  next();
}
