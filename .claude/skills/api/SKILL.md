---
name: api
description: Use this skill when defining, consuming, or extending AudioGrab API endpoints — request contract, response shapes, error codes, and extension conventions.
---

## POST /api/extract

The single endpoint for all audio extraction.

### Request

Supports either `application/json` or `multipart/form-data`.

#### JSON

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Full video URL (YouTube, Vimeo, direct video link) |
| `bitrate` | number | No | Output MP3 bitrate hint. Defaults to `192` |

#### Multipart

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | XOR `file` | Full video URL (YouTube, Vimeo, direct video link) |
| `file` | File | XOR `url` | Video file upload (max 200 MB) |
| `bitrate` | number | No (default `192`) | Output MP3 bitrate hint in kbps |

Exactly one of `url` or `file` must be present. Sending both or neither is a `400` error.

### Success Response

```
HTTP 200
Content-Type: audio/mpeg
Content-Disposition: attachment; filename="<video-title>.mp3"
Content-Length: <bytes>
Cache-Control: no-store
```

Body: raw MP3 binary. The filename is derived from the video title (sanitised — non-word chars replaced with `_`).

### Error Response

All errors return JSON regardless of `Accept` header:

```json
{
  "error": "Human-readable explanation.",
  "code": "ERROR_CODE"
}
```

### Error Codes

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | `MISSING_INPUT` | Neither `url` nor `file` provided |
| 400 | `AMBIGUOUS_INPUT` | Both `url` and `file` provided |
| 400 | `INVALID_URL` | `url` is not a valid `http`/`https` video URL |
| 400 | `INVALID_REQUEST` | Unsupported request `Content-Type` |
| 413 | `FILE_TOO_LARGE` | Uploaded file exceeds 200 MB |
| 422 | `UNSUPPORTED_URL` | `yt-dlp` cannot handle this URL |
| 422 | `BOT_BLOCKED` | Platform blocked the download (YouTube cloud IP block) |
| 422 | `CONVERSION_FAILED` | `ffmpeg` failed to convert the file |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

## Conventions for Adding / Extending Endpoints

1. **New endpoint file:** `app/api/<name>/route.ts`. Export only the HTTP verbs you use (`GET`, `POST`, etc.).
2. **Same error shape everywhere.** Return `{ error, code }` JSON on failures — never return ad-hoc error payloads with different keys.
3. **No breaking changes without updating this skill.** If you rename a field or change an HTTP status, update the table above before shipping.
4. **No auth currently.** If auth is added later, apply it as middleware at the route level, not inside extraction helpers.
5. **Document all new codes** in the error table above so the frontend can map them to user-friendly messages.

## Frontend ↔ API Contract Summary

```
JSON { url, bitrate? } or FormData { url | file, bitrate? }
  → POST /api/extract
  → 200 audio/mpeg binary
  → 4xx/5xx { error, code }
```

No polling, no WebSockets, no session tokens — one request, one response.
