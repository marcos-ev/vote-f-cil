import http from "node:http";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { squadsRouter } from "./routes/squads";
import { roomsRouter } from "./routes/rooms";
import { createRealtimeServer } from "./ws";

const ALLOWED_ORIGINS = [
  "https://pokerplanning-one.vercel.app",
  "https://pokerplanning-git-main-marcosevs-projects.vercel.app",
  "https://pokerplanning-27jjusi6x-marcosevs-projects.vercel.app",
  // local dev
  "http://localhost:8080",
  "http://localhost:5173",
];

const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS bloqueado para origem: ${origin}`));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "poker-server" });
});

app.use("/api/auth", authRouter);
app.use("/api/squads", squadsRouter);
app.use("/api/rooms", roomsRouter);

const port = Number(process.env.PORT || 8787);
const server = http.createServer(app);
createRealtimeServer(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`API + WS online em http://localhost:${port}`);
});
