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
const PBKDF2_ITERATIONS = 600000;
const PBKDF2_MAX = 2000000; // bounds iterations read from imported payloads
const ENVELOPE_VERSION = 2;
const MODES = ["aes", "base64", "caesar", "atbash", "vigenere", "xor"];

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

async function deriveKeyBits(password, salt, iterations) {
  const material = await crypto.subtle.importKey("raw", stringToUtf8Bytes(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, 256));
}
// Same key PBKDF2 deriveKey would give, so v1 payloads still decrypt.
const importAesKey = (bits) => crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]);
const deriveAesKey = async (password, salt, iterations) => importAesKey(await deriveKeyBits(password, salt, iterations));

function aesEnvelope(iterations, salt, iv, ciphertext) {
  return {
    v: ENVELOPE_VERSION, mode: "aes", kdf: "PBKDF2", hash: "SHA-256", iterations,
    salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext)
  };
}

async function aesEncrypt(plaintext, password, iterations = PBKDF2_ITERATIONS) {
  if (!hasWebCrypto()) throw new Error("This browser does not support the Web Crypto API.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, iterations);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, stringToUtf8Bytes(plaintext));
  return aesEnvelope(iterations, salt, iv, new Uint8Array(cipherBuf));
}

async function aesDecrypt(payload, password) {
  if (!hasWebCrypto()) throw new Error("This browser does not support the Web Crypto API.");
  const p = typeof payload === "string" ? parseEnvelope(payload) : payload;
  if (!p || (p.mode !== "aes" && p.type !== "aes-gcm") || !p.salt || !p.iv || !p.ciphertext) {
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

// Every payload is a JSON envelope naming its mode, so Recover can tell how it was made.
// Returns null for raw pre-envelope payloads; v1 AES envelopes ({type: "aes-gcm"}) count as mode "aes".
function parseEnvelope(text) {
  let p;
  try { p = JSON.parse(text); } catch (e) { return null; }
  if (!p || typeof p !== "object") return null;
  if (p.type === "aes-gcm") return Object.assign({}, p, { mode: "aes" });
  return MODES.includes(p.mode) ? p : null;
}
const payloadMode = (text) => { const env = parseEnvelope(text); return env ? env.mode : null; };

function puzzleCipher(mode, text, fields, encrypt) {
  if (mode === "base64") return encrypt ? textToBase64(text) : base64ToText(text.trim());
  if (mode === "caesar") return encrypt ? caesarEncrypt(text, fields.caesarShift) : caesarDecrypt(text, fields.caesarShift);
  if (mode === "atbash") return atbash(text);
  if (mode === "vigenere") return vigenere(text, fields.vigenereKey, !encrypt);
  if (mode === "xor") return encrypt ? xorCipherToBase64(text, fields.xorKey) : xorCipherFromBase64(text.trim(), fields.xorKey);
  throw new Error("Unknown cipher mode.");
}

// Encrypting always returns an envelope. Decrypting trusts the envelope's mode; `mode` only matters for raw legacy payloads.
async function applyCipher(mode, text, fields, encrypt) {
  if (!encrypt) {
    const env = parseEnvelope(text);
    if (env) { mode = env.mode; if (mode !== "aes") text = String(env.data); }
  }
  if (mode === "aes") {
    if (!fields.aesPassword) throw new Error("Missing password for AES-GCM.");
    return encrypt
      ? JSON.stringify(await aesEncrypt(text, fields.aesPassword))
      : await aesDecrypt(text, fields.aesPassword);
  }
  const out = puzzleCipher(mode, text, fields, encrypt);
  return encrypt ? JSON.stringify({ v: ENVELOPE_VERSION, mode, data: out }) : out;
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

// Marker PNG (non-AES payloads): magic + len(BE) + UTF-8 payload in R/G/B LSBs, in pixel order. Anyone can read it.
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

// ----- Keyed PNG (AES payloads): no marker, password-keyed pixel order, masked length -----
// Layout over R/G/B "slots" (slot s = channel s % 3 of pixel s / 3, alpha never used):
//   slots 0..127            salt, in order (random bytes, needed before any key exists)
//   keyed slots from 128+   masked length (4) | iv (12) | ciphertext, in an order only the password reproduces
const SALT_SLOTS = 128;
const KEYED_NOT_FOUND = "Wrong password, or this PNG has no hidden message.";
const slotCount = (imageData) => (imageData.data.length / 4) * 3;
const slotIndex = (s) => ((s / 3) | 0) * 4 + (s % 3);

function randomBytes(n) {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, i + 65536)); // per-call limit is 64 KiB
  return out;
}

// LSB matching: when a bit needs flipping, step the value randomly up or down by 1 instead of overwriting the LSB.
// Replacement only ever swaps within pairs (2k <-> 2k+1), which is exactly what chi-square, RS and sample-pairs analysis detect.
function writeSlots(data, slots, bytes) {
  const bits = bytesToBits(bytes);
  const coin = randomBytes(bits.length);
  for (let i = 0; i < bits.length; i++) {
    const at = slotIndex(slots[i]);
    const v = data[at];
    if ((v & 1) !== bits[i]) data[at] = v === 0 ? 1 : v === 255 ? 254 : v + (coin[i] & 1 ? 1 : -1);
    data[at - (at % 4) + 3] = 255; // canvas stores premultiplied alpha, so LSBs only survive in opaque pixels
  }
}
function readSlots(data, slots) {
  const bits = new Uint8Array(slots.length);
  for (let i = 0; i < slots.length; i++) bits[i] = data[slotIndex(slots[i])] & 1;
  return bitsToBytes(bits);
}
const saltSlots = () => Uint32Array.from({ length: SALT_SLOTS }, (_, i) => i);

// AES-CTR keystream under a key HKDF-derived from the password key: 4 bytes of length mask, then 4 bytes per slot pick.
async function orderStream(keyBits, salt, picks) {
  const hkdf = await crypto.subtle.importKey("raw", keyBits, "HKDF", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: stringToUtf8Bytes("stegatrix png order v2") },
    hkdf, { name: "AES-CTR", length: 128 }, false, ["encrypt"]
  );
  const zeros = new Uint8Array(4 + picks * 4);
  return new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CTR", counter: new Uint8Array(16), length: 64 }, key, zeros));
}

// First `count` slots of a keystream-driven shuffle of [SALT_SLOTS, n): sparse Fisher-Yates, O(count) memory.
function pickSlots(stream, n, count) {
  const range = n - SALT_SLOTS;
  const moved = new Map();
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    // shortcut: modulo bias is at most range/2^32 (~1% on a 12 MP image), switch to rejection sampling if positions must be exactly uniform
    const j = i + (view.getUint32(4 + i * 4) % (range - i));
    const atI = moved.has(i) ? moved.get(i) : i;
    out[i] = SALT_SLOTS + (moved.has(j) ? moved.get(j) : j);
    moved.set(j, atI);
  }
  return out;
}

