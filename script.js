// mmdrza.AI — script.js (Pro Lite v5.4)
// Author: you 🫡  — tuned for speed, stability, mobile friendliness

// ============= Tiny helpers =============
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const noop = () => {};

const App = {
  get user()   { try { return JSON.parse(localStorage.getItem("mmdrzaUser")||"null"); } catch { return null; } },
  get isUltra(){ return localStorage.getItem("mmdrzaUltra")==="true"; },
  set isUltra(v){ localStorage.setItem("mmdrzaUltra", v?"true":"false"); },
  get model()  { return localStorage.getItem("mm_model") || "gpt-neo"; },
  set model(v) { localStorage.setItem("mm_model", v); },
  voice: false,
  autoScroll: true,
  // stream control
  _ctrl: null,
};

const scroll = {
  isNearBottom(el, thresh=80){
    if (!el) return true;
    const delta = el.scrollHeight - el.scrollTop - el.clientHeight;
    return delta < thresh;
  },
  toBottom(el){ el?.scrollTo({ top: el.scrollHeight }); },
};

// ============= Loader =============
window.addEventListener("load", () => {
  const loader = $("#loader");
  if (loader) setTimeout(()=> loader.classList.add("hidden"), 1800);
});

// ============= Markdown & Highlight =============
function renderMD(text){
  try{
    const raw  = marked.parse(text, { breaks: true });
    const safe = DOMPurify.sanitize(raw, { ALLOWED_ATTR: ["class","href","target","rel"] });
    const tmp  = document.createElement("div");
    tmp.innerHTML = safe;
    tmp.querySelectorAll("a[href]").forEach(a=>{ a.target="_blank"; a.rel="noopener noreferrer"; });
    return tmp.innerHTML;
  }catch{
    return text.replace(/[<>&]/g, s=>({ "<":"&lt;",">":"&gt;","&":"&amp;" }[s]));
  }
}
function highlightInside(el){ try{ el.querySelectorAll("pre code").forEach(b=>hljs.highlightElement(b)); }catch{} }
function attachCopyButtons(scope){
  scope.querySelectorAll("pre").forEach(pre=>{
    if (pre.querySelector(".md-copy")) return;
    const btn = document.createElement("button");
    btn.className = "md-copy";
    btn.textContent = "Copy";
    btn.onclick = async ()=>{
      try{
        await navigator.clipboard.writeText(pre.innerText.trim());
        btn.textContent = "Copied ✓";
        setTimeout(()=> btn.textContent = "Copy", 1100);
      }catch{}
    };
    pre.style.position = "relative";
    Object.assign(btn.style,{ position:"absolute", top:"8px", right:"8px", fontSize:"12px", padding:"4px 8px", borderRadius:"8px", cursor:"pointer" });
    pre.appendChild(btn);
  });
}

// Progressive MD renderer during streaming (very light)
(function mountMDObserver(){
  const mount = $("#chatMessages");
  if (!mount) return;
  let raf = 0;
  const obs = new MutationObserver(()=>{
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(()=>{
      $$(".message.msg-ai .msg-content", mount).forEach(n=>{
        if (!n.dataset.md || n.dataset.md === "0"){
          // render progressively, but no copy buttons until final
          n.innerHTML = renderMD(n.textContent);
          highlightInside(n);
        }
      });
    });
  });
  obs.observe(mount, { childList:true, subtree:true, characterData:true });
})();

function finalRender(el){
  el.innerHTML  = renderMD(el.textContent);
  el.dataset.md = "1";
  highlightInside(el);
  attachCopyButtons(el);
}

