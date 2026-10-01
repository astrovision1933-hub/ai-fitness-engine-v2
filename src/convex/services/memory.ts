// Service-layer AI access for Convex mutations/queries. Convex mutations
// cannot call actions directly, so AI calls from the orchestrator happen in
// actions that then invoke these helpers as needed.
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** Append a structured memory record. Used by the orchestrator after replies. */
export const writeMemory = internalMutation({
  args: {
    userId: v.id("users"),
    scope: v.union(
      v.literal("short_term"),
      v.literal("long_term"),
      v.literal("event"),
      v.literal("preference"),
    ),
    key: v.string(),
    content: v.string(),
    source: v.union(v.literal("user_provided"), v.literal("system_data"), v.literal("estimated")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiMemory", {
      userId: args.userId,
      scope: args.scope,
      key: args.key,
      content: args.content,
      source: args.source,
      createdAt: Date.now(),
    });
  },
});

/** Log an audit event (sign-ins, plan generation, goal changes, etc.). */
export const writeAuditLog = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    action: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      userId: args.userId,
      action: args.action,
      detail: args.detail,
      createdAt: Date.now(),
    });
  },
});

/** Create a notification for the user's dashboard feed. */
export const createNotification = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      read: false,
      createdAt: Date.now(),
    });
  },
});
