import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

const OPENROUTER_KEY_SETTING = "openrouter_api_key";
const OPENROUTER_MODEL_SETTING = "openrouter_model";
const GEMINI_KEY_SETTING = "gemini_api_key";
const GEMINI_MODEL_SETTING = "gemini_model";

function readSetting(ctx: QueryCtx | MutationCtx, key: string): Promise<string | null> {
  return ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first()
    .then((row) => (row ? row.value : null));
}

async function writeSetting(ctx: MutationCtx, key: string, value: string) {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (row) {
    await ctx.db.patch(row._id, { value, updatedAt: Date.now() });
  } else {
    await ctx.db.insert("appSettings", { key, value, updatedAt: Date.now() });
  }
}

function maskApiKey(raw: string | null): string | null {
  if (!raw) return null;
  return raw.length > 8 ? `sk-...${raw.slice(-4)}` : raw.slice(0, 4) + "****";
}

function maskGeminiKey(raw: string | null): string | null {
  if (!raw) return null;
  return raw.length > 8 ? `AIza...${raw.slice(-4)}` : raw.slice(0, 4) + "****";
}

const ADMIN_UNLOCK_WINDOW_MS = 12 * 60 * 60 * 1000;

async function requireAdminMutation(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin" || user.disabled) throw new Error("Admin access required");
  if (!user.adminUnlockedAt || Date.now() - user.adminUnlockedAt > ADMIN_UNLOCK_WINDOW_MS) {
    throw new Error("Admin console is locked — enter the admin password");
  }
  return user;
}

async function requireAdminQuery(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin" || user.disabled) throw new Error("Admin access required");
  return user;
}

/**
 * Raw provider config for the AI action. Internal only — the keys never reach
 * the browser; the admin UI reads the masked status query below.
 */
export const readProviderSettings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [openrouterKey, openrouterModel, geminiKey, geminiModel] = await Promise.all([
      readSetting(ctx, OPENROUTER_KEY_SETTING),
      readSetting(ctx, OPENROUTER_MODEL_SETTING),
      readSetting(ctx, GEMINI_KEY_SETTING),
      readSetting(ctx, GEMINI_MODEL_SETTING),
    ]);
    return {
      openrouterKey: (openrouterKey ?? "").trim(),
      openrouterModel: (openrouterModel ?? "").trim(),
      geminiKey: (geminiKey ?? "").trim(),
      geminiModel: (geminiModel ?? "").trim(),
    };
  },
});

export const getAiProviderStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);

    const [openrouterKey, openrouterModel, geminiKey, geminiModel] = await Promise.all([
      readSetting(ctx, OPENROUTER_KEY_SETTING),
      readSetting(ctx, OPENROUTER_MODEL_SETTING),
      readSetting(ctx, GEMINI_KEY_SETTING),
      readSetting(ctx, GEMINI_MODEL_SETTING),
    ]);

    return {
      openrouter: {
        configured: !!openrouterKey,
        hasModelOverride: !!openrouterModel,
        modelOverride: openrouterModel ?? null,
        masked: maskApiKey(openrouterKey),
      },
      gemini: {
        configured: !!geminiKey,
        hasModelOverride: !!geminiModel,
        modelOverride: geminiModel ?? null,
        masked: maskGeminiKey(geminiKey),
      },
      note:
        "Keys are stored in Convex appSettings and read by the AI action at runtime via process.env. Set them in Settings → API keys first; this panel only controls model overrides and shows masked status.",
    };
  },
});

export const saveOpenRouterKey = mutation({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const value = args.key?.trim() || "";
    if (value && !/^[a-zA-Z0-9_-]{8,}$/.test(value)) {
      throw new Error("OpenRouter key does not look right — check Settings → API keys.");
    }
    await writeSetting(ctx, OPENROUTER_KEY_SETTING, value);
    return { ok: true };
  },
});

export const saveOpenRouterModel = mutation({
  args: { model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const value = args.model?.trim() || "";
    await writeSetting(ctx, OPENROUTER_MODEL_SETTING, value);
    return { ok: true };
  },
});

export const saveGeminiKey = mutation({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const value = args.key?.trim() || "";
    if (value && !/^[a-zA-Z0-9_-]{8,}$/.test(value)) {
      throw new Error("Gemini key does not look right — check Settings → API keys.");
    }
    await writeSetting(ctx, GEMINI_KEY_SETTING, value);
    return { ok: true };
  },
});

export const saveGeminiModel = mutation({
  args: { model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdminMutation(ctx);
    const value = args.model?.trim() || "";
    await writeSetting(ctx, GEMINI_MODEL_SETTING, value);
    return { ok: true };
  },
});

/**
 * One-time key bootstrap from the CLI (`convex run`). Accepts the provider slug
 * and the secret so a key can be installed without a browser session; the key
 * lands in appSettings and is read by the AI action at runtime.
 */
export const setProviderKeyInternal = internalMutation({
  args: {
    provider: v.union(v.literal("openrouter"), v.literal("gemini")),
    key: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const value = args.key.trim();
    if (!/^[A-Za-z0-9_-]{8,}$/.test(value)) throw new Error("That key does not look valid");

    const keySetting = args.provider === "openrouter" ? OPENROUTER_KEY_SETTING : GEMINI_KEY_SETTING;
    const modelSetting = args.provider === "openrouter" ? OPENROUTER_MODEL_SETTING : GEMINI_MODEL_SETTING;
    await writeSetting(ctx, keySetting, value);
    if (args.model !== undefined) await writeSetting(ctx, modelSetting, args.model.trim());

    return {
      provider: args.provider,
      saved: true,
      masked: args.provider === "openrouter" ? maskApiKey(value) : maskGeminiKey(value),
    };
  },
});

/** Mirror Convex appSettings keys into process.env so the AI action uses the same source of truth. */
export const syncAiProviderEnv = internalMutation({
  args: {},
  handler: async (ctx) => {
    const [openrouterKey, openrouterModel, geminiKey, geminiModel] = await Promise.all([
      readSetting(ctx, OPENROUTER_KEY_SETTING),
      readSetting(ctx, OPENROUTER_MODEL_SETTING),
      readSetting(ctx, GEMINI_KEY_SETTING),
      readSetting(ctx, GEMINI_MODEL_SETTING),
    ]);
    process.env.OPENROUTER_API_KEY = openrouterKey ?? "";
    process.env.OPENROUTER_MODEL = openrouterModel ?? "";
    process.env.GEMINI_API_KEY = geminiKey ?? "";
    process.env.GEMINI_MODEL = geminiModel ?? "";
    return {
      openrouter: !!openrouterKey,
      gemini: !!geminiKey,
      vly: !!process.env.VLY_INTEGRATION_KEY,
    };
  },
});
