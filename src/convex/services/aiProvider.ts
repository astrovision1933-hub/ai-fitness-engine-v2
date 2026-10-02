import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { createVlyIntegrations } from "@vly-ai/integrations";
import { v } from "convex/values";

/**
 * AI provider abstraction. The engine never talks to a vendor directly;
 * every call goes through this action so the model/provider can be swapped
 * (or a real backend added in later parts) without touching services.
 */
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
  handler: async (_ctx, args) => {
    const deploymentToken = process.env.VLY_INTEGRATION_KEY;
    if (!deploymentToken) {
      throw new Error(
        "VLY_INTEGRATION_KEY is not set — add it under Keys → API keys to enable AI replies."
      );
    }

    const vly = createVlyIntegrations({ deploymentToken });

    const result = await vly.ai.completion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system" as const, content: args.system },
        ...args.messages,
      ],
      temperature: args.temperature ?? 0.7,
      maxTokens: args.maxTokens ?? 700,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error ?? "AI provider returned no data");
    }

    const choice = result.data.choices?.[0];
    const text = choice?.message?.content ?? "";
    if (!text) throw new Error("AI provider returned an empty response");

    return { text };
  },
});
