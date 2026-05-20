# AudioGrab — 2-Hour Build Roadmap

A focused sprint plan for taking AudioGrab from zero to a deployed, demo-ready web app.

---

## Phase 1 — Setup & Split Work (0:00–0:15)

**Goal:** Both teammates unblocked and working in parallel within 15 minutes.

- Bootstrap Next.js app with Tailwind CSS (`npx create-next-app@latest audiograb --tailwind --app`)
- Push repo to GitHub
- Deploy hello-world to Vercel immediately (gives you a live URL to share early)
- Decide the split: **Person A → Frontend**, **Person B → Backend**
- Confirm environment: `yt-dlp` and `ffmpeg` installed locally for development

---

## Phase 2 — Core Build in Parallel (0:15–1:00)

### Frontend (Person A) — ✅ DONE

The single landing page is built (the "AlesSystems" dark/iridescent terminal design):

- ✅ **Hero:** iridescent `AudioGrab` wordmark + animated equalizer + one-line pitch
- ✅ **Tabs:** `paste url` | `upload file` toggling between two input modes
- ✅ **URL tab:** terminal-style `<input type="url">` for YouTube, Vimeo, or direct links
- ✅ **Upload tab:** drag-and-drop dropzone (`video/*`) with browse fallback + 200 MB client cap
- ✅ **Bitrate** segmented control (128/192/320) and collapsible **trim** advanced disclosure
- ✅ **CTA:** `$ ./extract-audio`, disabled until input is valid
- ✅ **States** (`idle → loading → success → error`): cross-faded panels, faux log stream on
  loading, green Download MP3 on success, mapped error codes on error
- ✅ Wired to `POST /api/extract` (`lib/extract.ts`) with a mock fallback so the page works
  standalone until the backend route lands

### Backend (Person B)

Wire up `POST /api/extract`:

- Accept either a JSON body `{ url: string, bitrate?: number }` or `multipart/form-data` with a `file` field
- **URL path:** Shell out to `yt-dlp --extract-audio --audio-format mp3 <url>` into a temp directory
- **File path:** Shell out to `ffmpeg -i <input> -vn -q:a 0 <output>.mp3` on the uploaded temp file
- Stream the resulting `.mp3` back in the response with `Content-Disposition: attachment`
- Return structured JSON errors (`{ error: string, code: string }`) for all failure modes

---

## Phase 3 — Wire Together + Messy Stuff (1:00–1:30)

- Connect frontend `fetch` call to `POST /api/extract`; trigger browser download on success
- Enforce **200 MB file size cap** on the server (`Content-Length` check + `multer` or similar)
- **Temp file cleanup:** Wrap extraction in a `try/finally` block — always `fs.unlink` temp files regardless of success or failure
- Plumb error codes from the API into the frontend error state with human-readable messages
- Smoke-test the two paths end-to-end: Vimeo URL + a local `.mp4` upload

---

## Phase 4 — Polish (1:30–1:50)

- **Bitrate selector:** 128 / 192 / 320 kbps radio buttons (default 192); wire value into the API call
- **Auto-naming:** Use the video title returned by `yt-dlp --print title` (or filename for uploads) to set `Content-Disposition: attachment; filename="<title>.mp3"`
- **Favicon:** Quick logo or text-based SVG favicon
- **OG image:** Static 1200×630 image for social sharing (`/public/og.png`)
- **README:** Add screenshot, demo GIF, and one-command local-run instructions

---

## Phase 5 — Deploy & Demo (1:50–2:00)

- Deploy the full Next.js app to **Railway** (or Render / Fly.io) where `yt-dlp` and `ffmpeg` can run as system binaries without serverless time limits
- Set environment variables on the host (`NODE_ENV=production`, any needed paths)
- Test three inputs on the live URL:
  1. A Vimeo URL
  2. A locally uploaded `.mp4` file
  3. A podcast video (direct `.mp4` or `.webm` link)
- Record a quick demo GIF; paste the live URL into the README

---

## Portfolio-Grade Touches (Future)

| Feature | Notes |
|---|---|
| Trim before extracting | Start/end timestamp inputs; pass `-ss` and `-to` flags to `ffmpeg` or `--download-sections` to `yt-dlp` |
| Format selector | Offer WAV, AAC, or OGG in addition to MP3 |
| Progress indicator | Stream `yt-dlp` stderr to the client via SSE for real-time progress |
| Paste-from-clipboard button | One-click URL paste using the Clipboard API |
| Dark mode | Tailwind `dark:` classes + `next-themes` |
| Rate limiting | Simple in-memory or Redis-backed limiter per IP |
| Signed download URLs | Upload to S3/Supabase Storage; return a short-lived URL instead of streaming directly |

---

## Heads-Up / Known Constraints

### YouTube Cloud Blocking

Running `yt-dlp` against YouTube on cloud hosts (Railway, Render, Fly, etc.) frequently fails due to **IP bans and bot-detection** (HTTP 429, sign-in prompts, `nsig` extraction errors). This is a known, ongoing cat-and-mouse problem with no guaranteed fix.

**Mitigation strategy for the demo:**

- Keep the "Upload File" tab as the primary, always-reliable path
- Prepare a list of safe demo URLs that reliably work on cloud hosts:
  - Vimeo public videos
  - Direct `.mp4` or `.webm` links (e.g. `sample-videos.com`, archive.org files)
  - Internet Archive video files
- Surface a friendly message when YouTube is blocked: *"YouTube links may not work on this server due to bot detection. Try uploading the file directly or use a Vimeo/direct link."*
- Locally, YouTube downloads work fine — note this in the README for reviewers running the project themselves

### Other Constraints

| Constraint | Value |
|---|---|
| Max file size | 200 MB (enforced server-side) |
| Max video length | ~30–60 min practical limit (serverless timeout equivalent) |
| Supported URL sources | ~1000 sites via `yt-dlp`; YouTube reliability varies on cloud |
| Supported upload formats | Any format `ffmpeg` can decode (`mp4`, `webm`, `mov`, `mkv`, `avi`, etc.) |
| Output format | MP3 only (for now) |
