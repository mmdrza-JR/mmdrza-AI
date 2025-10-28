// 🌌 mmdrza.AI — Fully Streaming Chat Server (Fixed Final)
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import chalk from "chalk";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("."));

const API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `
You are mmdrza.AI — an intelligent academic assistant created by mmdrza.
You answer only educational or scientific questions.
If the topic is not educational, politely refuse and guide back to learning.
Respond warmly and clearly, in Persian if the user writes in Persian.
`;

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ai: "mmdrza.AI", version: "3.0" });
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message." });
  if (!API_KEY) return res.status(500).json({ error: "Missing API key." });

  console.log(chalk.cyan("💬 User:"), chalk.white(message));

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
      }),
    });

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.flushHeaders?.(); // ✅ ارسال فوری هدر برای جلوگیری از buffer

    aiRes.body.on("data", (chunk) => {
      const lines = chunk
        .toString()
        .split("\n")
        .filter(line => line.trim() && line.includes("data:"));

      for (const line of lines) {
        const msg = line.replace(/^data:\s*/, "");
        if (msg === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.flush?.();
          res.end();
          console.log(chalk.green("✅ Stream finished"));
          return;
        }
        try {
          const parsed = JSON.parse(msg);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            res.write(`data: ${JSON.stringify(token)}\n\n`);
            res.flush?.();
          }
        } catch (e) {
          // نادیده گرفتن تکه‌های ناقص
        }
      }
    });

    aiRes.body.on("end", () => {
      console.log(chalk.green("✅ Stream naturally ended."));
      res.write("data: [DONE]\n\n");
      res.flush?.();
      res.end();
    });

    aiRes.body.on("error", (err) => {
      console.error(chalk.red("❌ Stream error:"), err.message);
      res.end();
    });
  } catch (err) {
    console.error(chalk.red("🚨 Error:"), err.message);
    if (!res.headersSent)
      res.status(500).json({ error: "Failed to connect to OpenAI." });
  }
});

app.listen(PORT, () => {
  console.log(chalk.cyanBright(`🚀 mmdrza.AI running at http://localhost:${PORT}`));
});
