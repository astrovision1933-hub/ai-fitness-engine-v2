import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal, api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { computePriceIntel } from "./services/supplements";

/* ------------------------------------------------------------------ */
/* Catalog browsing (GET /products, /products/:id equivalents)          */
/* ------------------------------------------------------------------ */

export const listProducts = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx); // must be signed in to browse
    const rows = args.category
      ? await ctx.db
          .query("productCatalog")
          .withIndex("by_category", (q) => q.eq("category", args.category!))
          .collect()
      : await ctx.db.query("productCatalog").collect();
    return rows
      .filter((p) => p.isActive)
      .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
  },
});

export const getProduct = query({
  args: { id: v.id("productCatalog") },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const p = await ctx.db.get(args.id);
    return p && p.isActive ? p : null;
  },
});

/* ------------------------------------------------------------------ */
/* Price intelligence (user-entered brand/product/size/price)           */
/* ------------------------------------------------------------------ */

export const checkPrice = mutation({
  args: {
    brand: v.string(),
    product: v.string(),
    price: v.number(),
    sizeGrams: v.optional(v.number()),
    servings: v.optional(v.number()),
    proteinPerServingG: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.price <= 0) throw new Error("Enter the price you actually paid.");
    const intel = computePriceIntel({
      price: args.price,
      servings: args.servings,
      sizeGrams: args.sizeGrams,
      proteinPerServingG: args.proteinPerServingG,
    });
    return intel;
  },
});

/* ------------------------------------------------------------------ */
/* Comparison (POST /products/compare equivalent)                       */
/* ------------------------------------------------------------------ */

type Product = Doc<"productCatalog">;

function metricRows(a: Product, b: Product) {
  const rows: Array<{ label: string; a: string; b: string; note?: string }> = [];
  const push = (label: string, va: string | number | undefined, vb: string | number | undefined, note?: string) =>
    rows.push({
      label,
      a: va === undefined || va === "" ? "—" : String(va),
      b: vb === undefined || vb === "" ? "—" : String(vb),
      note,
    });

  const pps = (p: Product) =>
    p.servings && p.servings > 0 ? Math.round((p.price / p.servings) * 100) / 100 : undefined;
  const pppg = (p: Product) =>
    p.servings && p.servings > 0 && p.nutrition?.proteinG
      ? Math.round((p.price / p.servings / p.nutrition.proteinG) * 100) / 100
      : undefined;

  push("Brand", a.brand, b.brand);
  push("Category", a.category, b.category);
  push("Price", `₹${a.price}`, `₹${b.price}`);
  if (a.mrp || b.mrp) push("MRP", a.mrp ? `₹${a.mrp}` : "—", b.mrp ? `₹${b.mrp}` : "—");
  push("Size", a.sizeGrams ? `${a.sizeGrams}g` : "—", b.sizeGrams ? `${b.sizeGrams}g` : "—");
  push("Servings", a.servings ?? "—", b.servings ?? "—");
  push("Serving size", a.servingSize ?? "—", b.servingSize ?? "—");
  push("Price / serving", pps(a) ?? "—", pps(b) ?? "—", "lower is cheaper per use");
  push("Protein / serving (g)", a.nutrition?.proteinG ?? "—", b.nutrition?.proteinG ?? "—");
  push("Price / g protein", pppg(a) ?? "—", pppg(b) ?? "—", "meaningful for protein products");
  push("Calories / serving", a.nutrition?.calories ?? "—", b.nutrition?.calories ?? "—");
  push("Manufacturer", a.manufacturer ?? "—", b.manufacturer ?? "—");
  push("Verification method", a.verificationMethod ?? "not listed", b.verificationMethod ?? "not listed");
  push("Certifications claimed", a.benefits?.includes("certif") ? "see benefits" : "—", b.benefits?.includes("certif") ? "see benefits" : "—", "brand claims unless independently verified");
  return rows;
}

