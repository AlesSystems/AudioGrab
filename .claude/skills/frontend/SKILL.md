---
name: frontend
description: Use this skill when building or modifying the AudioGrab Next.js frontend — landing page layout, tabbed URL/file input, state machine, bitrate selector, and calling the extract API.
---

## Stack

- **Next.js App Router** (TypeScript). All UI lives under `app/`.
- **Tailwind CSS** for all styling — no CSS modules or styled-components.
- Functional components only. Use `useState`/`useReducer` for local state; no global store.

## Layout & Design

Minimal, modern aesthetic. Dark background (`bg-gray-950`), single centered card (`max-w-xl`), generous vertical padding.

```
<main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
  <div className="w-full max-w-xl bg-gray-900 rounded-2xl p-8 shadow-xl">
    <h1 className="text-3xl font-bold text-white mb-2">AudioGrab</h1>
    <p className="text-gray-400 mb-6">Paste a video URL or upload a file — get an MP3.</p>
    {/* tabs, input, controls */}
  </div>
</main>
```

## Tabbed Input

Two tabs: **Paste URL** and **Upload File**. Active tab underlined with `border-b-2 border-indigo-500`.

- **Paste URL tab:** single `<input type="url">` with placeholder `https://youtube.com/watch?v=…`
- **Upload File tab:** drag-and-drop dropzone. Accept `video/*`. Show file name once selected. Enforce 200 MB client-side before submitting:

```ts
if (file.size > 200 * 1024 * 1024) {
  dispatch({ type: 'ERROR', message: 'File exceeds 200 MB limit.' });
  return;
}
```

Drag-over state: highlight dropzone border (`border-indigo-400 bg-gray-800`).

## Controls

- **Bitrate selector** — `<select>` with options 128, 192, 320 kbps. Default `192`.
- **Trim (optional)** — two `<input type="number">` fields for `trimStart` and `trimEnd` (seconds). Show only when the user expands an "Advanced" disclosure.
- **"Extract Audio" button** — full-width, `bg-indigo-600 hover:bg-indigo-500`, disabled during loading.

## State Machine

Use a `useReducer` with four states:

| State | Description |
|-------|-------------|
| `idle` | Initial; button enabled |
| `loading` | Request in flight; show spinner; button disabled |
| `success` | Show download link (blob URL); allow retry |
| `error` | Show `error.message` in red; allow retry |

```ts
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; url: string; filename: string }
  | { status: 'error'; message: string };
```

On success, create an object URL from the response blob and render:
```tsx
<a href={state.url} download={state.filename}
   className="block w-full text-center bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl">
  Download MP3
</a>
```

Revoke the blob URL on unmount or when a new extraction starts.

## Calling POST /api/extract

Always use `multipart/form-data` (do NOT set `Content-Type` manually — let the browser set the boundary).

```ts
async function extract(tab: 'url' | 'file') {
  dispatch({ type: 'LOADING' });
  const fd = new FormData();

  if (tab === 'url') {
    fd.append('url', urlInput);
  } else {
    fd.append('file', selectedFile);
  }
  fd.append('bitrate', bitrate);          // '128' | '192' | '320'
  if (trimStart) fd.append('trimStart', String(trimStart));
  if (trimEnd)   fd.append('trimEnd',   String(trimEnd));

  const res = await fetch('/api/extract', { method: 'POST', body: fd });
  if (!res.ok) {
    const { error } = await res.json();
    dispatch({ type: 'ERROR', message: error.message });
    return;
  }

  const blob = await res.blob();
  const filename = res.headers.get('Content-Disposition')
    ?.match(/filename="(.+)"/)?.[1] ?? 'audio.mp3';
  const blobUrl = URL.createObjectURL(blob);
  dispatch({ type: 'SUCCESS', url: blobUrl, filename });
}
```

## Do / Don't

- **Do** keep all extraction logic server-side; the frontend only submits and downloads.
- **Do** show user-friendly messages for every error code (see API skill).
- **Don't** poll or use WebSockets — single synchronous request is sufficient.
- **Don't** store the blob URL in any persistent state; always revoke it on cleanup.
