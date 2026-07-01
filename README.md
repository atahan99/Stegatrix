# Stegatrix

**Image → ASCII → Cipher → Stego Artifact**

Stegatrix is a self-contained, offline, single-file web app that turns an image
into cyberpunk ASCII art, encrypts a secret message, hides the encrypted payload
inside a carrier (ASCII text, PNG pixels, HTML, or zero-width characters), and
recovers it later. Everything runs locally in your browser — no backend, no build
step, no dependencies, and nothing is ever uploaded.

![Stegatrix — header, image input and cipher engine](docs/screenshots/hero.png)

---

## Table of contents

- [Concept](#concept)
- [How to run](#how-to-run)
- [Screenshots](#screenshots)
- [Features](#features)
- [Quick start](#quick-start)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Future upgrades](#future-upgrades)
- [Internal format identifiers](#internal-format-identifiers)

---

## Concept

The image is a **visual carrier**, not data storage. ASCII conversion is
intentionally **lossy** — the original image is never reconstructed from ASCII.
The real data path is:

```
Secret message ─▶ Cipher / AES-GCM ─▶ JSON payload ─▶ Stego carrier ─▶ Artifact
Artifact ─▶ Import / Decode ─▶ Decrypt ─▶ Recovered message
```

- **Image layer** — upload, draw to canvas, sample pixels into ASCII art.
- **Encryption layer** — puzzle ciphers (fun) or AES-GCM (secure).
- **Steganography layer** — hide the encrypted payload in ASCII, PNG LSBs, HTML, or zero-width text.
- **Recovery layer** — import an artifact, extract the payload, decrypt it.

---

## How to run

No install, no server, no build.

1. Download `index.html`.
2. Open it in any modern browser (Chrome, Edge, Firefox, Safari) — double-click or drag it into a tab.

That's it. The entire app (HTML + CSS + JS) lives in that one file.

> AES-GCM uses the browser's Web Crypto API, which is available on `file://`, `http://localhost`, and any `https://` origin.

---

## Screenshots

**ASCII Forge (pixel-color theme) + Stego Lab + Import panel**

![ASCII forge in color mode, cipher payload, stego lab and import panel](docs/screenshots/ascii-cipher.png)

**Recovery: extracted AES payload → decrypted plaintext, plus the Export panel**

![Import / decode showing recovered plaintext and the export buttons](docs/screenshots/recover-export.png)

---

## Features

### Image → ASCII
- Drag-and-drop or click-to-browse upload, plus a built-in **Load demo image**.
- Controls: ASCII width (40–240), brightness, contrast, invert, color mode, font size, line height.
- Character sets: **Dense**, **Blocks**, **Binary**, **Cyber**, **Minimal**, or **Custom**.
- Render themes: **monochrome neon**, **color (pixel color)**, **amber terminal**, **matrix green**, **magenta/cyan split glow**.
- Dark pixels are lifted for readability in color mode so images never render invisibly.
- Copy ASCII, download `.txt`, or export the ASCII art as a PNG raster.
- Optional debug view of the sampling canvas.

### Cipher Engine
- **None / Base64 wrapper** — encoding only, not encryption.
- **Caesar**, **Atbash**, **Vigenère**, **XOR** — *puzzle / aesthetic ciphers, clearly labelled not secure*.
- **AES-GCM** — *secure mode*: PBKDF2-SHA256 key derivation (default 250,000 iterations), 256-bit key, random 16-byte salt, random 12-byte IV.
- AES payload is a JSON object: `app, version, type, kdf, hash, iterations, salt, iv, ciphertext, createdAt`.
- Password show/hide toggle, live payload byte-size readout, and one-click copy on every output.

### Stego Lab
- **Visible ASCII block** — appends a `---BEGIN/END STEGATRIX PAYLOAD---` block below the art (Copy or Save `.txt`).
- **PNG LSB** — hides bytes in the least-significant bits of the R/G/B channels.
  Format: magic `STGTRX1` + 4-byte big-endian length + UTF-8 payload. A live capacity
  estimator (`width × height × 3` bits) shows whether the payload fits. Downloads a PNG directly.
- **Self-contained HTML** — downloads a standalone page containing the ASCII art plus the payload in `<script type="application/json" id="stegatrix-payload">`.
- **Zero-width text** (experimental) — hides the payload as invisible characters inside a visible cover sentence.

### Import / Decode
- Import a **PNG / TXT / HTML** file, **or paste artifact text** directly.
- Auto-detects the carrier: HTML script tag, ASCII block, zero-width data, or PNG LSB.
- Context-sensitive decode fields (only the relevant key/password is shown), then recovers the plaintext.

### Export
- PNG with hidden payload, self-contained HTML, ASCII TXT, encrypted payload JSON, and an instructions TXT.
- All downloads use timestamped filenames, e.g. `stegatrix-stego-YYYYMMDD-HHMM.png`.

---

## Quick start

1. Click **Load demo image** (or drop your own).
2. In **Cipher Engine**, type a message, pick **AES-GCM (secure)**, enter a password, click **Encrypt**.
3. In **Stego Lab**, choose a hide mode and click **Hide payload** (PNG/HTML download instantly; ASCII/zero-width appear in the output box — use Copy or Save `.txt`).
4. To recover: in **Import / Decode**, drop the artifact (or paste the text), set the matching decode mode/password, and click **Recover message**.

---

## Security notes

- **ASCII conversion is lossy and visual only.** You cannot rebuild the image from ASCII.
- **Classical ciphers (Caesar, Atbash, Vigenère, XOR) are puzzles, not security.**
- **AES-GCM is the secure option.** Use a strong, unique password.
- **LSB steganography is fragile.** It survives only lossless PNG. JPEG/WebP re-encoding, resizing, screenshots, and most social-media uploads will destroy the hidden bits.
- **Zero-width stego is experimental** and is often stripped by websites, editors, and messengers.
- **All processing happens locally in your browser.** No network requests, no uploads.

---

## Known limitations

- Very large images are capped during ASCII sampling to keep the browser responsive.
- PNG LSB capacity depends on image resolution; large AES payloads need larger images.
- Zero-width payloads can be silently removed by many text surfaces.
- Color ASCII uses one `<span>` per character, so extremely wide outputs are heavier to render.

---

## Future upgrades

- Optional payload compression before embedding.
- Password strength meter and configurable KDF presets.
- Error-correction coding for more robust LSB.
- Additional carriers (audio, SVG metadata).

---

## Internal format identifiers

These constants are used identically on the write and read paths, so artifacts round-trip cleanly.

| Purpose             | Value                               |
|---------------------|-------------------------------------|
| PNG magic header    | `STGTRX1`                           |
| ASCII block markers | `---BEGIN/END STEGATRIX PAYLOAD---` |
| HTML payload id     | `stegatrix-payload`                 |
| Payload `app` field | `STEGATRIX`                         |

---

## Verified flows

All core flows were tested end-to-end in a real browser:

- Base64 / Caesar / Atbash / Vigenère / XOR / AES-GCM encrypt + decrypt round-trips.
- AES-GCM fails cleanly with the wrong password.
- Image → ASCII across character sets and every render theme.
- Hide → import → decrypt for all four carriers (ASCII block, PNG LSB, HTML, zero-width).
- PNG LSB capacity estimator and over-capacity warning.
- Paste-to-decode and Save `.txt` from the Stego output.