export const compareProducts = action({
  args: {
    productAId: v.id("productCatalog"),
    productBId: v.id("productCatalog"),
    useAi: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ metrics: Array<{ label: string; a: string; b: string; note?: string }>; summary: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.productAId === args.productBId) throw new Error("Pick two different products.");

    const pair = await ctx.runQuery(internal.productStore.getProductPair, {
      aId: args.productAId,
      bId: args.productBId,
    });
    if (!pair) throw new Error("One or both products were not found in the catalog.");

    const metrics = metricRows(pair.a, pair.b);

    // Deterministic summary — the engine never declares a "winner".
    let summary =
      "Neither product is declared 'best'. The rows above show where they differ; which difference matters depends on your goal, budget and how you train.";

    if (args.useAi !== false) {
      try {
        const bundle = await ctx.runQuery(internal.coachChat.getContextBundle, { userId });
        const ai = await ctx.runAction(api.services.aiProvider.aiComplete, {
          system: [
            "You are the product-comparison module of an AI fitness coach.",
            "Given the user's context and a factual comparison table of two supplement products,",
            "write <=120 words explaining WHICH DIFFERENCES MATTER for this specific user's goal and diet.",
            "RULES: Never call either product 'best' overall. Never judge authenticity. No medical claims.",
            "If price differs, present unit economics neutrally (cheap does not mean fake, expensive does not mean genuine).",
            "If information is missing, say what to check on the label instead of guessing.",
          ].join("\n"),
          messages: [
            {
              role: "user" as const,
              content: `USER CONTEXT:\n${bundle.summary}\n\nCOMPARISON:\n${metrics
                .map((m) => `${m.label}: A=${m.a} | B=${m.b}${m.note ? ` (${m.note})` : ""}`)
                .join("\n")}`,
            },
          ],
          temperature: 0.5,
          maxTokens: 280,
        });
        summary = ai.text;
      } catch {
        // deterministic summary already set
      }
    }

    await ctx.runMutation(internal.productStore.saveComparison, {
      userId,
      productAId: args.productAId,
      productBId: args.productBId,
      metrics: JSON.stringify(metrics),
      summary,
    });

    return { metrics, summary };
  },
});

/* ------------------------------------------------------------------ */
/* Recommendation engine (POST /products/recommend equivalent)          */
/* Rules gate the catalog; the AI only explains, never invents products. */
/* ------------------------------------------------------------------ */

type Rule = Doc<"adminProductRules">;

/** Deterministic default goal→category mapping used ONLY when no admin rules exist. */
const DEFAULT_GOAL_CATEGORIES: Record<string, string[]> = {
  muscle_gain: ["whey_protein", "protein_blend", "creatine", "mass_gainer"],
  fat_loss: ["whey_protein", "protein_blend", "creatine"],
  lean_muscle: ["whey_protein", "protein_blend", "creatine"],
  strength: ["creatine", "whey_protein", "protein_blend"],
  body_recomposition: ["whey_protein", "protein_blend", "creatine"],
  general_fitness: ["whey_protein", "vitamins", "electrolytes"],
  athletic_performance: ["electrolytes", "whey_protein", "creatine"],
  bodybuilding: ["whey_protein", "protein_blend", "creatine", "mass_gainer"],
  competition_preparation: ["whey_protein", "protein_blend", "creatine", "electrolytes"],
};

function ruleMatches(rule: Rule, u: {
  goal?: string;
  dietType?: string;
  budgetLevel?: string;
  experience?: string;
  weightKg?: number;
}): boolean {
  if (rule.goal && rule.goal !== u.goal) return false;
  if (rule.dietType && rule.dietType !== u.dietType) return false;
  if (rule.budgetLevel && rule.budgetLevel !== u.budgetLevel) return false;
  if (rule.experience && rule.experience !== u.experience) return false;
  if (rule.weightMinKg !== undefined && (u.weightKg === undefined || u.weightKg < rule.weightMinKg)) return false;
  if (rule.weightMaxKg !== undefined && (u.weightKg === undefined || u.weightKg > rule.weightMaxKg)) return false;
  return true;
}

