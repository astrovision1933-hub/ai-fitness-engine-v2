import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  SUPPLEMENT_EDU,
  parseLabel,
  evaluateVerdict,
  computePriceIntel,
  PREVALENCE_STATEMENT,
} from "./services/supplements";
import { assessSafety } from "./services/safety";

/* ------------------------------------------------------------------ */
/* Education library                                                    */
/* ------------------------------------------------------------------ */

/** Curated supplement education (static, evidence-conservative). */
export const getEducationLibrary = query({
  args: {},
  handler: async () => SUPPLEMENT_EDU,
});

export const getSupplementEdu = query({
  args: { slug: v.string() },
  handler: async (_ctx, args) => {
    return SUPPLEMENT_EDU.find((s) => s.slug === args.slug) ?? null;
  },
});

/* ------------------------------------------------------------------ */
/* Label analysis (POST /supplements/analyze equivalent)                */
/* ------------------------------------------------------------------ */

/**
 * Analyze a supplement label. NOTE: this environment's AI is text-only —
 * image OCR is not available, so the scanner works on typed/pasted label
 * text and says so honestly in the UI.
 */
export const analyzeLabel = action({
  args: {
    rawLabel: v.string(),
    pricePaid: v.optional(v.number()),
    sizeGrams: v.optional(v.number()),
    servings: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ analysisId: string; verdict: ReturnType<typeof evaluateVerdict>; parsed: ReturnType<typeof parseLabel>; priceIntel: ReturnType<typeof computePriceIntel> | null; fitnessRelevance: string | null; prevalence: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const text = args.rawLabel.trim();
    if (text.length < 20) throw new Error("Paste more of the label text (at least a few lines).");
    if (text.length > 8000) throw new Error("Label text is too long — paste the key sections.");

    // Safety layer runs before anything else (PED/dangerous requests).
    const safety = assessSafety(text);
    if (safety.flagged) {
      throw new Error(safety.response ?? "This request cannot be processed.");
    }

    const parsed = parseLabel(text);

    // Price intelligence — computed BEFORE the verdict, and never fed into it.
    const priceIntel = args.pricePaid
      ? computePriceIntel({
          price: args.pricePaid,
          servings: args.servings ?? undefined,
          sizeGrams: args.sizeGrams ?? undefined,
          proteinPerServingG: parsed.proteinG,
        })
      : null;

    const result = evaluateVerdict({ parsed });

    // Persist the analysis + ingredients + sources as one transaction.
    const analysisId = await ctx.runMutation(internal.supplementStore.saveAnalysis, {
      userId,
      inputType: "typed",
      rawLabel: text.slice(0, 6000),
      parsed,
      verdict: result.verdict,
      evidenceChecked: result.evidenceChecked,
      evidenceMissing: result.evidenceMissing,
      redFlags: result.redFlags,
      verificationSteps: result.verificationSteps,
      priceIntel: priceIntel ?? undefined,
    });

    // AI FITNESS RELEVANCE — context-aware enrichment (best-effort).
    let fitnessRelevance: string | null = null;
    try {
      const bundle = await ctx.runQuery(internal.coachContext.getContextBundle, { userId });
      const ai = await ctx.runAction(api.services.aiProvider.aiComplete, {
        system: [
          "You are the supplement-relevance module of an AI fitness coach.",
          "Given the user's profile/context and a scanned supplement label, answer in <=110 words:",
          "1) Is this product category relevant to the user's current goal and diet? Why / why not?",
          "2) One practical note on how it would (or would not) fit.",
          "RULES: Never diagnose. Never give medical claims. Never declare the product genuine or fake.",
          "Never comment on authenticity — a separate evidence module already did that.",
          "Label uncertain statements with 'may' or 'unclear'. Recommend professional advice for medical conditions, pregnancy or medications.",
        ].join("\n"),
        messages: [
          {
            role: "user" as const,
            content: `USER CONTEXT:\n${bundle.summary}\n\nLABEL ANALYSIS:\nproduct=${parsed.productName ?? "unknown"}; brand=${parsed.brand ?? "unknown"}; category=${parsed.category ?? "unknown"}; serving=${parsed.servingSize ?? "unknown"}; protein=${parsed.proteinG ?? "?"}g; ingredients=${parsed.ingredientNames.slice(0, 12).join(", ") || "not parsed"}`,
          },
        ],
        temperature: 0.5,
        maxTokens: 260,
      });
      fitnessRelevance = ai.text;
    } catch {
      fitnessRelevance = null; // deterministic verdict already saved; AI layer is enrichment only
    }

    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "supplement_analyzed",
      detail: `verdict=${result.verdict}; product=${parsed.productName ?? "unknown"}`,
    });
    await ctx.runMutation(internal.services.lead.recordLeadSignal, {
      userId,
      signal: "supplement_analyzed",
      minRank: 1,
    });

    return { analysisId, verdict: result, parsed, priceIntel, fitnessRelevance, prevalence: PREVALENCE_STATEMENT };
  },
});

/* ------------------------------------------------------------------ */
/* Verification (POST /supplements/verify equivalent)                   */
/* ------------------------------------------------------------------ */

/**
 * Record a verification attempt and return evidence-based instructions.
 * We never fabricate a verification result: without an authoritative check
 * the result stays "instructions_provided".
 */
export const verifySupplement = action({
  args: {
    method: v.union(
      v.literal("qr"),
      v.literal("auth_code"),
      v.literal("batch"),
      v.literal("official_website"),
      v.literal("manual"),
    ),
    identifier: v.string(),
    analysisId: v.optional(v.id("supplementAnalysis")),
  },
  handler: async (ctx, args): Promise<{ id: Id<"supplementVerifications">; status: "instructions_provided"; brandName: string | null; officialUrl: string | null; message: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!args.identifier.trim()) throw new Error("Enter the code / batch number / URL from the pack.");

    let brandName: string | null = null;
    let officialUrl: string | null = null;
    if (args.analysisId) {
      const analysis = await ctx.runQuery(internal.supplementStore.getAnalysisRow, {
        id: args.analysisId,
        userId,
      });
      if (analysis?.brand) brandName = analysis.brand;
    }

    const result = await ctx.runMutation(internal.supplementStore.saveVerification, {
      userId,
      analysisId: args.analysisId ?? undefined,
      method: args.method,
      identifier: args.identifier.slice(0, 120),
    });

    return {
      id: result.id,
      status: "instructions_provided" as const,
      brandName,
      officialUrl,
      message:
        "Recorded. This engine cannot confirm authenticity on its own — complete the check on the brand's official verification channel (QR page, auth-code portal, or customer support with the batch number). Only an authoritative confirmation from the brand/regulator counts as verification.",
    };
  },
});

/* ------------------------------------------------------------------ */
/* User history                                                         */
/* ------------------------------------------------------------------ */

export const getMyAnalyses = query({
  args: { limit: v.optional(v.number()), nonce: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("supplementAnalysis")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const getMyVerifications = query({
  args: { nonce: v.optional(v.number()) },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("supplementVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

export const getAnalysisIngredients = query({
  args: { analysisId: v.id("supplementAnalysis") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis || analysis.userId !== userId) return [];
    return await ctx.db
      .query("supplementIngredients")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();
  },
});
