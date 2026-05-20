import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_BITRATE = 192;

export type ExtractRequest =
  | {
      url: string;
      bitrate?: number;
    }
  | {
      fileName?: string;
      fileBuffer: Buffer;
      bitrate?: number;
    };

export type ExtractResult = {
  buffer: Buffer;
  fileName: string;
};

export class ExtractApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ExtractApiError";
  }
}

export async function extractAudio(input: ExtractRequest): Promise<ExtractResult> {
  const tempDir = path.join(os.tmpdir(), `audiograb-${randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    if ("url" in input) {
      return await extractFromUrl(tempDir, input.url, input.bitrate);
    }

    return await extractFromFile(tempDir, input.fileBuffer, input.fileName, input.bitrate);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function extractFromUrl(
  tempDir: string,
  url: string,
  bitrate = DEFAULT_BITRATE,
): Promise<ExtractResult> {
  assertHttpUrl(url);

  const outputTemplate = path.join(tempDir, "downloaded.%(ext)s");
  const requestedTitle = await getVideoTitle(url);

  await runCommand(
    "yt-dlp",
    [
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      String(bitrate),
      "--no-playlist",
      "-o",
      outputTemplate,
      url,
    ],
    "URL extraction failed.",
  );

  const outputPath = await findSingleMp3(tempDir);
  const buffer = await fs.readFile(outputPath);

  return {
    buffer,
    fileName: sanitizeFileName(requestedTitle || path.basename(outputPath, path.extname(outputPath))),
  };
}

async function extractFromFile(
  tempDir: string,
  fileBuffer: Buffer,
  fileName?: string,
  bitrate = DEFAULT_BITRATE,
): Promise<ExtractResult> {
  const sourceName = fileName?.trim() || "upload.bin";
  const inputPath = path.join(tempDir, `input-${randomUUID()}${path.extname(sourceName)}`);
  const outputPath = path.join(tempDir, "output.mp3");

  await fs.writeFile(inputPath, fileBuffer);
  await runCommand(
    "ffmpeg",
    ["-y", "-i", inputPath, "-vn", "-b:a", `${bitrate}k`, outputPath],
    "File conversion failed.",
  );

  const buffer = await fs.readFile(outputPath);

  return {
    buffer,
    fileName: sanitizeFileName(path.basename(sourceName, path.extname(sourceName))),
  };
}

async function getVideoTitle(url: string): Promise<string | undefined> {
  try {
    const { stdout } = await runCommand(
      "yt-dlp",
      ["--print", "title", "--no-playlist", url],
      "Unable to read video title.",
      false,
    );
    return stdout.split(/\r?\n/).find(Boolean)?.trim();
  } catch {
    return undefined;
  }
}

async function findSingleMp3(tempDir: string): Promise<string> {
  const entries = await fs.readdir(tempDir);
  const mp3Name = entries.find((entry) => entry.toLowerCase().endsWith(".mp3"));

  if (!mp3Name) {
    throw new ExtractApiError("CONVERSION_FAILED", 422, "No MP3 output was produced.");
  }

  return path.join(tempDir, mp3Name);
}

function assertHttpUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ExtractApiError("INVALID_URL", 400, "Only http and https URLs are supported.");
    }
  } catch (error) {
    if (error instanceof ExtractApiError) {
      throw error;
    }

    throw new ExtractApiError("INVALID_URL", 400, "Provide a valid URL.");
  }
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "audio";
}

async function runCommand(
  command: string,
  args: string[],
  genericMessage: string,
  classifyErrors = true,
): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new ExtractApiError("INTERNAL_ERROR", 500, `${command} is not installed on the server.`));
        return;
      }

      reject(new ExtractApiError("INTERNAL_ERROR", 500, error.message));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      if (!classifyErrors) {
        reject(new ExtractApiError("CONVERSION_FAILED", 422, genericMessage));
        return;
      }

      reject(classifyCommandFailure(stderr, genericMessage));
    });
  });
}

function classifyCommandFailure(stderr: string, genericMessage: string): ExtractApiError {
  if (/sign in|bot detected|http error 429|too many requests/i.test(stderr)) {
    return new ExtractApiError("BOT_BLOCKED", 422, "The source platform blocked this download.");
  }

  if (/unsupported url|no video formats|unsupported site/i.test(stderr)) {
    return new ExtractApiError("UNSUPPORTED_URL", 422, "The provided URL is not supported.");
  }

  return new ExtractApiError("CONVERSION_FAILED", 422, genericMessage);
}