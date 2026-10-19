/* Stegatrix core: pure cipher + stego functions, shared by index.html and the Node tests.
   Classic script (not an ES module) so index.html still works from file://. */
(function (root) {
"use strict";

const enc = new TextEncoder();
const utf8Dec = new TextDecoder();

const PNG_MAGIC = "STGTRX1";
const ASCII_BEGIN = "---BEGIN STEGATRIX PAYLOAD---";
const ASCII_END = "---END STEGATRIX PAYLOAD---";
const HTML_PAYLOAD_ID = "stegatrix-payload";
const ZW_MAGIC = "\u2063\u2063";
const ZW_ZERO = "\u200B";
const ZW_ONE = "\u200C";
const PBKDF2_MIN = 100000;
const PBKDF2_MAX = 2000000; // also bounds iterations read from imported payloads

const stringToUtf8Bytes = (str) => enc.encode(str);
const utf8BytesToString = (bytes) => utf8Dec.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));

function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const textToBase64 = (str) => bytesToBase64(stringToUtf8Bytes(str));
const base64ToText = (b64) => utf8BytesToString(base64ToBytes(b64));

function bytesToBits(bytes) {
  const bits = new Uint8Array(bytes.length * 8);
  let k = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    for (let j = 7; j >= 0; j--) bits[k++] = (b >> j) & 1;
  }
  return bits;
}
function bitsToBytes(bits) {
  const n = Math.floor(bits.length / 8);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] & 1);
    out[i] = b;
  }
  return out;
}

function uint32ToBytesBE(n) {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}
function bytesBEToUint32(b, off) {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function shiftChar(ch, shift) {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + shift) % 26 + 26) % 26 + 65);
  if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + shift) % 26 + 26) % 26 + 97);
  return ch;
}
function caesarEncrypt(text, shift) {
  const n = ((shift % 26) + 26) % 26;
  let out = "";
  for (const ch of text) out += shiftChar(ch, n);
  return out;
}
function caesarDecrypt(text, shift) { return caesarEncrypt(text, -shift); }

function atbash(text) {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) out += String.fromCharCode(90 - (code - 65));
    else if (code >= 97 && code <= 122) out += String.fromCharCode(122 - (code - 97));
    else out += ch;
  }
  return out;
}

function cleanVigenereKey(key) {
  return (key || "").replace(/[^A-Za-z]/g, "").toUpperCase();
}
function vigenere(text, key, decrypt) {
  const k = cleanVigenereKey(key);
  if (!k) throw new Error("Vigenère key must contain letters.");
  let out = "", ki = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    if (isLetter) {
      const shift = k.charCodeAt(ki++ % k.length) - 65;
      out += shiftChar(ch, decrypt ? -shift : shift);
    } else out += ch;
  }
  return out;
}

function xorCipherToBase64(text, key) {
  if (!key) throw new Error("XOR key is required.");
  const tb = stringToUtf8Bytes(text);
  const kb = stringToUtf8Bytes(key);
  const out = new Uint8Array(tb.length);
  for (let i = 0; i < tb.length; i++) out[i] = tb[i] ^ kb[i % kb.length];
  return bytesToBase64(out);
}
function xorCipherFromBase64(b64, key) {
  if (!key) throw new Error("XOR key is required.");
  const tb = base64ToBytes(b64);
  const kb = stringToUtf8Bytes(key);
  const out = new Uint8Array(tb.length);
  for (let i = 0; i < tb.length; i++) out[i] = tb[i] ^ kb[i % kb.length];
  return utf8BytesToString(out);
}

function hasWebCrypto() { return !!(globalThis.crypto && globalThis.crypto.subtle); }

