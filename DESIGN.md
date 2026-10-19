---
name: Stegatrix
description: Neon on near-black, where every color has one job and glow means hidden data, focus, or now.
colors:
  bg: "#07030f"
  surface: "#0e0a1b"
  surface-2: "#15102a"
  void: "#000000"
  line: "rgba(0,245,255,0.16)"
  line-strong: "rgba(0,245,255,0.42)"
  cyan: "#00f5ff"
  cyan-hover: "#7ffaff"
  magenta: "#ff2bd6"
  magenta-hover: "#ff7ae6"
  green: "#39ff14"
  amber: "#ffbf00"
  danger: "#ff5c7a"
  text: "#e9f8ff"
  muted: "#9fb0c3"
  on-accent: "#07030f"
typography:
  wordmark:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "0.14em"
  display:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(28px, 3.4vw, 44px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  data:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  kbd: "4px"
  field: "9px"
  control: "10px"
  panel: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.cyan-hover}"
  button-secondary:
    backgroundColor: "rgba(0,245,255,0.06)"
    textColor: "{colors.cyan}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "rgba(0,245,255,0.14)"
  button-reveal:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  button-reveal-hover:
    backgroundColor: "{colors.magenta-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    height: "44px"
  input-field:
    backgroundColor: "rgba(0,0,0,0.35)"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "16px 20px 20px"
  view-switch-segment:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  view-switch-segment-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
  step-chip:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "4px 14px 4px 6px"
    height: "44px"
  step-chip-active:
    textColor: "{colors.text}"
  data-output:
    backgroundColor: "rgba(0,0,0,0.4)"
    textColor: "{colors.text}"
    typography: "{typography.data}"
    rounded: "{rounded.field}"
    padding: "12px"
---

# Design System: Stegatrix

## Overview

**Creative North Star: "The Lit Sign in a Dark Lab"**

Stegatrix is a neon world pinned by the user and then disciplined: a near-black violet ground, flat hairline-bordered panels, and a small set of saturated neon colors that each carry exactly one meaning. The wordmark is the neon sign over the door; everything else in the room is quiet until something real happens. Glow is a signal, not a finish. It appears on the wordmark, on hidden data when it is revealed, on keyboard focus, on the active wizard step, and on the user's own ASCII art output. Nowhere else.

Density is moderate and tool-like. A single 1120px column holds a two-area hero (image viewer beside a reveal panel) and a stepped wizard of flat panels. The interface proves its mechanism by showing it, so the canvas viewer and the monospace data surfaces are the most important things on screen, and chrome stays out of their way.

The world refuses the neon-template habit of glowing every surface: panels, buttons and fields sit flat at rest, and hierarchy comes from color role and hairline weight rather than light.

**Key Characteristics:**
- Near-black violet ground with two very faint corner washes (cyan top right, magenta bottom left).
- One job per color: cyan interface, magenta hidden data, green success, amber warnings, rose-red errors.
- Glow only on the wordmark, revealed data, focus, the active step, and user ASCII art.
- Geist Bold for display text only; system sans for prose and controls; system monospace for data.
- Flat, hairline-bordered panels; no nested cards; 44px minimum targets.
- Drawn CSS chevrons instead of glyph icons.

## Colors

Saturated neon accents on a violet-black ground, each accent locked to a single meaning.

### Primary
- **Interface Cyan** (`cyan`): the interface color. Links, the primary button fill, secondary button text and tint, the active step ring, range and checkbox accents, focus outlines, text selection, the caret, the ASCII default, and the 3px scan line of the hero wipe. Hover on a cyan fill lightens to **Pale Cyan** (`cyan-hover`).

### Secondary
- **Hidden-Data Magenta** (`magenta`): marks hidden data and the act of exposing it. The changed pixels in the Changes view, the active Changes segment, the revealed-message border and bloom, the bolded counts in the view caption, and the Reveal button. Hover lightens to **Pale Magenta** (`magenta-hover`).

### Tertiary
- **Success Green** (`green`): success only. Completed step badges, the "fits" capacity state, "ready" payload state, success toasts, and the green ASCII theme.
- **Warning Amber** (`amber`): warnings only. The warning notice (text, 40% border, 6% fill), warning toasts, and the amber ASCII theme.
- **Error Rose** (`danger`): errors only. Failed reveal text and its 60% border, over-capacity state, error toasts.

