// ─── Error code → message map ────────────────────────────────────────────────
export const ERROR_MESSAGES: Record<string, { msg: string; hint: string | null }> = {
  MISSING_INPUT:     { msg: "No input provided. Paste a URL or drop a video file to continue.", hint: null },
  AMBIGUOUS_INPUT:   { msg: "Both a URL and a file were sent. Pick one.", hint: null },
  INVALID_URL:       { msg: "That URL doesn't look right. Check the format and try again.", hint: null },
  INVALID_BITRATE:   { msg: "Unsupported bitrate. Use 128, 192, or 320 kbps.", hint: null },
  INVALID_TRIM:      { msg: "Trim values must be positive numbers and start < end.", hint: null },
  FILE_TOO_LARGE:    { msg: "File exceeds the 200 MB limit. Trim it locally first, or paste a URL instead.", hint: null },
  UNSUPPORTED_URL:   { msg: "We can't reach that host. Try YouTube, Vimeo, or a direct video link.", hint: null },
  BOT_BLOCKED:       { msg: "YouTube blocked the request as a bot.",
                       hint: "→ try a Vimeo link, a direct video URL, or upload the file directly." },
  CONVERSION_FAILED: { msg: "ffmpeg couldn't decode this source. The container may be corrupted.", hint: null },
  TIMEOUT:           { msg: "The fetch took too long and timed out. Try a shorter clip or upload the file.", hint: null },
  INTERNAL_ERROR:    { msg: "Something went sideways on our end. We logged it.", hint: null },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function slugFromUrl(s: string): string {
  try {
    const u = new URL(s);
    const seg =
      u.pathname.split("/").filter(Boolean).pop() ||
      u.hostname.split(".").slice(-2, -1)[0] ||
      "track";
    const id = u.searchParams.get("v") || u.searchParams.get("id");
    return (
      (id ? `${u.hostname.split(".").slice(-2, -1)[0]}-${id}` : seg) || "track"
    )
      .replace(/[^a-z0-9-_]/gi, "-")
      .slice(0, 48)
      .toLowerCase();
  } catch {
    return "track";
  }
}

export function stripExt(n: string): string {
  return (n || "").replace(/\.[a-z0-9]+$/i, "");
}

export function TS(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
