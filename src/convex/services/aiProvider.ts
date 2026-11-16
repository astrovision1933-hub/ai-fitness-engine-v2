import { action, internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { createVlyIntegrations } from "@vly-ai/integrations";

/**
 * AI provider abstraction. The engine never talks to a vendor directly;
 * every call goes through this action so models/providers can be swapped
 * without touching services.
 *
 * Provider chain — the first model that answers wins:
 *   1. OPENROUTER_API_KEY — OpenRouter free models. The free catalog is fetched
 *      live from /api/v1/models every 10 minutes, so free models OpenRouter
 *      adds later are picked up automatically — no code change needed. Models
 *      are tried fastest-first using the reply latency measured on previous
 *      calls; a failing / rate-limited model is skipped for 2 minutes and the
 *      next model answers immediately. Override the head of the chain with
 *      OPENROUTER_MODEL (e.g. "openrouter/free").
 *   2. GEMINI_API_KEY — Google AI Studio free tier. Its model list is also
 *      fetched live (flash → flash-lite → others), and a retired or failing
 *      model falls through to the next Gemini model instantly. Override:
 *      GEMINI_MODEL.
 *   3. VLY_INTEGRATION_KEY — platform default (gpt-4o-mini).
 *
 * Only when every provider fails (or none is configured) does the action throw.
 */

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const CATALOG_TTL_MS = 10 * 60_000;
const CATALOG_TIMEOUT_MS = 8_000;
const OPENROUTER_TIMEOUT_MS = 12_000;
const GEMINI_TIMEOUT_MS = 20_000;
const ACTION_BUDGET_MS = 55_000;
const MIN_ATTEMPT_MS = 2_500;
const MAX_OPENROUTER_ATTEMPTS = 3;
const MAX_GEMINI_ATTEMPTS = 2;
const FAILURE_COOLDOWN_MS = 2 * 60_000;
const UNMEASURED_LATENCY_MS = 3_000;

const OPENROUTER_KEY_ENV = process.env.OPENROUTER_API_KEY?.trim() || "";
const OPENROUTER_MODEL_ENV = process.env.OPENROUTER_MODEL?.trim() || "";
const GEMINI_KEY_ENV = process.env.GEMINI_API_KEY?.trim() || "";
const GEMINI_MODEL_ENV = process.env.GEMINI_MODEL?.trim() || "";

const OPENROUTER_KEY_SETTING = "openrouter_api_key";
const OPENROUTER_MODEL_SETTING = "openrouter_model";
const GEMINI_KEY_SETTING = "gemini_api_key";
const GEMINI_MODEL_SETTING = "gemini_model";

const resolveOpenRouterKey = async (ctx: MutationCtx): Promise<string> => {
  if (OPENROUTER_KEY_ENV) return OPENROUTER_KEY_ENV;
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", OPENROUTER_KEY_SETTING))
    .first();
  return (row?.value ?? "").trim();
};

const resolveOpenRouterModel = async (ctx: MutationCtx): Promise<string | undefined> => {
  if (OPENROUTER_MODEL_ENV) return OPENROUTER_MODEL_ENV;
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", OPENROUTER_MODEL_SETTING))
    .first();
  const value = (row?.value ?? "").trim();
  return value || undefined;
};

const resolveGeminiKey = async (ctx: MutationCtx): Promise<string> => {
  if (GEMINI_KEY_ENV) return GEMINI_KEY_ENV;
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", GEMINI_KEY_SETTING))
    .first();
  return (row?.value ?? "").trim();
};

const resolveGeminiModel = async (ctx: MutationCtx): Promise<string | undefined> => {
  if (GEMINI_MODEL_ENV) return GEMINI_MODEL_ENV;
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", GEMINI_MODEL_SETTING))
    .first();
  const value = (row?.value ?? "").trim();
  return value || undefined;
};

/**
 * Seed order used only to break ties between models that have no measured
 * latency yet. Availability is never limited to this list — the live free
 * catalog is the source of truth, so new free models join the pool by
 * themselves and then earn their position through measured latency.
 */
const FAST_FREE_MODELS = [
  "inclusionai/ling-3.2-flash:free",
  "nvidia/nemotron-3.5-lightning:free",
  "baidu/ernie-5.5-flash-preview:free",
  "liquid/lfm-3-1.7b:free",
  "thinkingmachines/inkling-2-small:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "cohere/north-mini-code:free",
  "dots-studio/dots-3-note-preview:free",
  "recursive/flint-v1.0:free",
  "particle-ai/particle-1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "openrouter/free",
];

const GEMINI_FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

type ChatMessage = { role: "user" | "assistant"; content: string };
type OpenRouterModel = { id: string; created: number };
type ModelStat = { model: string; avgLatencyMs: number; samples: number; lastFailedAt?: number };

let openRouterCatalog: { at: number; models: OpenRouterModel[] } | null = null;
let geminiCatalog: { at: number; models: string[] } | null = null;

async function getJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${detail ? ` ${detail.slice(0, 160)}` : ""}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

/** Some free models wrap their reasoning in  thinking...</think> — strip it. */
function cleanText(raw: string): string {
  return raw.replace(/<think[\s\S]*?<\/think>/gi, "").trim();
}

function isZeroPrice(value: string | undefined): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

/**
 * Live free-model catalog. Filtering keeps text-in/text-out chat models that
 * cost nothing; everything else (audio, embeddings, paid) is dropped. Newly
 * published free models are sorted ahead of older community models and then
 * integrated into latency ranking like any other model.
 */
async function discoverOpenRouterFreeModels(): Promise<OpenRouterModel[]> {
  if (openRouterCatalog && Date.now() - openRouterCatalog.at < CATALOG_TTL_MS) {
    return openRouterCatalog.models;
  }

  try {
    const data = (await getJson(OPENROUTER_MODELS_URL, {}, CATALOG_TIMEOUT_MS)) as {
      data?: Array<{
        id?: string;
        created?: number;
        pricing?: { prompt?: string; completion?: string };
        architecture?: { output_modalities?: string[] | null };
      }>;
    };

    const models: OpenRouterModel[] = [];
    for (const entry of data.data ?? []) {
      if (!entry.id) continue;
      if (!isZeroPrice(entry.pricing?.prompt) || !isZeroPrice(entry.pricing?.completion)) continue;
      const outputs = entry.architecture?.output_modalities;
      // Text reply models only — excludes free music/audio generators.
      if (outputs && (outputs.length !== 1 || outputs[0] !== "text")) continue;
      models.push({ id: entry.id, created: entry.created ?? 0 });
    }
    if (!models.length) throw new Error("catalog contained no free text models");

    const seedRank = new Map(FAST_FREE_MODELS.map((id, index) => [id, index]));
    models.sort((a, b) => {
      const rankA = seedRank.get(a.id);
      const rankB = seedRank.get(b.id);
      if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
      if (rankA !== undefined) return -1;
      if (rankB !== undefined) return 1;
      return b.created - a.created; // newest free models get tried first
    });

    openRouterCatalog = { at: Date.now(), models };
    return models;
  } catch {
    return openRouterCatalog?.models ?? FAST_FREE_MODELS.map((id) => ({ id, created: 0 }));
  }
}

/**
 * Fastest-first ordering: proven-fast models lead, unmeasured models start at
 * a neutral prior so they get a chance, and models that just failed go to the
 * back for a short cooldown.
 */
function rankOpenRouterModels(
  models: OpenRouterModel[],
  stats: ModelStat[],
  forcedModel: string | undefined,
): string[] {
  const now = Date.now();
  const statByModel = new Map(stats.map((stat) => [stat.model, stat]));

  const ranked = models
    .map((model, index) => {
      const stat = statByModel.get(model.id);
      const cooling = stat?.lastFailedAt !== undefined && now - stat.lastFailedAt < FAILURE_COOLDOWN_MS;
      const latency = stat && stat.samples > 0 ? stat.avgLatencyMs : UNMEASURED_LATENCY_MS;
      return { id: model.id, index, cooling: cooling ? 1 : 0, latency };
    })
    .sort((a, b) => a.cooling - b.cooling || a.latency - b.latency || a.index - b.index)
    .map((entry) => entry.id);

  if (!forcedModel) return ranked;
  return [forcedModel, ...ranked.filter((id) => id !== forcedModel)];
}

/** Fastest Gemini chat models first: lite → flash → others, newest version first. */
function geminiSpeedRank(a: string, b: string): number {
  const tier = (id: string) => (id.includes("lite") ? 0 : id.includes("flash") ? 1 : 2);
  const diff = tier(a) - tier(b);
  if (diff !== 0) return diff;
  return b.localeCompare(a, undefined, { numeric: true });
}

/** Live Gemini model list so retired models never break the fallback chain. */
async function discoverGeminiModels(key: string): Promise<string[]> {
  if (geminiCatalog && Date.now() - geminiCatalog.at < CATALOG_TTL_MS) {
    return geminiCatalog.models;
  }

  try {
    const data = (await getJson(
      `${GEMINI_MODELS_URL}?pageSize=1000`,
      { "x-goog-api-key": key },
      CATALOG_TIMEOUT_MS,
    )) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };

    const models = (data.models ?? [])
      .filter((entry) => (entry.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((entry) => (entry.name ?? "").replace(/^models\//, ""))
      .filter((id) => id.startsWith("gemini-"))
      .filter((id) => !/(embedding|embed|tts|image|audio|live|robotics)/i.test(id));

    if (!models.length) throw new Error("no Gemini chat models available");

    const ranked = models.sort(geminiSpeedRank);
    geminiCatalog = { at: Date.now(), models: ranked };
    return ranked;
  } catch {
    return geminiCatalog?.models ?? GEMINI_FALLBACK_MODELS;
  }
}

async function completeWithOpenRouter(
  key: string,
  model: string,
  system: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  const data = (await postJson(
    OPENROUTER_CHAT_URL,
    {
      Authorization: `Bearer ${key}`,
      "X-Title": "AI Fitness Engine",
    },
    {
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature,
      max_tokens: maxTokens,
      // Ask OpenRouter to route this model to its fastest healthy upstream.
      provider: { sort: "throughput", allow_fallbacks: true },
    },
    timeoutMs,
  )) as { error?: { message?: string }; choices?: Array<{ message?: { content?: string } }> };

  if (data.error?.message) throw new Error(data.error.message);
  const text = cleanText(data.choices?.[0]?.message?.content ?? "");
  if (!text) throw new Error(`${model} returned an empty response`);
  return text;
}

async function completeWithGemini(
  key: string,
  model: string,
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  const data = (await postJson(
    `${GEMINI_MODELS_URL}/${model}:generateContent`,
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
    timeoutMs,
  )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

  const text = cleanText(
    (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
  );
  if (!text) throw new Error(`${model} returned an empty response`);
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

/* ------------------------------------------------------------------ */
/* Model speed telemetry (fastest model earns the first slot)          */
/* ------------------------------------------------------------------ */

export const listModelStats = internalQuery({
  args: { provider: v.string() },
  handler: async (ctx, args): Promise<ModelStat[]> => {
    const rows = await ctx.db
      .query("aiModelStats")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .collect();
    return rows.map((row) => ({
      model: row.model,
      avgLatencyMs: row.avgLatencyMs,
      samples: row.samples,
      lastFailedAt: row.lastFailedAt,
    }));
  },
});

export const recordModelResult = internalMutation({
  args: {
    provider: v.string(),
    model: v.string(),
    latencyMs: v.optional(v.number()),
    failed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("aiModelStats")
      .withIndex("by_provider_model", (q) =>
        q.eq("provider", args.provider).eq("model", args.model),
      )
      .first();

    if (!existing) {
      await ctx.db.insert("aiModelStats", {
        provider: args.provider,
        model: args.model,
        avgLatencyMs: args.latencyMs ?? 0,
        samples: args.latencyMs !== undefined ? 1 : 0,
        failures: args.failed ? 1 : 0,
        lastLatencyMs: args.latencyMs,
        lastUsedAt: now,
        lastFailedAt: args.failed ? now : undefined,
      });
      return;
    }

    const samples = existing.samples + (args.latencyMs !== undefined ? 1 : 0);
    const avgLatencyMs =
      args.latencyMs !== undefined
        ? Math.round((existing.avgLatencyMs * existing.samples + args.latencyMs) / Math.max(samples, 1))
        : existing.avgLatencyMs;

    await ctx.db.patch(existing._id, {
      avgLatencyMs,
      samples,
      failures: existing.failures + (args.failed ? 1 : 0),
      lastUsedAt: now,
      ...(args.latencyMs !== undefined ? { lastLatencyMs: args.latencyMs } : {}),
      ...(args.failed ? { lastFailedAt: now } : {}),
    });
  },
});

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
  handler: async (ctx, args): Promise<{ text: string; provider: string }> => {
    const temperature = args.temperature ?? 0.7;
    const maxTokens = args.maxTokens ?? 700;
    const failures: string[] = [];
    const deadline = Date.now() + ACTION_BUDGET_MS;
    const remainingMs = () => deadline - Date.now();

    // 1. OpenRouter free models — fastest measured model first. Each failure
    // records the failure and immediately moves to the next model, so a
    // rate-limited model never stalls the reply.
    const openrouterKey = await resolveOpenRouterKey(ctx as unknown as MutationCtx);
    if (openrouterKey) {
      const forcedModel = await resolveOpenRouterModel(ctx as unknown as MutationCtx);
      const models = await discoverOpenRouterFreeModels();
      const stats = await ctx
        .runQuery(internal.services.aiProvider.listModelStats, { provider: "openrouter" })
        .catch(() => [] as ModelStat[]);
      const ranked = rankOpenRouterModels(models, stats, forcedModel);

      for (const model of ranked.slice(0, MAX_OPENROUTER_ATTEMPTS)) {
        const timeoutMs = Math.min(OPENROUTER_TIMEOUT_MS, remainingMs());
        if (timeoutMs < MIN_ATTEMPT_MS) break;

        const startedAt = Date.now();
        try {
          const text = await completeWithOpenRouter(
            openrouterKey,
            model,
            args.system,
            args.messages,
            temperature,
            maxTokens,
            timeoutMs,
          );
          await ctx
            .runMutation(internal.services.aiProvider.recordModelResult, {
              provider: "openrouter",
              model,
              latencyMs: Date.now() - startedAt,
              failed: false,
            })
            .catch(() => undefined);
          return { text, provider: `openrouter:${model}` };
        } catch (err) {
          failures.push(
            `openrouter:${model} (${err instanceof Error ? err.message : String(err)})`,
          );
          await ctx
            .runMutation(internal.services.aiProvider.recordModelResult, {
              provider: "openrouter",
              model,
              failed: true,
            })
            .catch(() => undefined);
        }
      }
    }

    // 2. Gemini free tier — model-level fallback so a retired model does not
    // take the whole provider down.
    const geminiKey = await resolveGeminiKey(ctx as unknown as MutationCtx);
    if (geminiKey) {
      const forcedModel = await resolveGeminiModel(ctx as unknown as MutationCtx);
      const available = await discoverGeminiModels(geminiKey);
      const chain = forcedModel
        ? [forcedModel, ...available.filter((model) => model !== forcedModel)]
        : available;

      for (const model of chain.slice(0, MAX_GEMINI_ATTEMPTS)) {
        const timeoutMs = Math.min(GEMINI_TIMEOUT_MS, remainingMs());
        if (timeoutMs < MIN_ATTEMPT_MS) break;

        try {
          const text = await completeWithGemini(
            geminiKey,
            model,
            args.system,
            args.messages,
            maxTokens,
            timeoutMs,
          );
          return { text, provider: `gemini:${model}` };
        } catch (err) {
          failures.push(`gemini:${model} (${err instanceof Error ? err.message : String(err)})`);
        }
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
