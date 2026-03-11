import http from "node:http";
import express from "express";
import cors from "cors";
import { squadsRouter } from "./routes/squads";
import { roomsRouter } from "./routes/rooms";
import { createRealtimeServer } from "./ws";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "poker-server" });
});

app.use("/api/squads", squadsRouter);
app.use("/api/rooms", roomsRouter);

const port = Number(process.env.PORT || 8787);
const server = http.createServer(app);
createRealtimeServer(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`API + WS online em http://localhost:${port}`);
});