const maskLength = (len, stream) => uint32ToBytesBE(len).map((b, k) => b ^ stream[k]);

async function embedPayloadKeyed(imageData, payload, password) {
  const env = parseEnvelope(payload);
  if (!env || env.mode !== "aes") throw new Error("Keyed PNG hiding needs an AES-GCM payload.");
  if (env.iterations !== PBKDF2_ITERATIONS) throw new Error("This message uses an older key setting. Encrypt it again.");
  const salt = base64ToBytes(env.salt), iv = base64ToBytes(env.iv), ct = base64ToBytes(env.ciphertext);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("Not a valid AES-GCM payload.");
  const n = slotCount(imageData);
  const bodyBits = (4 + 12 + ct.length) * 8;
  if (SALT_SLOTS + bodyBits > n) throw new Error("Payload too large for image capacity.");

  const keyBits = await deriveKeyBits(password, salt, PBKDF2_ITERATIONS);
  // The pixel order comes from the password, so a mismatched one would hide a message nobody can find.
  try { await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await importAesKey(keyBits), ct); }
  catch (e) { throw new Error("The password doesn't match the encrypted message. Encrypt it again."); }

  const stream = await orderStream(keyBits, salt, bodyBits);
  const body = new Uint8Array(4 + 12 + ct.length);
  body.set(maskLength(ct.length, stream), 0);
  body.set(iv, 4);
  body.set(ct, 16);
  writeSlots(imageData.data, saltSlots(), salt);
  writeSlots(imageData.data, pickSlots(stream, n, bodyBits), body);
  return imageData;
}

// Finds, decrypts and returns the message. Wrong password and "nothing here" fail identically by design.
async function openPayloadKeyed(imageData, password) {
  const data = imageData.data;
  const n = slotCount(imageData);
  const headerBits = (4 + 12) * 8;
  if (SALT_SLOTS + headerBits + 128 > n) throw new Error(KEYED_NOT_FOUND);
  const salt = readSlots(data, saltSlots());
  const keyBits = await deriveKeyBits(password, salt, PBKDF2_ITERATIONS);

  const headStream = await orderStream(keyBits, salt, headerBits);
  const head = readSlots(data, pickSlots(headStream, n, headerBits));
  const len = bytesBEToUint32(maskLength(bytesBEToUint32(head, 0), headStream), 0);
  if (len < 16 || SALT_SLOTS + headerBits + len * 8 > n) throw new Error(KEYED_NOT_FOUND);

  const bodyBits = headerBits + len * 8;
  const stream = await orderStream(keyBits, salt, bodyBits);
  const body = readSlots(data, pickSlots(stream, n, bodyBits));
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: body.subarray(4, 16) }, await importAesKey(keyBits), body.subarray(16));
    return utf8BytesToString(new Uint8Array(plain));
  } catch (e) {
    throw new Error(KEYED_NOT_FOUND);
  }
}

// Bytes the PNG carrier needs: keyed layout for AES envelopes, marker layout for everything else.
function pngBytesNeeded(payload) {
  const env = parseEnvelope(payload);
  if (env && env.mode === "aes") return SALT_SLOTS / 8 + 4 + 12 + base64ToBytes(env.ciphertext).length;
  return PNG_MAGIC.length + 4 + stringToUtf8Bytes(payload).length;
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
  HTML_PAYLOAD_ID,
  PBKDF2_MAX,
  stringToUtf8Bytes,
  escapeHtml,
  hasWebCrypto,
  aesEncrypt,
  aesDecrypt,
  applyCipher,
  payloadMode,
  embedPayloadKeyed,
  openPayloadKeyed,
  pngBytesNeeded,
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
