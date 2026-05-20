"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  ERROR_MESSAGES,
  fmtBytes,
  isValidUrl,
  TS,
} from "@/lib/errors";
import { extract, ExtractResult } from "@/lib/extract";

// ─── Loading log stream ───────────────────────────────────────────────────────

const LOG_SEQUENCE = (bitrate: string, src: string) => [
  { t: 0,    pre: "→", msg: `connecting to ${src}…`,                    cls: "dim" },
  { t: 500,  pre: "✓", msg: "source reachable · 200 OK",                cls: "ok"  },
  { t: 950,  pre: "→", msg: "fetching media stream…",                   cls: "dim" },
  { t: 1700, pre: "✓", msg: "stream acquired · 4m 28s · 1080p",         cls: "ok"  },
  { t: 2050, pre: "→", msg: "demuxing audio track [aac, 2ch, 44.1kHz]…",cls: "dim" },
  { t: 2600, pre: "→", msg: `encoding mp3 @ ${bitrate}k cbr…`,          cls: "dim" },
  { t: 3500, pre: "✓", msg: "mp3 encoded · writing tags…",              cls: "ok"  },
];

type LogLine = {
  t: number;
  pre: string;
  msg: string;
  cls: string;
  ts: string;
  key: string;
};

function LoadingPanel({
  bitrate,
  source,
}: {
  bitrate: string;
  source: string;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const seq = useMemo(() => LOG_SEQUENCE(bitrate, source), [bitrate, source]);

  useEffect(() => {
    const t0 = Date.now();
    const timers = seq.map((ln, i) =>
      setTimeout(() => {
        setLines((prev) => [
          ...prev,
          { ...ln, ts: TS(), key: `${t0}-${i}` },
        ]);
      }, ln.t)
    );
    return () => timers.forEach(clearTimeout);
  }, [seq]);

  const allDone = lines.length >= seq.length;

  return (
    <div className="log" role="status" aria-live="polite">
      {lines.map((ln) => (
        <div className={`ln ${ln.cls || ""}`} key={ln.key}>
          <span className="ts">[{ln.ts}]</span>
          <span className="pre">{ln.pre}</span>
          <span className="msg">{ln.msg}</span>
        </div>
      ))}
      {!allDone && (
        <div className="ln" style={{ opacity: 1, animation: "none" }}>
          <span className="ts">[{TS()}]</span>
          <span className="pre" style={{ color: "var(--magenta)" }}>
            $
          </span>
          <span className="msg working">working</span>
        </div>
      )}
      <div className="bar" aria-hidden="true">
        <i />
      </div>
    </div>
  );
}

// ─── Success panel ────────────────────────────────────────────────────────────

function SuccessPanel({
  filename,
  size,
  durationMs,
  bitrate,
  onReset,
  onDownload,
}: {
  filename: string;
  size: number;
  durationMs: number;
  bitrate: string;
  onReset: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="success" role="status">
      <div className="head">
        <span className="ok" aria-hidden="true">
          ✓
        </span>
        <span>extraction complete · ready for download</span>
      </div>
      <div className="meta">
        <div className="chip-file" title={filename}>
          <span style={{ color: "var(--magenta)" }}>♫</span>
          <span className="name">{filename}</span>
          <span className="sz">· {fmtBytes(size)}</span>
        </div>
      </div>
      <div className="row2">
        <button className="dl" onClick={onDownload}>
          <span className="arr">↓</span> Download MP3
        </button>
        <button className="linkbtn" onClick={onReset}>
          ↺ extract another
        </button>
      </div>
      <div className="stats">
        <span>
          <b>bitrate</b> {bitrate}k
        </span>
        <span>
          <b>duration</b> {(durationMs / 1000).toFixed(2)}s
        </span>
        <span>
          <b>cleanup</b> auto · 5 min
        </span>
      </div>
    </div>
  );
}

// ─── Error panel ──────────────────────────────────────────────────────────────

function ErrorPanel({ code, onReset }: { code: string; onReset: () => void }) {
  const { msg, hint } =
    ERROR_MESSAGES[code] ?? ERROR_MESSAGES["INTERNAL_ERROR"]!;
  return (
    <div className="errorbox shake" role="alert">
      <div className="line1">
        <span className="x">✗</span>
        <span className="code">{code}</span>
      </div>
      <div className="msg">{msg}</div>
      {hint && (
        <div className="hint2">
          <span className="acc">›</span> {hint.replace(/^→\s*/, "")}
        </div>
      )}
      <div>
        <button className="linkbtn" onClick={onReset}>
          ↺ try again
        </button>
      </div>
    </div>
  );
}

// ─── Extractor ────────────────────────────────────────────────────────────────

type Phase = "idle" | "loading" | "success" | "error";

export default function Extractor() {
  const [tab, setTab] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bitrate, setBitrate] = useState("192");
  const [advOpen, setAdvOpen] = useState(false);
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");
  const [over, setOver] = useState(false);

  // state machine
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const validInput = tab === "url" ? isValidUrl(url) : !!file;
  const fileOk = !file || file.size <= 200 * 1024 * 1024;

  // ── File handlers ──────────────────────────────────────────────────────────

  const handleFiles = (fs: FileList | null) => {
    const f = fs?.[0];
    if (!f) return;
    if (
      !f.type.startsWith("video/") &&
      !/\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(f.name)
    ) {
      setErrorCode("UNSUPPORTED_URL");
      setPhase("error");
      return;
    }
    if (f.size > 200 * 1024 * 1024) {
      setErrorCode("FILE_TOO_LARGE");
      setPhase("error");
      return;
    }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  // ── Reset / cancel ─────────────────────────────────────────────────────────

  const reset = () => {
    abortRef.current?.abort();
    if (result?.url) URL.revokeObjectURL(result.url);
    setPhase("idle");
    setErrorCode(null);
    setResult(null);
  };

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault?.();
    if (phase === "loading" || !validInput || !fileOk) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("loading");

    extract({
      tab,
      url,
      file,
      bitrate,
      trimStart,
      trimEnd,
      signal: controller.signal,
    })
      .then((outcome) => {
        if (outcome.ok) {
          setResult(outcome.result);
          setPhase("success");
        } else {
          setErrorCode(outcome.code);
          setPhase("error");
        }
      })
      .catch((err: unknown) => {
        // AbortError = user cancelled; do nothing
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorCode("INTERNAL_ERROR");
        setPhase("error");
      });
  };

  // ── Download ───────────────────────────────────────────────────────────────

  const doDownload = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── Derived display values ─────────────────────────────────────────────────

  const phaseLabel =
    phase === "idle"
      ? "ready"
      : phase === "loading"
      ? "running"
      : phase === "success"
      ? "done"
      : "error";

  const phaseColor =
    phase === "error"
      ? "var(--red)"
      : phase === "success"
      ? "var(--green)"
      : phase === "loading"
      ? "var(--magenta)"
      : "var(--dim)";

  const sourceLabel =
    tab === "url"
      ? (() => {
          try {
            return new URL(url).hostname.replace(/^www\./, "");
          } catch {
            return "source";
          }
        })()
      : file?.name || "upload";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card-wrap">
      <div className={`card ${phase === "loading" ? "busy" : ""}`}>
        {/* titlebar */}
        <div className="titlebar">
          <div className="lights" aria-hidden="true">
            <i className="r" />
            <i className="y" />
            <i className="g" />
          </div>
          <div className="tabtitle">
            <span className="acc">$</span> audiograb — extract
          </div>
          <div className="bytes" style={{ color: phaseColor }}>
            ● {phaseLabel}
          </div>
        </div>

        <div className="body">
          {/* ── idle ── */}
          {phase === "idle" && (
            <div className="fadeswap" key="idle">
              {/* tabs */}
              <div className="tabs" role="tablist" aria-label="input mode">
                <button
                  className={`tab ${tab === "url" ? "active" : ""}`}
                  role="tab"
                  aria-selected={tab === "url"}
                  onClick={() => setTab("url")}
                >
                  <span className="gt">›</span>paste url
                  {tab === "url" && <span className="caret" />}
                </button>
                <button
                  className={`tab ${tab === "file" ? "active" : ""}`}
                  role="tab"
                  aria-selected={tab === "file"}
                  onClick={() => setTab("file")}
                >
                  <span className="gt">›</span>upload file
                  {tab === "file" && <span className="caret" />}
                </button>
              </div>

              {/* url input */}
              {tab === "url" ? (
                <div
                  className="field"
                  onClick={(e) =>
                    (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()
                  }
                >
                  <span className="prompt">&gt;</span>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://vimeo.com/…"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    onKeyDown={(e) =>
                      e.key === "Enter" && validInput && onSubmit(e)
                    }
                    aria-label="video url"
                  />
                  {url && (
                    <button
                      className="x"
                      onClick={() => setUrl("")}
                      title="clear"
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "var(--dim)",
                        cursor: "pointer",
                        fontFamily: "var(--mono)",
                        fontSize: 14,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ) : (
                /* dropzone */
                <div
                  className={`dz ${over ? "over" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(true);
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={onDrop}
                >
                  {file ? (
                    <span className="filechip">
                      <span style={{ color: "var(--violet)" }}>▢</span>
                      <span>{file.name}</span>
                      <span className="sz">· {fmtBytes(file.size)}</span>
                      <button
                        className="x"
                        onClick={() => setFile(null)}
                        aria-label="remove"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <>
                      <span className="ic" aria-hidden="true">
                        ↥
                      </span>
                      <div>
                        <strong>drop a video</strong> · or{" "}
                        <span
                          className="browse"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          browse
                        </span>
                      </div>
                      <div className="hint">mp4 · mov · webm · mkv · max 200 MB</div>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
              )}

              {/* bitrate selector */}
              <div className="row" role="radiogroup" aria-label="bitrate">
                <label>bitrate</label>
                <div className="seg">
                  {(["128", "192", "320"] as const).map((b) => (
                    <button
                      key={b}
                      className={bitrate === b ? "on" : ""}
                      role="radio"
                      aria-checked={bitrate === b}
                      onClick={() => setBitrate(b)}
                    >
                      {b}
                      <span
                        style={{ color: "var(--dim)", marginLeft: 2 }}
                      >
                        k
                      </span>
                    </button>
                  ))}
                </div>
                <span
                  style={{
                    color: "var(--dim)",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    marginLeft: "auto",
                  }}
                >
                  kbps · cbr
                </span>
              </div>

              {/* advanced / trim */}
              <button
                className={`disclose ${advOpen ? "open" : ""}`}
                onClick={() => setAdvOpen((o) => !o)}
                aria-expanded={advOpen}
              >
                <span className="tri">▸</span> advanced · trim
              </button>
              <div
                className={`advgrid ${advOpen ? "open" : ""}`}
                aria-hidden={!advOpen}
              >
                <div className="adv-field">
                  <span style={{ color: "var(--dim)" }}>start</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={trimStart}
                    onChange={(e) => setTrimStart(e.target.value)}
                    placeholder="0.0"
                    aria-label="trim start seconds"
                  />
                  <span style={{ color: "var(--dim)" }}>s</span>
                </div>
                <div className="adv-field">
                  <span style={{ color: "var(--dim)" }}>end</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(e.target.value)}
                    placeholder="—"
                    aria-label="trim end seconds"
                  />
                  <span style={{ color: "var(--dim)" }}>s</span>
                </div>
              </div>

              {/* CTA button */}
              <button
                className="cta"
                disabled={!validInput}
                onClick={onSubmit}
              >
                <span style={{ color: "var(--magenta)" }}>$</span>
                <span>./extract-audio</span>
                {validInput && <span className="ent">↵ enter</span>}
              </button>
            </div>
          )}

          {/* ── loading ── */}
          {phase === "loading" && (
            <div className="fadeswap" key="loading">
              <LoadingPanel bitrate={bitrate} source={sourceLabel} />
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <button className="linkbtn" onClick={reset}>
                  ✕ cancel
                </button>
              </div>
            </div>
          )}

          {/* ── success ── */}
          {phase === "success" && result && (
            <div className="fadeswap" key="success">
              <SuccessPanel
                filename={result.filename}
                size={result.size}
                durationMs={result.durationMs}
                bitrate={result.bitrate}
                onReset={reset}
                onDownload={doDownload}
              />
            </div>
          )}

          {/* ── error ── */}
          {phase === "error" && errorCode && (
            <div className="fadeswap" key="error">
              <ErrorPanel code={errorCode} onReset={reset} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
