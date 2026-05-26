import { Readable } from "node:stream";

import { extractAudio, ExtractApiError, getFileSize, openMp3Stream } from "@/lib/extract-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 200 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") || "";
    const contentLength = request.headers.get("content-length");

    if (contentLength) {
      const parsedLength = Number(contentLength);
      // Multipart overhead counts toward Content-Length, so this is only an early coarse reject.
      if (Number.isFinite(parsedLength) && parsedLength > MAX_FILE_SIZE) {
        return jsonError("Uploaded file exceeds the 200 MB limit.", "FILE_TOO_LARGE", 413);
      }
    }

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { url?: unknown; bitrate?: unknown };
      const url = typeof body.url === "string" ? body.url.trim() : "";
      const bitrate = toBitrate(body.bitrate);

      if (!url) {
        return jsonError("Provide a URL to extract audio.", "MISSING_INPUT", 400);
      }

      const result = await extractAudio({ url, bitrate });
      return await mp3Response(result.outputPath, result.fileName, result.cleanup);
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      const url = formData.get("url");
      const bitrate = toBitrate(formData.get("bitrate"));

      if (file instanceof File && typeof url === "string" && url.trim()) {
        return jsonError("Provide either a URL or a file, not both.", "AMBIGUOUS_INPUT", 400);
      }

      if (file instanceof File) {
        if (file.size > MAX_FILE_SIZE) {
          return jsonError("Uploaded file exceeds the 200 MB limit.", "FILE_TOO_LARGE", 413);
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await extractAudio({
          fileBuffer: buffer,
          fileName: file.name,
          bitrate,
        });

        return await mp3Response(result.outputPath, result.fileName, result.cleanup);
      }

      if (typeof url === "string" && url.trim()) {
        const result = await extractAudio({ url: url.trim(), bitrate });
        return await mp3Response(result.outputPath, result.fileName, result.cleanup);
      }

      return jsonError("Provide a URL or upload a file.", "MISSING_INPUT", 400);
    }

    return jsonError(
      "Unsupported content type. Use application/json or multipart/form-data.",
      "INVALID_REQUEST",
      400,
    );
  } catch (error) {
    if (error instanceof ExtractApiError) {
      return jsonError(error.message, error.code, error.status);
    }

    console.error(error);
    return jsonError("Unexpected server error.", "INTERNAL_ERROR", 500);
  }
}

function toBitrate(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return undefined;
}

async function mp3Response(
  outputPath: string,
  fileName: string,
  cleanup: () => Promise<void>,
): Promise<Response> {
  const contentLength = await getFileSize(outputPath);
  const nodeStream = openMp3Stream(outputPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;
  const finalize = once(cleanup);

  nodeStream.on("close", () => {
    finalize().catch(logCleanupError);
  });
  nodeStream.on("error", () => {
    finalize().catch(logCleanupError);
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${fileName}.mp3"`,
      "Content-Length": String(contentLength),
    },
  });
}

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}

function once(callback: () => Promise<void>): () => Promise<void> {
  let didRun = false;

  return async () => {
    if (didRun) {
      return;
    }

    didRun = true;
    await callback();
  };
}

function logCleanupError(error: unknown): void {
  console.error("Failed to clean up extraction temp files.", error);
}