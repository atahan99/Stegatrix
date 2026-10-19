# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: portfolio reviewers, meaning recruiters and engineers who land on the live demo or repo and give it 30–60 seconds. They need to see the trick work and come away convinced the author understands steganography and applied crypto, not just a UI.

Secondary: people who actually hide messages, such as CTF players, puzzle makers and privacy hobbyists. They come back to use the Create and Recover flows.

## Product Purpose

Stegatrix hides an encrypted message inside an image, a text block, an HTML page or zero-width characters, and recovers it later, entirely in the browser. Success for the primary audience is understanding *where the message lives* and that it's really protected, within the first screen. Success for the secondary audience is a Create or Recover round trip with no confusion about which mode or password applies.

## Positioning

Most browser stego demos write plaintext into the first pixels behind a visible header. Stegatrix's AES PNG carrier has no marker, a password-keyed pixel order, a masked length and LSB matching, and the repo documents a threat model and backs it with tests. The difference is honest, inspectable depth: the product shows its mechanism rather than just claiming security.

## Operating Context

- Hosted on Cloudflare Pages at stegatrix.cybrsmr.xyz with a strict CSP (no third-party scripts, no network requests after load). It also runs from a downloaded copy on `file://`.
- Reviewers often arrive from a GitHub README or a portfolio link, on desktop or phone.
- Users move artifacts through other channels (chat, email, file shares) that may strip zero-width characters or re-encode images.

## Capabilities and Constraints

- Static `index.html` + `core.js`: no build step, no framework, no dependencies. This must stay true.
- Create path (Image → Encrypt → Hide) and Recover path (Import → Recover) as a stepped wizard. This structure stays.
- Image-to-ASCII conversion with tuning controls stays as a feature.
- Ciphers: AES-GCM (default and only secure mode). Base64, Caesar, Atbash, Vigenère and XOR are puzzle modes that may move behind a puzzle-mode switch.
- Carriers: keyed PNG (AES), marker PNG (puzzle modes), ASCII text block, HTML page, zero-width text (experimental).
- Every payload is a v2 JSON envelope naming its mode. PBKDF2 is fixed at 600k iterations.
- The pure logic in `core.js` is covered by `node --test`.

## Brand Commitments

- Name: Stegatrix.
- Neon identity stays (user decision, 2026-10-19): dark ground with cyan and magenta neon. Redesign work refines this world and doesn't replace it.
- GitHub button in the About panel matches the author's other sites (NeonSig pattern: logo + "GitHub repository").

## Evidence on Hand

- Working code, a 22-test suite and the threat model in README.md.
- Screenshots in `docs/screenshots/` show the outgoing neon design, not the redesign.
- No sample stego image exists yet. The redesigned hero needs one made with the real app, with its password shown publicly. Don't fake the reveal.
- No testimonials, usage numbers or press. Don't invent any.

## Product Principles

1. Show the mechanism. The hidden data should be visible on demand (bit planes, scattered pixels), not just described.
2. Honest claims only. Every security statement in the UI must match the README's threat model.
3. Secure by default. AES-GCM is the default path, and insecure modes are clearly labelled as puzzles.
4. Local and offline. Nothing the user provides leaves the browser.
5. Thirty-second proof. A reviewer should see a message come out of an image before scrolling.

## Accessibility & Inclusion

WCAG 2.1 AA: visible keyboard focus, labelled controls, 44px touch targets and a reduced-motion alternative. Any reveal that depends on color must also work without it.
