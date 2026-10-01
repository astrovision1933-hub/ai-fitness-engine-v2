// Internal persistence helpers for supplement analyses. Kept in a separate
// module so supplement.ts actions never reference their own module's API
// (self-references break Convex type inference).
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const saveAnalysis = internalMutation({
  args: {
    userId: v.id("users"),
    inputType: v.string(),
    rawLabel: v.string(),
    parsed: v.object({
      productName: v.optional(v.string()),
      brand: v.optional(v.string()),
      category: v.optional(v.string()),
      servingSize: v.optional(v.string()),
      calories: v.optional(v.number()),
      proteinG: v.optional(v.number()),
      carbsG: v.optional(v.number()),
      fatG: v.optional(v.number()),
      manufacturer: v.optional(v.string()),
      importer: v.optional(v.string()),
      batchNumber: v.optional(v.string()),
      expiry: v.optional(v.string()),
      mrp: v.optional(v.number()),
      barcode: v.optional(v.string()),
      verificationInfo: v.optional(v.string()),
      ingredientNames: v.array(v.string()),
    }),
    verdict: v.string(),
    evidenceChecked: v.array(v.string()),
    evidenceMissing: v.array(v.string()),
    redFlags: v.array(v.string()),
    verificationSteps: v.array(v.string()),
    priceIntel: v.optional(
      v.object({
        pricePerServing: v.optional(v.number()),
        pricePerGram: v.optional(v.number()),
        pricePerProteinGram: v.optional(v.number()),
        note: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const analysisId = await ctx.db.insert("supplementAnalysis", {
      userId: args.userId,
      inputType: args.inputType,
      rawLabel: args.rawLabel,
      productName: args.parsed.productName,
      brand: args.parsed.brand,
      category: args.parsed.category,
      servingSize: args.parsed.servingSize,
      nutritionFacts: {
        calories: args.parsed.calories,
        proteinG: args.parsed.proteinG,
        carbsG: args.parsed.carbsG,
        fatG: args.parsed.fatG,
      },
      manufacturer: args.parsed.manufacturer,
      importer: args.parsed.importer,
      batchNumber: args.parsed.batchNumber,
      expiry: args.parsed.expiry,
      mrp: args.parsed.mrp,
      barcode: args.parsed.barcode,
      verificationInfo: args.parsed.verificationInfo,
      priceIntel: args.priceIntel ?? undefined,
      verdict: args.verdict,
      evidenceChecked: args.evidenceChecked,
      evidenceMissing: args.evidenceMissing,
      redFlags: args.redFlags,
      verificationSteps: args.verificationSteps,
      createdAt: Date.now(),
    });

    for (const name of args.parsed.ingredientNames.slice(0, 30)) {
      await ctx.db.insert("supplementIngredients", {
        analysisId,
        name,
        role: "other",
      });
    }
    return analysisId;
  },
});

export const saveVerification = internalMutation({
  args: {
    userId: v.id("users"),
    analysisId: v.optional(v.id("supplementAnalysis")),
    method: v.string(),
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("supplementVerifications", {
      userId: args.userId,
      analysisId: args.analysisId,
      method: args.method,
      identifier: args.identifier,
      result: "instructions_provided",
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const getAnalysisRow = internalQuery({
  args: { id: v.id("supplementAnalysis"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== args.userId) return null;
    return row;
  },
});
