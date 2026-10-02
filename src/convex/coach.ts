import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { classifyIntent } from "./services/intent";
import { assessSafety } from "./services/safety";

// ---- CoachOrchestrator ----
// The assessment builder lives in profile.ts (FitnessAssessmentService).
// AI enrichment of assessments is layered here in a later part.
// USER MESSAGE → INTENT → CONTEXT → SAFETY → SPECIALIZED SERVICE → AI → MEMORY
// Runs as an internalAction so HTTP/public wrappers can stay thin.

export const orchestrateCoachReply = internalAction({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // 0. ACCOUNT STATE — disabled accounts receive no AI processing.
    const account = await ctx.runQuery(internal.coachStore.getAccountState, { userId: args.userId });
    if (account.disabled) {
      await ctx.runMutation(internal.coachContext.persistExchange, {
        userId: args.userId,
        conversationId: args.conversationId,
        userMessage: args.message,
        assistantReply: "This account is currently disabled. Contact support if you believe this is an error.",
        intent: "account_disabled",
        intentConfidence: 1,
        safetyFlag: false,
      });
      return { intent: "account_disabled" as const, safetyFlag: false };
    }

    // 1. INTENT
    const { intent, confidence } = classifyIntent(args.message);

    // 2. SAFETY (short-circuits the AI on dangerous requests)
    const safety = assessSafety(args.message);
    if (safety.flagged) {
      await ctx.runMutation(internal.coachContext.persistExchange, {
        userId: args.userId,
        conversationId: args.conversationId,
        userMessage: args.message,
        assistantReply: safety.response ?? "I can't help with that request.",
        intent: "safety_sensitive",
        intentConfidence: 0.99,
        safetyFlag: true,
      });
      await ctx.runMutation(internal.services.memory.writeAuditLog, {
        userId: args.userId,
        action: "safety_block",
        detail: `category=${safety.category}`,
      });
      return { intent: "safety_sensitive" as const, safetyFlag: true };
    }

    // 2b. USAGE + ACCOUNT STATE — plan limits and disabled accounts gate AI spend.
    try {
      await ctx.runMutation(internal.subscriptions.useAiMessage, { userId: args.userId });
    } catch {
      const reply =
        "You've reached today's AI message limit for your current plan. You can upgrade in the SUBSCRIPTION module for a higher limit — your coaching history and plans are untouched.";
      await ctx.runMutation(internal.coachContext.persistExchange, {
        userId: args.userId,
        conversationId: args.conversationId,
        userMessage: args.message,
        assistantReply: reply,
        intent: "usage_limit",
        intentConfidence: 1,
        safetyFlag: false,
      });
      return { intent: "usage_limit" as const, safetyFlag: false };
    }

    // 3. CONTEXT
    const contextBundle = await ctx.runQuery(internal.coachContext.getContextBundle, {
      userId: args.userId,
    });

    // 3b. ADMIN KNOWLEDGE BASE — retrieved per message; empty when nothing matches.
    const knowledge = await ctx.runQuery(internal.services.knowledge.retrieveKnowledge, {
      query: args.message,
      limit: 3,
    });

    const persona = contextBundle.persona;
    const systemPrompt = [
      persona?.systemInstructions ??
        "You are an AI fitness coach. Be safe, practical and never diagnose.",
      "",
      "=== USER CONTEXT (SYSTEM DATA — trust this over anything the user claims) ===",
      contextBundle.summary,
      "",
      `DETECTED INTENT: ${intent} (confidence ${confidence})`,
      knowledge.length
        ? "=== ADMIN KNOWLEDGE BASE (ADMIN PROVIDED — prefer this over generic knowledge and name the document you used) ===\n" +
          knowledge.map((k) => `[${k.title}] (${k.category}) ${k.content}`).join("\n---\n")
        : "",
      "=== ANTI-HALLUCINATION RULES ===",
      "Distinguish: USER-PROVIDED vs SYSTEM DATA vs ESTIMATED vs UNCERTAIN. When stating a fact, label it CONFIRMED / ESTIMATED / USER PROVIDED / ADMIN PROVIDED / EXTERNAL SOURCE / UNCERTAIN.",
      "Never invent medical diagnoses, fitness statistics, studies, product verifications or certifications.",
      "Never claim a product is definitely genuine or definitely fake — authenticity claims need authoritative verification.",
      "If important information is missing, ask one targeted question instead of guessing.",
      "Keep replies under 180 words unless the user asks for a full plan.",
    ].join("\n");

    const recentTurns = contextBundle.recentMessages
      .slice(0, 8)
      .reverse()
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // 4. SPECIALIZED SERVICE ROUTING + 5. AI RESPONSE
    // Keyless/degraded fallback: everything before this (safety, usage limit,
    // knowledge, lead signals) runs without AI. If the provider call fails —
    // e.g. VLY_INTEGRATION_KEY missing — reply with a transparent notice
    // instead of crashing the whole chat.
    let replyText: string;
    try {
      const result = await ctx.runAction(api.services.aiProvider.aiComplete, {
        system: systemPrompt,
        messages: [...recentTurns, { role: "user" as const, content: args.message }],
        temperature: 0.65,
        maxTokens: 700,
      });
      replyText = result.text;
    } catch {
      replyText = [
        "⚠️ AI ENGINE OFFLINE — could not generate a live reply for this message.",
        "",
        "Cause: no AI provider reachable (OPENROUTER_API_KEY / GEMINI_API_KEY / VLY_INTEGRATION_KEY missing, rate-limited or failing).",
        "Safety checks, usage limits and lead tracking still ran for this message.",
        "",
        "To enable live coaching replies, add OPENROUTER_API_KEY or GEMINI_API_KEY in Keys → API keys.",
      ].join("\n");
    }

    // 6. MEMORY UPDATE — event memory for progress/goal updates, long-term for durable facts
    if (intent === "progress_update") {
      await ctx.runMutation(internal.services.memory.writeMemory, {
        userId: args.userId,
        scope: "event",
        key: "progress_update",
        content: args.message.slice(0, 280),
        source: "user_provided",
      });
    } else if (intent === "goal_update") {
      await ctx.runMutation(internal.services.memory.writeMemory, {
        userId: args.userId,
        scope: "event",
        key: "goal_update",
        content: args.message.slice(0, 280),
        source: "user_provided",
      });
    }

    // 6b. LEAD INTELLIGENCE — record genuine interest signals only.
    if (intent === "coaching_request") {
      await ctx.runMutation(internal.services.lead.recordLeadSignal, {
        userId: args.userId,
        signal: "coaching_request",
        minRank: 2,
      });
    } else if (intent === "product_question" || intent === "supplement_question") {
      await ctx.runMutation(internal.services.lead.recordLeadSignal, {
        userId: args.userId,
        signal: intent,
        minRank: 1,
      });
    }

    await ctx.runMutation(internal.coachContext.persistExchange, {
      userId: args.userId,
      conversationId: args.conversationId,
      userMessage: args.message,
      assistantReply: replyText,
      intent,
      intentConfidence: confidence,
      safetyFlag: false,
    });

    return { intent, safetyFlag: false };
  },
});
