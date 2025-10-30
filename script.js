// 🌀 LOADER LOGIC
window.addEventListener("load", () => {
  const loader = document.getElementById("loader");
  if (loader) setTimeout(() => loader.classList.add("hidden"), 1800);
});

document.addEventListener("DOMContentLoaded", () => {
  // عناصر اصلی
  const messages = document.getElementById("chatMessages");
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const scrollIndicator = document.getElementById("scrollIndicator");
  const modal = new bootstrap.Modal(document.getElementById("settingsModal"));

  // 🧠 نمایش نام کاربر در هدر
  const user = JSON.parse(localStorage.getItem("mmdrzaUser"));
  const userWelcome = document.getElementById("userWelcome");
  if (userWelcome && user && user.username) {
    userWelcome.textContent = `👋 Welcome, ${user.username}`;
  } else if (userWelcome) {
    userWelcome.textContent = "👋 Welcome, Guest";
  }
// ⭐ نمایش نشان ULTRA برای کاربران ویژه
const ultraBadge = document.getElementById("ultraBadge");
const isUltra = localStorage.getItem("mmdrzaUltra") === "true";
if (isUltra && ultraBadge) {
  ultraBadge.style.display = "inline-flex";
}

  // تنظیمات اولیه
  let typingSpeed = 25;
  let voiceEnabled = false;
  let autoScroll = true;

  // 🌓 تم ذخیره‌شده
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") document.body.classList.add("light-mode");

  // ⚙️ تنظیمات پنجره
  document.getElementById("settingsBtn")?.addEventListener("click", () => modal.show());
  document.getElementById("speedRange")?.addEventListener("input", e => typingSpeed = e.target.value);
  document.getElementById("voiceToggle")?.addEventListener("change", e => voiceEnabled = e.target.checked);
  document.getElementById("autoScrollToggle")?.addEventListener("change", e => autoScroll = e.target.checked);

  // 🌗 دکمه تغییر تم
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

  // 💬 افزودن پیام
  function addMessage(text, sender = "user") {
    const msg = document.createElement("div");
    msg.className = `message msg-${sender}`;
    msg.innerHTML = `<div class="msg-content">${text}</div>`;
    messages.appendChild(msg);
    if (autoScroll) messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
  }

  // 🚀 ارسال پیام
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

    } catch (err) {
      msgContent.innerHTML = "⚠️ Connection error.";
    }
  }

  // 🧹 پاک‌کردن چت
  document.getElementById("clearChatBtn")?.addEventListener("click", () => {
    messages.innerHTML = "";
    addMessage("Chat cleared. Ready to start again!", "ai");
  });

  // 📩 نشانگر اسکرول
  const chatBox = document.querySelector(".chat-messages");
  chatBox?.addEventListener("scroll", () => {
    const nearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 100;
    scrollIndicator?.classList.toggle("show", !nearBottom);
  });
  scrollIndicator?.addEventListener("click", () => {
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
  });

  // ➕ دکمه شروع چت جدید
  const newChatBtn = document.getElementById("newChatBtn");
  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      messages.innerHTML = "";
      addMessage("👋 New conversation started. How can I help you study today?", "ai");
    });
  }

  // 🔒 دکمه خروج از حساب
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("آیا مطمئنی می‌خوای از حساب خارج بشی؟")) {
        localStorage.removeItem("mmdrzaUser");
        addMessage("👋 Logged out successfully!", "ai");
        setTimeout(() => window.location.href = "index.html", 1000);
      }
    });
  }

  // 🖐️ خوش‌آمد اولیه در شروع چت
  if (messages && user && user.username) {
    addMessage(`سلام ${user.username} 🌌! من mmdrza.AI هستم — آماده‌ام کمکت کنم 💬`, "ai");
  }
});
// ---------- Ultra manual-payment UI (show merchant card, copy, confirm manual) ----------
(function initUltraManual() {
  const ultraBtn = document.getElementById("ultraBtn");
  const ultraModal = document.getElementById("ultraModal");
  const ultraClose = document.getElementById("ultraClose");
  const ultraManual = document.getElementById("ultraManual");
  const ultraFeatures = document.getElementById("ultraFeatures");
  const ultraUpload = document.getElementById("ultraUpload");
  const ultraUploadBtn = document.getElementById("ultraUploadBtn");
  const uploadResult = document.getElementById("uploadResult");
  const merchantCardEl = document.getElementById("merchantCardNumber");
  const showCardBtn = document.getElementById("showCardBtn");
  const copyCardBtn = document.getElementById("copyCardBtn");
// 🪄 Attach Panel Logic
const attachBtn = document.getElementById("attachBtn");
const attachPanel = document.getElementById("attachPanel");
const closeAttach = document.getElementById("closeAttach");
const hiddenFileInput = document.getElementById("hiddenFileInput");

attachBtn?.addEventListener("click", () => {
  attachPanel.classList.add("show");
});

closeAttach?.addEventListener("click", () => {
  attachPanel.classList.remove("show");
});

// 📎 فایل انتخابی با هر دکمه
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
// 🎯 انتخاب نوع اشتراک (ماهانه یا سالانه)
document.querySelectorAll(".price-card").forEach(card => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".price-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");

    // نمایش انتخاب در کنسول یا ثبت برای فعال‌سازی
    const plan = card.querySelector("h4").innerText.trim();
    console.log("✅ Selected plan:", plan);
  });
});

