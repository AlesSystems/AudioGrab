# AudioGrab — Security Considerations

This document describes the security controls in AudioGrab and the reasoning behind them.

---

## File Size Cap

Uploads are rejected as early as possible — before the request body is fully buffered — if the `Content-Length` header exceeds `MAX_FILE_SIZE_MB` (default 200 MB). Streaming uploads that exceed the limit mid-transfer are also aborted immediately.

This prevents:
- Disk exhaustion on the server.
- Memory pressure from buffering oversized payloads.
- Slow-loris style resource-exhaustion attacks via large uploads.

---

## URL Validation and SSRF Protection

Before passing any user-supplied URL to `yt-dlp`, the server validates it strictly:

- **Scheme allowlist:** Only `http` and `https` are accepted. `file://`, `ftp://`, `data:`, and all other schemes are rejected with `422 UNSUPPORTED_URL`.
- **Private/internal address rejection:** The resolved hostname must not be a loopback address (`127.x.x.x`, `::1`), link-local address (`169.254.x.x`), RFC-1918 private range (`10.x`, `172.16–31.x`, `192.168.x`), or the metadata service endpoint (`169.254.169.254`). This prevents Server-Side Request Forgery (SSRF) attacks where an attacker tricks the server into fetching internal resources.
- **DNS rebinding:** Resolve the hostname at validation time and re-validate after DNS resolution. Do not trust the hostname alone.

---

## Command-Injection Prevention

`yt-dlp` and `ffmpeg` are invoked as child processes. The following rules are **strictly enforced**:

- **Never use `shell: true`** when spawning child processes. All process calls use Node's `child_process.spawn` (or equivalent) with an explicit argv array.
- **Never build shell strings from user input.** User-supplied values (URL, filenames, timestamps) are passed as discrete array elements, not interpolated into a command string.
- **Validate all inputs before passing them as arguments:**
  - URLs are validated against the allowlist above before being passed to `yt-dlp`.
  - Bitrate must be one of the allowed enum values (`128`, `192`, `320`).
  - Timestamps (`trimStart`, `trimEnd`) are validated as numeric seconds or `HH:MM:SS` format via a strict regex before being passed to `ffmpeg -ss` / `-to`.
- **Filenames are never interpolated into shell strings.** Output filenames use randomly generated IDs (see Temp File Handling below).

Example of the correct pattern:

```js
// Correct — argv array, no shell interpolation
spawn('yt-dlp', ['--no-playlist', '-x', '--audio-format', 'mp3', '--', url], {
  shell: false,
});

// WRONG — never do this
exec(`yt-dlp ${url}`);
```

---

## Temp File Handling

- **Random names:** All working files use a cryptographically random ID (e.g. `crypto.randomUUID()`) as the filename, never the original upload name or video title.
- **Isolated directory:** All temp files are written to `TEMP_DIR` (default `/tmp/audiograb`), which is isolated from other application directories. The server never serves files from arbitrary filesystem paths — only files it explicitly created in `TEMP_DIR` during the current request lifecycle.
- **Guaranteed cleanup:** Temp files are deleted in a `finally` block (or equivalent) so they are removed whether the request succeeds, fails, or times out. The download stream's `close` event triggers final cleanup after the response is fully sent.
- **No directory traversal:** Generated filenames are never constructed from user input, eliminating path-traversal risk.

---

## Resource Limits and Timeouts

To prevent denial-of-service through resource exhaustion:

- **Request timeout:** Each `/api/extract` request has a server-side deadline. Requests exceeding this deadline are aborted and return `504 TIMEOUT`.
- **Child process timeout:** `yt-dlp` and `ffmpeg` processes are killed if they run longer than the configured limit.
- **Concurrency limit (recommended):** Limit the number of simultaneous extractions to prevent CPU/disk saturation. Use a queue or semaphore in production.
- **Rate limiting (recommended):** Apply per-IP rate limiting at the edge (e.g. Vercel Edge Middleware, Railway's proxy, or a reverse proxy like Nginx) to limit the number of requests per minute.

---

## Reporting a Vulnerability

If you discover a security vulnerability in AudioGrab, please **do not open a public GitHub issue**.

Report it privately via email to: **security@your-org.example.com**

Include:
- A clear description of the vulnerability and its potential impact.
- Steps to reproduce or a proof-of-concept.
- Any suggested mitigations (optional but appreciated).

We aim to acknowledge reports within 2 business days and provide a remediation timeline within 7 days.
