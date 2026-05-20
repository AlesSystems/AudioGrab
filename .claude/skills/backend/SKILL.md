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

Always use an **isolated temp directory per request** with a random name. Clean up in a `finally` block — guaranteed even on error or early return.

```ts
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const tmpDir = path.join(os.tmpdir(), `audiograb-${randomUUID()}`);
await fs.mkdir(tmpDir, { recursive: true });

try {
  // ... write input file if needed, run extraction, read output ...
  const mp3Buffer = await fs.readFile(outputPath);
  return streamMp3(mp3Buffer, safeFilename);
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}
```

Never leave temp files on disk — the host's ephemeral filesystem fills up quickly.

## File Upload Handling

Convert the `File` object from `formData()` to a buffer and write to the temp dir:

```ts
if (file) {
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

Return the MP3 as a binary response with correct headers. Read the output file into a buffer and return it (buffered is fine for files up to 200 MB):

```ts
function streamMp3(buffer: Buffer, filename: string): Response {
  const safe = filename.replace(/[^\w.\-]/g, '_');
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${safe}.mp3"`,
      'Content-Length': String(buffer.length),
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
