const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../core.js");

const MESSAGE = "meet at dawn — 東京 </script><b>x</b> 🔐";
const FAST = 1000; // PBKDF2 iterations for tests; the app default is 600k

// Fake ImageData: an opaque w×h RGBA buffer with varied pixel values.
function imageData(w, h, alpha = 255) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = (i * 37) & 0xff;
  for (let i = 3; i < data.length; i += 4) data[i] = alpha;
  return { width: w, height: h, data };
}

// What DOMParser hands back for a <script> element: its raw text, no entity decoding.
function scriptText(html) {
  const open = `id="${core.HTML_PAYLOAD_ID}">`;
  const start = html.indexOf(open) + open.length;
  return html.slice(start, html.indexOf("</script>", start));
}

test("every cipher round-trips", async () => {
  const fields = { caesarShift: 7, vigenereKey: "GHOST", xorKey: "k3y", aesPassword: "correct horse" };
  for (const mode of ["base64", "caesar", "atbash", "vigenere", "xor", "aes"]) {
    const payload = await core.applyCipher(mode, MESSAGE, fields, true);
    assert.equal(await core.applyCipher(mode, payload, fields, false), MESSAGE, mode);
  }
});

test("every payload is an envelope that names its mode and carries no app tag or timestamp", async () => {
  const fields = { caesarShift: 7, vigenereKey: "GHOST", xorKey: "k3y", aesPassword: "pw" };
  for (const mode of ["base64", "caesar", "atbash", "vigenere", "xor", "aes"]) {
    const payload = await core.applyCipher(mode, MESSAGE, fields, true);
    const env = JSON.parse(payload);
    assert.equal(env.mode, mode);
    assert.equal(env.v, 2);
    assert.equal(env.app, undefined);
    assert.equal(env.createdAt, undefined);
    assert.equal(core.payloadMode(payload), mode);
    // Recover may be left on the wrong mode; the envelope wins.
    assert.equal(await core.applyCipher("base64", payload, fields, false), MESSAGE, mode);
  }
});

test("raw pre-envelope payloads still decrypt with an explicit mode", async () => {
  assert.equal(await core.applyCipher("caesar", "Uryyb", { caesarShift: 13 }, false), "Hello");
  assert.equal(await core.applyCipher("base64", "aGVsbG8=", {}, false), "hello");
  assert.equal(core.payloadMode("Uryyb"), null);
});

test("v1 AES envelopes (deriveKey, type aes-gcm) still decrypt", async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode("pw"), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: FAST, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(MESSAGE));
  const b64 = (b) => Buffer.from(b).toString("base64");
  const v1 = JSON.stringify({ app: "STEGATRIX", version: 1, type: "aes-gcm", iterations: FAST, salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) });
  assert.equal(core.payloadMode(v1), "aes");
  assert.equal(await core.applyCipher("auto", v1, { aesPassword: "pw" }, false), MESSAGE);
});

test("AES uses a fresh salt and IV each time", async () => {
  const a = await core.aesEncrypt(MESSAGE, "pw", FAST);
  const b = await core.aesEncrypt(MESSAGE, "pw", FAST);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
});

test("AES rejects a wrong password and a tampered ciphertext", async () => {
  const p = await core.aesEncrypt(MESSAGE, "right", FAST);
  await assert.rejects(core.aesDecrypt(p, "wrong"), /Wrong password/);
  const bytes = Buffer.from(p.ciphertext, "base64");
  bytes[0] ^= 1;
  await assert.rejects(core.aesDecrypt({ ...p, ciphertext: bytes.toString("base64") }, "right"), /Wrong password/);
});

test("AES refuses an imported iteration count above the cap", async () => {
  const p = await core.aesEncrypt(MESSAGE, "pw", FAST);
  await assert.rejects(core.aesDecrypt({ ...p, iterations: core.PBKDF2_MAX + 1 }, "pw"), /iteration count/);
  await assert.rejects(core.aesDecrypt({ ...p, iterations: "600000" }, "pw"), /iteration count/);
});

test("ASCII block carrier round-trips", () => {
  const text = core.buildAsciiBlock("@@##..\n..##@@", MESSAGE);
  assert.equal(core.extractAsciiBlock(text), MESSAGE);
  assert.equal(core.extractAsciiBlock("no markers here"), null);
});

test("HTML carrier round-trips a payload that contains </script>", () => {
  const html = core.buildHtmlArtifact("@#", MESSAGE);
  assert.equal(html.split("</script>").length, 2, "payload must not close the script tag early");
  assert.equal(core.decodeHtmlPayloadText(scriptText(html)), MESSAGE);
});

test("HTML carrier still reads older unquoted artifacts", () => {
  assert.equal(core.decodeHtmlPayloadText("  aGVsbG8=  "), "aGVsbG8=");
});

test("zero-width carrier round-trips inside cover text", () => {
  const hidden = "hello" + core.encodeZeroWidth(MESSAGE) + " there";
  assert.equal(core.decodeZeroWidth(hidden), MESSAGE);
  assert.equal(core.decodeZeroWidth("hello there"), null);
});