### Neutral
- **Violet Black** (`bg`): page ground; also the text color on every neon fill (`on-accent`).
- **Night Violet** (`surface`): panel and reveal-panel fill.
- **Raised Violet** (`surface-2`): active view-switch segment, step-number badges at rest, toasts, keyboard keys.
- **Void** (`void`): the image viewer and ASCII shell, so pixels and art read against true black.
- **Cyan Hairline** (`line`, 16% cyan): every resting border and divider.
- **Strong Hairline** (`line-strong`, 42% cyan): hover borders, secondary button borders, dropzone dash, toast border.
- **Ice White** (`text`): primary text.
- **Slate Mist** (`muted`): secondary prose, captions, hints, inactive segments and steps.

### Named Rules
**The One Job Rule.** Each neon color means one thing. Cyan is interface, magenta is hidden data, green is success, amber is warning, rose is error. A color never borrows another's meaning, and a state never appears in a color it does not own.

**The Magenta Is Secret Rule.** As a foreground or border, magenta appears only on hidden data or the control that reveals it. Its single non-data appearance is the 6% ambient wash in the bottom-left corner of the page ground.

## Typography

**Display Font:** Geist Bold, 700 only, self-hosted (SIL OFL) with system-ui fallback
**Body Font:** system UI sans stack
**Label/Mono Font:** system monospace stack (ui-monospace, SF Mono, Menlo, Consolas)

**Character:** A single geometric bold face gives the wordmark and headings one consistent voice on every device, while native sans keeps prose and controls fast and familiar, and monospace marks anything that is data.

### Hierarchy
- **Wordmark** (Geist 700, 22px, 0.14em tracking, uppercase text, cyan with the brand glow): the header wordmark only.
- **Display** (Geist 700, clamp(28px, 3.4vw, 44px), 1.15, -0.025em, max 16ch): the home hero H1. 26px under 560px.
- **Headline** (Geist 700, 20px, 1.15): wizard step headings at the top of each panel.
- **Body** (system sans 400, 16px, 1.55): prose. Hero support copy is muted and capped at 44ch; captions at 62ch; long lists at 72ch.
- **Label** (system sans 600, 14px): field labels, disclosure summaries; buttons use 600 at 15px. Secondary prose sits at 14px muted, fine print at 13px.
- **Data** (system monospace, 13 to 14px): passwords, payloads, outputs, capacity counts, step numbers, range values, the revealed message, keyboard keys (12px).

### Named Rules
**The Three Voices Rule.** Geist Bold speaks only in the wordmark, the hero H1 and step headings. System sans carries prose and controls. Monospace means "this is data". Never set prose in mono or data in sans.

**The One Weight Rule.** Only Geist 700 is shipped. Do not request other Geist weights; a lighter display needs a new face file and a deliberate decision.

## Layout

A single centered column, max 1120px, padded 20px (16px under 560px) with 64px (48px) bottom room. The header is a baseline-aligned row: wordmark, tagline, and on wizard screens a wrapping step bar, closed by a hairline.

The home hero is a two-column grid (1.45fr / 1fr, 20px by 40px gaps): the 4:3 viewer and its caption on the left, the H1 block and reveal panel on the right. Under 860px it collapses to one column in the order copy, viewer, caption, reveal, and the view switch stretches full width with equal segments. Hero actions sit below a hairline, 32px down.

Spacing runs on 4, 8, 12, 16 and 20px, with 28 to 32px between major blocks. Button groups gap at 10px; label-to-field is 6px with 16px above each label. Wizard panels pad 16px 20px 20px (16px sides on phones).

## Elevation & Depth

The system is flat. Depth comes from three tonal steps (ground, surface, raised surface) and from hairline borders, not shadows. Light is reserved for meaning.

