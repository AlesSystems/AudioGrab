# AudioGrab — API Reference

## POST /api/extract

Accepts a URL or uploaded video file and returns an MP3 audio stream.

---

### Request

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Conditionally required | Public video URL (YouTube, Vimeo, direct `.mp4`, etc.). Exactly one of `url` or `file` must be provided. |
| `file` | binary | Conditionally required | Video file upload. Exactly one of `url` or `file` must be provided. Max 200 MB. |
| `bitrate` | enum | No | MP3 bitrate in kbps. One of `128`, `192`, `320`. Default: `192`. |
| `trimStart` | string | No | Start of the audio clip. `HH:MM:SS` or seconds (e.g. `90`). |
| `trimEnd` | string | No | End of the audio clip. `HH:MM:SS` or seconds (e.g. `150`). |

Providing neither `url` nor `file` returns `400 MISSING_INPUT`; providing both returns `400 AMBIGUOUS_INPUT`.

---

### Success Response

**Status:** `200 OK`

**Headers:**
```
Content-Type: audio/mpeg
Content-Disposition: attachment; filename="<video-title>.mp3"
```

The response body is the MP3 file streamed directly to the client. The filename is derived from the video title (slugified). The temp file is deleted from the server after the stream completes.

#### Future mode (optional)

A future response mode may return JSON instead of streaming the file directly:

```json
{
  "url": "https://storage.example.com/signed/abc123.mp3?expires=..."
}
```

This would be selected via an `Accept: application/json` header or a `?mode=url` query parameter (not yet implemented).

---

### Error Responses

All errors return JSON with the following shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of the error."
  }
}
```

These codes are canonical and shared with [ERROR.md](ERROR.md) (full catalog) and the `api`/`backend`/`extraction` skills.

| HTTP Status | Code | Cause |
|-------------|------|-------|
| `400` | `MISSING_INPUT` | Neither `url` nor `file` provided. |
| `400` | `AMBIGUOUS_INPUT` | Both `url` and `file` provided. |
| `400` | `INVALID_URL` | URL is malformed, not `http`/`https`, or points to a private/internal address. |
| `400` | `INVALID_BITRATE` | `bitrate` is not one of `128`/`192`/`320`. |
| `400` | `INVALID_TRIM` | `trimStart`/`trimEnd` is not a valid time value, or `trimStart >= trimEnd`. |
| `413` | `FILE_TOO_LARGE` | Uploaded file exceeds the 200 MB limit. |
| `422` | `UNSUPPORTED_URL` | The host is not supported by `yt-dlp`. |
| `422` | `BOT_BLOCKED` | Source platform (e.g. YouTube) blocked the server (cloud IP block). |
| `422` | `CONVERSION_FAILED` | `yt-dlp` or `ffmpeg` failed to produce an MP3 (corrupt/unsupported/unavailable). |
| `504` | `TIMEOUT` | The extraction or conversion exceeded the server-side time limit. |
| `500` | `INTERNAL_ERROR` | Missing binary or any unexpected server error. |

---

### Examples

#### Extract audio from a URL

```bash
curl -X POST https://your-app.railway.app/api/extract \
  -F "url=https://vimeo.com/123456789" \
  --output audio.mp3
```

#### Extract with a custom bitrate

```bash
curl -X POST https://your-app.railway.app/api/extract \
  -F "url=https://vimeo.com/123456789" \
  -F "bitrate=320" \
  --output audio-hq.mp3
```

#### Upload a local video file

```bash
curl -X POST https://your-app.railway.app/api/extract \
  -F "file=@/path/to/video.mp4" \
  -F "bitrate=128" \
  -F "trimStart=00:01:30" \
  -F "trimEnd=00:03:00" \
  --output clip.mp3
```