hiddenFileInput?.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    attachPanel.classList.remove("show");
    alert(`✅ ${files.length} فایل انتخاب شد.`);
  }
});

  if (!ultraBtn) return;

  // ====== ⚠️ اینجا شماره کارت خودت رو قرار بده (یا از سرور بگیر) ======
  // مثال: const MERCHANT_CARD = "6037-1234-5678-9012";
  // یا برای امنیت بیشتر: const MERCHANT_CARD = "6037-****-****-9012";
  const MERCHANT_CARD = "5022-2913-3773-8171"; // <-- شماره‌ کارتِ خودت رو اینجا بذار

  // نمایش ماسک‌شده اولیه (مثال: اول/وسط مخفی)
  function maskCard(card) {
    // ساده: نمایش 4 رقم آخر و بقیه مخفی
    const last4 = card.slice(-4);
    return "•••• •••• •••• " + last4;
  }
  if (merchantCardEl) merchantCardEl.textContent = maskCard(MERCHANT_CARD);

  // دکمه نمایش کامل
  showCardBtn?.addEventListener("click", () => {
    if (merchantCardEl.textContent.includes("•")) {
      merchantCardEl.textContent = MERCHANT_CARD;
      showCardBtn.textContent = "مخفی کن";
    } else {
      merchantCardEl.textContent = maskCard(MERCHANT_CARD);
      showCardBtn.textContent = "نمایش کامل";
    }
  });

  // دکمه کپی
  copyCardBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(MERCHANT_CARD);
      copyCardBtn.textContent = "کپی شد ✓";
      setTimeout(() => (copyCardBtn.textContent = "کپی"), 1500);
    } catch {
      alert("کپی ناموفق — لطفاً دستی کپی کنید.");
    }
  });

  // اگر کاربر قبلاً Ultra خریده، نمایش امکانات
  const localUltra = localStorage.getItem("mmdrzaUltra") === "true";
  if (localUltra) {
    ultraFeatures.style.display = "block";
    ultraBtn.style.display = "none";
  } else {
    ultraBtn.addEventListener("click", () => ultraModal.classList.add("show"));
    ultraClose.addEventListener("click", () => ultraModal.classList.remove("show"));
  }

  // تأیید پرداخت دستی — کاربر کلیک می‌کنه پس خودش واریز کرده
  ultraManual?.addEventListener("click", async () => {
    if (!confirm("آیا مطمئنی که مبلغ را کارت‌به‌کارت کردی؟ در صورت تأیید، امکانات Ultra فعال خواهند شد.")) return;

    // اگر کاربر لاگین است -> اطلاع به سرور برای ثبت isUltra
    const user = JSON.parse(localStorage.getItem("mmdrzaUser"));
    if (user && user.email) {
      try {
        const res = await fetch("/api/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: "manual", email: user.email })
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "server error");
      } catch (err) {
        // اگر سرور نباشه یا خطا، ما local flag رو هم میذاریم — در production بهتره تایید سروری باشه
        console.warn("upgrade API failed or absent:", err?.message || err);
      }
    }

    // ثبت محلی و فعال‌سازی UI
    localStorage.setItem("mmdrzaUltra", "true");
    ultraModal.classList.remove("show");
    ultraBtn.style.display = "none";
    ultraFeatures.style.display = "block";
    alert("✅ درخواست ثبت شد. امکانات ULTRA (آپلود فایل) فعال شد.");
  });

  // آپلود (مثل نمونه قبلی)
  ultraUploadBtn?.addEventListener("click", async () => {
    const files = ultraUpload.files;
    if (!files || files.length === 0) { uploadResult.innerText = "فایلی انتخاب نشده."; return; }
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) fd.append("files", files[i]);
    uploadResult.innerText = "در حال آپلود...";
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (res.ok) uploadResult.innerText = "آپلود موفق: " + (j.files?.length || 0) + " فایل";
      else uploadResult.innerText = "خطا: " + (j.error || "upload failed");
    } catch (err) {
      uploadResult.innerText = "خطا در ارسال: " + err.message;
    }
  });

})();
// ---------- 📎 File Upload Button ----------
// ---------- 📎 File Upload (Ultra only) ----------
const hiddenInput = document.getElementById("hiddenFileInput");
// 🖼️ File Preview (Lightweight)
const filePreviewContainer = document.getElementById("filePreviewContainer");
let selectedFiles = [];

