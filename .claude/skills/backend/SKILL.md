---
name: backend
description: Use this skill when building or modifying the AudioGrab Next.js API route — multipart parsing, temp file lifecycle, MP3 streaming, size/timeout enforcement, and deployment considerations.
---

## Route Location & Runtime

File: `app/api/extract/route.ts`

```ts
// Top of file — REQUIRED
export const runtime = 'nodejs';   // never 'edge'; ffmpeg needs Node APIs
export const dynamic = 'force-dynamic';

// Increase body size limit for file uploads (Next.js 13+ App Router)
export const maxDuration = 300;    // seconds; set to your host's max

// next.config.ts — also set api body size limit
// api: { bodyParser: { sizeLimit: '210mb' } }  // slightly above 200MB cap
```

Deploy to **Railway or Render**, not Vercel serverless. Vercel's serverless functions have a 250 MB bundle size cap and short execution limits that prevent bundling `yt-dlp`/`ffmpeg` binaries.

## Multipart Parsing

Use the built-in `request.formData()` — Next.js App Router handles this natively:

```ts
export async function POST(request: Request) {
  const form = await request.formData();
  const url      = form.get('url')      as string | null;
  const file     = form.get('file')     as File   | null;
  const bitrate  = form.get('bitrate')  as string ?? '192';
  const trimStart = form.get('trimStart') ? Number(form.get('trimStart')) : undefined;
  const trimEnd   = form.get('trimEnd')   ? Number(form.get('trimEnd'))   : undefined;

  if (!url && !file) {
    return errorResponse('MISSING_INPUT', 'Provide a URL or upload a file.', 400);
  }
  if (url && file) {
    return errorResponse('AMBIGUOUS_INPUT', 'Provide a URL or a file, not both.', 400);
  }
  // ...
}
```

## Temp File Lifecycle

Always use an **isolated temp directory per request** with a random name. Clean up extraction temps on failure inside the helper, then defer success cleanup to the route once the MP3 response stream closes.

```ts
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { Readable } from 'node:stream';
import { randomUUID } from 'crypto';

const tmpDir = path.join(os.tmpdir(), `audiograb-${randomUUID()}`);
await fs.mkdir(tmpDir, { recursive: true });

try {
  // ... run extraction and return { outputPath, cleanup }
  const contentLength = await fs.stat(outputPath);
  const nodeStream = createReadStream(outputPath);
  const webStream = Readable.toWeb(nodeStream);
  nodeStream.on('close', () => {
    cleanup().catch((error) => console.error('Temp cleanup failed', error));
  });
  return new Response(webStream, {
    headers: { 'Content-Length': String(contentLength.size) },
  });
} catch (error) {
  await fs.rm(tmpDir, { recursive: true, force: true });
  throw error;
}
```

Never leave temp files on disk — the host's ephemeral filesystem fills up quickly. If the helper returns a `cleanup` callback, the route must always attach it to stream completion.

## File Upload Handling

Convert the `File` object from `formData()` to a buffer and write to the temp dir:

```ts
if (file) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > 200 * 1024 * 1024) {
    return errorResponse('FILE_TOO_LARGE', 'File exceeds 200 MB.', 413);
  }
  if (file.size > 200 * 1024 * 1024) {
    return errorResponse('FILE_TOO_LARGE', 'File exceeds 200 MB.', 413);
  }
  const inputPath = path.join(tmpDir, `input-${randomUUID()}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(inputPath, buffer);
  // pass inputPath to extraction layer
}
```

## Streaming the MP3 Response

Return the MP3 as a streamed binary response with correct headers. Stat the file before opening the stream so a stat failure cannot leak the temp directory:

```ts
async function streamMp3(outputPath: string, filename: string, cleanup: () => Promise<void>): Promise<Response> {
  const stats = await fs.stat(outputPath);
  const nodeStream = createReadStream(outputPath);
  const webStream = Readable.toWeb(nodeStream);

  nodeStream.on('close', () => {
    cleanup().catch((error) => console.error('Temp cleanup failed', error));
  });
  nodeStream.on('error', () => {
    cleanup().catch((error) => console.error('Temp cleanup failed', error));
  });

  const safe = filename.replace(/[^\w.\-]/g, '_');
  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${safe}.mp3"`,
      'Content-Length': String(stats.size),
      'Cache-Control': 'no-store',
    },
  });
}
```

## Error Response Helper

```ts
function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}
```

## Timeouts & Size Enforcement

- Reject files > 200 MB before processing (both client-side and server-side).
- Wrap `yt-dlp` / `ffmpeg` invocations with an `AbortController` timeout (e.g., 240 s) and kill the child process if exceeded.
- Return `504` with `TIMEOUT` code if processing exceeds limit.

## Do / Don't

- **Do** always clean up temp files in `finally`.
- **Do** use `runtime = 'nodejs'` — never the Edge runtime.
- **Do** validate all inputs at the route boundary before calling extraction helpers.
- **Don't** deploy to Vercel serverless — use Railway or Render.
- **Don't** store anything permanently; this app has no database.