export const generateRecommendations = action({
  args: { max: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const u = await ctx.runQuery(internal.productStore.getUserRuleContext, { userId });
    if (!u.goal) throw new Error("Set your goal first (Goals page), then ask again.");

    // 1. Rules gate which categories may be recommended to this user.
    const rules = (await ctx.runQuery(internal.productStore.listRules, {})) as Array<
      Doc<"adminProductRules">
    >;
    const enabled = rules.filter((r) => r.enabled);
    const matched = enabled.filter((r) => ruleMatches(r, u));
    let allowedCategories: string[];
    let rulesNote: string;
    if (enabled.length === 0) {
      allowedCategories = DEFAULT_GOAL_CATEGORIES[u.goal] ?? ["whey_protein", "creatine"];
      rulesNote = "No admin rules configured — using conservative default goal-category mapping.";
    } else if (matched.length === 0) {
      return {
        items: [],
        note: "No admin recommendation rules match your profile yet — the engine will not push products without a matching rule.",
      };
    } else {
      allowedCategories = [...new Set(matched.map((r) => r.category).filter((c): c is string => Boolean(c)))];
      rulesNote = `Matched ${matched.length} admin rule(s).`;
    }

    // 2. Admin-approved catalog only.
    const catalog = (await ctx.runQuery(internal.productStore.listCatalogInternal, {})) as Array<
      Doc<"productCatalog">
    >;
    const eligible = catalog.filter(
      (p) =>
        p.isActive &&
        p.approvedForRecommendation &&
        p.stockStatus === "in_stock" &&
        allowedCategories.includes(p.category),
    );
    if (eligible.length === 0) {
      return {
        items: [],
        note: "No approved products currently match your goal category. The engine will not substitute an unapproved product.",
      };
    }

    // 3. Score: goal-tagged products first, then budget fit, then price efficiency.
    const budgetRank = { low: 0, medium: 1, high: 2 } as Record<string, number | undefined>;
    const userBudget = u.budgetLevel ? budgetRank[u.budgetLevel] : undefined;
    const scored = eligible
      .map((p) => {
        let score = 0;
        if (p.fitnessGoals.includes(u.goal!)) score += 2;
        if (userBudget !== undefined) {
          const pps = p.servings ? p.price / p.servings : p.price;
          if (userBudget === 0 && pps <= 60) score += 1;
          if (userBudget === 1 && pps > 40 && pps <= 120) score += 1;
          if (userBudget === 2) score += 1;
        }
        if (p.verificationMethod) score += 1; // verifiable products preferred
        return { p, score };
      })
      .sort((x, y) => y.score - x.score || x.p.price - y.p.price);

    const top = scored.slice(0, Math.min(args.max ?? 2, 3));
    const primary = top[0];
    const alternatives = top.slice(1).map((t) => `${t.p.brand} ${t.p.name}`);

    // 4. AI explains the fit using real user context. Falls back to a
    //    deterministic reason if AI is unavailable.
    const bundle = await ctx.runQuery(internal.coachChat.getContextBundle, { userId });
    let reason = `Matches your goal (${u.goal}) and approved category (${primary.p.category}) under active admin rules.`;
    try {
      const ai = await ctx.runAction(api.services.aiProvider.aiComplete, {
        system: [
          "You are the product-recommendation module of an AI fitness coach.",
          "Given the user's context and ONE product from the admin-approved catalog, write <=90 words:",
          "why this product may be relevant to THIS user's goal and diet right now.",
          "RULES: Be direct that it is a product recommendation. No medical claims. Never judge authenticity.",
          "Mention serving information factually from the data. If a diet restriction conflicts with the product, say so.",
        ].join("\n"),
        messages: [
          {
            role: "user" as const,
            content: `USER CONTEXT:\n${bundle.summary}\n\nPRODUCT:\n${primary.p.brand} ${primary.p.name} — category ${primary.p.category}, ₹${primary.p.price}, serving ${primary.p.servingSize ?? "?"}, protein ${primary.p.nutrition?.proteinG ?? "?"}g/serving. Ingredients: ${primary.p.ingredients ?? "not listed"}.`,
          },
        ],
        temperature: 0.5,
        maxTokens: 200,
      });
      reason = ai.text;
    } catch {
      // keep deterministic reason
    }

    const ids = await ctx.runMutation(internal.productStore.saveRecommendations, {
      userId,
      items: [
        {
          productId: primary.p._id as Id<"productCatalog">,
          reason,
          userContext: `goal=${u.goal}; diet=${u.dietType ?? "?"}; budget=${u.budgetLevel ?? "?"}; experience=${u.experience ?? "?"}`,
          alternatives: alternatives.join("; ") || undefined,
        },
      ],
    });

    await ctx.runMutation(internal.services.lead.recordLeadSignal, {
      userId,
      signal: "product_recommendation_shown",
      minRank: 1,
    });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "product_recommendation",
      detail: `product=${primary.p._id}; rules=${rulesNote}`,
    });

    const productsOut = await Promise.all(
      top.map(async (t) => {
        const row = await ctx.runQuery(internal.productStore.getProductInternal, { id: t.p._id });
        return row;
      }),
    );

    return {
      items: [
        {
          recommendationId: ids[0],
          product: productsOut[0],
          reason,
          alternatives,
        },
      ],
      note: rulesNote,
    };
  },
});

export const getSavedRecommendations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("productRecommendations")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
    const out = [];
    for (const r of rows) {
      const product = await ctx.db.get(r.productId);
      if (product) out.push({ ...r, product });
    }
    return out;
  },
});

export const setRecommendationStatus = mutation({
  args: { id: v.id("productRecommendations"), status: v.union(v.literal("accepted"), v.literal("dismissed")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const logProductInterest = mutation({
  args: { productId: v.optional(v.id("productCatalog")), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.runMutation(internal.services.lead.recordLeadSignal, {
      userId,
      signal: args.note ?? "product_viewed",
      minRank: 1,
    });
    await ctx.db.insert("analyticsEvents", {
      userId,
      name: "product_interest",
      props: args.productId ? JSON.stringify({ productId: args.productId }) : undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
