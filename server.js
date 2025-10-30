// 🌌 mmdrza.AI — Cloud Optimized Server (v3.4 Production Ready)
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ⚙️ تنظیمات محیط
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Middleware عمومی
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

// 🧠 شخصیت پیش‌فرض AI
const SYSTEM_PROMPT = `
You are mmdrza.AI — an intelligent academic assistant created by mmdrza.
You answer only educational or scientific questions.
If the topic is not educational, politely refuse and guide back to learning.
Respond warmly and clearly, in Persian if the user writes in Persian.
`;

// ✅ مسیر اصلی
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ مسیر سلامت Railway / Vercel
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ai: "mmdrza.AI", version: "3.4-cloud" });
});

// 💬 مسیر اصلی چت با Stream + مدیریت reconnect
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message." });
  if (!API_KEY) return res.status(500).json({ error: "Missing OpenAI API Key" });

  // 🚀 لاگ ساده (بدون اسپم)
  if (process.env.NODE_ENV !== "production") {
    console.log("💬 User:", message);
  }

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
      const errText = await aiRes.text();
      console.error("❌ OpenAI API error:", errText);
      return res.status(500).json({ error: "OpenAI API failed", detail: errText });
    }

    // ✅ آماده‌سازی استریم SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    async function stream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            const json = line.replace("data: ", "").trim();
            if (json === "[DONE]") {
              res.write("data: [DONE]\n\n");
              res.end();
              if (process.env.NODE_ENV !== "production") console.log("✅ Stream complete");
              return;
            }

            try {
              const parsed = JSON.parse(json);
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) res.write(`data: ${JSON.stringify(token)}\n\n`);
            } catch {
              // ignore broken chunks
            }
          }
        }

        res.end();
      } catch (err) {
        console.error("⚠️ Stream error:", err.message);
        if (!res.headersSent) res.status(500).json({ error: "Stream interrupted" });
      }
    }

    stream();

  } catch (err) {
    console.error("🚨 Fatal Error:", err);
    if (!res.headersSent)
      res.status(500).json({ error: "OpenAI connection failed" });
  }
});

// ✅ 404 Catch — فقط در محیط dev
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});
// 🧩 سیستم ثبت‌نام و ورود ساده با JSON File
import fs from "fs";

// مسیر فایل کاربران
const USERS_FILE = path.join(__dirname, "users.json");

// تابع برای خواندن کاربران
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

// تابع برای ذخیره کاربران
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 🔐 ثبت‌نام کاربر جدید
app.post("/api/signup", (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "Please fill all fields" });

  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: "Email already registered" });
  }

  const newUser = {
    id: Date.now(),
    username,
    email,
    password, // در نسخه بعد هش می‌کنیم
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  res.json({ message: "Signup successful", user: { username, email } });
});

// 🔓 ورود کاربر
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  res.json({ message: "Login successful", user: { username: user.username, email: user.email } });
});

// 🚀 Start Server
app.listen(PORT, () => {
  console.log(`🚀 mmdrza.AI (Cloud Mode) running at http://localhost:${PORT}`);
});
