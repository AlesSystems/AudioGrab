# CLAUDE.md

Guidance for Claude Code (and humans) working in the **AudioGrab** repository.

---

## ⚠️ Documentation Update Rule

**📝 Documentation MUST be updated after each implementation to keep repo information up to date.**

Every code change ships with its doc change in the **same PR** — never defer to a follow-up. Use this checklist:

| Change type | Update |
|---|---|
| New/changed API field, endpoint, request/response shape, or error code | [API.md](API.md), [ERROR.md](ERROR.md), `.claude/skills/api/SKILL.md` |
| New error/failure mode | [ERROR.md](ERROR.md) (canonical catalog) + [API.md](API.md) |
| New prerequisite, env var, install step, or deploy change | [SETUP.md](SETUP.md) |
| New architecture decision, data flow, or major dependency | [Architecture.md](Architecture.md) + this file |
| Security control or threat-model change | [SECURITY.md](SECURITY.md) |
| Roadmap progress or new planned feature | [ROADMAP.md](ROADMAP.md) |
| Frontend / backend / extraction convention change | the matching skill in `.claude/skills/` |

Error codes are canonical and shared across [ERROR.md](ERROR.md), [API.md](API.md), and the skills — keep all in sync.

---

## What AudioGrab Is

A web app where a user pastes a video URL (YouTube, Vimeo, direct link) **or** uploads a video file, and gets back a downloadable MP3.

## Stack

- **Frontend:** Next.js (App Router, TypeScript). Styling is **plain CSS + CSS variables** in `globals.css` (the "AlesSystems" dark/iridescent design system — *not* Tailwind utilities, which can't express the iridescent/`mask-composite` gradients). Three Google fonts (Space Grotesk, JetBrains Mono, Inter) via `next/font/google`.
- **Backend:** Next.js API route — `POST /api/extract`.
- **Core tools:** `yt-dlp` (URL downloads, ~1000 sites) + `ffmpeg` (audio extraction/conversion), invoked as child processes via argv arrays (never a shell).
- **Storage:** Ephemeral only — temp files created per request, cleaned up in a `finally` block. **No database.**
- **Deploy:** Frontend on Vercel; the extraction app on **Railway / Render / Fly** (Vercel serverless time/size limits can't run ffmpeg). See [Architecture.md](Architecture.md#why-not-vercel-serverless-for-the-backend).

## Key Constraints

- Max upload: **200 MB**. Bitrate options: **128 / 192 / 320 kbps** (default 192). Optional trim (start/end).
- **YouTube on cloud hosts is frequently blocked** (bot detection / IP bans). Fallback: file upload + reliable sample URLs (Vimeo, direct `.mp4`). See [ROADMAP.md](ROADMAP.md#heads-up--known-constraints).

## Documentation Map

| Doc | Purpose |
|---|---|
| [ROADMAP.md](ROADMAP.md) | 2-hour build plan, future touches, known constraints |
| [Architecture.md](Architecture.md) | System design, data flow, deploy topology |
| [API.md](API.md) | `POST /api/extract` contract |
| [ERROR.md](ERROR.md) | Canonical error/failure catalog |
| [SETUP.md](SETUP.md) | Local dev + deployment (incl. Dockerfile) |
| [SECURITY.md](SECURITY.md) | Size caps, SSRF, command-injection, temp-file hygiene |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branch/commit/PR conventions |

## Claude Skills (`.claude/skills/`)

Read the relevant skill before implementing in that area:

- **frontend** — Next.js + Tailwind UI, tabbed input, dropzone, state machine, bitrate selector, calling the API.
- **backend** — API route runtime, multipart parsing, temp-file lifecycle + cleanup, MP3 streaming, size/timeout enforcement.
- **api** — `POST /api/extract` contract and conventions for extending endpoints.
- **extraction** — yt-dlp/ffmpeg invocation, bitrate/trim flags, URL-vs-file branching, security-critical subprocess rules.

---

## Agentic Orchestration Strategy

Work on this repo is organized around a model hierarchy. Match the model to the task:

| Model | Role | Use for |
|---|---|---|
| **Opus 4.7** | Orchestrator / planner | Breaking down work, designing approach, reviewing subagent output, cross-file consistency, git/PR. Delegates implementation rather than writing everything itself. |
| **Sonnet 4.6** | Implementation | Writing and editing feature code, building components, drafting docs — the bulk of hands-on work. |
| **Haiku** | Research / small tasks | Quick lookups (flag syntax, API shapes), file-location searches, mechanical edits, short analyses. |

**How to apply:**
- The orchestrator (Opus) plans, then spawns Sonnet subagents for independent implementation chunks **in parallel** where possible.
- Use Haiku subagents for fast research/verification that would otherwise bloat the orchestrator's context.
- **Trust but verify:** the orchestrator reads each subagent's actual output before committing — a subagent's summary describes intent, not necessarily what landed.
