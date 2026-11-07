/* Stegatrix UI: wizard, image/ASCII, home demo, import and export. Pure crypto and stego logic lives in core.js. */
(function () {
"use strict";

/* --- Utilities --- */
const $ = (id) => document.getElementById(id);
const {
  HTML_PAYLOAD_ID, stringToUtf8Bytes, escapeHtml, hasWebCrypto, applyCipher, payloadMode, embedPayloadKeyed, openPayloadKeyed, pngBytesNeeded, lsbAgreement, buildAsciiBlock, extractAsciiBlock, embedPayloadInImageData, extractPayloadFromImageData, buildHtmlArtifact, decodeHtmlPayloadText, encodeZeroWidth, decodeZeroWidth
} = StegatrixCore;

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function debounce(fn, ms) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

function getPayload() {
  return state.encryptedPayload || $("payloadOut").textContent;
}

function copyText(text, opts) {
  opts = opts || {};
  if (!text) { toast(opts.empty || "Nothing to copy yet.", "error"); return Promise.reject(); }
  return navigator.clipboard.writeText(text).then(
    () => {
      if (opts.btn) {
        const o = opts.btn.textContent;
        opts.btn.textContent = "Copied!";
        setTimeout(() => (opts.btn.textContent = o), 1200);
      } else if (opts.ok) toast(opts.ok, "success");
    },
    () => toast("Copy failed.", "error")
  );
}

function wireDropzone(zone, input, onFile) {
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  input.addEventListener("change", () => { if (input.files[0]) onFile(input.files[0]); input.value = ""; });
  ["dragover", "dragenter"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) onFile(f); });
}

function syncPanelOpts(selector, attr, activeMode, exact) {
  document.querySelectorAll(selector).forEach((el) => {
    const val = el.getAttribute(attr) || "";
    const show = exact ? val === activeMode : val.split(" ").includes(activeMode);
    el.style.display = show ? "" : "none";
  });
}

/* --- State --- */
const state = {
  imageEl: null,
  coverAgreement: 0, // lsbAgreement of the loaded image; near 1 means too smooth to hide in unnoticed
  asciiText: "",
  asciiRows: null,
  encryptedPayload: "",
  extractedPayload: "",
  keyedPng: null, // imported PNG with no visible marker; only a password can open it
  stegoReady: false,
  settings: {
    asciiWidth: 120,
    brightness: 0,
    contrast: 0,
    invert: false,
    charset: "dense",
    customCharset: "@#=-. ",
    fontSize: 7,
    lineHeight: 1.0,
    theme: "mono",
    cipherMode: "aes",
    stegoMode: "ascii"
  }
};

/* --- Wizard (Create / Recover stepped flow) --- */
const PATHS = {
  create: [
    { id: "image", label: "Image" },
    { id: "cipher", label: "Encrypt" },
    { id: "stego", label: "Hide" }
  ],
  recover: [
    { id: "import", label: "Import" },
    { id: "recover", label: "Recover" }
  ]
};
const UNLOCK = {
  image: () => !!state.imageEl && !!state.asciiText,
  cipher: () => !!state.encryptedPayload,
  import: () => !!state.extractedPayload || !!state.keyedPng
};
const wizard = { path: null, screen: "home" };

function pathSteps() {
  return wizard.path ? PATHS[wizard.path] : [];
}
function stepIndex(id) {
  return pathSteps().findIndex((s) => s.id === id);
}
function canUnlock(id) {
  return UNLOCK[id] ? UNLOCK[id]() : true;
}
function markStegoReady() {
  state.stegoReady = true;
  refreshWizard();
}

