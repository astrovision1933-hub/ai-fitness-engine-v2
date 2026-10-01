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
    // 1. INTENT
    const { intent, confidence } = classifyIntent(args.message);

    // 2. SAFETY (short-circuits the AI on dangerous requests)
    const safety = assessSafety(args.message);
    if (safety.flagged) {
      await ctx.runMutation(internal.coachChat.persistExchange, {
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

    // 3. CONTEXT
    const contextBundle = await ctx.runQuery(internal.coachChat.getContextBundle, {
      userId: args.userId,
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
      "=== ANTI-HALLUCINATION RULES ===",
      "Distinguish: USER-PROVIDED vs SYSTEM DATA vs ESTIMATED vs UNCERTAIN.",
      "Never invent medical diagnoses, fitness statistics, studies, product verifications or certifications.",
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
    const result = await ctx.runAction(api.services.aiProvider.aiComplete, {
      system: systemPrompt,
      messages: [...recentTurns, { role: "user" as const, content: args.message }],
      temperature: 0.65,
      maxTokens: 700,
    });

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

    await ctx.runMutation(internal.coachChat.persistExchange, {
      userId: args.userId,
      conversationId: args.conversationId,
      userMessage: args.message,
      assistantReply: result.text,
      intent,
      intentConfidence: confidence,
      safetyFlag: false,
    });

    return { intent, safetyFlag: false };
  },
});
