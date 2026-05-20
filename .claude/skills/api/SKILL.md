---
name: api
description: Use this skill when defining, consuming, or extending AudioGrab API endpoints — request contract, response shapes, error codes, and extension conventions.
---

## POST /api/extract

The single endpoint for all audio extraction.

### Request

`Content-Type: multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | XOR `file` | Full video URL (YouTube, Vimeo, direct video link) |
| `file` | File | XOR `url` | Video file upload (max 200 MB) |
| `bitrate` | `'128'` \| `'192'` \| `'320'` | No (default `'192'`) | Output MP3 bitrate in kbps |
| `trimStart` | number (seconds) | No | Trim audio from this offset |
| `trimEnd` | number (seconds) | No | Trim audio up to this offset |

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
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation."
  }
}
```

### Error Codes

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | `MISSING_INPUT` | Neither `url` nor `file` provided |
| 400 | `AMBIGUOUS_INPUT` | Both `url` and `file` provided |
| 400 | `INVALID_URL` | `url` is not a valid/supported video URL |
| 400 | `INVALID_BITRATE` | `bitrate` not in `['128','192','320']` |
| 400 | `INVALID_TRIM` | `trimStart`/`trimEnd` out of range or `trimStart >= trimEnd` |
| 413 | `FILE_TOO_LARGE` | Uploaded file exceeds 200 MB |
| 422 | `UNSUPPORTED_URL` | `yt-dlp` cannot handle this URL |
| 422 | `BOT_BLOCKED` | Platform blocked the download (YouTube cloud IP block) |
| 422 | `CONVERSION_FAILED` | `ffmpeg` failed to convert the file |
| 504 | `TIMEOUT` | Processing exceeded the time limit |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

### Validation Rules (apply at route boundary)

```ts
const VALID_BITRATES = ['128', '192', '320'];
if (bitrate && !VALID_BITRATES.includes(bitrate)) {
  return errorResponse('INVALID_BITRATE', `bitrate must be one of ${VALID_BITRATES.join(', ')}.`, 400);
}
if (trimStart !== undefined && trimEnd !== undefined && trimStart >= trimEnd) {
  return errorResponse('INVALID_TRIM', 'trimStart must be less than trimEnd.', 400);
}
```

Always validate at the route entry — never pass raw user data to extraction helpers without checking.

## Conventions for Adding / Extending Endpoints

1. **New endpoint file:** `app/api/<name>/route.ts`. Export only the HTTP verbs you use (`GET`, `POST`, etc.).
2. **Same error shape everywhere.** Use the shared `errorResponse(code, message, status)` helper — never return ad-hoc JSON error objects.
3. **No breaking changes without updating this skill.** If you rename a field or change an HTTP status, update the table above before shipping.
4. **No auth currently.** If auth is added later, apply it as middleware at the route level, not inside extraction helpers.
5. **Document all new codes** in the error table above so the frontend can map them to user-friendly messages.

## Frontend ↔ API Contract Summary

```
FormData { url | file, bitrate?, trimStart?, trimEnd? }
  → POST /api/extract
  → 200 audio/mpeg binary   (trigger download)
  → 4xx/5xx { error: { code, message } }  (show to user)
```

No polling, no WebSockets, no session tokens — one request, one response.
