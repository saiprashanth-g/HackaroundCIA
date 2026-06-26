import { env } from "@/lib/env";

/**
 * Minimal Groq client over the OpenAI-compatible REST endpoint. No SDK — full
 * control of the multimodal message shape (base64 image_url for photos/scans).
 * Extraction is the ONLY place an LLM is used in the runtime pipeline.
 */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GroqTextPart = { type: "text"; text: string };
export type GroqImagePart = { type: "image_url"; image_url: { url: string } };
export type GroqContentPart = GroqTextPart | GroqImagePart;

export type GroqUsage = { inTokens: number | null; outTokens: number | null };

export class GroqError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

/**
 * Calls Groq chat completions in JSON mode and returns the parsed JSON object
 * plus token usage. Throws GroqError on a non-2xx response or non-JSON content.
 */
export async function groqChatJSON(opts: {
  system: string;
  content: string | GroqContentPart[];
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<{ json: unknown; usage: GroqUsage }> {
  if (!env.groqApiKey) {
    throw new GroqError(0, "GROQ_API_KEY is not configured.");
  }

  const model = opts.model ?? env.groqModel;
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.content },
      ],
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GroqError(res.status, `Groq ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  const usage: GroqUsage = {
    inTokens: data.usage?.prompt_tokens ?? null,
    outTokens: data.usage?.completion_tokens ?? null,
  };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GroqError(0, "Model did not return valid JSON.");
  }

  return { json, usage };
}
