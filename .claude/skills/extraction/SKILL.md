---
name: extraction
description: Use this skill when implementing or modifying AudioGrab's audio extraction logic — yt-dlp URL downloads, ffmpeg file conversion, bitrate/trim flags, and security-critical subprocess invocation.
---

## URL Path — yt-dlp

```ts
import { spawn } from 'child_process';

function ytDlp(url: string, outputPath: string, bitrate: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // ALWAYS use argv array — never shell: true or string interpolation
    const proc = spawn('yt-dlp', [
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', `${bitrate}k`,
      '-o', outputPath,
      '--no-playlist',
      url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new ExtractionError('CONVERSION_FAILED', `yt-dlp exited with code ${code}`));
    });
    proc.on('error', (err) => reject(new ExtractionError('INTERNAL_ERROR', err.message)));
  });
}
```

`outputPath` should be a full path inside the isolated temp dir (e.g., `<tmpDir>/out.mp3`). yt-dlp writes directly to this path.

## File Path — ffmpeg

```ts
function ffmpegConvert(
  inputPath: string,
  outputPath: string,
  bitrate: string,
  trimStart?: number,
  trimEnd?: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['-y', '-i', inputPath];

    // Trim flags (must come after -i for output-side trim)
    if (trimStart !== undefined) args.push('-ss', String(trimStart));
    if (trimEnd   !== undefined) args.push('-to', String(trimEnd));

    args.push('-vn', '-acodec', 'libmp3lame', '-b:a', `${bitrate}k`, outputPath);

    // ALWAYS use argv array — no shell: true
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new ExtractionError('CONVERSION_FAILED', `ffmpeg exited with code ${code}`));
    });
    proc.on('error', (err) => reject(new ExtractionError('INTERNAL_ERROR', err.message)));
  });
}
```

## Trim also applies to yt-dlp output

After `yt-dlp` downloads the MP3, if `trimStart` or `trimEnd` is set, run `ffmpegConvert` on the downloaded file as a second pass to apply the trim. Use separate input/output paths within the same temp dir.

## Bitrate Flag Mapping

| User value | ffmpeg `-b:a` | yt-dlp `--audio-quality` |
|------------|---------------|--------------------------|
| `'128'`    | `128k`        | `128k`                   |
| `'192'`    | `192k`        | `192k`                   |
| `'320'`    | `320k`        | `320k`                   |

Validate that `bitrate` is one of these three values before passing it to any subprocess.

## URL vs File Branching

```ts
export async function extractAudio(params: ExtractionParams): Promise<Buffer> {
  const { url, filePath, bitrate, trimStart, trimEnd, tmpDir } = params;
  const outputPath = path.join(tmpDir, 'out.mp3');

  if (url) {
    await validateUrl(url);                          // throws INVALID_URL / UNSUPPORTED_URL
    await ytDlp(url, outputPath, bitrate);
    if (trimStart !== undefined || trimEnd !== undefined) {
      const trimmedPath = path.join(tmpDir, 'trimmed.mp3');
      await ffmpegConvert(outputPath, trimmedPath, bitrate, trimStart, trimEnd);
      return fs.readFile(trimmedPath);
    }
    return fs.readFile(outputPath);
  }

  // file upload path
  await ffmpegConvert(filePath!, outputPath, bitrate, trimStart, trimEnd);
  return fs.readFile(outputPath);
}
```

## URL Validation

```ts
import { URL } from 'url';

function validateUrl(raw: string): void {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ExtractionError('INVALID_URL', 'Not a valid URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ExtractionError('INVALID_URL', 'Only http/https URLs are allowed.');
  }
  // Optionally allowlist known hostnames (youtube.com, youtu.be, vimeo.com, etc.)
}
```

Never pass a URL string directly to a shell. The `spawn` argv-array approach prevents injection even without allowlisting, but allowlisting adds defense-in-depth.

## SECURITY — Critical Rules

1. **Always use `spawn` with an argv array.** Never `exec`, never `execSync`, never `shell: true`. Never build a command string with user data.
2. **Never interpolate user input into any string that goes to a shell.**
3. **Validate URLs** with the `URL` constructor before passing to yt-dlp.
4. **Temp paths are random UUIDs** — users cannot influence the path on disk.
5. If you add new subprocess calls, apply the same rules.

## Failure Modes & Error Mapping

| Situation | Detected by | Error code to throw |
|-----------|-------------|---------------------|
| yt-dlp can't find video | non-zero exit + stderr "not found" | `UNSUPPORTED_URL` |
| YouTube bot block | non-zero exit + stderr "sign in" / "bot" | `BOT_BLOCKED` |
| ffmpeg decode failure | non-zero exit | `CONVERSION_FAILED` |
| Process timeout | `AbortController` kills proc | `TIMEOUT` |
| File write/read failure | `fs` throws | `INTERNAL_ERROR` |

Parse `proc.stderr` to distinguish `BOT_BLOCKED` from `UNSUPPORTED_URL`:

```ts
let stderrOut = '';
proc.stderr.on('data', (chunk) => { stderrOut += chunk.toString(); });
proc.on('close', (code) => {
  if (code !== 0) {
    if (/sign in|bot detected|HTTP Error 429/i.test(stderrOut))
      reject(new ExtractionError('BOT_BLOCKED', 'Platform blocked the download.'));
    else if (/unsupported url|no video formats/i.test(stderrOut))
      reject(new ExtractionError('UNSUPPORTED_URL', 'URL not supported by yt-dlp.'));
    else
      reject(new ExtractionError('CONVERSION_FAILED', `Process exited ${code}.`));
  } else resolve();
});
```

## ExtractionError Class

```ts
export class ExtractionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}
```

Catch `ExtractionError` in the route handler and map `code` to the appropriate HTTP status (see API skill).
