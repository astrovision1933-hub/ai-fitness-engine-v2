import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/* ------------------------------------------------------------------ */
/* SiteService — appearance (theme/font/text), home banners, coupons   */
/* ------------------------------------------------------------------ */

const THEME_IDS = [
  "neon-lime",
  "midnight-blue",
  "cyber-violet",
  "ember-orange",
  "ocean-teal",
  "rose-quartz",
  "monochrome",
  "forest-emerald",
  "solar-amber",
  "crimson-carbon",
] as const;

const FONT_IDS = ["space-inter", "poppins", "montserrat", "roboto", "lora", "orbitron"] as const;

const PLAN_SLUGS = ["premium", "pro_coach", "competition"] as const;

export const DEFAULT_THEME = "neon-lime";
export const DEFAULT_FONT = "space-inter";

/* Editable marketing copy keys — only copy, never identifiers. */
const TEXT_KEYS = [
  "hero.badge",
  "hero.line1",
  "hero.line2",
  "hero.line3",
  "hero.body",
  "hero.getStarted",
  "hero.openCenter",
] as const;

const MAX_IMAGE_CHARS = 850_000;
/** Optional artwork that replaces the illustrated coach in the hero. */
const HERO_IMAGE_KEY = "hero_coach_image";

const ADMIN_UNLOCK_WINDOW_MS = 12 * 60 * 60 * 1000;

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin" || user.disabled) throw new Error("Admin access required");
  if (!user.adminUnlockedAt || Date.now() - user.adminUnlockedAt > ADMIN_UNLOCK_WINDOW_MS) {
    throw new Error("Admin console is locked — enter the admin password");
  }
  return user;
}

async function readSetting(ctx: QueryCtx | MutationCtx, key: string): Promise<string | null> {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return row?.value ?? null;
}

async function writeSetting(ctx: MutationCtx, key: string, value: string) {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (row) await ctx.db.patch(row._id, { value, updatedAt: Date.now() });
  else await ctx.db.insert("appSettings", { key, value, updatedAt: Date.now() });
}

/* ------------------------------------------------------------------ */
/* Public read — theme/font/text + active banners                      */
/* ------------------------------------------------------------------ */

export const getCustomization = query({
  args: {},
  handler: async (ctx) => {
    const [theme, font, textRaw, heroRaw] = await Promise.all([
      readSetting(ctx, "site_theme"),
      readSetting(ctx, "site_font"),
      readSetting(ctx, "site_text_overrides"),
      readSetting(ctx, HERO_IMAGE_KEY),
    ]);

    let textOverrides: Record<string, string> = {};
    if (textRaw) {
      try {
        const parsed: unknown = JSON.parse(textRaw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [k, val] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof val === "string" && (TEXT_KEYS as readonly string[]).includes(k)) {
              textOverrides[k] = val;
            }
          }
        }
      } catch {
        textOverrides = {};
      }
    }

    const banners = await ctx.db
      .query("siteBanners")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return {
      theme: theme && (THEME_IDS as readonly string[]).includes(theme) ? theme : DEFAULT_THEME,
      font: font && (FONT_IDS as readonly string[]).includes(font) ? font : DEFAULT_FONT,
      heroImage: heroRaw && heroRaw.startsWith("data:image/") ? heroRaw : null,
      textOverrides,
      banners: banners
        .sort((a, b) => a.order - b.order || b.createdAt - a.createdAt)
        .map((b) => ({
          _id: b._id,
          imageDataUrl: b.imageDataUrl,
          linkUrl: b.linkUrl ?? null,
          title: b.title ?? null,
        })),
    };
  },
});

/* ------------------------------------------------------------------ */
/* Appearance (admin)                                                  */
/* ------------------------------------------------------------------ */

export const setTheme = mutation({
  args: { theme: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(THEME_IDS as readonly string[]).includes(args.theme)) throw new Error("Unknown theme");
    await writeSetting(ctx, "site_theme", args.theme);
    return args.theme;
  },
});

export const setFont = mutation({
  args: { font: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(FONT_IDS as readonly string[]).includes(args.font)) throw new Error("Unknown font");
    await writeSetting(ctx, "site_font", args.font);
    return args.font;
  },
});

export const setTextOverrides = mutation({
  args: { overrides: v.record(v.string(), v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(args.overrides)) {
      if (!(TEXT_KEYS as readonly string[]).includes(key)) continue;
      const trimmed = value.trim();
      if (trimmed) cleaned[key] = trimmed.slice(0, 400);
    }
    await writeSetting(ctx, "site_text_overrides", JSON.stringify(cleaned));
    return cleaned;
  },
});

/* ------------------------------------------------------------------ */
/* Hero artwork (admin) — replaces the illustrated coach in the hero   */
/* ------------------------------------------------------------------ */