### Shadow Vocabulary
- **Brand glow** (`text-shadow: 0 0 10px rgba(0,245,255,0.45)`): the wordmark only.
- **Data glow** (`box-shadow: 0 0 14px rgba(255,43,214,0.55)`): the revealed message at rest, after a one-time 0.9s bloom from a 48px magenta flare.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(0,245,255,0.28)`, paired with a 2px cyan outline at 2px offset): every focusable control.
- **Active step** (`box-shadow: 0 0 12px rgba(0,245,255,0.25)`): the current wizard step chip.
- **Art glow** (`text-shadow: 0 0 6px currentColor`): the user's ASCII output, in its chosen theme color.
- **Toast lift** (`box-shadow: 0 8px 24px rgba(0,0,0,0.5)`): toasts only, the one floating layer; a dark lift, not a glow.

### Named Rules
**The Glow Is a Signal Rule.** If something glows, it is the brand sign, hidden data, focus, the current step, or the user's art. Panels, buttons and fields never glow at rest or on hover.

## Shapes

Softly rounded rectangles with 1px hairlines. Panels, the viewer and the dropzone take 12px corners; buttons, the message output, toasts and the ASCII shell take 10px; fields, data outputs and notices take 9px; keyboard keys 4px. Segmented controls and step chips are full pills (999px); step-number badges are circles. Directional marks (disclosure chevrons, step-bar arrows) are drawn as two-sided bordered squares rotated 45 degrees, never type glyphs. The dropzone is the only dashed border.

## Components

### Buttons
Flat, confident, and color-coded by role.
- **Shape:** gently rounded (10px), 44px minimum height, 15px semibold sans.
- **Primary:** cyan fill with violet-black text; one per decision ("Hide your own message", next step).
- **Reveal:** magenta fill with violet-black text; only for the action that exposes hidden data.
- **Secondary:** 6% cyan tint, strong-hairline border, cyan text; hover deepens the tint to 14% and the border to full cyan.
- **Ghost:** transparent with a 45% slate border and ice-white text; hover brightens the border.
- **States:** fills lighten on hover; press nudges 1px down; disabled drops to 45% opacity; focus takes the cyan outline plus focus ring.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Night Violet surface.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px cyan hairline.
- **Internal Padding:** 16px 20px 20px; step heading in Geist at 20px on top. Disclosure panels use a 48px summary row with a drawn cyan chevron that rotates open.

### Inputs / Fields
- **Style:** 35% black fill, 1px hairline, 9px corners, 44px minimum, 10px 12px padding, 15px text. Passwords are set in monospace.
- **Hover:** border strengthens to the 42% hairline.
- **Focus:** 2px cyan outline at 2px offset plus the 3px cyan focus ring.
- **Checks and ranges:** native controls tinted cyan; checkboxes 20px inside a 44px row.

### Navigation
- **Step bar:** pill chips with a 24px circular monospace number badge. Resting chips are muted on a hairline; the active chip turns ice white with a full cyan border, a soft cyan glow and a cyan badge; completed chips take a green badge and become clickable, with a green border on hover. Drawn chevrons separate steps.
- **Wordmark:** a button that returns home.

### Data Surfaces
- **Output:** 40% black fill, hairline, 9px corners, 13px monospace, scrolls past 240px; copy buttons sit right-aligned in its header row.
- **Revealed message:** borderless monospace at rest; on reveal it takes a magenta border and plays one magenta bloom into the data glow; on failure it takes a rose border and rose text.
- **Notices:** amber warning block (amber text, 40% amber border, 6% amber fill). Toasts sit bottom right on the raised surface with a role-colored border.

### Hero Viewer (signature)
A 4:3 canvas on true black with pixelated scaling, under a three-way pill switch (Image / LSB plane / Changes). The active segment takes the raised surface and a strong hairline inset; the Changes segment turns magenta. Switching views runs a 420ms cubic ease-out wipe led by a 3px cyan scan line; under reduced motion the new view replaces the old instantly. The Changes view greys the image and plots changed pixels as magenta dots, with a monospace label marking the salt region.

## Do's and Don'ts

### Do:
- **Do** give every neon color one meaning: cyan interface, magenta hidden data, green success, amber warnings, rose errors.
- **Do** keep panels flat on the Night Violet surface with a 1px cyan hairline and 12px corners.
- **Do** reserve glow for the wordmark, revealed data, focus, the active step and user ASCII art.
- **Do** set the wordmark, hero H1 and step headings in Geist Bold, prose and controls in system sans, and all data in monospace.
- **Do** make every target at least 44px tall and pair every focus state with the 2px cyan outline and 3px ring.
- **Do** draw directional marks as rotated bordered squares in CSS.
- **Do** make every animation instant or absent under prefers-reduced-motion.

### Don't:
- **Don't** glow panels, buttons or fields at rest or on hover.
- **Don't** use magenta for interface chrome, or green, amber or rose outside their states.
- **Don't** nest a card inside a panel.
- **Don't** use type glyphs or emoji as icons; inline SVG is reserved for real logos.
- **Don't** set Geist on prose, labels or controls, or load additional Geist weights without a decision.
