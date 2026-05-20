# AudioGrab — Error Catalog

This document maps every known failure mode to its root cause, the user-facing message surfaced in the UI, and the server-side handling strategy.

---

## Error Table

> **Canonical error codes.** The `code` values below are the single source of truth, shared with [API.md](API.md) and the `api`/`backend`/`extraction` skills. Do not invent new codes without updating all four.

| # | Failure Mode | Root Cause | `code` (HTTP) | User-Facing Message | Handling |
|---|---|---|---|---|---|
| 1 | **No input provided** | Neither `url` nor `file` was sent | `MISSING_INPUT` (400) | "Paste a URL or choose a file first." | Validated at the route boundary before any processing |
| 2 | **Ambiguous input** | Both `url` and `file` were sent | `AMBIGUOUS_INPUT` (400) | "Provide either a URL or a file, not both." | Validated at the route boundary |
| 3 | **Invalid / unparseable URL** | Input fails `URL` constructor or uses a non-HTTP scheme | `INVALID_URL` (400) | "That doesn't look like a valid URL. Please enter an `http://` or `https://` link." | Rejected server-side before spawning any process |
| 4 | **Unsupported request type** | Request body is not JSON or multipart form data | `INVALID_REQUEST` (400) | "Use application/json or multipart/form-data." | Validated from the request `Content-Type` header |
| 5 | **File too large (> 200 MB)** | Uploaded file exceeds the enforced 200 MB cap | `FILE_TOO_LARGE` (413) | "File is too large. The maximum size is 200 MB." | Checked against `file.size` before writing to disk |
| 6 | **Unsupported URL (site not recognized by yt-dlp)** | `yt-dlp` exits with *"Unsupported URL"* / "no video formats" in stderr | `UNSUPPORTED_URL` (422) | "This URL isn't supported. Try Vimeo, a direct video link (.mp4), or upload the file instead." | Detect the pattern in `yt-dlp` stderr |
| 7 | **YouTube bot-block / IP ban (cloud host)** | Cloud host IP flagged; `yt-dlp` returns HTTP 429 or a sign-in wall | `BOT_BLOCKED` (422) | "YouTube blocked this server from downloading the video. Try uploading the file directly, or paste a Vimeo or direct `.mp4` link." | Detect `429`, `sign in`, or `bot detected` errors in stderr |
| 8 | **Unsupported file format / decode failure** | `ffmpeg` cannot identify a video/audio stream, or a conversion process exits non-zero | `CONVERSION_FAILED` (422) | "Audio extraction failed. The file may be corrupted, in an unsupported format, or the video may be unavailable." | Fallback classification for non-zero yt-dlp/ffmpeg exits |
| 9 | **Missing yt-dlp / ffmpeg binary** | Binary not found in `$PATH` (`ENOENT` from `child_process`) | `INTERNAL_ERROR` (500) | "Something went wrong on the server. Please try again later." | Detect `ENOENT` on spawn; return a generic server error |
| 10 | **Unexpected server error** | Any unhandled exception (fs failure, malformed JSON, etc.) | `INTERNAL_ERROR` (500) | "Something went wrong on the server. Please try again later." | Catch-all in the route handler; log the full stack server-side |
| 11 | **Temp-file cleanup failure** | `fs.rm` throws after extraction (permissions, file already gone) | _none — silent_ | No user-facing message | Best-effort cleanup in a `finally` block |

---

## HTTP Status Code Reference

| Code | Constant | Meaning |
|---|---|---|
| `400` | `MISSING_INPUT` | Neither `url` nor `file` provided |
| `400` | `AMBIGUOUS_INPUT` | Both `url` and `file` provided |
| `400` | `INVALID_URL` | Malformed or non-HTTP URL |
| `400` | `INVALID_REQUEST` | Unsupported request content type |
| `413` | `FILE_TOO_LARGE` | Upload exceeds 200 MB cap |
| `422` | `UNSUPPORTED_URL` | URL is valid HTTP but yt-dlp does not support the site |
| `422` | `BOT_BLOCKED` | Source site (e.g. YouTube) blocked the server's request |
| `422` | `CONVERSION_FAILED` | yt-dlp/ffmpeg failed to produce an MP3 (bad format, corrupt, unavailable) |
| `500` | `INTERNAL_ERROR` | Missing binary or any unexpected server error |

---

## Error Response Shape

All errors from `POST /api/extract` return JSON in this shape:

```json
{
  "error": "Human-readable message shown in the UI.",
  "code": "CANONICAL_CONSTANT"
}
```

The frontend reads `error` to display to the user and may switch on `code` for code-specific handling.

---

## Handling Philosophy

- **Fail fast on the route boundary** — validate presence of `url`/`file`, file size, and content type before doing any disk or subprocess work.
- **Classify stderr before giving up** — scan `yt-dlp` and `ffmpeg` stderr for known patterns like bot blocks and unsupported URLs before falling through to the generic conversion error.
- **Always clean up** — temp files are removed in a `finally` block regardless of success or failure.
- **Return one stable error shape** — every failure path returns `{ error, code }` JSON so the frontend can handle it consistently.