// ============= Messages UI =============
function addMessage(text, sender="user"){
  const messages = $("#chatMessages");
  if (!messages) return null;

  const label  = document.createElement("div");
  label.className = "label";
  label.textContent = sender==="user" ? "You" : "AI";

  const msg   = document.createElement("div");
  msg.className = `message msg-${sender}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";

  const wrap  = document.createElement("div");
  wrap.className = "msg-content";
  wrap.textContent = text; // raw during stream

  msg.appendChild(avatar);
  msg.appendChild(wrap);
  messages.appendChild(label);
  messages.appendChild(msg);

  if (App.autoScroll && scroll.isNearBottom(messages)) scroll.toBottom(messages);
  return wrap;
}

function updateActionsForLastAI(){
  const msgs = $$(".message.msg-ai");
  if (!msgs.length) return;
  $$(".msg-actions").forEach(x=>x.remove());
  const last = msgs[msgs.length-1];
  const content = $(".msg-content", last);
  if (!content) return;

  const bar = document.createElement("div");
  bar.className = "msg-actions";
  bar.innerHTML = `
    <button class="btn btn-sm" id="actCopy">Copy</button>
    <button class="btn btn-sm" id="actRegen">Regenerate</button>
  `;
  last.insertAdjacentElement("afterend", bar);

  $("#actCopy", bar)?.addEventListener("click", async ()=>{
    try{ await navigator.clipboard.writeText(content.innerText.trim()); }catch{}
  });

  $("#actRegen", bar)?.addEventListener("click", ()=>{
    const lastUser = $$(".message.msg-user .msg-content").pop();
    if (!lastUser) return;
    // cancel any running stream
    try{ App._ctrl?.abort(); }catch{}
    content.textContent = "🔄 Regenerating...";
    content.dataset.md  = "0";
    sendMessage(lastUser.textContent.trim());
  });
}

// ============= Streaming Chat =============
async function sendMessage(seedText){
  window.sendMessage = sendMessage; // expose

  const input    = $("#userInput");
  const messages = $("#chatMessages");
  const text     = (seedText ?? input?.value ?? "").trim();
  if (!text) return;

  addMessage(text, "user");
  if (!seedText && input) input.value = "";

  const aiWrap = addMessage("🤖 ...", "ai");
  if (!aiWrap) return;
  aiWrap.dataset.md = "0";

  // cancel previous stream if any
  try{ App._ctrl?.abort(); }catch{}
  const ctrl = new AbortController();
  App._ctrl = ctrl;

  // typing indicator
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  messages.appendChild(typing);

  try{
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ message: text, model: App.model }),
      signal: ctrl.signal,
    });

    if (!response.ok || !response.body){
      throw new Error("Network");
    }

    const reader = response.body.getReader();
    const dec    = new TextDecoder("utf-8");
    let buffer   = "";
    let acc      = "";

    while(true){
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream:true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const line of chunks){
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]"){ buffer=""; break; }

        let piece = "";
        try{
          const j = JSON.parse(data);
          piece = typeof j === "string" ? j : (j.token ?? "");
        }catch{
          piece = data.replace(/^['"]|['"]$/g, "");
        }

        acc += piece;
        aiWrap.textContent = acc;
        // only autoscroll when user is near bottom
        if (App.autoScroll && scroll.isNearBottom(messages)) scroll.toBottom(messages);
      }
    }

    typing.remove();
    aiWrap.dataset.md = "1";
    finalRender(aiWrap);
    updateActionsForLastAI();

    if (App.voice && "speechSynthesis" in window){
      try{
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(aiWrap.innerText || "");
        window.speechSynthesis.speak(u);
      }catch{}
    }
  }catch(err){
    if (ctrl.signal.aborted){
      // stream aborted intentionally (e.g., regenerate) — clean typing & exit
      try{ typing.remove(); }catch{}
      return;
    }
    console.warn("[chat] stream error:", err?.message||err);
    try{ typing.remove(); }catch{}
    aiWrap.textContent = "⚠️ Connection error.";
    aiWrap.dataset.md  = "1";
    finalRender(aiWrap);
  }
}

// ============= DOM Ready Wiring =============
document.addEventListener("DOMContentLoaded", () => {
  const messages       = $("#chatMessages");
  const input          = $("#userInput");
  const sendBtn        = $("#sendBtn");
  const scrollIndicator= $("#scrollIndicator");

  // Welcome
  const userWelcome = $("#userWelcome");
  if (userWelcome) userWelcome.textContent = App.user?.username ? `👋 Welcome, ${App.user.username}` : "👋 Welcome, Guest";

  // Ultra badge
  const ultraBadge = $("#ultraBadge");
  if (App.isUltra && ultraBadge) ultraBadge.style.display = "inline-flex";

  // Offcanvas (mobile menu) + inert behavior
  const menuToggle   = $("#menuToggle");
  const mobileMenuEl = $("#mobileMenu");
  const mobileMenu   = mobileMenuEl ? new bootstrap.Offcanvas(mobileMenuEl) : null;
  menuToggle?.addEventListener("click", ()=> mobileMenu?.toggle());

  $("#newChatBtnMobile")?.addEventListener("click", ()=>{ $("#newChatBtn")?.click(); mobileMenu?.hide(); });
  $("#clearChatBtnMobile")?.addEventListener("click", ()=>{ $("#clearChatBtn")?.click(); mobileMenu?.hide(); });
  $("#openUltraMobile")?.addEventListener("click", ()=>{ $("#ultraBtn")?.click(); mobileMenu?.hide(); });

  // Settings
  const settingsEl = $("#settingsModal");
  const modal      = settingsEl ? new bootstrap.Modal(settingsEl) : null;
  $("#settingsBtn")?.addEventListener("click", ()=> modal?.show());
  $("#speedRange")?.addEventListener("input", noop);
  $("#voiceToggle")?.addEventListener("change", e=> App.voice      = !!e.target.checked);
  $("#autoScrollToggle")?.addEventListener("change", e=> App.autoScroll = !!e.target.checked);

  // Theme toggle
  const savedTheme = localStorage.getItem("theme") || "dark";
  if (savedTheme === "light") document.body.classList.add("light-mode");
  const themeBtn = document.createElement("button");
  themeBtn.className = "btn btn-outline-warning btn-sm ms-2";
  themeBtn.innerHTML = savedTheme === "light" ? '<i class="bi bi-moon-stars"></i>' : '<i class="bi bi-sun"></i>';
  $(".navbar .container-fluid")?.appendChild(themeBtn);
  themeBtn.addEventListener("click", ()=>{
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    themeBtn.innerHTML = isLight ? '<i class="bi bi-moon-stars"></i>' : '<i class="bi bi-sun"></i>';
  });

  // Send hooks
  sendBtn?.addEventListener("click", ()=> sendMessage());
  input?.addEventListener("keypress", e=>{ if (e.key === "Enter") sendMessage(); });

  // iOS/Android keyboard safe: keep input visible
  input?.addEventListener("focus", ()=>{
    const cm = $(".chat-main");
    cm?.scrollIntoView({ block: "end" });
    setTimeout(()=> scroll.toBottom(messages), 100);
  });

  // Clear / New
  $("#clearChatBtn")?.addEventListener("click", ()=>{
    if (!messages) return;
    messages.innerHTML = "";
    addMessage("Chat cleared. Ready to start again!", "ai");
    scroll.toBottom(messages);
  });
  $("#newChatBtn")?.addEventListener("click", ()=>{
    if (!messages) return;
    messages.innerHTML = "";
    addMessage("👋 New conversation started. How can I help you study today?", "ai");
    scroll.toBottom(messages);
  });

  // Logout
  $("#logoutBtn")?.addEventListener("click", ()=>{
    if (confirm("آیا مطمئنی می‌خوای خارج بشی؟")){
      try { localStorage.removeItem("mmdrzaUser"); localStorage.removeItem("mm_user_name"); } catch {}
      addMessage("👋 Logged out successfully!", "ai");
      setTimeout(()=> window.location.href="index.html", 800);
    }
  });

  // Scroll indicator (only when user is away from bottom)
  const chatBox = $(".chat-messages");
  chatBox?.addEventListener("scroll", ()=>{
    const nearBottom = scroll.isNearBottom(chatBox, 100);
    scrollIndicator?.classList.toggle("show", !nearBottom);
  });
  scrollIndicator?.addEventListener("click", ()=> scroll.toBottom(chatBox));

  // Quick prompts
  $$(".chip").forEach(ch=> ch.addEventListener("click", ()=>{
    if (!input) return;
    input.value = ch.dataset.q || ch.textContent.trim();
    sendBtn?.click();
  }));

  // Model bar
  const cur = $("#currentModel");
  if (cur) cur.textContent = App.model;
  $$(".model-opt").forEach(a=> a.addEventListener("click", (e)=>{
    e.preventDefault();
    App.model = a.dataset.model;
    if (cur) cur.textContent = App.model;
  }));

  // Mock metrics
  const tok=$("#tok"), lat=$("#lat"); let fakeTok=0;
  (function tick(){
    fakeTok = Math.max(0, fakeTok - Math.floor(Math.random()*20));
    if (tok) tok.textContent = `${fakeTok.toLocaleString()}`;
    if (lat) lat.textContent = (40 + Math.floor(Math.random()*40)).toString();
    setTimeout(tick, 1800);
  })();
  sendBtn?.addEventListener("click", ()=>{
    fakeTok += Math.ceil((input?.value||"").length/4);
  });

  // Seed prompt first
  const seed = sessionStorage.getItem("seedPrompt");
  if (seed){
    sessionStorage.removeItem("seedPrompt");
    sendMessage(seed);
  }

  // Greeting
  if (messages && App.user?.username){
    addMessage(`سلام ${App.user.username} 🌌! من mmdrza.AI هستم — آماده‌ام کمکت کنم 💬`, "ai");
    scroll.toBottom(messages);
  }

  // Init ultra/upload
  initUltraSystem();
});

// ============= Ultra / Upload =============
function initUltraSystem(){
  const ultraBtn       = $("#ultraBtn");
  const ultraModal     = $("#ultraModal");
  const ultraClose     = $("#ultraClose");
  const ultraManual    = $("#ultraManual");
  const ultraFeatures  = $("#ultraFeatures");
  const merchantCardEl = $("#merchantCardNumber");
  const showCardBtn    = $("#showCardBtn");
  const copyCardBtn    = $("#copyCardBtn");

  const attachBtn      = $("#attachBtn");
  const attachPanel    = $("#attachPanel");
  const closeAttach    = $("#closeAttach");
  const hiddenFileInput= $("#hiddenFileInput");
  const filePreviewContainer = $("#filePreviewContainer");

  // Panel open/close
  attachBtn?.addEventListener("click", ()=> attachPanel?.classList.add("show"));
  closeAttach?.addEventListener("click", ()=> attachPanel?.classList.remove("show"));

  // Options
  $("#attachPhoto")?.addEventListener("click", ()=>{ if (hiddenFileInput) hiddenFileInput.accept="image/*"; hiddenFileInput?.click(); });
  $("#attachFile") ?.addEventListener("click", ()=>{ if (hiddenFileInput) hiddenFileInput.accept="*/*";   hiddenFileInput?.click(); });
  $("#attachPdf")  ?.addEventListener("click", ()=>{ if (hiddenFileInput) hiddenFileInput.accept="application/pdf"; hiddenFileInput?.click(); });

  // Previews
  let selectedFiles=[]; const blobURLs=[];
  hiddenFileInput?.addEventListener("change", (e)=>{
    const files = Array.from(e.target.files || []);
    selectedFiles = [...selectedFiles, ...files];
    renderPreviews();
    attachPanel?.classList.remove("show");
  });
  function renderPreviews(){
    if (!filePreviewContainer) return;
    filePreviewContainer.innerHTML = "";
    blobURLs.splice(0).forEach(url=> URL.revokeObjectURL(url));
    selectedFiles.forEach((file, i)=>{
      const item = document.createElement("div"); item.className = "file-item";
      const remove = document.createElement("button"); remove.className="file-remove"; remove.innerHTML="×";
      remove.onclick = ()=>{ selectedFiles.splice(i,1); renderPreviews(); };
      if (file.type.startsWith("image/")){
        const img = document.createElement("img");
        const url = URL.createObjectURL(file);
        blobURLs.push(url);
        img.src = url;
        item.appendChild(img);
      }else{
        const name = document.createElement("span");
        name.textContent = file.name;
        item.appendChild(name);
      }
      item.appendChild(remove);
      filePreviewContainer.appendChild(item);
    });
  }

  // Card number
  const MERCHANT_CARD = "5022-2913-3773-8171";
  const mask = card => "•••• •••• •••• " + card.slice(-4);
  if (merchantCardEl) merchantCardEl.textContent = mask(MERCHANT_CARD);
  showCardBtn?.addEventListener("click", ()=>{
    if (!merchantCardEl) return;
    if (merchantCardEl.textContent.includes("•")){ merchantCardEl.textContent = MERCHANT_CARD; showCardBtn.textContent="مخفی کن"; }
    else { merchantCardEl.textContent = mask(MERCHANT_CARD); showCardBtn.textContent="نمایش کامل"; }
  });
  copyCardBtn?.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(MERCHANT_CARD);
      copyCardBtn.textContent = "کپی شد ✓";
      setTimeout(()=> (copyCardBtn.textContent = "کپی"), 1500);
    }catch{
      alert("کپی ناموفق بود. لطفاً دستی کپی کن.");
    }
  });

  // Plan select
  $$(".price-card").forEach(card=>{
    card.addEventListener("click", ()=>{
      $$(".price-card").forEach(c=> c.classList.remove("selected"));
      card.classList.add("selected");
    });
  });

  // Activate Ultra
  ultraManual?.addEventListener("click", async ()=>{
    if (!confirm("آیا مطمئنی که مبلغ را کارت‌به‌کارت کردی؟")) return;
    try{
      const u = App.user;
      if (u?.email){
        await fetch("/api/upgrade", {
          method: "POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ email: u.email, method:"manual" })
        });
      }
    }catch(e){ console.warn("upgrade fail:", e?.message); }
    App.isUltra = true;
    ultraModal?.classList.remove("show");
    const badge = $("#ultraBadge"); if (badge) badge.style.display="inline-flex";
    if (ultraBtn) ultraBtn.style.display="none";
    if (ultraFeatures) ultraFeatures.style.display="block";
    alert("✅ نسخه Ultra با موفقیت فعال شد.");
  });

  ultraBtn?.addEventListener("click", ()=> ultraModal?.classList.add("show"));
  ultraClose?.addEventListener("click", ()=> ultraModal?.classList.remove("show"));

  // Require Ultra overlay
  function requireUltra(){
    if (App.isUltra) return true;
    const overlay = document.createElement("div");
    overlay.className = "ultra-lock-overlay animate__animated animate__fadeIn";
    overlay.innerHTML = `
      <div class="ultra-lock-box animate__animated animate__zoomIn">
        <h4>💎 نسخه Ultra مورد نیاز است</h4>
        <p>برای استفاده از ارسال فایل و عکس، نسخه Ultra را فعال کنید 🌟</p>
        <button class="btn btn-warning mt-2" id="openUltraBtn">فعال‌سازی نسخه Ultra</button>
      </div>`;
    document.body.appendChild(overlay);
    $("#openUltraBtn")?.addEventListener("click", ()=>{ overlay.remove(); ultraModal?.classList.add("show"); });
    overlay.addEventListener("click", e=>{ if (e.target === overlay) overlay.remove(); });
    return false;
  }

  // Upload handler
  const uploadResult = document.getElementById("uploadResult") || document.createElement("div");
  uploadResult.style.fontSize = "0.9rem";
  uploadResult.style.marginTop = "0.3rem";
  $(".chat-input")?.appendChild(uploadResult);

  hiddenFileInput?.addEventListener("change", async ()=>{
    if (!requireUltra()){ hiddenFileInput.value = ""; return; }
    const files = hiddenFileInput.files;
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (let i=0;i<files.length;i++) fd.append("files", files[i]);
    uploadResult.innerHTML = "⏳ Uploading...";
    try{
      const res = await fetch("/api/upload", { method:"POST", body: fd });
      const j   = await res.json().catch(()=>({}));
      uploadResult.innerHTML = res.ok ? `✅ Uploaded ${j.files?.length || files.length} file(s)` : `❌ Upload failed: ${j.error || res.status}`;
    }catch(err){
      uploadResult.innerHTML = `⚠️ Error: ${err.message}`;
    }
    hiddenFileInput.value = "";
  });

  // Drag & Drop
  const main = $(".chat-main");
  if (main && hiddenFileInput){
    ["dragenter","dragover"].forEach(ev=> main.addEventListener(ev, e=>{ e.preventDefault(); main.classList.add("dragging"); }));
    ["dragleave","drop"].forEach(ev=> main.addEventListener(ev, e=>{ e.preventDefault(); main.classList.remove("dragging"); }));
    main.addEventListener("drop", e=>{
      const dt = e.dataTransfer; if (!dt?.files?.length) return;
      const files = Array.from(dt.files);
      try{
        const d = new DataTransfer();
        files.forEach(f=> d.items.add(f));
        hiddenFileInput.files = d.files;
        hiddenFileInput.dispatchEvent(new Event("change"));
      }catch{}
    });
  }
}

// ============= Offcanvas / dropdown conflict & body inert =============
(function(){
  const offcanvas = document.getElementById("mobileMenu");
  if (!offcanvas) return;

  // Close any open dropdowns when opening menu
  offcanvas.addEventListener("show.bs.offcanvas", ()=>{
    document.querySelectorAll(".dropdown-menu.show").forEach(m=> m.classList.remove("show"));
    document.body.classList.add("drawer-open");
    // Make main content inert (no tab focus)
    ["#modelBar",".chat-container",".chat-footer"].forEach(sel=>{
      const el = $(sel); if (el) el.setAttribute("aria-hidden","true");
    });
  });

  offcanvas.addEventListener("hidden.bs.offcanvas", ()=>{
    document.body.classList.remove("drawer-open");
    ["#modelBar",".chat-container",".chat-footer"].forEach(sel=>{
      const el = $(sel); if (el) el.removeAttribute("aria-hidden");
    });
  });
})();

// ============= Tab visibility: stop speech on hide ============
document.addEventListener("visibilitychange", ()=>{
  if (document.hidden && "speechSynthesis" in window){
    try{ window.speechSynthesis.cancel(); }catch{}
  }
});
