---
name: frontend
description: Use this skill when building or modifying the AudioGrab Next.js frontend — landing page layout, tabbed URL/file input, state machine, bitrate selector, and calling the extract API.
---

## Stack

- **Next.js App Router** (TypeScript). UI lives under `web/src/app/` (pages) and `web/src/components/`.
- **Styling = plain CSS + CSS variables** in `web/src/app/globals.css`. **Not** Tailwind utilities.
  The "AlesSystems" aesthetic relies on conic/iridescent gradients and a `mask-composite`
  gradient border that Tailwind utilities can't express cleanly. Tailwind is not used here.
- **Fonts** via `next/font/google` in `app/layout.tsx`, exposed as CSS variables:
  Space Grotesk (`--font-space-grotesk` → `--display`), JetBrains Mono
  (`--font-jetbrains-mono` → `--mono`), Inter (`--font-inter` → `--body`).
- Functional components only. Local state with `useState`; no global store.

## Aesthetic — "AlesSystems"

Dark navy (never pure black), terminal-inspired, iridescent. All design tokens are defined
once at `:root` in `globals.css` — **never invent new colors/gradients**, reuse the vars:

- Surfaces `--bg #0A0E27`, `--surface`, `--line`. Text `--text`/`--muted`/`--dim`.
- Accents `--blue --violet --teal --magenta(#EC4899, THE accent) --green --amber --red`.
- Gradients `--grad`, `--grad-soft`, `--grad-iri` (the iridescent one).
- `--mono` for ALL labels/nav/buttons/status/codes; `--display` for the wordmark; `--body` for the pitch line.
- Keep all `@keyframes` (`iri`, `blink`, `pulse`, `reveal`, `eq`, `barslide`, `shake`, etc.) verbatim.
  `prefers-reduced-motion` disables them; a `max-width:640px` block makes it responsive.

## Component map (`web/src/`)

| File | Role |
|---|---|
| `app/layout.tsx` | Loads the 3 Google fonts, applies their CSS-var classes to `<html>`, sets metadata. |
| `app/page.tsx` | Assembles `Overlays` + `CustomCursor` + `Nav` + `.shell`(`Hero` + `Extractor`) + `Footer`. |
| `app/globals.css` | All design CSS — `:root` tokens, every component class, keyframes. |
| `components/Nav.tsx` | Glass fixed nav: `~/audiograb ▍`, `● online` chip, `~/github`. |
| `components/Hero.tsx` | `Audio` + iridescent `Grab` wordmark, 20-bar equalizer, Inter pitch. |
| `components/Footer.tsx` | One mono line. |
| `components/Overlays.tsx` | Grain SVG + scanlines. |
| `components/CustomCursor.tsx` | `'use client'` — magenta dot + lagging ring; off on touch/mobile/reduced-motion. |
| `components/Extractor.tsx` | `'use client'` — the terminal card + 4-state machine (below). |
| `lib/errors.ts` | `ERROR_MESSAGES` (all 11 codes) + helpers `fmtBytes`/`isValidUrl`/`slugFromUrl`/`stripExt`/`TS`. |
| `lib/extract.ts` | `extract()` — real `POST /api/extract` with mock fallback. |

## The Extractor (terminal card)

Styled as a terminal window: macOS lights, mono title `$ audiograb — extract`, a status pill
(`ready`/`running`/`done`/`error`), and the animated iridescent border (`.card::before`,
`mask-composite` trick; speeds up via `.card.busy` during loading).

- **Tabbed input** — mono tabs `paste url` | `upload file`; active tab gets a magenta underline
  + blinking caret (`role="tab"`, `aria-selected`).
  - URL tab: `<input type="url">` with a leading magenta `>` prompt, placeholder `https://vimeo.com/…`.
  - File tab: drag-drop dropzone (`video/*`), lights iridescent on drag-over, shows a filename chip,
    enforces the 200 MB cap client-side before submit.
- **Bitrate** — mono segmented control `128`/`192`/`320` (default `192`), `role="radiogroup"`.
- **Advanced · trim** — collapsible disclosure with two `<input type="number">` (start/end seconds).
- **CTA** — full-width mono `$ ./extract-audio`, bordered/tinted (not a solid fill), disabled until valid input.

## State Machine

`Extractor` holds `phase: 'idle' | 'loading' | 'success' | 'error'` (plus `errorCode`, `result`)
in `useState`. Panels cross-fade (`.fadeswap`):

| Phase | Shows |
|-------|-------|
| `idle` | tabs + input + bitrate + trim + CTA |
| `loading` | timestamped faux log stream (`LoadingPanel`, visual only) + cancel link |
| `success` | `SuccessPanel` — filename chip, size, green **Download MP3**, `↺ extract another` |
| `error` | `ErrorPanel` — red `✗ CODE` + friendly message from `ERROR_MESSAGES` + `↺ try again` |

Map every API error `code` to a message (`lib/errors.ts`). `BOT_BLOCKED` nudges toward Vimeo/upload.

## Calling POST /api/extract (`lib/extract.ts`)

`multipart/form-data` (never set `Content-Type` — let the browser set the boundary):

```ts
const fd = new FormData();
tab === 'url' ? fd.append('url', url) : fd.append('file', file);
fd.append('bitrate', bitrate);              // '128' | '192' | '320'
if (trimStart) fd.append('trimStart', trimStart);
if (trimEnd)   fd.append('trimEnd',   trimEnd);
const res = await fetch('/api/extract', { method: 'POST', body: fd, signal });
// ok → blob + filename from Content-Disposition; non-ok → { error: { code } }
```

**Mock fallback:** if the fetch throws (no backend) or returns 404 with a non-JSON body, `extract()`
falls back to a client-side mock (4 s timer, URL-keyword forced errors, fake MP3 blob) so the page
works standalone until the backend route exists. A real backend's `{error:{code}}` envelope is always honored.

## Do / Don't

- **Do** keep all real extraction server-side; the frontend only submits + downloads.
- **Do** revoke object URLs on reset/unmount.
- **Do** reuse the `:root` tokens and existing `@keyframes` — verify the iridescent border still cycles after any change.
- **Don't** use Tailwind utilities, add a light mode, poll, or use WebSockets — one synchronous request is enough.
