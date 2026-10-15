// Sign-in tracker — fires right after a successful email-OTP verification.
// Records a signupNotices row and schedules the node action that emails the
// site owner (info@thenutritionhut.in). This file stays on the default
// runtime because mutations/queries must not live in "use node" files.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const recordSignin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { notified: false as const, reason: "not_signed_in" as const };

    const user = await ctx.db.get(userId);
    // Guest (anonymous) sessions have no verified email to report on.
    if (!user || user.isAnonymous) {
      return { notified: false as const, reason: "guest_or_missing_user" as const };
    }
    if (!user.email) {
      return { notified: false as const, reason: "no_email_on_user" as const };
    }

    const signedInAt = Date.now();
    const noticeId = await ctx.db.insert("signupNotices", {
      userId,
      email: user.email,
      name: user.name,
      signedInAt,
    });
    await ctx.scheduler.runAfter(0, internal.signupNotify.sendOwnerEmail, {
      noticeId,
      userEmail: user.email,
      userName: user.name,
      signedInAt,
    });
    return { notified: true as const, email: user.email };
  },
});

// Called by signupNotify.sendOwnerEmail after Resend accepts the email.
export const markNoticeSent = internalMutation({
  args: { noticeId: v.id("signupNotices"), messageId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noticeId, {
      sentAt: Date.now(),
      messageId: args.messageId,
      error: undefined,
    });
  },
});

// Called by signupNotify.sendOwnerEmail when the mail could not be sent —
// the notice row keeps the error for history; the next real sign-in retries.
export const markNoticeError = internalMutation({
  args: { noticeId: v.id("signupNotices"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noticeId, { error: args.error });
  },
});
