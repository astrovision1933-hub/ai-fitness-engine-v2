// KnowledgeRetrievalService — retrieves relevant admin knowledge documents for
// the coach orchestrator. Simple, deterministic token-overlap scoring keeps
// retrieval auditable (no black-box vector DB claims); safety always overrides.
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const STOPWORDS = new Set(
  ("a an and are as at be but by for from has have how i in is it its of on or that the their them there " +
    "these this to was were what when where which who why will with you your my me our not do does did can").split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Jaccard-style overlap score between query and document tokens. */
export function scoreDoc(queryTokens: string[], docTokens: string[]): number {
  const qSet = new Set(queryTokens);
  const dSet = new Set(docTokens);
  if (qSet.size === 0 || dSet.size === 0) return 0;
  let inter = 0;
  for (const t of qSet) if (dSet.has(t)) inter++;
  const union = new Set([...qSet, ...dSet]).size;
  return inter / union;
}

export type KnowledgeHit = {
  id: string;
  title: string;
  category: string;
  content: string;
  source: string | null;
  score: number;
};

/**
 * Retrieve the top active knowledge documents matching the user's message.
 * Returns [] when nothing matches meaningfully — callers must not invent
 * content to fill gaps.
 */
export const retrieveKnowledge = internalQuery({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<KnowledgeHit[]> => {
    const docs = await ctx.db
      .query("knowledgeDocuments")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    if (docs.length === 0) return [];

    const qTokens = tokenize(args.query);
    const limit = args.limit ?? 3;
    const hits: KnowledgeHit[] = [];
    for (const doc of docs) {
      const docTokens = tokenize(`${doc.title} ${doc.content} ${doc.tags.join(" ")}`);
      const score = scoreDoc(qTokens, docTokens);
      if (score >= 0.08) {
        hits.push({
          id: doc._id,
          title: doc.title,
          category: doc.category,
          content: doc.content,
          source: doc.source ?? null,
          score: Math.round(score * 100) / 100,
        });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  },
});
