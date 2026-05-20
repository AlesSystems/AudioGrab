# AudioGrab — Error Catalog

This document maps every known failure mode to its root cause, the user-facing message surfaced in the UI, and the server-side handling strategy.

---

## Error Table

> **Canonical error codes.** The `code` values below are the single source of truth, shared with [API.md](API.md) and the `api`/`backend`/`extraction` skills. Do not invent new codes without updating all four.

| # | Failure Mode | Root Cause | `code` (HTTP) | User-Facing Message | Handling |
|---|---|---|---|---|---|
| 1 | **No input provided** | Neither `url` nor `file` was sent | `MISSING_INPUT` (400) | "Paste a URL or choose a file first." | Validated at the route boundary before any processing |
| 2 | **Ambiguous input** | Both `url` and `file` were sent | `AMBIGUOUS_INPUT` (400) | "Provide either a URL or a file, not both." | Validated at the route boundary |
| 3 | **Invalid / unparseable URL** | Input fails `URL` constructor, uses a non-HTTP scheme, or points to a private/internal address | `INVALID_URL` (400) | "That doesn't look like a valid URL. Please enter an `http://` or `https://` link." | Validated client-side first; also rejected server-side before spawning any process (see [SECURITY.md](SECURITY.md) for SSRF rules) |
| 4 | **Invalid bitrate** | `bitrate` not in `128/192/320` | `INVALID_BITRATE` (400) | "Choose a bitrate of 128, 192, or 320 kbps." | Enum-checked at the route boundary |
| 5 | **Invalid trim range** | `trimStart`/`trimEnd` malformed or `trimStart >= trimEnd` | `INVALID_TRIM` (400) | "Check your trim times — start must be before end." | Validated at the route boundary before passing to ffmpeg |
| 6 | **File too large (> 200 MB)** | Uploaded file exceeds the enforced 200 MB cap | `FILE_TOO_LARGE` (413) | "File is too large. The maximum size is 200 MB." | Checked against `file.size`/`Content-Length` before writing to disk |
| 7 | **Unsupported URL (site not recognized by yt-dlp)** | `yt-dlp` exits with *"Unsupported URL"* / "no video formats" in stderr | `UNSUPPORTED_URL` (422) | "This URL isn't supported. Try Vimeo, a direct video link (.mp4), or upload the file instead." | Detect the pattern in `yt-dlp` stderr |
| 8 | **YouTube bot-block / IP ban (cloud host)** | Cloud host IP flagged; `yt-dlp` returns HTTP 429, a sign-in wall, or `nsig` extraction failure | `BOT_BLOCKED` (422) | "YouTube blocked this server from downloading the video. Try uploading the file directly, or paste a Vimeo or direct `.mp4` link." | Detect `429`, `sign in`, `bot detected`, or `nsig`/`player` errors in stderr |
| 9 | **Unsupported file format / decode failure** | `ffmpeg` cannot identify a video/audio stream, or exits non-zero (corrupt file, unsupported codec) | `CONVERSION_FAILED` (422) | "Audio extraction failed. The file may be corrupted, in an unsupported format, or the video may be unavailable." | Detect `"Invalid data found"` etc., or any non-zero ffmpeg/yt-dlp exit not matched above; log full stderr server-side |
| 10 | **Request timeout (video too long)** | Processing exceeds the server's request timeout | `TIMEOUT` (504) | "This is taking too long — the video may be too long or the server is busy. Try a shorter clip." | `AbortController` kills the child process; temp-file cleanup still runs in `finally` |
| 11 | **Missing yt-dlp / ffmpeg binary** | Binary not found in `$PATH` (`ENOENT` from `child_process`) | `INTERNAL_ERROR` (500) | "Something went wrong on the server. Please try again later." | Detect `ENOENT` on spawn; log `"yt-dlp/ffmpeg not found in PATH"` |
| 12 | **Unexpected server error** | Any unhandled exception (fs failure, OOM, etc.) | `INTERNAL_ERROR` (500) | "Something went wrong on the server. Please try again later." | Catch-all in the route handler; log the full stack server-side |
| 13 | **Temp-file cleanup failure** | `fs.rm` throws after extraction (permissions, file already gone) | _none — silent_ | No user-facing message | Caught and logged to `console.error`; never re-thrown — the user already received their file |

---

## HTTP Status Code Reference

| Code | Constant | Meaning |
|---|---|---|
| `400` | `MISSING_INPUT` | Neither `url` nor `file` provided |
| `400` | `AMBIGUOUS_INPUT` | Both `url` and `file` provided |
| `400` | `INVALID_URL` | Malformed, non-HTTP, or disallowed (private/internal) URL |
| `400` | `INVALID_BITRATE` | `bitrate` not one of 128/192/320 |
| `400` | `INVALID_TRIM` | Bad trim values or `trimStart >= trimEnd` |
| `413` | `FILE_TOO_LARGE` | Upload exceeds 200 MB cap |
| `422` | `UNSUPPORTED_URL` | URL is valid HTTP but yt-dlp does not support the site |
| `422` | `BOT_BLOCKED` | Source site (e.g. YouTube) blocked the server's request |
| `422` | `CONVERSION_FAILED` | yt-dlp/ffmpeg failed to produce an MP3 (bad format, corrupt, unavailable) |
| `500` | `INTERNAL_ERROR` | Missing binary or any unexpected server error |
| `504` | `TIMEOUT` | Extraction exceeded the allowed processing time |

---

## Error Response Shape

All errors from `POST /api/extract` return JSON in this shape:

```json
{
  "error": {
    "code": "CANONICAL_CONSTANT",
    "message": "Human-readable message shown in the UI."
  }
}
```

The frontend reads `error.message` to display to the user and may switch on `error.code` for code-specific handling. This shape is produced by the shared `errorResponse(code, message, status)` helper (see the `backend` skill).

---

## Handling Philosophy

- **Fail fast on the client** — validate URL format and file size in the browser before sending the request. This catches the most common mistakes with zero server load.
- **Classify stderr before giving up** — always scan `yt-dlp` and `ffmpeg` stderr for known patterns (bot-block strings, unsupported URL, codec errors) before falling through to the generic error. Specific messages are far more actionable for users.
- **Always clean up** — temp files are removed in a `finally` block regardless of whether the error is caught, uncaught, or the client disconnects. A cleanup failure is logged but never surfaces to the user.
- **Log everything server-side** — full stderr from child processes is logged at `error` level so that operators can diagnose new failure modes without requiring users to reproduce issues.
