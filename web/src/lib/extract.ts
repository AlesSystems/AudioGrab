import { isValidUrl, slugFromUrl, stripExt } from "@/lib/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtractResult = {
  filename: string;
  size: number;
  durationMs: number;
  bitrate: string;
  blob: Blob;
  url: string;
};

export type ExtractOutcome =
  | { ok: true; result: ExtractResult }
  | { ok: false; code: string };

export interface ExtractOpts {
  tab: "url" | "file";
  url: string;
  file: File | null;
  bitrate: string;
  trimStart: string;
  trimEnd: string;
  signal?: AbortSignal;
}

// ─── Real fetch with mock fallback ───────────────────────────────────────────

export async function extract(opts: ExtractOpts): Promise<ExtractOutcome> {
  const { tab, url, file, bitrate, trimStart, trimEnd, signal } = opts;

  // Client-side pre-validation
  if (trimStart && trimEnd && Number(trimStart) >= Number(trimEnd)) {
    return { ok: false, code: "INVALID_TRIM" };
  }

  const fd = new FormData();
  if (tab === "url") {
    fd.append("url", url);
  } else if (file) {
    fd.append("file", file);
  }
  fd.append("bitrate", bitrate);
  if (trimStart) fd.append("trimStart", trimStart);
  if (trimEnd) fd.append("trimEnd", trimEnd);

  const t0 = Date.now();

  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      body: fd,
      signal,
    });

    if (res.ok) {
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="(.+)"/)?.[1] ?? "audio.mp3";
      const blobUrl = URL.createObjectURL(blob);
      return {
        ok: true,
        result: {
          filename,
          size: blob.size,
          durationMs: Date.now() - t0,
          bitrate,
          blob,
          url: blobUrl,
        },
      };
    }

    // Non-2xx: parse the canonical error envelope { error: { code } }.
    try {
      const json = (await res.json()) as { error?: { code?: string } };
      if (json?.error?.code) return { ok: false, code: json.error.code };
    } catch {
      // Body wasn't the JSON envelope. A 404 means the route isn't deployed
      // yet — fall back to the mock so the page works standalone.
      if (res.status === 404) return mockExtract(opts);
    }
    return { ok: false, code: "INTERNAL_ERROR" };
  } catch (err: unknown) {
    // Re-throw aborts — caller handles them
    if (
      err instanceof DOMException && err.name === "AbortError"
    ) {
      throw err;
    }

    // No backend / network error: fall back to mock
    return mockExtract(opts);
  }
}

// ─── Mock fallback (replicates audiograb.jsx mockExtract) ────────────────────

async function mockExtract(opts: ExtractOpts): Promise<ExtractOutcome> {
  const { tab, url, file, bitrate, trimStart, trimEnd, signal } = opts;

  // URL-driven forced errors
  const u = url.toLowerCase();
  let forced: string | null = null;

  if (tab === "url") {
    if (!isValidUrl(url)) forced = "INVALID_URL";
    else if (u.includes("youtube.com") || u.includes("youtu.be"))
      forced = "BOT_BLOCKED";
    else if (u.includes("timeout")) forced = "TIMEOUT";
    else if (u.includes("error")) forced = "CONVERSION_FAILED";
    else if (u.includes("blocked")) forced = "BOT_BLOCKED";
  }
  if (trimStart && trimEnd && Number(trimStart) >= Number(trimEnd))
    forced = "INVALID_TRIM";

  // 4 s delay, respecting abort
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 4000);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });

  if (forced) return { ok: false, code: forced };

  // Build fake MP3 blob stub
  const stub = new Uint8Array(2048);
  stub[0] = 0xff;
  stub[1] = 0xfb;
  stub[2] = 0x90;
  stub[3] = 0x44;
  const blob = new Blob([stub], { type: "audio/mpeg" });
  const blobUrl = URL.createObjectURL(blob);

  const filename =
    (tab === "url" ? slugFromUrl(url) : stripExt(file?.name ?? "")) + ".mp3";

  return {
    ok: true,
    result: {
      filename,
      size:
        tab === "url"
          ? Math.round(1.4 * 1024 * 1024 + Math.random() * 4 * 1024 * 1024)
          : Math.round((file?.size ?? 0) * 0.05),
      durationMs: 3500 + Math.round(Math.random() * 900),
      bitrate,
      blob,
      url: blobUrl,
    },
  };
}
