import { extractAudio, ExtractApiError } from "@/lib/extract-audio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 200 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { url?: unknown; bitrate?: unknown };
      const url = typeof body.url === "string" ? body.url.trim() : "";
      const bitrate = toBitrate(body.bitrate);

      if (!url) {
        return jsonError("Provide a URL to extract audio.", "MISSING_INPUT", 400);
      }

      const result = await extractAudio({ url, bitrate });
      return mp3Response(result.buffer, result.fileName);
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

        return mp3Response(result.buffer, result.fileName);
      }

      if (typeof url === "string" && url.trim()) {
        const result = await extractAudio({ url: url.trim(), bitrate });
        return mp3Response(result.buffer, result.fileName);
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

function mp3Response(buffer: Buffer, fileName: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${fileName}.mp3"`,
      "Content-Length": String(buffer.length),
    },
  });
}

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code }, { status });
}