test("PNG LSB carrier round-trips and only touches low bits", () => {
  const img = imageData(64, 48);
  const before = Uint8ClampedArray.from(img.data);
  core.embedPayloadInImageData(img, MESSAGE);
  assert.equal(core.extractPayloadFromImageData(img), MESSAGE);
  for (let i = 0; i < img.data.length; i++) assert.ok(Math.abs(img.data[i] - before[i]) <= 1);
});

test("PNG embedding makes carrying pixels opaque", () => {
  const img = imageData(64, 48, 40);
  core.embedPayloadInImageData(img, "hi");
  assert.equal(img.data[3], 255, "first carrying pixel");
  assert.equal(img.data[img.data.length - 1], 40, "untouched pixel keeps its alpha");
  assert.equal(core.extractPayloadFromImageData(img), "hi");
});

test("PNG embedding rejects payloads over capacity", () => {
  assert.throws(() => core.embedPayloadInImageData(imageData(4, 4), MESSAGE), /too large/);
});

test("PNG extraction rejects images without a payload", () => {
  assert.throws(() => core.extractPayloadFromImageData(imageData(64, 48)), /No STEGATRIX payload/);
});

// ---- Keyed PNG (AES): runs real 600k-iteration PBKDF2, so a few seconds ----

const aesPayload = async (password) => JSON.stringify(await core.aesEncrypt(MESSAGE, password));

// Indices of RGB channels whose value changed.
function changedSlots(before, after) {
  const out = [];
  for (let i = 0; i < after.length; i++) if (i % 4 !== 3 && before[i] !== after[i]) out.push(i);
  return out;
}

test("keyed PNG round-trips with the password", async () => {
  const img = imageData(64, 48);
  const payload = await aesPayload("correct horse");
  await core.embedPayloadKeyed(img, payload, "correct horse");
  assert.equal(await core.openPayloadKeyed(img, "correct horse"), MESSAGE);
  assert.ok(core.pngBytesNeeded(payload) <= (64 * 48 * 3) / 8);
});

test("keyed PNG has no public marker and scatters its bits", async () => {
  const img = imageData(64, 48);
  const before = Uint8ClampedArray.from(img.data);
  await core.embedPayloadKeyed(img, await aesPayload("pw"), "pw");
  assert.throws(() => core.extractPayloadFromImageData(img), /No STEGATRIX payload/);
  const changed = changedSlots(before, img.data);
  // Sequential embedding would leave the bottom of the image untouched.
  assert.ok(changed[changed.length - 1] > img.data.length * 0.9, "changes reach the end of the image");
});

test("keyed PNG uses LSB matching: changes are ±1 and cross value pairs", async () => {
  const img = imageData(64, 48);
  const before = Uint8ClampedArray.from(img.data);
  await core.embedPayloadKeyed(img, await aesPayload("pw"), "pw");
  let up = 0, down = 0, crossPair = 0;
  for (const i of changedSlots(before, img.data)) {
    const d = img.data[i] - before[i];
    assert.ok(d === 1 || d === -1, `channel ${i} moved by ${d}`);
    if (d === 1) up++; else down++;
    // Replacement never leaves the pair {2k, 2k+1}; matching does about half the time.
    if (img.data[i] >> 1 !== before[i] >> 1) crossPair++;
  }
  assert.ok(up > 0 && down > 0, `both directions used (up ${up}, down ${down})`);
  assert.ok(crossPair > 0, "some changes cross value pairs");
});

test("keyed PNG matching stays in range on black and white images", async () => {
  for (const fill of [0, 255]) {
    const img = imageData(64, 48);
    for (let i = 0; i < img.data.length; i++) if (i % 4 !== 3) img.data[i] = fill;
    await core.embedPayloadKeyed(img, await aesPayload("pw"), "pw");
    for (let i = 0; i < img.data.length; i++) if (i % 4 !== 3) assert.ok(Math.abs(img.data[i] - fill) <= 1);
    assert.equal(await core.openPayloadKeyed(img, "pw"), MESSAGE, `fill ${fill}`);
  }
});

test("keyed PNG: wrong password and a plain image fail the same way", async () => {
  const img = imageData(64, 48);
  await core.embedPayloadKeyed(img, await aesPayload("right"), "right");
  await assert.rejects(core.openPayloadKeyed(img, "wrong"), /Wrong password, or this PNG has no hidden message/);
  await assert.rejects(core.openPayloadKeyed(imageData(64, 48), "right"), /Wrong password, or this PNG has no hidden message/);
});

test("keyed PNG refuses a password that doesn't match the payload", async () => {
  await assert.rejects(core.embedPayloadKeyed(imageData(64, 48), await aesPayload("one"), "two"), /doesn't match/);
});

test("keyed PNG rejects payloads over capacity", async () => {
  await assert.rejects(core.embedPayloadKeyed(imageData(8, 8), await aesPayload("pw"), "pw"), /too large/);
});
