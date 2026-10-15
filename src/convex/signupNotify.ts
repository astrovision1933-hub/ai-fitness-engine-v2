// Site-owner sign-in notifications — node action (external HTTP side effects).
// Whenever an athlete verifies their email-OTP code, the tracker mutation
// (signupTracker.ts) records a signupNotices row and schedules this action,
// which emails the owner's fixed address with the athlete's information.
// Mail transport is Resend via a direct HTTP POST (no SDK dependency).
"use node";

import axios from "axios";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// The owner address is fixed business configuration, not per-tenant data.
const OWNER_EMAIL = "info@thenutritionhut.in";

// Escape user-controlled values before embedding them in HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Never stringify the whole request error: it carries request headers.
function resendError(error: unknown): Error {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } })
    ?.response;
  if (response) {
    const detail =
      typeof response.data?.message === "string" ? `: ${response.data.message}` : "";
    return new Error(`Resend rejected the sign-in notification (HTTP ${response.status})${detail}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Resend sign-in notification failed: ${message}`);
}

export const sendOwnerEmail = internalAction({
  args: {
    noticeId: v.id("signupNotices"),
    userEmail: v.string(),
    userName: v.optional(v.string()),
    signedInAt: v.number(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RESEND_API_KEY is not set on this Convex deployment, so sign-in notifications cannot be emailed.",
      );
    }
    // Free/test accounts can send from onboarding@resend.dev until the owner
    // verifies their own domain; override with RESEND_FROM_EMAIL afterwards.
    const from =
      process.env.RESEND_FROM_EMAIL || "AI Fitness Engine <onboarding@resend.dev>";
    const when = new Date(args.signedInAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const subject = `New sign-in · ${args.userEmail} · AI Fitness Engine`;
    const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;background:#faf9f5;border:1px solid #e4e4dc;border-radius:12px;padding:24px">
  <h2 style="margin:0 0 4px;color:#1c1c1a;font-size:18px">&#128694; New sign-in — AI Fitness Engine</h2>
  <p style="margin:0 0 16px;color:#6b6b62;font-size:12px">An athlete just verified their sign-in code.</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1c1c1a">
    <tr><td style="padding:6px 0;color:#6b6b62;width:150px">Email</td><td style="padding:6px 0"><strong>${escapeHtml(args.userEmail)}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#6b6b62">Name</td><td style="padding:6px 0">${args.userName ? escapeHtml(args.userName) : "&mdash; (profile not filled yet)"}</td></tr>
    <tr><td style="padding:6px 0;color:#6b6b62">Sign-in time (IST)</td><td style="padding:6px 0">${when}</td></tr>
  </table>
  <p style="margin:18px 0 0;color:#9a9a8e;font-size:11px">Automatic alert · sent to ${OWNER_EMAIL} · do not reply to this email</p>
</div>`;
    const text = [
      "New sign-in — AI Fitness Engine",
      `Email: ${args.userEmail}`,
      `Name: ${args.userName ?? "— (profile not filled yet)"}`,
      `Sign-in time (IST): ${when}`,
    ].join("\n");

    try {
      const response = await axios.post(
        "https://api.resend.com/emails",
        { from, to: [OWNER_EMAIL], subject, html, text },
        { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } },
      );
      // Actions have no direct db access — record the outcome via mutations.
      await ctx.runMutation(internal.signupTracker.markNoticeSent, {
        noticeId: args.noticeId,
        messageId:
          typeof response.data?.id === "string" ? response.data.id : undefined,
      });
    } catch (error) {
      await ctx.runMutation(internal.signupTracker.markNoticeError, {
        noticeId: args.noticeId,
        error: resendError(error).message,
      });
      throw resendError(error);
    }
  },
});
