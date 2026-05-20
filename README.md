# AudioGrab

Paste a video URL (YouTube, Vimeo, direct link) or upload a video file — get a downloadable MP3.

AudioGrab is a single Next.js app that extracts audio with [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) (for URLs) and [`ffmpeg`](https://ffmpeg.org/) (for uploads). No accounts, no database — files are processed in a temp directory and cleaned up after each request.

## Features

- **Two inputs:** paste a URL or drag-and-drop a video file.
- **Bitrate selector:** 128 / 192 / 320 kbps.
- **Optional trim:** pick start/end timestamps (planned).
- **Auto-named output** from the video title.

## Stack

- Next.js (App Router) + Tailwind CSS — deploys to Vercel.
- `POST /api/extract` API route — runs on Railway / Render / Fly (ffmpeg jobs exceed Vercel serverless limits).
- `yt-dlp` + `ffmpeg` as system binaries.

## Documentation

| Doc | What's inside |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Repo guide, doc-update rule, orchestration strategy |
| [ROADMAP.md](ROADMAP.md) | Build plan, future touches, known constraints |
| [Architecture.md](Architecture.md) | System design, data flow, deploy topology |
| [API.md](API.md) | `POST /api/extract` reference |
| [ERROR.md](ERROR.md) | Error / failure catalog |
| [SETUP.md](SETUP.md) | Local dev + deployment |
| [SECURITY.md](SECURITY.md) | Security considerations |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

## Quick start

See [SETUP.md](SETUP.md) for prerequisites (`yt-dlp`, `ffmpeg`), local dev, and deployment.

> **Heads-up:** YouTube downloads are often blocked on cloud hosts (bot detection / IP bans). Use file upload or Vimeo / direct `.mp4` links for reliable demos. Details in [ROADMAP.md](ROADMAP.md#heads-up--known-constraints).

## License

See [LICENSE](LICENSE).
