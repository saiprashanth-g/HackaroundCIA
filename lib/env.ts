/**
 * Centralized env access. The human provisions Supabase + Groq manually and
 * wires these via .env.local — we never scaffold provisioning. Everything is
 * read here so the rest of the app can ask `isSupabaseConfigured` /
 * `isGroqConfigured` and degrade gracefully instead of crashing when a service
 * isn't wired yet (important for design QA before creds exist).
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "qwen/qwen3.6-27b",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

export const isGroqConfigured = Boolean(env.groqApiKey);
