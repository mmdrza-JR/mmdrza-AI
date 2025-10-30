// 🌌 mmdrza.AI — Ultra Edition Server (v4.0 Secure + Stream Stable)
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import fs from "fs";
import multer from "multer";

// ⚙️ تنظیم محیط
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, "users.json");
const SALT_ROUNDS = 10;

// 📂 تنظیم آپلود فایل‌ها
const upload = multer({ dest: path.join(__dirname, "uploads/") });

// 🧠 شخصیت پیش‌فرض AI
const SYSTEM_PROMPT = `
You are mmdrza.AI — an intelligent academic assistant created by mmdrza.
You answer only educational or scientific questions.
If the topic is not educational, politely refuse and guide back to learning.
Respond warmly and clearly, in Persian if the user writes in Persian.
`;

// ✅ صفحه اصلی
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ مسیر سلامت
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", ai: "mmdrza.AI", version: "4.0-ultra" });
});

// 💬 مسیر چت استریم
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message." });
  if (!API_KEY) return res.status(500).json({ error: "Missing OpenAI API Key" });

  console.log("💬 User:", message);

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

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    if (res.flushHeaders) res.flushHeaders(); // 💡 برای جلوگیری از بافر شدن

    const reader = aiRes.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

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
          console.log("✅ Stream finished successfully");
          res.end();
          return;
        }

        try {
          const parsed = JSON.parse(json);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) res.write(`data: ${JSON.stringify(token)}\n\n`);
        } catch {
          // ignore partials
        }
      }
    }

    // 🔧 پایان امن برای جلوگیری از "سه نقطه" بدون پاسخ
    setTimeout(() => {
      if (!res.writableEnded) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }, 300);
  } catch (err) {
    console.error("🚨 Fatal Error:", err.message);
    if (!res.headersSent)
      res.status(500).json({ error: "OpenAI connection failed" });
  }
});

// 📂 مسیر آپلود فایل برای Ultra
app.post("/api/upload", upload.array("files"), (req, res) => {
  try {
    const fileInfos = req.files.map(f => ({
      name: f.originalname,
      size: f.size,
      path: f.path,
    }));
    console.log("📁 Uploaded:", fileInfos.length, "files");
    res.json({ message: "Files uploaded", files: fileInfos });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// 🧩 مدیریت کاربران
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8") || "[]");
  } catch {
    fs.writeFileSync(USERS_FILE, "[]");
    return [];
  }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 🔐 ثبت‌نام
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: "Please fill all fields" });

  const users = readUsers();
  if (users.find(u => u.email === email))
    return res.status(400).json({ error: "Email already registered" });

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = {
      id: Date.now(),
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      isUltra: false,
    };
    users.push(newUser);
    saveUsers(users);
    console.log("✅ Registered:", email);
    res.json({ message: "Signup successful", user: { username, email } });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// 🔓 ورود
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email);

  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Invalid email or password" });

  console.log("🔐 Login:", email);
  res.json({
    message: "Login successful",
    user: { username: user.username, email: user.email, isUltra: user.isUltra },
  });
});

// 💎 ارتقاء به Ultra
app.post("/api/upgrade", (req, res) => {
  const { email, method } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.isUltra = true;
  user.upgradedAt = new Date().toISOString();
  user.method = method || "manual";
  saveUsers(users);

  console.log("💎 User upgraded to Ultra:", email);
  res.json({ message: "User upgraded to Ultra" });
});

// ✅ صفحه 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

// 🚀 اجرا
app.listen(PORT, () => {
  console.log(`🚀 mmdrza.AI Ultra v4.0 running at http://localhost:${PORT}`);
});