function goTo(screenId) {
  wizard.screen = screenId;
  if (screenId === "home") wizard.path = null;
  document.querySelectorAll(".screen").forEach((el) => {
    const on = el.getAttribute("data-screen") === screenId;
    el.classList.toggle("active", on);
    el.hidden = !on;
  });
  refreshWizard();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function refreshWizard() {
  const steps = pathSteps();
  const idx = stepIndex(wizard.screen);
  const bar = $("workflow");
  const nav = $("flowNav");
  const btnNext = $("btnNext");
  const btnBack = $("btnBack");
  const btnRestart = $("btnRestart");
  const onHome = wizard.screen === "home";

  if (onHome || !steps.length) {
    bar.classList.remove("show");
    bar.innerHTML = "";
    nav.hidden = true;
    return;
  }

  bar.classList.add("show");
  bar.innerHTML = "";
  steps.forEach((s, i) => {
    if (i) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.setAttribute("aria-hidden", "true");
      bar.appendChild(arrow);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "step";
    if (i === idx) btn.classList.add("active");
    else if (i < idx) btn.classList.add("done");
    btn.innerHTML = `<b>${i + 1}</b> ${s.label}`;
    btn.disabled = i > idx;
    if (i < idx) btn.addEventListener("click", () => goTo(s.id));
    bar.appendChild(btn);
  });

  nav.hidden = false;
  const isLast = idx === steps.length - 1;
  btnRestart.hidden = !isLast;
  btnNext.hidden = isLast;
  btnBack.hidden = false;

  if (!isLast) {
    const unlocked = canUnlock(wizard.screen);
    btnNext.disabled = !unlocked;
    btnNext.title = unlocked ? "" : "Complete this step’s action first";
  }

  const finish = $("finishStrip");
  if (finish) {
    const showFinish = wizard.screen === "stego" && state.stegoReady;
    finish.hidden = !showFinish;
    if (showFinish) {
      const hint = $("finishHint");
      if (hint) {
        const mode = state.settings.stegoMode;
        hint.textContent = mode === "png" || mode === "html"
          ? "Artifact downloaded. You can recover it anytime, or export extras below."
          : "Artifact ready below. Copy or save it, then recover anytime.";
      }
    }
  }
}

function startPath(path) {
  wizard.path = path;
  state.stegoReady = false;
  goTo(PATHS[path][0].id);
}

function goHome() {
  state.stegoReady = false;
  goTo("home");
}

function bindWizard() {
  document.querySelectorAll("[data-path]").forEach((btn) => {
    btn.addEventListener("click", () => startPath(btn.getAttribute("data-path")));
  });
  $("btnBack").addEventListener("click", () => {
    if (wizard.screen === "home") return;
    const idx = stepIndex(wizard.screen);
    if (idx <= 0) goTo("home");
    else goTo(pathSteps()[idx - 1].id);
  });
  $("btnNext").addEventListener("click", () => {
    if (!canUnlock(wizard.screen)) {
      toast("Complete this step’s action before continuing.", "warn");
      return;
    }
    const idx = stepIndex(wizard.screen);
    const steps = pathSteps();
    if (idx < 0 || idx >= steps.length - 1) return;
    goTo(steps[idx + 1].id);
  });
  $("btnRestart").addEventListener("click", goHome);
  $("gotoDecode").addEventListener("click", () => startPath("recover"));
  const title = $("homeTitle");
  title.addEventListener("click", goHome);
}

const CHARSETS = {
  dense: "@%#*+=-:. ",
  blocks: "\u2588\u2593\u2592\u2591 ",
  binary: "01",
  cyber: "@#&$%*+=-:. ",
  minimal: "# ."
};

/* --- Toast --- */
function toast(msg, type) {
  const box = $("toasts");
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, type === "error" ? 5200 : 3200);
}

/* --- Image + ASCII --- */
const work = document.createElement("canvas"); // offscreen sampling canvas
const wctx = work.getContext("2d", { willReadFrequently: true });

function activeCharset() {
  const s = state.settings;
  if (s.charset === "custom") return s.customCharset && s.customCharset.length ? s.customCharset : "@#=-. ";
  return CHARSETS[s.charset] || CHARSETS.dense;
}

function visColor(r, g, b) {
  const lift = (v) => Math.round(70 + v * (185 / 255));
  return [lift(r), lift(g), lift(b)];
}

// 40 MP is about 160 MB of RGBA once read back from a canvas; bigger images can crash the tab.
const MAX_PIXELS = 40e6;
function tooBig(img) {
  if (img.naturalWidth * img.naturalHeight <= MAX_PIXELS) return false;
  toast(`That image is ${img.naturalWidth}×${img.naturalHeight}. Use one under 40 megapixels.`, "error");
  return true;
}

// Sample a native-resolution crop from the middle: scaling would blur away the low bits being measured.
function measureCover(img) {
  const w = Math.min(512, img.naturalWidth), h = Math.min(512, img.naturalHeight);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, (img.naturalWidth - w) >> 1, (img.naturalHeight - h) >> 1, w, h, 0, 0, w, h);
  try { return lsbAgreement(ctx.getImageData(0, 0, w, h)); } catch (e) { return 0; }
}

function showImagePreview(img, msg) {
  if (tooBig(img)) return;
  state.imageEl = img;
  state.coverAgreement = measureCover(img);
  const p = $("previewImg");
  p.src = img.src;
  p.style.display = "block";
  renderAscii();
  updateCapacity();
  refreshWizard();
  toast(msg, "success");
}

function loadImageFile(file) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    toast("Unsupported file type. Please choose an image.", "error");
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (tooBig(img)) { URL.revokeObjectURL(url); return; }
    $("previewImg").addEventListener("load", () => URL.revokeObjectURL(url), { once: true }); // preview reuses this URL
    showImagePreview(img, "Image loaded — forging ASCII.");
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Could not load that image.", "error"); };
  img.src = url;
}

// Generate a built-in demo image so users can try the app instantly.
function drawDemoCanvas() {
  const w = 480, h = 360;
  const cvs = document.createElement("canvas");
  cvs.width = w; cvs.height = h;
  const c = cvs.getContext("2d", { willReadFrequently: true });
  // synthwave sky gradient
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1a0833");
  sky.addColorStop(0.55, "#3a0d5c");
  sky.addColorStop(0.75, "#f82bd6");
  sky.addColorStop(1, "#f8bf0c");
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  // sun
  const sun = c.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, 120);
  sun.addColorStop(0, "#f8eeb0"); sun.addColorStop(1, "rgba(255,43,214,0)");
  c.fillStyle = sun; c.beginPath(); c.arc(w / 2, h * 0.62, 120, 0, Math.PI * 2); c.fill();
  // sun stripes
  c.fillStyle = "#1a0833";
  for (let y = h * 0.55; y < h * 0.75; y += 10) c.fillRect(w / 2 - 120, y, 240, 4);
  // grid floor
  c.strokeStyle = "rgba(12,240,248,0.7)"; c.lineWidth = 1;
  const hz = h * 0.72;
  for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(w / 2 + i * 24, hz); c.lineTo(w / 2 + i * 120, h); c.stroke(); }
  for (let y = hz; y < h; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  // skyline silhouette
  c.fillStyle = "#100a1c";
  for (let x = 0; x < w; x += 34) { const bh = 40 + (Math.sin(x) + 1) * 45; c.fillRect(x, hz - bh, 26, bh); }
  // Film grain: real photos carry sensor noise, which is why their LSB plane looks like static.
  // The palette above stays clear of 0 and 255 so the grain never clips and every low bit randomizes.
  const px = c.getImageData(0, 0, w, h);
  for (let i = 0; i < px.data.length; i++) if (i % 4 !== 3) px.data[i] += Math.round((Math.random() - 0.5) * 6);
  c.putImageData(px, 0, 0);
  return cvs;
}

