/**
 * Rough cost estimate per extraction call, logged to extraction_log for cost
 * control. Rates are USD per 1M tokens and configurable via env — set them to
 * Groq's published price for the model in use. Defaults are placeholders.
 */
const IN_RATE_PER_M = Number(process.env.GROQ_IN_RATE_PER_M ?? 0.3);
const OUT_RATE_PER_M = Number(process.env.GROQ_OUT_RATE_PER_M ?? 0.5);

export function estimateCost(
  inTokens: number | null,
  outTokens: number | null,
): number {
  const i = inTokens ?? 0;
  const o = outTokens ?? 0;
  return (i / 1_000_000) * IN_RATE_PER_M + (o / 1_000_000) * OUT_RATE_PER_M;
}
