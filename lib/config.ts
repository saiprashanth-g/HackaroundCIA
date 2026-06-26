/** App-wide constants: upload caps, accepted types, cost controls. */
export const APP = {
  name: "HackaroundCIA",

  // Upload caps (per-student batch). Enforced client + server side.
  maxFilesPerBatch: Number(process.env.MAX_FILES_PER_BATCH ?? 5),
  maxFileMB: Number(process.env.MAX_FILE_MB ?? 8),

  // Accepted course-plan formats: PDFs, photos/scans (multimodal), and docx.
  acceptedMimes: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ] as string[],

  // Cost control: minimum gap between re-extractions of the same document.
  reextractCooldownMs: 60_000,
} as const;

export function maxFileBytes() {
  return APP.maxFileMB * 1024 * 1024;
}
