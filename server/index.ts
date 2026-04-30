import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createTerminal } from "./terminal";
import { runAI } from "./ai";

const TOKEN = "7fcd45c24ce1c8106e3171c153b9255b7248c66006ca0ae05226e666829dad3d";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ai", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    return res.status(401).send("Unauthorized");
  }

  const { prompt } = req.body;

  try {
    const result = await runAI(prompt);
    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const server = app.listen(3001, () => {
  console.log("Server running http://localhost:3001");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url!, "http://localhost");
  const token = url.searchParams.get("token");

  if (token !== TOKEN) {
    ws.close();
    return;
  }

  const term = createTerminal((data) => {
    ws.send(JSON.stringify({ type: "output", data }));
  });

  ws.on("message", (msg) => {
    const { type, data } = JSON.parse(msg.toString());

    if (type === "input") {
      term.write(data);
    }
  });

  ws.on("close", () => {
    term.kill();
  });
});