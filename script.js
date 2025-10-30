// 🌀 LOADER LOGIC
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  setTimeout(() => loader.classList.add("hidden"), 1800);
});

document.addEventListener("DOMContentLoaded", () => {
  const messages = document.getElementById("chatMessages");
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const scrollIndicator = document.getElementById("scrollIndicator");
  const modal = new bootstrap.Modal(document.getElementById("settingsModal"));
  // 🧠 نمایش نام کاربر در هدر (Welcome message)
const userWelcome = document.getElementById("userWelcome");
if (userWelcome) {
  const user = JSON.parse(localStorage.getItem("mmdrzaUser"));
  if (user && user.username) {
    userWelcome.textContent = `👋 Welcome, ${user.username}`;
  } else {
    userWelcome.textContent = "👋 Welcome, Guest";
  }
}

  let typingSpeed = 25;
  let voiceEnabled = false;
  let autoScroll = true;

  // 🧩 بررسی ورود کاربر و تنظیم محدودیت پیام
  const user = JSON.parse(localStorage.getItem("mmdrzaUser"));
  let messageCount = 0;
  const MAX_MESSAGES = user ? Infinity : 5; // اگر لاگین نیستی، فقط ۵ پیام مجاز

  // 🌓 Load saved theme
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") document.body.classList.add("light-mode");

  // ⚙️ Settings
  document.getElementById("settingsBtn").addEventListener("click", () => modal.show());
  document.getElementById("speedRange").addEventListener("input", e => typingSpeed = e.target.value);
  document.getElementById("voiceToggle").addEventListener("change", e => voiceEnabled = e.target.checked);
  document.getElementById("autoScrollToggle").addEventListener("change", e => autoScroll = e.target.checked);

  // 🌗 Theme switch button
  const themeBtn = document.createElement("button");
  themeBtn.className = "btn btn-outline-warning btn-sm ms-2";
  themeBtn.innerHTML = savedTheme === "light" ? '<i class="bi bi-moon-stars"></i>' : '<i class="bi bi-sun"></i>';
  document.querySelector(".navbar .container-fluid").appendChild(themeBtn);

  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    themeBtn.innerHTML = isLight
      ? '<i class="bi bi-moon-stars"></i>'
      : '<i class="bi bi-sun"></i>';
  });

  // 💬 Add message
  function addMessage(text, sender = "user") {
    const msg = document.createElement("div");
    msg.className = `message msg-${sender}`;
    msg.innerHTML = `<div class="msg-content">${text}</div>`;
    messages.appendChild(msg);
    if (autoScroll) messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
  }

  // 🧩 محدودیت پیام برای کاربران مهمان
  function canSendMessage() {
    if (!user && messageCount >= MAX_MESSAGES) {
      addMessage("⚠️ برای ادامه لطفاً وارد حساب خود شوید یا ثبت‌نام کنید 🌟", "ai");
      return false;
    }
    return true;
  }

  // 🚀 Send event
  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    if (!canSendMessage()) return;

    messageCount++; // شمارنده‌ی پیام‌ها

    addMessage(text, "user");
    input.value = "";

    const aiMsg = document.createElement("div");
    aiMsg.className = "message msg-ai";
    const msgContent = document.createElement("div");
    msgContent.className = "msg-content";
    msgContent.innerHTML = "🤖 ...";
    aiMsg.appendChild(msgContent);
    messages.appendChild(aiMsg);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.replace("data:", "").trim();
          if (data === "[DONE]") return;
          try {
            const token = JSON.parse(data);
            msgContent.innerHTML += token;
          } catch {
            msgContent.innerHTML += data.replace(/["']/g, "");
          }

          if (autoScroll) messages.scrollTo({ top: messages.scrollHeight });
        }
      }

      if (voiceEnabled) {
        const utter = new SpeechSynthesisUtterance(msgContent.innerText);
        speechSynthesis.speak(utter);
      }

    } catch (err) {
      msgContent.innerHTML = "⚠️ Connection error.";
    }
  }

  // 🧹 Clear chat
  document.getElementById("clearChatBtn").addEventListener("click", () => {
    messages.innerHTML = "";
    addMessage("Chat cleared. Ready to start again!", "ai");
  });

  // 📩 Scroll indicator
  const chatBox = document.querySelector(".chat-messages");
  chatBox.addEventListener("scroll", () => {
    const nearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 100;
    scrollIndicator.classList.toggle("show", !nearBottom);
  });
  scrollIndicator.addEventListener("click", () => {
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
  });

  // ➕ New Chat Button
  const newChatBtn = document.getElementById("newChatBtn");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      messages.innerHTML = "";
      addMessage("👋 New conversation started. How can I help you study today?", "ai");
    });
  }
  // 🔒 Logout button
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    if (confirm("آیا مطمئنی می‌خوای از حساب خارج بشی؟")) {
      localStorage.removeItem("mmdrzaUser"); // پاک کردن کاربر
      addMessage("👋 Logged out successfully!", "ai");
      setTimeout(() => {
        window.location.href = "index.html"; // برگشت به صفحه‌ی ورود
      }, 1000);
    }
  });
}

});