function generateDemoImage() {
  const cvs = drawDemoCanvas();
  const img = new Image();
  img.onload = () => showImagePreview(img, "Demo image loaded.");
  img.src = cvs.toDataURL("image/png");
}

// Contrast factor per standard formula; c in [-100,100]
function contrastFactor(c) { return (259 * (c + 255)) / (255 * (259 - c)); }

// Core conversion: draw resized image, sample pixels, map brightness -> chars.
function buildAscii() {
  const s = state.settings;
  const img = state.imageEl;
  if (!img) return null;

  const w = Math.max(1, Math.min(240, s.asciiWidth | 0));
  // Character cells are taller than wide -> compress height ~0.45
  let h = Math.floor((img.height / img.width) * w * 0.45);
  h = Math.max(1, Math.min(400, h)); // guard against runaway sizes

  work.width = w;
  work.height = h;
  wctx.clearRect(0, 0, w, h);
  wctx.drawImage(img, 0, 0, w, h);

  let data;
  try {
    data = wctx.getImageData(0, 0, w, h).data;
  } catch (e) {
    toast("Cannot read pixels (browser security). Try a different image.", "error");
    return null;
  }

  const chars = activeCharset();
  const nChars = chars.length;
  const cf = contrastFactor(s.contrast);
  const bright = s.brightness;

  const lines = [];
  const colorLines = s.theme === "color" ? [] : null;

  for (let y = 0; y < h; y++) {
    let line = "";
    let colorLine = colorLines ? [] : null;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i], g = data[i + 1], b = data[i + 2];
      // luminance
      let lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // brightness + contrast
      lum = cf * (lum - 128) + 128 + bright;
      if (lum < 0) lum = 0; else if (lum > 255) lum = 255;
      if (s.invert) lum = 255 - lum;
      // map brightness -> char index (dark char = index 0)
      let idx = Math.round((lum / 255) * (nChars - 1));
      if (idx < 0) idx = 0; else if (idx >= nChars) idx = nChars - 1;
      line += chars[idx];
      if (colorLine) colorLine.push([r, g, b]);
    }
    lines.push(line);
    if (colorLines) colorLines.push(colorLine);
  }
  return { lines, colorLines, width: w, height: h };
}

// Render ASCII into the <pre>, honoring theme / color mode
function renderAscii() {
  const out = $("asciiOut");
  const empty = $("asciiEmpty");
  if (!state.imageEl) { empty.style.display = "block"; out.textContent = ""; return; }

  const built = buildAscii();
  if (!built) return;
  empty.style.display = "none";

  state.asciiText = built.lines.join("\n");
  state.asciiRows = built;

  const s = state.settings;
  out.className = "ascii" + (s.theme === "amber" ? " theme-amber" : s.theme === "green" ? " theme-green" : "");
  out.style.fontSize = s.fontSize + "px";
  out.style.lineHeight = s.lineHeight;

  const useColor = s.theme === "color";

  if (useColor && built.colorLines) {
    // Build one HTML string (assigned once) with a span per char run.
    let html = "";
    for (let y = 0; y < built.lines.length; y++) {
      const line = built.lines[y];
      const colors = built.colorLines[y];
      for (let x = 0; x < line.length; x++) {
        const c = visColor(colors[x][0], colors[x][1], colors[x][2]);
        html += `<span style="color:rgb(${c[0]},${c[1]},${c[2]})">${escapeHtml(line[x])}</span>`;
      }
      html += "\n";
    }
    out.innerHTML = html;
    out.style.textShadow = "none";
  } else if (s.theme === "split") {
    // magenta/cyan split glow by column position
    let html = "";
    for (let y = 0; y < built.lines.length; y++) {
      const line = built.lines[y];
      for (let x = 0; x < line.length; x++) {
        const color = x < line.length / 2 ? "var(--magenta)" : "var(--cyan)";
        html += `<span style="color:${color};text-shadow:0 0 6px ${color}">${escapeHtml(line[x])}</span>`;
      }
      html += "\n";
    }
    out.innerHTML = html;
  } else {
    out.textContent = state.asciiText; // fast path: single assignment
    out.style.textShadow = "0 0 6px currentColor";
  }
  refreshWizard();
}

const renderAsciiDebounced = debounce(renderAscii, 120);