async function deriveAesKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    "raw", stringToUtf8Bytes(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function aesEncrypt(plaintext, password, iterations) {
  if (!hasWebCrypto()) throw new Error("This browser does not support the Web Crypto API.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, iterations);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, stringToUtf8Bytes(plaintext));
  return {
    app: "STEGATRIX",
    version: 1,
    type: "aes-gcm",
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(cipherBuf)),
    createdAt: new Date().toISOString()
  };
}

async function aesDecrypt(payload, password) {
  if (!hasWebCrypto()) throw new Error("This browser does not support the Web Crypto API.");
  let p = payload;
  if (typeof payload === "string") {
    try { p = JSON.parse(payload); } catch (e) { throw new Error("Payload is not valid JSON."); }
  }
  if (!p || p.type !== "aes-gcm" || !p.salt || !p.iv || !p.ciphertext) {
    throw new Error("Not a valid AES-GCM payload.");
  }
  const salt = base64ToBytes(p.salt);
  const iv = base64ToBytes(p.iv);
  const iterations = p.iterations || 250000;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_MAX) {
    throw new Error("Payload asks for an unsupported PBKDF2 iteration count.");
  }
  const key = await deriveAesKey(password, salt, iterations);
  let plainBuf;
  try {
    plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(p.ciphertext));
  } catch (e) {
    throw new Error("Wrong password or corrupted payload.");
  }
  return utf8BytesToString(new Uint8Array(plainBuf));
}

async function applyCipher(mode, text, fields, encrypt) {
  if (mode === "base64") return encrypt ? textToBase64(text) : base64ToText(text.trim());
  if (mode === "caesar") return encrypt ? caesarEncrypt(text, fields.caesarShift) : caesarDecrypt(text, fields.caesarShift);
  if (mode === "atbash") return atbash(text);
  if (mode === "vigenere") return vigenere(text, fields.vigenereKey, !encrypt);
  if (mode === "xor") return encrypt ? xorCipherToBase64(text, fields.xorKey) : xorCipherFromBase64(text.trim(), fields.xorKey);
  if (mode === "aes") {
    if (!fields.aesPassword) throw new Error("Missing password for AES-GCM.");
    return encrypt
      ? JSON.stringify(await aesEncrypt(text, fields.aesPassword, fields.aesIterations), null, 2)
      : await aesDecrypt(text, fields.aesPassword);
  }
  throw new Error("Unknown cipher mode.");
}

function buildAsciiBlock(asciiText, payload) {
  const b64 = textToBase64(payload); // wrap so JSON/newlines survive cleanly
  return `${asciiText}\n\n${ASCII_BEGIN}\n${b64}\n${ASCII_END}\n`;
}
function extractAsciiBlock(text) {
  const bi = text.indexOf(ASCII_BEGIN);
  const ei = text.indexOf(ASCII_END);
  if (bi === -1 || ei === -1 || ei < bi) return null;
  const body = text.slice(bi + ASCII_BEGIN.length, ei).trim();
  try { return base64ToText(body); } catch (e) { return body; }
}

// PNG LSB: magic + len(BE) + UTF-8 payload in R/G/B LSBs
function embedPayloadInImageData(imageData, payloadString) {
  const payloadBytes = stringToUtf8Bytes(payloadString);
  const magic = stringToUtf8Bytes(PNG_MAGIC);
  const lenBytes = uint32ToBytesBE(payloadBytes.length);
  const full = new Uint8Array(magic.length + 4 + payloadBytes.length);
  full.set(magic, 0);
  full.set(lenBytes, magic.length);
  full.set(payloadBytes, magic.length + 4);

  const bits = bytesToBits(full);
  const data = imageData.data;
  // capacity = width*height*3 (skip alpha)
  const capacityBits = (data.length / 4) * 3;
  if (bits.length > capacityBits) {
    throw new Error("Payload too large for image capacity.");
  }
  let bit = 0;
  for (let i = 0; i < data.length && bit < bits.length; i += 4) {
    data[i + 3] = 255; // canvas stores premultiplied alpha, so LSBs only survive in opaque pixels
    for (let ch = 0; ch < 3 && bit < bits.length; ch++) {
      data[i + ch] = (data[i + ch] & 0xfe) | bits[bit++];
    }
  }
  return imageData;
}

