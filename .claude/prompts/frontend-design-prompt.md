# Design Prompt — AudioGrab Frontend

> Hand this to a design-capable Claude (Claude.ai artifact or a frontend design agent). It is self-contained: it specifies the product, the exact aesthetic, the page anatomy, every UI state, and the API contract the UI must speak to. Produce a single, polished, animated dark landing page.

---

## 1. The Brief

Design and build the **complete single-page frontend** for **AudioGrab** — a web app where a user pastes a video URL (YouTube, Vimeo, direct link) **or** uploads a video file and gets back a downloadable MP3.

It's one page. No routing, no marketing sections, no multi-screen flow. Everything happens in one extractor surface that moves through four states: **idle → loading → success → error**. Make all four states feel intentional and beautiful.

**Tech target:** React + Next.js (App Router, TypeScript). Deliver as a working artifact first if prototyping; the production port keeps the CSS verbatim (see §8). Use CSS variables + CSS Modules / styled-components — **do NOT translate the gradients to Tailwind utilities** (they can't express the conic/iridescent gradients cleanly).

---

## 2. Aesthetic — "AlesSystems": developer tool meets art object

Dark, terminal-inspired, iridescent. Restrained but rich. Every detail intentional. Ask yourself: *would a senior product engineer who reads Hacker News find this tasteful?*

### Design tokens — define at `:root`, do not invent new values
```css
:root {
  /* Base surfaces — navy, NEVER pure black */
  --bg: #0A0E27; --bg-2: #0d1230; --surface: #1A1B3A; --surface-2: #232450; --line: #2a2c5a;
  /* Text */
  --text: #E8EAF6; --muted: #9aa0d4; --dim: #6e75a8;
  /* Accents — magenta is THE accent */
  --blue:#3B82F6; --violet:#8B5CF6; --teal:#14B8A6; --magenta:#EC4899;
  --green:#10B981; --amber:#F59E0B; --red:#EF4444;
  /* Signature gradients */
  --grad: linear-gradient(120deg,#3B82F6 0%,#8B5CF6 50%,#14B8A6 100%);
  --grad-soft: linear-gradient(120deg,rgba(59,130,246,.18),rgba(139,92,246,.18),rgba(20,184,166,.18));
  --grad-iri: linear-gradient(120deg,#3B82F6,#8B5CF6,#EC4899,#14B8A6,#3B82F6);
}
```

### Typography — three families, used with intent
- **Space Grotesk** (600–700): the `AudioGrab` wordmark + any display headline. Tight tracking `-0.03em`, line-height `~0.95`. Render one word with iridescent gradient text (`background:var(--grad-iri); -webkit-background-clip:text; color:transparent`).
- **JetBrains Mono** (400–500): ALL labels, nav, captions, chips, tab labels, button text, the bitrate selector, status lines, error codes. Use `~/path-style` and shell-style flourishes.
- **Inter** (400–500): the one-line body/pitch text only.
- Load all three via Google Fonts. Never substitute system fonts.

### Atmosphere
- Body background = layered radial gradients (violet top-right, blue mid-left, teal bottom-right) over `--bg`, plus a subtle SVG fractal-noise grain overlay at `opacity:.35; mix-blend-mode:overlay`.
- `::selection { background: rgba(236,72,153,.4); color:#fff; }`
- **Custom cursor:** small magenta dot + a larger ring that lags slightly and grows when hovering interactive elements. Disable on touch/mobile.

### Hard anti-patterns — DO NOT
- ❌ Pure black background. ❌ Default Tailwind look (rounded-lg gray cards, blue-500 solid buttons). ❌ Inter for headlines. ❌ Emoji or playful illustrations. ❌ Multiple bright accents stacked in one element (one accent per element). ❌ Box-shadows as the primary depth cue — use borders + gradients. ❌ Animating everything — one or two signature animations per area.

---

## 3. Page Anatomy

A vertically centered, single-column composition, `min-height:100vh`, `max-width` ~720px for the core card, page wrap padded `0 32px`.

1. **Fixed top nav (glass):** blurred (`backdrop-filter: blur(14px) saturate(160%)`), transparent. Left: `~/audiograb` wordmark in mono with a blinking magenta caret `▍`. Right: a status chip — `● online` with a pulsing green dot — and a small mono link `~/github`.

2. **Hero line (above the card):** the `AudioGrab` wordmark in Space Grotesk with one word in iridescent gradient text, and a one-line Inter pitch beneath: *"Paste a link or drop a video — get an MP3."* Optionally a small iridescent waveform/equalizer motif (animated bars) as the only decorative graphic — keep it subtle, max ~120px tall.

3. **The Extractor — a terminal block** (the centerpiece, see §4).

4. **Footer:** one mono line, `--dim`: `$ built with yt-dlp + ffmpeg · no tracking · files deleted after download`.

---

## 4. The Extractor (terminal block)

Style the extractor as a **terminal window**:
- Three macOS lights (red/yellow/green) top-left, a mono tab title `audiograb — extract`, and an **animated iridescent border** (the `mask-composite` gradient-border trick) that slowly cycles (8–10s).
- Inside, a shell-style prompt feel. The primary CTA reads like a command: `$ ./extract-audio`.

### Controls inside the block
- **Tabbed input** — two mono tabs: `paste url` | `upload file`. Active tab marked with `border-b-2` in magenta + the blinking caret. Switching tabs swaps the input region.
  - **paste url tab:** a single `<input type="url">` styled as a terminal line with a leading magenta `>` prompt and placeholder `https://vimeo.com/…`.
  - **upload file tab:** a **drag-and-drop dropzone** (accepts `video/*`). Dashed `--line` border that lights up iridescent on drag-over (`border-color` shifts to magenta/violet, faint `--grad-soft` fill). Shows the chosen filename + size as a mono chip once selected. Enforce the 200 MB cap client-side (reject with an inline error before submit).
- **Bitrate selector** — a mono segmented control: `128` `192` `320` kbps. Default `192`. Active segment gets a tinted magenta background + border. (Not a default `<select>` — build the segmented pill.)
- **Advanced disclosure (optional trim)** — a collapsible `▸ advanced` mono toggle revealing two small `<input type="number">` fields: `trim start (s)` and `trim end (s)`.
- **Primary CTA** — full-width, mono, `$ ./extract-audio`. Border + tinted background (NOT a solid fill button). Disabled until valid input is present.

---

## 5. The Four States — design each deliberately

| State | What the extractor shows |
|---|---|
| **idle** | Tabs + input + bitrate + CTA, all enabled. Calm. The iridescent border idles its slow cycle. |
| **loading** | CTA replaced by a terminal-style progress line — animated mono dots / a faux log stream (e.g. `> fetching… > extracting audio… > encoding mp3 (192k)…`) with a blinking caret. Controls disabled/dimmed. The iridescent border speeds up subtly to signal activity. |
| **success** | A "download ready" panel: the auto-named filename as a mono chip, file size, and a prominent **Download MP3** action (green `--green` accent — the one place green leads). A small `↺ extract another` mono link resets to idle. |
| **error** | An inline terminal error line: red `--red` prompt with the **error code in mono** (e.g. `✗ BOT_BLOCKED`) and the human message beneath in `--muted`. A `↺ try again` reset link. Never a browser alert. |

Map every API error `code` (see §7) to a friendly message. For `BOT_BLOCKED`, the message must nudge the user toward upload or a Vimeo/direct link.

---

## 6. Motion (rich, but disciplined)

Signature animations (respect `prefers-reduced-motion` — disable all under it):
- **Iridescent border/text cycle:** 8–10s linear infinite, animating `background-position`.
- **Cursor caret blink:** 1s step-end infinite.
- **Status dot pulse:** 2s, opacity 0.5→1.
- **Reveal on load:** the card and hero fade + `translateY(24px)→0`, 0.8s `cubic-bezier(.2,.7,.2,1)`.
- **Drag-over:** dropzone border + fill transition ~200ms.
- **State transitions:** cross-fade between idle/loading/success/error (don't jump-cut).
- **Loading log stream:** typed/streamed mono lines.
- Optional tasteful WebGL/canvas: a small iridescent waveform or particle motif in the hero (max ~120px tall, framed). Keep it small and optional — never block first paint.

---

## 7. API Contract the UI must speak to

The page calls **one endpoint** — no polling, no WebSockets. One request, one response.

**Request:** `POST /api/extract`, `multipart/form-data`:
- `url` (string) **XOR** `file` (binary) — exactly one.
- `bitrate`: `'128' | '192' | '320'` (default `'192'`).
- `trimStart`, `trimEnd`: optional, seconds.
- Do **not** set `Content-Type` manually — let the browser set the multipart boundary.

**Success:** `200`, body is the MP3 binary, headers:
`Content-Type: audio/mpeg`, `Content-Disposition: attachment; filename="<title>.mp3"`.
Create an object URL from the blob, parse the filename from `Content-Disposition`, render the Download action, and **revoke the object URL** on reset/unmount.

**Error:** non-2xx, JSON `{ "error": { "code", "message" } }`. Canonical codes the UI should map:
`MISSING_INPUT`, `AMBIGUOUS_INPUT`, `INVALID_URL`, `INVALID_BITRATE`, `INVALID_TRIM`, `FILE_TOO_LARGE`, `UNSUPPORTED_URL`, `BOT_BLOCKED`, `CONVERSION_FAILED`, `TIMEOUT`, `INTERNAL_ERROR`.

Reference fetch shape:
```ts
const fd = new FormData();
tab === 'url' ? fd.append('url', urlInput) : fd.append('file', file);
fd.append('bitrate', bitrate);
if (trimStart) fd.append('trimStart', String(trimStart));
if (trimEnd)   fd.append('trimEnd',   String(trimEnd));
const res = await fetch('/api/extract', { method: 'POST', body: fd });
if (!res.ok) { const { error } = await res.json(); showError(error.code, error.message); return; }
const blob = await res.blob();
const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'audio.mp3';
```

---

## 8. Deliverable & constraints

- **Dark theme only.** No light mode, no toggle.
- One self-contained page. Mobile-responsive (card goes full-width with comfortable padding; custom cursor + heavy WebGL disabled on mobile).
- Accessible: real form controls / ARIA where custom widgets are used, visible focus states (iridescent ring), keyboard-operable tabs and segmented control, `prefers-reduced-motion` honored.
- Performance: fonts preconnected, no layout shift, decorative WebGL must not block first paint.
- **Preserve the `:root` tokens and `@keyframes` verbatim** when porting from artifact → Next.js; move any `<script>` logic (custom cursor, IntersectionObserver reveals, loading log stream, optional WebGL) into `useEffect`/components. The #1 thing that breaks in ports is the iridescent gradient animation — verify it still cycles.

Output: the full page markup + CSS (+ JS/React for interactions and the four-state machine). Make it feel like a crafted artifact, not a form.
