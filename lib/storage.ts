import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Local stand-in for object storage. Callers use these helpers so files can move later.
const MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);

const DOCUMENT_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".doc", ".docx"]);

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

export function uploadDir(): string {
  return path.join(process.cwd(), "uploads");
}

export function resolveStoredFile(storedName: string): string | null {
  if (!/^[a-f0-9]{32}(?:\.[a-z0-9]{1,8})?$/.test(storedName)) return null;
  return path.join(uploadDir(), storedName);
}

export function uploadProblem(file: File): string | null {
  if (file.size === 0) return "Choose a file.";
  if (file.size > MAX_BYTES) return "File must be 10 MB or smaller.";
  const extension = path.extname(file.name).toLowerCase();
  if (!DOCUMENT_EXTENSIONS.has(extension)) return "Upload a PDF, image, text file, or Word document.";
  return null;
}

export function videoUploadProblem(file: File): string | null {
  if (file.size === 0) return "Choose a video.";
  if (file.size > MAX_BYTES) return "Video must be 10 MB or smaller.";
  const extension = path.extname(file.name).toLowerCase();
  if (!VIDEO_EXTENSIONS.has(extension)) return "Upload an MP4, WebM, or MOV video.";
  return null;
}

export function imageUploadProblem(file: File): string | null {
  if (file.size === 0) return "Choose an image.";
  if (file.size > MAX_BYTES) return "Image must be 10 MB or smaller.";
  const extension = path.extname(file.name).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return "Upload a PNG, JPEG, WebP, or GIF.";
  return null;
}

export function fileBaseName(name: string): string {
  const base = name.split(/[/\\]/).pop()?.trim() ?? "";
  return base.slice(0, 180);
}

export async function saveBytes(bytes: Uint8Array, extension: ".pdf"): Promise<string> {
  if (extension !== ".pdf") throw new Error("Could not store that file.");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error("Could not store that file.");
  const storedName = `${randomBytes(16).toString("hex")}${extension}`;
  await mkdir(uploadDir(), { recursive: true });
  const full = resolveStoredFile(storedName);
  if (!full) throw new Error("Could not store that file.");
  await writeFile(full, bytes);
  return storedName;
}

export async function saveUpload(
  file: File,
  kind: "file" | "image" | "video" = "file",
): Promise<{ storedName: string; originalName: string }> {
  const problem =
    kind === "image" ? imageUploadProblem(file) : kind === "video" ? videoUploadProblem(file) : uploadProblem(file);
  if (problem) throw new Error(problem);
  const extension = path.extname(file.name).toLowerCase();
  const storedName = `${randomBytes(16).toString("hex")}${extension}`;
  await mkdir(uploadDir(), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const full = resolveStoredFile(storedName);
  if (!full) throw new Error("Could not store that file.");
  await writeFile(full, bytes);
  return { storedName, originalName: fileBaseName(file.name) || "file" };
}

export async function readStoredFile(storedName: string): Promise<Buffer | null> {
  const full = resolveStoredFile(storedName);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

export async function removeUpload(storedName: string | null): Promise<void> {
  if (!storedName) return;
  const full = resolveStoredFile(storedName);
  if (!full) return;
  await unlink(full).catch(() => undefined);
}

export function contentTypeFor(storedName: string): string {
  return CONTENT_TYPES[path.extname(storedName).toLowerCase()] ?? "application/octet-stream";
}

export function contentDisposition(filename: string, inline = false): string {
  const cleaned = filename.replace(/["\r\n\\]/g, "");
  const kind = inline ? "inline" : "attachment";
  return `${kind}; filename="${cleaned}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
