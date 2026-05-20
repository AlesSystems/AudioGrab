# AudioGrab — API Reference

## POST /api/extract

Accepts a video URL or uploaded video file and returns an MP3 audio stream.

---

### Request

Supports two request modes:

#### JSON request

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | Public video URL (YouTube, Vimeo, direct `.mp4`, etc.) |
| `bitrate` | number | No | Preferred MP3 bitrate. Defaults to `192`. |

#### Multipart request

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Conditionally required | Video file upload. Max 200 MB. |
| `url` | string | Conditionally required | Public video URL. Supported for parity with the JSON mode. |
| `bitrate` | number | No | Preferred MP3 bitrate. Defaults to `192`. |

Providing neither `url` nor `file` returns `400 MISSING_INPUT`; providing both returns `400 AMBIGUOUS_INPUT`.

---

### Success Response

**Status:** `200 OK`

**Headers:**
```
Content-Type: audio/mpeg
Content-Disposition: attachment; filename="<video-title>.mp3"
Content-Length: <bytes>
```

The response body is the MP3 file streamed directly to the client. The filename is derived from the video title for URL extraction or the original upload filename for file conversion.

---

### Error Responses

All errors return JSON with the following shape:

```json
{
  "error": "Human-readable description of the error.",
  "code": "ERROR_CODE"
}
```

These codes are canonical and shared with [ERROR.md](ERROR.md) (full catalog) and the `api`/`backend`/`extraction` skills.

| HTTP Status | Code | Cause |
|-------------|------|-------|
| `400` | `MISSING_INPUT` | Neither `url` nor `file` provided. |
| `400` | `AMBIGUOUS_INPUT` | Both `url` and `file` provided. |
| `400` | `INVALID_URL` | URL is malformed or not `http`/`https`. |
| `400` | `INVALID_REQUEST` | Content type is not `application/json` or `multipart/form-data`. |
| `413` | `FILE_TOO_LARGE` | Uploaded file exceeds the 200 MB limit. |
| `422` | `UNSUPPORTED_URL` | The host is not supported by `yt-dlp`. |
| `422` | `BOT_BLOCKED` | Source platform (e.g. YouTube) blocked the server (cloud IP block). |
| `422` | `CONVERSION_FAILED` | `yt-dlp` or `ffmpeg` failed to produce an MP3. |
| `500` | `INTERNAL_ERROR` | Missing binary or any unexpected server error. |

---

### Examples

#### Extract audio from a URL

```bash
curl -X POST https://your-app.railway.app/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://vimeo.com/123456789","bitrate":192}' \
  --output audio.mp3
```

#### Extract audio from a URL with multipart

```bash
curl -X POST https://your-app.railway.app/api/extract \
  -F "url=https://vimeo.com/123456789" \
  --output audio.mp3
```

#### Upload a local video file

```bash
curl -X POST https://your-app.railway.app/api/extract \
  -F "file=@/path/to/video.mp4" \
  -F "bitrate=128" \
  --output clip.mp3
```
