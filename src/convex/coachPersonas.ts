import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/** Seed the coach persona roster (idempotent; called on app bootstrap). */
export const seedPersonasPublic = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("coachPersonas").collect();
    if (existing.length > 0) return { seeded: false };
    await ctx.runMutation(internal.services.personas.seedPersonas, {});
    return { seeded: true };
  },
});

/** List active coach personas (the persona engine roster). */
export const listPersonas = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("coachPersonas").collect();
    return all.filter((p) => p.isActive).sort((a, b) => a.name.localeCompare(b.name));
  },
});