// Export ASCII <pre> as a PNG raster
function exportAsciiPng() {
  if (!state.asciiRows) { toast("No ASCII yet. Upload an image first.", "error"); return; }
  const s = state.settings;
  const built = state.asciiRows;
  const fs = Math.max(6, s.fontSize + 3); // a touch larger for crisp raster
  const cw = fs * 0.6;
  const ch = fs * s.lineHeight * 1.15;
  const cols = built.lines[0] ? built.lines[0].length : 1;
  const rows = built.lines.length;
  const cvs = document.createElement("canvas");
  cvs.width = Math.ceil(cols * cw) + 20;
  cvs.height = Math.ceil(rows * ch) + 20;
  const c = cvs.getContext("2d");
  c.fillStyle = "#05000f";
  c.fillRect(0, 0, cvs.width, cvs.height);
  c.font = `${fs}px ${getComputedStyle(document.body).fontFamily}`;
  c.textBaseline = "top";
  const useColor = s.theme === "color";
  const root = getComputedStyle(document.documentElement);
  const monoColor = s.theme === "amber" ? root.getPropertyValue("--amber").trim()
    : s.theme === "green" ? root.getPropertyValue("--green").trim()
    : root.getPropertyValue("--cyan").trim();
  for (let y = 0; y < rows; y++) {
    const line = built.lines[y];
    if (useColor && built.colorLines) {
      for (let x = 0; x < line.length; x++) {
        const col = visColor(built.colorLines[y][x][0], built.colorLines[y][x][1], built.colorLines[y][x][2]);
        c.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        c.fillText(line[x], 10 + x * cw, 10 + y * ch);
      }
    } else {
      c.fillStyle = monoColor;
      c.fillText(line, 10, 10 + y * ch);
    }
  }
  cvs.toBlob((blob) => downloadBlob(blob, `stegatrix-ascii-${timestamp()}.png`), "image/png");
}

/* --- Home demo: hide a real message in the demo image, then show where it went --- */
const DEMO_PASSWORD = "neon-lantern-42";
const DEMO_MESSAGE = "You found it. This sentence was encrypted with AES-256-GCM and scattered across the picture's lowest bits, in an order only the password reproduces.";
const demo = { cover: null, stego: null, frame: null, changedPixels: [], changedValues: 0, view: "image" };

const DEMO_CAPTIONS = {
  image: () => "The picture as anyone sees it. The message is already inside.",
  lsb: () => "Only the lowest bit of every color value. It looks like static, as it does in any real photo, so there's nothing to spot.",
  changes: () => `<b>${demo.changedValues.toLocaleString()}</b> of ${(demo.cover.data.length / 4 * 3).toLocaleString()} color values changed, each by ±1. The labelled run at the top left is the random salt, stored in order; the rest follow a password-keyed order. Without the password or the original image, there's no telling which ones.`
};

// Renders the current view at display resolution: the image, its LSB plane, or the changes over a grey-dimmed copy.
function renderDemoFrame() {
  const { width: w, height: h } = demo.stego;
  const src = demo.stego.data;
  const frame = new ImageData(w, h);
  const dst = frame.data;
  for (let i = 0; i < src.length; i += 4) {
    const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    for (let ch = 0; ch < 3; ch++) {
      const v = src[i + ch];
      dst[i + ch] = demo.view === "lsb" ? (v & 1) * 255 : demo.view === "changes" ? lum * 0.25 : v;
    }
    dst[i + 3] = 255;
  }
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  small.getContext("2d").putImageData(frame, 0, 0);
  const out = document.createElement("canvas");
  out.width = $("demoCanvas").width; out.height = $("demoCanvas").height;
  const c = out.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.drawImage(small, 0, 0, out.width, out.height);
  if (demo.view === "changes") {
    // Bright dots on a grey field: the contrast reads without relying on hue.
    const sx = out.width / w, sy = out.height / h;
    c.fillStyle = "#ff2bd6";
    for (const p of demo.changedPixels) c.fillRect((p % w) * sx - sx, ((p / w) | 0) * sy - sy, sx * 3, sy * 3);
    // The salt sits in the first 43 pixels, in order; label it so it reads as part of the format, not a glitch.
    const k = out.width / ($("demoCanvas").clientWidth || out.width); // canvas px per CSS px
    c.font = `600 ${Math.round(14 * k)}px ui-monospace, Menlo, Consolas, monospace`;
    const label = "salt, stored in order";
    c.fillStyle = "rgba(7,3,15,0.85)";
    c.fillRect(10, 16, c.measureText(label).width + 12 * k, 24 * k);
    c.fillStyle = "#e9f8ff";
    c.fillText(label, 10 + 6 * k, 16 + 17 * k);
  }
  return out;
}

