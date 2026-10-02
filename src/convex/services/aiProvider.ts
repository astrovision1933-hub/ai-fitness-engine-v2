import { action } from "../_generated/server";
import { v } from "convex/values";
import { createVlyIntegrations } from "@vly-ai/integrations";

/**
 * AI provider abstraction. The engine never talks to a vendor directly;
 * every call goes through this action so models/providers can be swapped
 * without touching services.
 *
 * Provider chain — the first configured provider that answers wins:
 *   1. OPENROUTER_API_KEY — OpenRouter. Model defaults to `openrouter/free`,
 *      the free-pool router (auto-picks among available free models, so one
 *      rate-limited model can't take the bot down). Override: OPENROUTER_MODEL.
 *   2. GEMINI_API_KEY — Google AI Studio free tier (default: gemini-3.8-flash,
 *      free of charge). Override: GEMINI_MODEL.
 *   3. VLY_INTEGRATION_KEY — platform default (gpt-4o-mini).
 *
 * A failing provider falls through to the next one; only when every provider
 * fails (or none is configured) does the action throw.
 */

const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const CALL_TIMEOUT_MS = 20_000;

type ChatMessage = { role: "user" | "assistant"; content: string };

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${detail ? ` ${detail.slice(0, 160)}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Some free models wrap their reasoning in  thinking... response — strip it. */
function cleanText(raw: string): string {
  return raw.replace(/<think[\s\S]*?<\/think>/gi, "").trim();
}

async function completeWithOpenRouter(
  system: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;

  const data = (await postJson(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      Authorization: `Bearer ${key}`,
      "X-Title": "AI Fitness Engine",
    },
    {
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature,
      max_tokens: maxTokens,
    },
  )) as { choices?: Array<{ message?: { content?: string } }> };

  const text = cleanText(data.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error(`OpenRouter (${model}) returned an empty response`);
  return text;
}

async function completeWithGemini(
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

  const data = (await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { "x-goog-api-key": key },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      // Gemini 3 models are tuned for their default temperature — leave it.
      generationConfig: { maxOutputTokens: maxTokens },
    },
  )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

  const text = cleanText(
    (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
  );
  if (!text) throw new Error(`Gemini (${model}) returned an empty response`);
  return text;
}

async function completeWithVly(
  system: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const deploymentToken = process.env.VLY_INTEGRATION_KEY;
  if (!deploymentToken) throw new Error("VLY_INTEGRATION_KEY is not set");

  const vly = createVlyIntegrations({ deploymentToken });
  const result = await vly.ai.completion({
    model: "gpt-4o-mini",
    messages: [{ role: "system" as const, content: system }, ...messages],
    temperature,
    maxTokens,
  });

  if (!result.success || !result.data) {
    throw new Error(result.error ?? "AI provider returned no data");
  }
  const text = result.data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("AI provider returned an empty response");
  return text;
}

export const aiComplete = action({
  args: {
    system: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      }),
    ),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
  },
  handler: async (_ctx, args): Promise<{ text: string; provider: string }> => {
    const temperature = args.temperature ?? 0.7;
    const maxTokens = args.maxTokens ?? 700;
    const failures: string[] = [];

    // 1. OpenRouter — user preference #1 (free-pool router by default).
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const text = await completeWithOpenRouter(args.system, args.messages, temperature, maxTokens);
        const model = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
        return { text, provider: `openrouter:${model}` };
      } catch (err) {
        failures.push(`openrouter (${err instanceof Error ? err.message : String(err)})`);
      }
    }

    // 2. Gemini free tier.
    if (process.env.GEMINI_API_KEY) {
      try {
        const text = await completeWithGemini(args.system, args.messages, maxTokens);
        const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
        return { text, provider: `gemini:${model}` };
      } catch (err) {
        failures.push(`gemini (${err instanceof Error ? err.message : String(err)})`);
      }
    }

    // 3. Platform default.
    if (process.env.VLY_INTEGRATION_KEY) {
      try {
        const text = await completeWithVly(args.system, args.messages, temperature, maxTokens);
        return { text, provider: "vly:gpt-4o-mini" };
      } catch (err) {
        failures.push(`vly (${err instanceof Error ? err.message : String(err)})`);
      }
    }

    throw new Error(
      failures.length
        ? `All AI providers failed — ${failures.join(" | ")}`
        : "No AI provider configured — add OPENROUTER_API_KEY or GEMINI_API_KEY under Keys → API keys.",
    );
  },
});