export const setHeroImage = mutation({
  args: { imageDataUrl: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const image = args.imageDataUrl.trim();
    // Empty string = remove the artwork and fall back to the built-in coach.
    if (!image) {
      await writeSetting(ctx, HERO_IMAGE_KEY, "");
      return null;
    }
    if (image.length > MAX_IMAGE_CHARS) {
      throw new Error("Hero image is too large — try a smaller image");
    }
    if (!image.startsWith("data:image/")) {
      throw new Error("Hero image must be an image file");
    }
    await writeSetting(ctx, HERO_IMAGE_KEY, image);
    return image;
  },
});

/* ------------------------------------------------------------------ */
/* Home banners (admin + public read above)                            */
/* ------------------------------------------------------------------ */

export const listBannersAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("siteBanners").collect();
    return rows.sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
  },
});

export const addBanner = mutation({
  args: {
    imageDataUrl: v.string(),
    linkUrl: v.optional(v.string()),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.imageDataUrl.length > MAX_IMAGE_CHARS) {
      throw new Error("Banner image is too large — try a smaller image");
    }
    if (!args.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Banner must be an image file");
    }
    const link = args.linkUrl?.trim();
    if (link && !/^https?:\/\/|^\//.test(link)) {
      throw new Error("Link must start with http(s):// or /");
    }
    const existing = await ctx.db.query("siteBanners").collect();
    const id = await ctx.db.insert("siteBanners", {
      imageDataUrl: args.imageDataUrl,
      linkUrl: link || undefined,
      title: args.title?.trim().slice(0, 120) || undefined,
      isActive: true,
      order: existing.length,
      createdAt: Date.now(),
      createdBy: admin._id,
    });
    return id;
  },
});

export const toggleBanner = mutation({
  args: { bannerId: v.id("siteBanners") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const banner = await ctx.db.get(args.bannerId);
    if (!banner) throw new Error("Banner not found");
    await ctx.db.patch(banner._id, { isActive: !banner.isActive });
    return !banner.isActive;
  },
});

export const deleteBanner = mutation({
  args: { bannerId: v.id("siteBanners") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.bannerId);
    return { ok: true };
  },
});

/* ------------------------------------------------------------------ */
/* Coupons (admin creates, user redeems)                               */
/* ------------------------------------------------------------------ */

export const listCoupons = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("coupons").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createCoupon = mutation({
  args: {
    code: v.string(),
    planSlug: v.string(),
    durationDays: v.number(),
    maxUses: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const code = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{4,24}$/.test(code)) {
      throw new Error("Coupon code must be 4–24 characters (A–Z, 0–9, - or _)");
    }
    if (!(PLAN_SLUGS as readonly string[]).includes(args.planSlug)) {
      throw new Error("Unknown plan");
    }
    const existing = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing) throw new Error("This coupon code already exists");
    const id = await ctx.db.insert("coupons", {
      code,
      planSlug: args.planSlug,
      durationDays: Math.max(0, Math.round(args.durationDays)),
      maxUses: Math.max(0, Math.round(args.maxUses)),
      usedCount: 0,
      isActive: true,
      note: args.note?.trim().slice(0, 160) || undefined,
      createdAt: Date.now(),
      createdBy: admin._id,
    });
    return { id, code };
  },
});

export const toggleCoupon = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) throw new Error("Coupon not found");
    await ctx.db.patch(coupon._id, { isActive: !coupon.isActive });
    return !coupon.isActive;
  },
});

export const deleteCoupon = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.couponId);
    return { ok: true };
  },
});

/** Redeem a coupon → gives the signed-in user the coupon's paid plan free. */
export const redeemCoupon = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to redeem a coupon");
    const code = args.code.trim().toUpperCase();
    if (!code) throw new Error("Enter a coupon code");

    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!coupon || !coupon.isActive) throw new Error("This coupon is not valid");
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new Error("This coupon has reached its usage limit");
    }

    const now = Date.now();
    const current = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Existing paid plan wins — never downgrade someone who already pays.
    if (
      current &&
      current.planSlug !== "free" &&
      (current.status === "active" ||
        (current.status === "trialing" && (current.trialEndsAt ?? 0) > now))
    ) {
      throw new Error("You already have an active paid plan");
    }

    const periodEnd = coupon.durationDays > 0 ? now + coupon.durationDays * 86_400_000 : undefined;

    if (current) {
      await ctx.db.patch(current._id, {
        planSlug: coupon.planSlug,
        status: "active",
        source: "coupon",
        trialStartedAt: undefined,
        trialEndsAt: undefined,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: periodEnd !== undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId,
        planSlug: coupon.planSlug,
        status: "active",
        source: "coupon",
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: periodEnd !== undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });
    await ctx.runMutation(internal.services.memory.writeAuditLog, {
      userId,
      action: "coupon_redeemed",
      detail: `code=${code}; plan=${coupon.planSlug}`,
    });

    return { planSlug: coupon.planSlug, durationDays: coupon.durationDays, periodEnd: periodEnd ?? null };
  },
});