// 📎 کلیک روی گزینه‌های منو
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

// 📥 رویداد انتخاب فایل
hiddenFileInput?.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);
  selectedFiles = [...selectedFiles, ...files];
  renderFilePreviews();
});

// 🧩 تابع رندر پیش‌نمایش
function renderFilePreviews() {
  filePreviewContainer.innerHTML = "";
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "file-item";

    const removeBtn = document.createElement("button");
    removeBtn.className = "file-remove";
    removeBtn.innerHTML = "&times;";
    removeBtn.onclick = () => {
      selectedFiles.splice(index, 1);
      renderFilePreviews();
    };

    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      item.appendChild(img);
    } else {
      const name = document.createElement("span");
      name.textContent = file.name.split(".").pop().toUpperCase();
      item.appendChild(name);
    }

    item.appendChild(removeBtn);
    filePreviewContainer.appendChild(item);
  });
}

const uploadResult = document.getElementById("uploadResult") || document.createElement("div");
uploadResult.style.fontSize = "0.9rem";
uploadResult.style.marginTop = "0.3rem";
document.querySelector(".chat-input")?.appendChild(uploadResult);

// دریافت وضعیت کاربر (عادی یا Ultra)
const currentUser = JSON.parse(localStorage.getItem("mmdrzaUser")) || {};
const isUltra = localStorage.getItem("mmdrzaUltra") === "true" || currentUser.isUltra;

// تابع انتخاب فایل
function openFileSelector(accept) {
  if (!isUltra) {
    showUltraLock(); // اگر نسخه Ultra نیست، هشدار بده
    return;
  }
  hiddenInput.accept = accept;
  hiddenInput.click();
}

// گزینه‌ها
document.getElementById("attachPhoto")?.addEventListener("click", () => openFileSelector("image/*"));
document.getElementById("attachFile")?.addEventListener("click", () => openFileSelector("*/*"));
document.getElementById("attachPdf")?.addEventListener("click", () => openFileSelector("application/pdf"));

// عملکرد انتخاب فایل
hiddenInput?.addEventListener("change", async () => {
  const files = hiddenInput.files;
  if (!files || files.length === 0) return;

  const fd = new FormData();
  for (let i = 0; i < files.length; i++) fd.append("files", files[i]);

  uploadResult.innerHTML = "⏳ Uploading...";
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (res.ok) {
      uploadResult.innerHTML = `✅ Uploaded ${j.files.length} file(s)`;
      addMessage(`📂 Uploaded <b>${j.files.map(f => f.name).join(", ")}</b>`, "ai");
    } else {
      uploadResult.innerHTML = `❌ Upload failed: ${j.error}`;
    }
  } catch (err) {
    uploadResult.innerHTML = `⚠️ Error: ${err.message}`;
  }

  hiddenInput.value = "";
});

// 💎 تابع نمایش هشدار برای کاربران عادی
function showUltraLock() {
  if (document.querySelector(".ultra-lock-overlay")) return; // از چندبار ساختن جلوگیری کن

  const overlay = document.createElement("div");
  overlay.className = "ultra-lock-overlay animate__animated animate__fadeIn";

  overlay.innerHTML = `
    <div class="ultra-lock-box animate__animated animate__zoomIn">
      <h4>💎 نسخه Ultra مورد نیاز است</h4>
      <p>برای استفاده از قابلیت ارسال عکس و فایل، باید نسخه Ultra را فعال کنید 🌟</p>
      <button class="btn btn-warning mt-2" id="openUltraBtn">
        فعال‌سازی نسخه Ultra
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("openUltraBtn").addEventListener("click", () => {
    overlay.classList.add("animate__fadeOut");
    setTimeout(() => {
      overlay.remove();
      const ultraModal = document.getElementById("ultraModal");
      ultraModal?.classList.add("show"); // نمایش پنجره Ultra
    }, 300);
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.classList.add("animate__fadeOut");
      setTimeout(() => overlay.remove(), 300);
    }
  });
}
// 💎 Floating Ultra Button — open modal
document.addEventListener("DOMContentLoaded", () => {
  const ultraBtn = document.getElementById("ultraBtn");
  const ultraModal = document.getElementById("ultraModal");
  const ultraClose = document.getElementById("ultraClose");

  if (!ultraBtn || !ultraModal) return;

  ultraBtn.addEventListener("click", () => {
    ultraModal.classList.add("show");
  });

  ultraClose?.addEventListener("click", () => {
    ultraModal.classList.remove("show");
  });
});