let demoWipe = 0;
function drawDemoView() {
  const cvs = $("demoCanvas");
  const c = cvs.getContext("2d");
  const next = renderDemoFrame();
  const prev = demo.frame;
  demo.frame = next;
  $("demoCaption").innerHTML = DEMO_CAPTIONS[demo.view]();
  cvs.setAttribute("aria-label", { image: "Demo image with a hidden message", lsb: "Least significant bit plane of the demo image: random static", changes: `Demo image in grey with ${demo.changedPixels.length} changed pixels marked` }[demo.view]);
  if (!prev || matchMedia("(prefers-reduced-motion: reduce)").matches) { c.drawImage(next, 0, 0); return; }
  // Signature move: a scan line sweeps across and swaps one plane for the next.
  const id = ++demoWipe, start = performance.now(), W = cvs.width, H = cvs.height;
  const step = (t) => {
    if (id !== demoWipe) return;
    const k = Math.min(1, (t - start) / 420);
    const x = Math.round(W * (1 - Math.pow(1 - k, 3)));
    c.drawImage(prev, 0, 0);
    if (x > 0) c.drawImage(next, 0, 0, x, H, 0, 0, x, H);
    if (k < 1) {
      c.fillStyle = "#00f5ff";
      c.fillRect(x - 2, 0, 3, H);
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

async function initDemo() {
  const status = $("demoStatus");
  if (!hasWebCrypto()) { status.textContent = "This browser has no Web Crypto API, so the live demo can't run here."; return; }
  try {
    const cvs = drawDemoCanvas();
    demo.cover = cvs.getContext("2d").getImageData(0, 0, cvs.width, cvs.height);
    demo.stego = new ImageData(new Uint8ClampedArray(demo.cover.data), cvs.width, cvs.height);
    const payload = await applyCipher("aes", DEMO_MESSAGE, { aesPassword: DEMO_PASSWORD }, true);
    await embedPayloadKeyed(demo.stego, payload, DEMO_PASSWORD);
    const a = demo.cover.data, b = demo.stego.data;
    for (let i = 0; i < a.length; i += 4) {
      let hit = false;
      for (let ch = 0; ch < 3; ch++) if (a[i + ch] !== b[i + ch]) { demo.changedValues++; hit = true; }
      if (hit) demo.changedPixels.push(i / 4);
    }
    status.hidden = true;
    $("demoReveal").disabled = false;
    drawDemoView();
  } catch (e) {
    status.textContent = "The demo couldn't run: " + e.message;
  }
}

function bindDemo() {
  document.querySelectorAll("input[name=demoView]").forEach((r) => r.addEventListener("change", () => {
    demo.view = r.value;
    if (demo.stego) drawDemoView();
  }));
  $("demoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const out = $("demoSecret"), btn = $("demoReveal");
    btn.disabled = true;
    out.className = "secret-out";
    out.textContent = "Deriving the key and reading the hidden bits…";
    try {
      const msg = await openPayloadKeyed(demo.stego, $("demoPassword").value);
      void out.offsetWidth; // restart the reveal animation on repeat reveals
      out.textContent = msg;
      out.classList.add("revealed");
    } catch (err) {
      out.textContent = err.message;
      out.classList.add("failed");
    }
    btn.disabled = false;
    out.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}

function cipherFields(source) {
  if (source === "recover") {
    return {
      caesarShift: parseInt($("decCaesar").value, 10) || 0,
      vigenereKey: $("decKey").value,
      xorKey: $("decKey").value,
      aesPassword: $("decPassword").value
    };
  }
  return {
    caesarShift: parseInt($("caesarShift").value, 10) || 0,
    vigenereKey: $("vigenereKey").value,
    xorKey: $("xorKey").value,
    aesPassword: $("aesPassword").value
  };
}


function updatePayloadMeta() {
  const el = $("payloadMeta");
  const payload = getPayload();
  if (!payload) { el.textContent = ""; return; }
  const bytes = stringToUtf8Bytes(payload).length;
  el.innerHTML = `${bytes.toLocaleString()} bytes · <span class="rdy">ready to hide</span>`;
}

async function runEncrypt() {
  const text = $("secret").value;
  if (!text) { toast("Empty secret message.", "error"); return; }
  const mode = state.settings.cipherMode;
  try {
    const payload = await applyCipher(mode, text, cipherFields("encrypt"), true);
    state.encryptedPayload = payload;
    $("payloadOut").textContent = payload;
    updatePayloadMeta();
    updateCapacity();
    refreshWizard();
    toast(mode === "aes" ? "Encrypted with AES-GCM." : "Encoded (puzzle mode).", "success");
  } catch (e) {
    toast(e.message || "Encryption failed.", "error");
  }
}

async function runDecrypt() {
  const payload = getPayload();
  if (!payload) { toast("No payload to decrypt.", "error"); return; }
  try {
    $("plainOut").textContent = await applyCipher(null, payload, cipherFields("encrypt"), false);
    toast("Decrypted.", "success");
  } catch (e) {
    toast(e.message || "Decryption failed.", "error");
  }
}

// PNG blob of the source image (natural resolution) with the payload embedded.
// AES payloads use the keyed, marker-free layout; everything else uses the public marker layout.
async function makeStegoPngBlob(payload) {
  const img = state.imageEl;
  const cvs = document.createElement("canvas");
  cvs.width = img.naturalWidth || img.width;
  cvs.height = img.naturalHeight || img.height;
  const c = cvs.getContext("2d");
  // Flatten onto white: canvas stores premultiplied alpha, which would erase bits in transparent pixels.
  c.fillStyle = "#fff";
  c.fillRect(0, 0, cvs.width, cvs.height);
  c.drawImage(img, 0, 0, cvs.width, cvs.height);
  let imageData;
  try { imageData = c.getImageData(0, 0, cvs.width, cvs.height); }
  catch (e) { throw new Error("Cannot read image pixels for embedding."); }
  if (payloadMode(payload) === "aes") await embedPayloadKeyed(imageData, payload, $("aesPassword").value);
  else embedPayloadInImageData(imageData, payload);
  c.putImageData(imageData, 0, 0);
  return new Promise((resolve) => cvs.toBlob(resolve, "image/png"));
}

// Capacity estimator for PNG mode
function updateCapacity() {
  const box = $("capacityBox");
  const warn = $("stegoWarn");
  if (state.settings.stegoMode !== "png") { box.style.display = "none"; return; }
  box.style.display = "block";
  if (!state.imageEl) { box.innerHTML = "<span class='bad'>Load an image to estimate capacity.</span>"; return; }
  const w = state.imageEl.naturalWidth || state.imageEl.width;
  const h = state.imageEl.naturalHeight || state.imageEl.height;
  const capBits = w * h * 3;
  const capBytes = Math.floor(capBits / 8);
  const payload = state.encryptedPayload || "";
  const needBytes = payload ? pngBytesNeeded(payload) : 0;
  const fits = payload && needBytes <= capBytes;
  let html = `Capacity: <b>${capBytes.toLocaleString()}</b> bytes (${w}×${h}×3 bits).`;
  if (payload) {
    html += fits
      ? ` Payload needs <b>${needBytes.toLocaleString()}</b> bytes — <span class="ok">fits</span>`
      : ` Payload needs <b>${needBytes.toLocaleString()}</b> bytes — <span class="bad">too large</span>`;
  } else {
    html += " <span class='bad'>No payload yet.</span>";
  }
  box.innerHTML = html;
  warn.textContent = (payload && payloadMode(payload) !== "aes"
    ? "Without AES-GCM the PNG carries a public marker, so anyone with Stegatrix can read it. JPEG/WebP compression will also destroy the hidden bits."
    : "PNG only — JPEG/WebP compression will destroy hidden bits.")
    + (state.coverAgreement > 0.6 ? " This image is very smooth, so the changed bits will show up in its LSB plane. A noisy photo hides a message better." : "");
  warn.className = "warn show";
}

function extractHtmlPayload(htmlText) {
  try {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const el = doc.getElementById(HTML_PAYLOAD_ID);
    if (el) return decodeHtmlPayloadText(el.textContent);
  } catch (e) { /* fall through */ }
  return null;
}


async function downloadStegoPng(payload, after) {
  let blob;
  try { blob = await makeStegoPngBlob(payload); }
  catch (e) { toast(e.message, "error"); return; }
  downloadBlob(blob, `stegatrix-stego-${timestamp()}.png`);
  toast("Stego PNG exported.", "success");
  if (after) after();
}

function downloadHtmlArtifact(payload, okMsg) {
  downloadText(buildHtmlArtifact(state.asciiText, payload), `stegatrix-artifact-${timestamp()}.html`, "text/html;charset=utf-8");
  toast(okMsg, "success");
}

function runHide() {
  const payload = getPayload();
  if (!payload) { toast("Encrypt a message first — no payload to hide.", "error"); return; }
  const mode = state.settings.stegoMode;
  const out = $("stegoOut");

  if (mode === "ascii") {
    out.textContent = buildAsciiBlock(state.asciiText, payload);
    markStegoReady();
    toast("Payload appended to ASCII block. Copy or export the TXT.", "success");
  } else if (mode === "png") {
    if (!state.imageEl) { toast("No image selected for PNG stego.", "error"); return; }
    downloadStegoPng(payload, () => {
      out.textContent = "PNG exported with hidden payload (LSB). Re-import to extract.";
      markStegoReady();
    });
  } else if (mode === "html") {
    downloadHtmlArtifact(payload, "HTML artifact downloaded.");
    out.textContent = "Self-contained HTML artifact downloaded (stegatrix-artifact-*.html). It contains the ASCII art plus the embedded payload. Re-import it to recover.";
    markStegoReady();
  } else if (mode === "zw") {
    const zw = encodeZeroWidth(payload);
    const cover = ($("zwCover").value || "").trim() || "hello there";
    const parts = cover.split(" ");
    parts[0] = parts[0] + zw;
    out.textContent = parts.join(" ");
    markStegoReady();
    toast("Zero-width text ready — use Copy (invisible chars are included).", "warn");
  }
}
/* --- Import / Decode --- */
function showExtracted(payload) {
  state.extractedPayload = payload;
  state.keyedPng = null;
  $("extractOut").textContent = payload;
  $("decMode").value = payloadMode(payload) || "auto"; // envelopes name their mode
  syncDecUi();
  refreshWizard();
}

function showKeyedPng(imageData) {
  state.extractedPayload = "";
  state.keyedPng = imageData;
  $("extractOut").textContent = "No visible payload. If this PNG was hidden with an AES password, continue and enter it.";
  $("decMode").value = "aes";
  syncDecUi();
  refreshWizard();
}

// Try every text carrier in turn: HTML script tag, ASCII block, zero-width, then a bare envelope.
function extractFromText(text) {
  const payload = extractHtmlPayload(text) || extractAsciiBlock(text) || decodeZeroWidth(text) || text.trim();
  return payloadMode(payload) ? payload : null;
}

function handleImportFile(file) {
  if (!file) return;
  const name = (file.name || "").toLowerCase();
  const isPng = file.type === "image/png" || name.endsWith(".png");
  const isHtml = file.type === "text/html" || name.endsWith(".html") || name.endsWith(".htm");
  const isTxt = file.type === "text/plain" || name.endsWith(".txt");

  if (isPng) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (tooBig(img)) return;
      const cvs = document.createElement("canvas");
      cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
      const c = cvs.getContext("2d");
      c.drawImage(img, 0, 0);
      let imageData;
      try { imageData = c.getImageData(0, 0, cvs.width, cvs.height); }
      catch (e) { toast("Cannot read PNG pixels.", "error"); return; }
      try {
        showExtracted(extractPayloadFromImageData(imageData));
        toast("Payload extracted from PNG.", "success");
      } catch (e) {
        // No public marker: it may be a keyed PNG, which can't be told apart from a plain image without the password.
        showKeyedPng(imageData);
        toast("PNG loaded. Enter the password on the next step.", "success");
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("Could not load PNG.", "error"); };
    img.src = url;
    return;
  }

  if (isHtml || isTxt) {
    const reader = new FileReader();
    reader.onload = () => {
      const payload = extractFromText(String(reader.result || ""));
      if (!payload) { toast("No STEGATRIX payload found in file.", "error"); return; }
      showExtracted(payload);
      toast("Payload extracted.", "success");
    };
    reader.onerror = () => toast("Could not read file.", "error");
    reader.readAsText(file);
    return;
  }

  toast("Unsupported file type. Use PNG, TXT, or HTML.", "error");
}

async function runRecover() {
  if (state.keyedPng) {
    const password = $("decPassword").value;
    if (!password) { toast("Enter the password the PNG was hidden with.", "error"); return; }
    try {
      $("recoverOut").textContent = await openPayloadKeyed(state.keyedPng, password);
      toast("Message recovered.", "success");
    } catch (e) {
      toast(e.message, "error");
    }
    return;
  }
  const payload = state.extractedPayload;
  if (!payload) { toast("Nothing extracted yet — import an artifact first.", "error"); return; }
  try {
    $("recoverOut").textContent = await applyCipher(null, payload, cipherFields("recover"), false);
    toast("Message recovered.", "success");
  } catch (e) {
    toast(e.message || "Recovery failed.", "error");
  }
}

/* --- Export --- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadText(text, filename, mime) {
  downloadBlob(new Blob([text], { type: mime || "text/plain;charset=utf-8" }), filename);
}

function exportPayloadJson() {
  const payload = getPayload();
  if (!payload) { toast("No payload — encrypt a message first.", "error"); return; }
  downloadText(payload, `stegatrix-payload-${timestamp()}.json`, "application/json");
  toast("Payload JSON exported.", "success");
}
function exportReadme() {
  const txt = README_TEXT;
  downloadText(txt, `stegatrix-instructions-${timestamp()}.txt`);
  toast("Instructions exported.", "success");
}

const README_TEXT = [
  "STEGATRIX: hide an encrypted message in an image, text or web page",
  "===================================================================",
  "",
  "Runs entirely in the browser. Nothing is uploaded.",
  "",
  "HIDE A MESSAGE",
  " 1. Image: pick a picture (it also becomes ASCII art for the text carriers).",
  " 2. Encrypt: type the message and a password. AES-256-GCM is the default.",
  "    Base64, Caesar, Atbash, Vigenere and XOR are puzzle modes, not security.",
  " 3. Hide: choose PNG, ASCII text, HTML page or zero-width text.",
  "",
  "RECOVER A MESSAGE",
  " 1. Import: load the PNG, TXT or HTML file, or paste the text.",
  " 2. Recover: enter the password or key. The payload names its own mode.",
  "",
  "LIMITS",
  " - Hidden PNG bits survive only lossless copies. JPEG, WebP, resizing,",
  "   screenshots and most chat apps destroy them.",
  " - AES PNGs have no marker: the password picks which pixels hold the message.",
  " - The ASCII, HTML and zero-width carriers are visible containers.",
  " - Zero-width text is experimental; many apps strip those characters.",
  " - Use a strong password. There is no strength check.",
].join("\n");

/* --- Wiring --- */
function syncCipherUi() {
  const mode = state.settings.cipherMode;
  syncPanelOpts(".cipher-opt", "data-for", mode, true);
  const warn = $("cipherWarn");
  if (mode === "caesar" || mode === "atbash" || mode === "vigenere" || mode === "xor") {
    warn.textContent = "Puzzle cipher only; not secure.";
    warn.className = "warn show";
  } else if (mode === "base64") {
    warn.textContent = "Base64 is an encoding, not encryption — not secure.";
    warn.className = "warn show";
  } else { warn.className = "warn"; }
}

function syncDecUi() {
  syncPanelOpts(".dec-opt", "data-decfor", $("decMode").value, false);
}

function bindRange(id, key, labelId, fmt) {
  const el = $(id);
  el.addEventListener("input", () => {
    let v = parseFloat(el.value);
    state.settings[key] = key === "asciiWidth" ? (v | 0) : v;
    if (labelId) $(labelId).textContent = fmt ? fmt(v) : v;
    renderAsciiDebounced();
  });
}

function init() {
  if (!hasWebCrypto()) toast("Web Crypto API unavailable — AES-GCM disabled.", "warn");

  wireDropzone($("dropzone"), $("fileInput"), loadImageFile);
  wireDropzone($("importDrop"), $("importInput"), handleImportFile);

  // --- Ranges ---
  bindRange("asciiWidth", "asciiWidth", "asciiWidthVal");
  bindRange("brightness", "brightness", "brightnessVal");
  bindRange("contrast", "contrast", "contrastVal");
  bindRange("fontSize", "fontSize", "fontSizeVal");
  bindRange("lineHeight", "lineHeight", "lineHeightVal", (v) => v.toFixed(2));

  // --- Charset + toggles + theme ---
  $("charset").addEventListener("change", (e) => {
    state.settings.charset = e.target.value;
    $("customCharsetField").style.display = e.target.value === "custom" ? "" : "none";
    renderAscii();
  });
  $("customCharset").addEventListener("input", (e) => { state.settings.customCharset = e.target.value; renderAsciiDebounced(); });
  $("invert").addEventListener("change", (e) => { state.settings.invert = e.target.checked; renderAscii(); });
  $("colorMode").addEventListener("change", (e) => {
    if (e.target.checked) { state.settings.theme = "color"; $("theme").value = "color"; }
    else if (state.settings.theme === "color") { state.settings.theme = "mono"; $("theme").value = "mono"; }
    renderAscii();
  });
  $("theme").addEventListener("change", (e) => {
    state.settings.theme = e.target.value;
    $("colorMode").checked = e.target.value === "color";
    renderAscii();
  });

  // --- ASCII actions ---
  $("copyAscii").addEventListener("click", () => {
    if (!state.asciiText) { toast("No ASCII to copy.", "error"); return; }
    copyText(state.asciiText, { ok: "ASCII copied." });
  });
  $("downloadAscii").addEventListener("click", () => { if (!state.asciiText) { toast("No ASCII yet.", "error"); return; } downloadText(state.asciiText, `stegatrix-ascii-${timestamp()}.txt`); toast("ASCII downloaded.", "success"); });
  $("exportAsciiPng").addEventListener("click", exportAsciiPng);

  // --- Cipher ---
  $("cipherMode").addEventListener("change", (e) => { state.settings.cipherMode = e.target.value; syncCipherUi(); });
  $("encryptBtn").addEventListener("click", runEncrypt);
  $("decryptBtn").addEventListener("click", runDecrypt);
  $("clearCipher").addEventListener("click", () => {
    $("secret").value = "";
    $("payloadOut").textContent = "";
    $("plainOut").textContent = "";
    state.encryptedPayload = "";
    state.stegoReady = false;
    updatePayloadMeta();
    updateCapacity();
    refreshWizard();
  });

  // --- Stego ---
  $("stegoMode").addEventListener("change", (e) => {
    state.settings.stegoMode = e.target.value;
    const warn = $("stegoWarn");
    $("zwCoverField").style.display = e.target.value === "zw" ? "" : "none";
    if (e.target.value === "zw") { warn.textContent = "Experimental: may be stripped by websites, editors, or messengers."; warn.className = "warn show"; }
    else if (e.target.value === "png") { /* handled by updateCapacity */ }
    else warn.className = "warn";
    updateCapacity();
  });
  $("hideBtn").addEventListener("click", runHide);
  $("saveStegoTxt").addEventListener("click", () => {
    const text = $("stegoOut").textContent;
    if (!text) { toast("Nothing to save yet — hide a payload first.", "error"); return; }
    downloadText(text, `stegatrix-stego-${timestamp()}.txt`);
    toast("Stego output saved as .txt", "success");
  });

  // --- Import / decode ---
  $("recoverBtn").addEventListener("click", runRecover);
  $("decMode").addEventListener("change", syncDecUi);
  $("decodePaste").addEventListener("click", () => {
    const text = $("importText").value;
    if (!text) { toast("Paste some artifact text first.", "error"); return; }
    const payload = extractFromText(text);
    if (!payload) { toast("No STEGATRIX payload found in pasted text.", "error"); return; }
    showExtracted(payload);
    toast("Payload extracted from pasted text.", "success");
  });

  // --- Demo image ---
  $("demoImage").addEventListener("click", generateDemoImage);

  // --- Copy buttons (copy the textContent of a target output box) ---
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = $(btn.getAttribute("data-copy"));
      copyText(target ? target.textContent : "", { btn });
    });
  });

  // --- Password show/hide toggles ---
  document.querySelectorAll(".pw-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $(btn.getAttribute("data-target"));
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "hide" : "show";
    });
  });

  // --- Advanced exports (finish strip) ---
  $("expPayloadJson").addEventListener("click", exportPayloadJson);
  $("expReadme").addEventListener("click", exportReadme);

  $("puzzleModes").addEventListener("change", (e) => {
    $("cipherModeField").hidden = !e.target.checked;
    if (!e.target.checked) { $("cipherMode").value = "aes"; state.settings.cipherMode = "aes"; syncCipherUi(); }
  });

  syncCipherUi();
  syncDecUi();
  bindWizard();
  bindDemo();
  goTo("home");
  initDemo();
}

document.addEventListener("DOMContentLoaded", init);
})();
