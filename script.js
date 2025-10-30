// 🌌 mmdrza.AI — ULTRA Stable v5.0
// =========================================
// 🌀 Loader Logic
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) setTimeout(() => loader.classList.add("hidden"), 1800);
});

// =========================================
// 🚀 Main Chat Logic
document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const messages = document.getElementById("chatMessages");
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const scrollIndicator = document.getElementById("scrollIndicator");
  const modal = new bootstrap.Modal(document.getElementById("settingsModal"));

  // --- User info ---
  const user = JSON.parse(localStorage.getItem("mmdrzaUser"));
  const userWelcome = document.getElementById("userWelcome");
  if (userWelcome && user?.username)
    userWelcome.textContent = `👋 Welcome, ${user.username}`;
  else if (userWelcome)
    userWelcome.textContent = "👋 Welcome, Guest";

  // --- Ultra badge ---
  const ultraBadge = document.getElementById("ultraBadge");
  const isUltra = localStorage.getItem("mmdrzaUltra") === "true";
  if (isUltra && ultraBadge) ultraBadge.style.display = "inline-flex";

  // --- Mobile Menu (Offcanvas) ---
  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = new bootstrap.Offcanvas(document.getElementById("mobileMenu"));
  menuToggle?.addEventListener("click", () => mobileMenu.toggle());

  document.getElementById("newChatBtnMobile")?.addEventListener("click", () => {
    document.getElementById("newChatBtn")?.click();
    mobileMenu.hide();
  });
  document.getElementById("clearChatBtnMobile")?.addEventListener("click", () => {
    document.getElementById("clearChatBtn")?.click();
    mobileMenu.hide();
  });
  document.getElementById("openUltraMobile")?.addEventListener("click", () => {
    document.getElementById("ultraBtn")?.click();
    mobileMenu.hide();
  });

  // --- Settings ---
  let typingSpeed = 25;
  let voiceEnabled = false;
  let autoScroll = true;

  // --- Theme ---
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") document.body.classList.add("light-mode");

  document.getElementById("settingsBtn")?.addEventListener("click", () => modal.show());
  document.getElementById("speedRange")?.addEventListener("input", e => typingSpeed = e.target.value);
  document.getElementById("voiceToggle")?.addEventListener("change", e => voiceEnabled = e.target.checked);
  document.getElementById("autoScrollToggle")?.addEventListener("change", e => autoScroll = e.target.checked);

  // 🌗 Theme Button
  const themeBtn = document.createElement("button");
  themeBtn.className = "btn btn-outline-warning btn-sm ms-2";
  themeBtn.innerHTML = savedTheme === "light" ? '<i class="bi bi-moon-stars"></i>' : '<i class="bi bi-sun"></i>';
  document.querySelector(".navbar .container-fluid")?.appendChild(themeBtn);
  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    themeBtn.innerHTML = isLight
      ? '<i class="bi bi-moon-stars"></i>'
      : '<i class="bi bi-sun"></i>';
  });

  // --- Message System ---
  function addMessage(text, sender = "user") {
    const msg = document.createElement("div");
    msg.className = `message msg-${sender}`;
    msg.innerHTML = `<div class="msg-content">${text}</div>`;
    messages.appendChild(msg);
    if (autoScroll) messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
  }

  // --- Send Message ---
  sendBtn?.addEventListener("click", sendMessage);
  input?.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });

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
    } catch {
      msgContent.innerHTML = "⚠️ Connection error.";
    }
  }

  // --- Clear Chat ---
  document.getElementById("clearChatBtn")?.addEventListener("click", () => {
    messages.innerHTML = "";
    addMessage("Chat cleared. Ready to start again!", "ai");
  });

  // --- Scroll Indicator ---
  const chatBox = document.querySelector(".chat-messages");
  chatBox?.addEventListener("scroll", () => {
    const nearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 100;
    scrollIndicator?.classList.toggle("show", !nearBottom);
  });
  scrollIndicator?.addEventListener("click", () => {
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
  });

  // --- New Chat ---
  document.getElementById("newChatBtn")?.addEventListener("click", () => {
    messages.innerHTML = "";
    addMessage("👋 New conversation started. How can I help you study today?", "ai");
  });

  // --- Logout ---
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    if (confirm("آیا مطمئنی می‌خوای خارج بشی؟")) {
      localStorage.removeItem("mmdrzaUser");
      addMessage("👋 Logged out successfully!", "ai");
      setTimeout(() => window.location.href = "index.html", 800);
    }
  });

  // --- Greeting Message ---
  if (messages && user?.username)
    addMessage(`سلام ${user.username} 🌌! من mmdrza.AI هستم — آماده‌ام کمکت کنم 💬`, "ai");

  // Attach Panel Setup ادامه در بخش دوم...
});
// =========================================
// 📎 Attach Panel + Upload + Ultra Activation
// =========================================
(function initUltraSystem() {
  const ultraBtn = document.getElementById("ultraBtn");
  const ultraModal = document.getElementById("ultraModal");
  const ultraClose = document.getElementById("ultraClose");
  const ultraManual = document.getElementById("ultraManual");
  const ultraFeatures = document.getElementById("ultraFeatures");
  const merchantCardEl = document.getElementById("merchantCardNumber");
  const showCardBtn = document.getElementById("showCardBtn");
  const copyCardBtn = document.getElementById("copyCardBtn");

  // 🧩 Attach Panel
  const attachBtn = document.getElementById("attachBtn");
  const attachPanel = document.getElementById("attachPanel");
  const closeAttach = document.getElementById("closeAttach");
  const hiddenFileInput = document.getElementById("hiddenFileInput");
  const filePreviewContainer = document.getElementById("filePreviewContainer");

  // 🪄 Panel Open / Close
  attachBtn?.addEventListener("click", () => attachPanel.classList.add("show"));
  closeAttach?.addEventListener("click", () => attachPanel.classList.remove("show"));

  // --- File Options ---
  document.getElementById("attachPhoto")?.addEventListener("click", () => {
    hiddenFileInput.accept = "image/*";
    hiddenFileInput.click();
  });
  document.getElementById("attachFile")?.addEventListener("click", () => {
    hiddenFileInput.accept = "*/*";
    hiddenFileInput.click();
  });
  document.getElementById("attachPdf")?.addEventListener("click", () => {
    hiddenFileInput.accept = "application/pdf";
    hiddenFileInput.click();
  });

  // --- File Preview ---
  let selectedFiles = [];
  hiddenFileInput?.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    selectedFiles = [...selectedFiles, ...files];
    renderPreviews();
    attachPanel.classList.remove("show");
  });

  function renderPreviews() {
    if (!filePreviewContainer) return;
    filePreviewContainer.innerHTML = "";
    selectedFiles.forEach((file, i) => {
      const item = document.createElement("div");
      item.className = "file-item";

      const removeBtn = document.createElement("button");
      removeBtn.className = "file-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.onclick = () => {
        selectedFiles.splice(i, 1);
        renderPreviews();
      };

      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        item.appendChild(img);
      } else {
        const name = document.createElement("span");
        name.textContent = file.name;
        item.appendChild(name);
      }

      item.appendChild(removeBtn);
      filePreviewContainer.appendChild(item);
    });
  }

  // 💳 پرداخت دستی — شماره کارت
  const MERCHANT_CARD = "5022-2913-3773-8171"; // ← شماره کارت تو
  function maskCard(card) {
    const last4 = card.slice(-4);
    return "•••• •••• •••• " + last4;
  }
  if (merchantCardEl) merchantCardEl.textContent = maskCard(MERCHANT_CARD);

  // دکمه نمایش کامل شماره کارت
  showCardBtn?.addEventListener("click", () => {
    if (merchantCardEl.textContent.includes("•")) {
      merchantCardEl.textContent = MERCHANT_CARD;
      showCardBtn.textContent = "مخفی کن";
    } else {
      merchantCardEl.textContent = maskCard(MERCHANT_CARD);
      showCardBtn.textContent = "نمایش کامل";
    }
  });

  // دکمه کپی شماره کارت
  copyCardBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(MERCHANT_CARD);
      copyCardBtn.textContent = "کپی شد ✓";
      setTimeout(() => (copyCardBtn.textContent = "کپی"), 1500);
    } catch {
      alert("کپی ناموفق بود. لطفاً دستی کپی کن.");
    }
  });

  // 🎯 انتخاب نوع اشتراک
  document.querySelectorAll(".price-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".price-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      const plan = card.querySelector("h4").innerText.trim();
      console.log("✅ Plan selected:", plan);
    });
  });

  // 💎 فعال‌سازی نسخه Ultra
  ultraManual?.addEventListener("click", async () => {
    if (!confirm("آیا مطمئنی که مبلغ را کارت‌به‌کارت کردی؟")) return;

    const user = JSON.parse(localStorage.getItem("mmdrzaUser"));
    try {
      if (user?.email) {
        await fetch("/api/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, method: "manual" }),
        });
      }
    } catch (err) {
      console.warn("⚠️ Server upgrade failed:", err.message);
    }

    localStorage.setItem("mmdrzaUltra", "true");
    ultraModal.classList.remove("show");
    ultraBtn.style.display = "none";
    ultraFeatures.style.display = "block";
    alert("✅ نسخه Ultra با موفقیت فعال شد.");
  });

  // 💎 باز و بسته کردن پنجره Ultra
  ultraBtn?.addEventListener("click", () => ultraModal.classList.add("show"));
  ultraClose?.addEventListener("click", () => ultraModal.classList.remove("show"));

  // 🔒 اگر کاربر Ultra نیست، هشدار بده
  const isUltra = localStorage.getItem("mmdrzaUltra") === "true";
  function requireUltra() {
    if (isUltra) return true;

    const overlay = document.createElement("div");
    overlay.className = "ultra-lock-overlay animate__animated animate__fadeIn";
    overlay.innerHTML = `
      <div class="ultra-lock-box animate__animated animate__zoomIn">
        <h4>💎 نسخه Ultra مورد نیاز است</h4>
        <p>برای استفاده از ارسال فایل و عکس، نسخه Ultra را فعال کنید 🌟</p>
        <button class="btn btn-warning mt-2" id="openUltraBtn">فعال‌سازی نسخه Ultra</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("openUltraBtn").addEventListener("click", () => {
      overlay.remove();
      ultraModal?.classList.add("show");
    });
    overlay.addEventListener("click", e => {
      if (e.target === overlay) overlay.remove();
    });
    return false;
  }

  // ⚡ آپلود فایل برای کاربران Ultra
  const uploadResult = document.getElementById("uploadResult") || document.createElement("div");
  uploadResult.style.fontSize = "0.9rem";
  uploadResult.style.marginTop = "0.3rem";
  document.querySelector(".chat-input")?.appendChild(uploadResult);

  hiddenFileInput?.addEventListener("change", async () => {
    if (!requireUltra()) return;

    const files = hiddenFileInput.files;
    if (!files || files.length === 0) return;

    const fd = new FormData();
    for (let i = 0; i < files.length; i++) fd.append("files", files[i]);

    uploadResult.innerHTML = "⏳ Uploading...";
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok) {
        uploadResult.innerHTML = `✅ Uploaded ${j.files?.length || 0} file(s)`;
      } else {
        uploadResult.innerHTML = `❌ Upload failed: ${j.error}`;
      }
    } catch (err) {
      uploadResult.innerHTML = `⚠️ Error: ${err.message}`;
    }
    hiddenFileInput.value = "";
  });
})();
