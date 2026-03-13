import type { Request, Response } from "express";
import { getUserBySessionToken } from "../db";

function getBearerToken(authorizationHeader: string) {
  if (!authorizationHeader) return "";
  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return "";
  return token || "";
}

export function requireAuth(req: Request, res: Response) {
  const token = getBearerToken(String(req.headers.authorization || ""));
  if (!token) {
    res.status(401).json({ error: "Token ausente" });
    return null;
  }
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: "Sessão inválida" });
    return null;
  }
  return { token, user };
}
