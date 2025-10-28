// 🌌 mmdrza.AI — Ultimate Nebula Chat Server (Stable + Railway Ready)
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // ✅ تمام فایل‌های HTML و JS قابل دسترسی می‌شوند

const API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

// 💡 شخصیت اختصاصی mmdrza.AI
const SYSTEM_PROMPT = `
You are mmdrza.AI — an intelligent academic assistant created by mmdrza.
You answer only educational or scientific questions.
If the topic is not educational, politely refuse and guide back to learning.
Respond warmly and clearly, in Persian if the user writes in Persian.
`;

// ✅ صفحه اصلی (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ مسیر سلامت برای بررسی Railway
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ai: "mmdrza.AI", version: "3.2" });
});

// 💬 مسیر چت هوش مصنوعی با Stream واقعی
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    console.warn(chalk.yellow("⚠️ No message provided"));
    return res.status(400).json({ error: "Missing message." });
  }

  if (!API_KEY) {
    console.error(chalk.red("❌ Missing OpenAI API Key!"));
    return res.status(500).json({ error: "Server misconfiguration: missing API key." });
  }

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

    if (!aiRes.ok || !aiRes.body) {
      console.error(chalk.red(`🚨 OpenAI API Error: ${aiRes.status}`));
      return res.status(500).json({ error: "Failed to connect to OpenAI API" });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    aiRes.body.on("data", (chunk) => {
      const lines = chunk
        .toString()
        .split("\n")
        .filter(line => line.trim().startsWith("data:"));

      for (const line of lines) {
        const msg = line.replace(/^data:\s*/, "");
        if (msg === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.flush?.();
          res.end();
          console.log(chalk.green("✅ Stream finished successfully"));
          return;
        }
        try {
          const parsed = JSON.parse(msg);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            res.write(`data: ${JSON.stringify(token)}\n\n`);
            res.flush?.();
          }
        } catch {
          // ignore partial chunks
        }
      }
    });

    aiRes.body.on("end", () => {
      console.log(chalk.blue("🔚 Stream closed normally."));
      res.write("data: [DONE]\n\n");
      res.end();
    });

    aiRes.body.on("error", (err) => {
      console.error(chalk.red("❌ Stream error:"), err.message);
      if (!res.headersSent) res.end();
    });

  } catch (err) {
    console.error(chalk.red("🚨 Critical Error:"), err.message);
    if (!res.headersSent)
      res.status(500).json({ error: "Failed to connect to OpenAI." });
  }
});

app.listen(PORT, () => {
  console.log(chalk.cyanBright(`🚀 mmdrza.AI running at http://localhost:${PORT}`));
});
