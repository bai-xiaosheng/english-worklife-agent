import { verifyAuthToken } from "../services/authService.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Unauthorized. Missing bearer token." });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      displayName: payload.displayName || ""
    };
    next();
  } catch (_error) {
    res.status(401).json({ error: "Unauthorized. Invalid or expired token." });
  }
}

