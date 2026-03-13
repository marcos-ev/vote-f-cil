import { Router } from "express";
import { getUserBySessionToken, loginUser, registerUser, revokeSessionToken } from "../db";

export const authRouter = Router();

function getBearerToken(authorizationHeader: string) {
  if (!authorizationHeader) return "";
  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return "";
  return token || "";
}

authRouter.post("/register", (req, res) => {
  const username = String(req.body?.username || "");
  const displayName = String(req.body?.displayName || "");
  const password = String(req.body?.password || "");
  try {
    const result = registerUser({ username, displayName, password });
    res.status(201).json(result);
  } catch (error: any) {
    const reason = String(error?.message || "");
    if (
      reason === "invalid_user_input" ||
      reason === "username_too_short" ||
      reason === "display_name_too_short" ||
      reason === "password_too_short"
    ) {
      res.status(400).json({ error: "Dados inválidos para cadastro" });
      return;
    }
    if (reason === "username_already_exists") {
      res.status(409).json({ error: "Usuário já existe" });
      return;
    }
    res.status(500).json({ error: "Falha ao cadastrar usuário" });
  }
});

authRouter.post("/login", (req, res) => {
  const username = String(req.body?.username || "");
  const password = String(req.body?.password || "");
  const result = loginUser({ username, password });
  if (!result) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }
  res.json(result);
});

authRouter.get("/me", (req, res) => {
  const token = getBearerToken(String(req.headers.authorization || ""));
  if (!token) {
    res.status(401).json({ error: "Token ausente" });
    return;
  }
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: "Sessão inválida" });
    return;
  }
  res.json({ user });
});

authRouter.post("/logout", (req, res) => {
  const token = getBearerToken(String(req.headers.authorization || ""));
  if (!token) {
    res.json({ ok: true });
    return;
  }
  revokeSessionToken(token);
  res.json({ ok: true });
});