function extractPayloadFromImageData(imageData) {
  const data = imageData.data;
  const totalChannels = (data.length / 4) * 3;
  // read helper: read N bytes worth of bits starting at channel position
  function readBits(numBits, startBit) {
    const bits = new Uint8Array(numBits);
    let bit = 0, produced = 0;
    for (let i = 0; i < data.length && produced < startBit + numBits; i += 4) {
      for (let ch = 0; ch < 3; ch++) {
        if (produced >= startBit && bit < numBits) bits[bit++] = data[i + ch] & 1;
        produced++;
        if (produced >= startBit + numBits) break;
      }
    }
    return bits;
  }
  const magicLen = PNG_MAGIC.length; // 7 bytes
  const headerBits = (magicLen + 4) * 8;
  if (headerBits > totalChannels) throw new Error("No STEGATRIX payload found in this PNG.");
  const headerBytes = bitsToBytes(readBits(headerBits, 0));
  const magic = utf8BytesToString(headerBytes.subarray(0, magicLen));
  if (magic !== PNG_MAGIC) throw new Error("No STEGATRIX payload found in this PNG.");
  const len = bytesBEToUint32(headerBytes, magicLen);
  if (len <= 0 || (headerBits + len * 8) > totalChannels) throw new Error("PNG payload header is corrupted.");
  const payloadBits = readBits(len * 8, headerBits);
  const payloadBytes = bitsToBytes(payloadBits);
  return utf8BytesToString(payloadBytes);
}

// ----- (c) Self-contained HTML artifact -----
function buildHtmlArtifact(asciiText, payload) {
  const asciiEsc = escapeHtml(asciiText || "(no ASCII generated)");
  // Script content is raw text (no entity decoding), so store a JSON string with every "<" escaped so the payload can't close the tag.
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Stegatrix Artifact</title>
<style>
body{background:#05000f;color:#00f5ff;font-family:monospace;margin:0;padding:24px}
h1{color:#ff2bd6;text-shadow:0 0 10px #ff2bd6}
pre{white-space:pre;font-size:8px;line-height:1;text-shadow:0 0 4px #00f5ff;overflow:auto}
.note{color:#91a4b7;font-size:12px;margin-top:20px;border-top:1px solid #234;padding-top:12px}
</style></head>
<body>
<h1>STEGATRIX ARTIFACT</h1>
<pre>${asciiEsc}</pre>
<script type="application/json" id="${HTML_PAYLOAD_ID}">${payloadJson}<\/script>
<div class="note">
  <p>An encrypted payload is embedded in the script tag with id "${HTML_PAYLOAD_ID}".</p>
  <p>To recover: open Stegatrix, use the Import / Decode panel, load this HTML file,
  then decrypt with the correct cipher/password. Payload is base64/JSON.</p>
</div>
</body></html>`;
}
// Inverse of the payload encoding above: the raw text content of that script tag back to the payload.
function decodeHtmlPayloadText(text) {
  const t = text.trim();
  try { const v = JSON.parse(t); if (typeof v === "string") return v; } catch (e) { /* older unquoted artifact */ }
  return t;
}

// ----- (d) Zero-width text stego (experimental) -----
function encodeZeroWidth(payload) {
  const bytes = stringToUtf8Bytes(payload);
  const bits = bytesToBits(bytes);
  let zw = ZW_MAGIC;
  for (let i = 0; i < bits.length; i++) zw += bits[i] ? ZW_ONE : ZW_ZERO;
  return zw;
}
function decodeZeroWidth(text) {
  const mi = text.indexOf(ZW_MAGIC);
  if (mi === -1) return null;
  const rest = text.slice(mi + ZW_MAGIC.length);
  const bits = [];
  for (const ch of rest) {
    if (ch === ZW_ZERO) bits.push(0);
    else if (ch === ZW_ONE) bits.push(1);
    else break; // stop at first non zero-width char
  }
  if (bits.length < 8) return null;
  const bytes = bitsToBytes(Uint8Array.from(bits));
  return utf8BytesToString(bytes);
}

const api = {
  PNG_MAGIC,
  HTML_PAYLOAD_ID,
  PBKDF2_MIN,
  PBKDF2_MAX,
  stringToUtf8Bytes,
  escapeHtml,
  hasWebCrypto,
  aesEncrypt,
  aesDecrypt,
  applyCipher,
  buildAsciiBlock,
  extractAsciiBlock,
  embedPayloadInImageData,
  extractPayloadFromImageData,
  buildHtmlArtifact,
  decodeHtmlPayloadText,
  encodeZeroWidth,
  decodeZeroWidth
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.StegatrixCore = api;
})(globalThis);
