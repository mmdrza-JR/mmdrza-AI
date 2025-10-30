// 🌀 LOADER LOGIC
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  setTimeout(() => loader.classList.add("hidden"), 1800); // زمان نمایشش
});

document.addEventListener("DOMContentLoaded", () => {
  const messages = document.getElementById("chatMessages");
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const scrollIndicator = document.getElementById("scrollIndicator");
  const modal = new bootstrap.Modal(document.getElementById("settingsModal"));

  let typingSpeed = 25;
  let voiceEnabled = false;
  let autoScroll = true;

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

  // 🚀 Send event
  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
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
  msgContent.innerHTML += token; // متن استریم‌شده
} catch {
  msgContent.innerHTML += data.replace(/["']/g, ""); // درصورت JSON ناقص
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
// ✅ مسیر 404 — هر مسیر ناشناخته بره به صفحه‌ی سفارشی

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

});
