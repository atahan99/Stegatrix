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
  const fields = { caesarShift: 7, vigenereKey: "GHOST", xorKey: "k3y", aesPassword: "correct horse", aesIterations: FAST };
  for (const mode of ["base64", "caesar", "atbash", "vigenere", "xor", "aes"]) {
    const payload = await core.applyCipher(mode, MESSAGE, fields, true);
    assert.equal(await core.applyCipher(mode, payload, fields, false), MESSAGE, mode);
  }
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
