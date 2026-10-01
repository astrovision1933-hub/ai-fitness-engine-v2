import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { Panel, TerminalBadge, SectionHeader, StatusDot } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";

type NotificationsPref = {
  workoutReminders: boolean;
  waterReminders: boolean;
  checkinReminders: boolean;
  weeklyReview: boolean;
  milestones: boolean;
  subscription: boolean;
  planRenewal: boolean;
};
type VoicePref = { inputEnabled: boolean; outputEnabled: boolean };
type PrivacyPref = { consentAnalytics: boolean; allowCoachMemory: boolean };
type MySettings = {
  _id: string;
  notifications: NotificationsPref;
  voice: VoicePref;
  privacy: PrivacyPref;
};

const NOTIFICATION_META: Array<{ key: keyof NotificationsPref; label: string; hint: string }> = [
  { key: "workoutReminders", label: "WORKOUT REMINDERS", hint: "nudge when a session is scheduled" },
  { key: "waterReminders", label: "WATER REMINDERS", hint: "hydration nudges through the day" },
  { key: "checkinReminders", label: "CHECK-IN REMINDERS", hint: "daily check-in prompt" },
  { key: "weeklyReview", label: "WEEKLY REVIEW", hint: "auto summary of the week" },
  { key: "milestones", label: "GOAL MILESTONES", hint: "milestone celebrations" },
  { key: "subscription", label: "SUBSCRIPTION", hint: "trial and plan status changes" },
  { key: "planRenewal", label: "PLAN RENEWAL", hint: "renewal reminders" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const profile = useQuery(api.profile.getProfile);
  const settings = useQuery(api.settings.getMySettings);
  const memory = useQuery(api.settings.listMyMemory);
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});

  const ensure = useMutation(api.settings.ensureSettings);
  const update = useMutation(api.settings.updateSettings);
  const deleteMemory = useMutation(api.settings.deleteMemoryEntry);
  const clearMemory = useMutation(api.settings.clearAllMemory);
  const exportData = useQuery(api.settings.exportMyData);
  const deleteAccountData = useMutation(api.settings.deleteMyAccountData);

  useEffect(() => {
    ensure({}).catch(() => undefined);
  }, [ensure]);

  useEffect(() => {
    if (profile === null) navigate("/onboarding");
  }, [profile, navigate]);

  // Local mirrors so toggles feel instant; server confirms in the background.
  const [notifState, setNotifState] = useState<NotificationsPref | null>(null);
  const [voiceState, setVoiceState] = useState<VoicePref | null>(null);
  const [privacyState, setPrivacyState] = useState<PrivacyPref | null>(null);

  const premium =
    ent !== undefined &&
    ent !== null &&
    (ent.planSlug !== "free" ||
      (ent.status === "trialing" && ent.trialEndsAt !== null && ent.trialEndsAt > Date.now()));

  function toggleNotif(key: keyof NotificationsPref) {
    if (!settings) return;
    const base = notifState ?? settings.notifications;
    const next = { ...base, [key]: !base[key] };
    setNotifState(next);
    update({ notifications: next }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed to save"));
  }

  function togglePrivacy(key: keyof PrivacyPref) {
    if (!settings) return;
    const base = privacyState ?? settings.privacy;
    const next = { ...base, [key]: !base[key] };
    setPrivacyState(next);
    update({ privacy: next }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed to save"));
  }

  function toggleVoice(key: keyof VoicePref) {
    if (!settings) return;
    if (!premium) {
      toast.error("Voice features are part of paid plans — start the 14-day trial in SUBSCRIPTION.");
      return;
    }
    const base = voiceState ?? settings.voice;
    const next = { ...base, [key]: !base[key] };
    setVoiceState(next);
    update({ voice: next }).catch((e) => toast.error(e instanceof Error ? e.message : "Failed to save"));
  }

  function runExport() {
    if (!exportData) {
      toast.error("Export data not ready yet — try again in a moment.");
      return;
    }
    try {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-fitness-engine-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data export downloaded.");
    } catch {
      toast.error("Export failed.");
    }
  }

  async function runDelete() {
    try {
      const res = await deleteAccountData({});
      toast.success(`Deleted ${res.deleted} records. Account anonymized and disabled.`);
      setTimeout(() => {
        window.location.href = "/";
      }, 1400);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deletion failed.");
    }
  }

  if (profile === undefined || settings === undefined || settings === null) {
    return (
      <AppShell>
        <div className="space-y-2 font-mono text-xs text-muted-foreground">
          <p>&gt; loading settings…</p>
        </div>
      </AppShell>
    );
  }

  const effNotifications = notifState ?? settings.notifications;
  const effVoice = voiceState ?? settings.voice;
  const effPrivacy = privacyState ?? settings.privacy;

  return (
    <AppShell>
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <StatusDot pulse /> MODULE 06 · SETTINGS &amp; PRIVACY
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">Settings</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Notification preferences, voice access, privacy consent, AI-memory control and full data ownership.
                Basic safety information is never gated behind a plan.
              </p>
            </div>
            <TerminalBadge tone="ok">USER CONTROLLED</TerminalBadge>
          </div>
        </Panel>

        <SectionHeader index="01" title="NOTIFICATIONS" hint="you control every channel" />
        <Panel>
          <div className="divide-y divide-border/60">
            {NOTIFICATION_META.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-xs font-semibold">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.hint}</p>
                </div>
                <Switch checked={effNotifications[m.key]} onCheckedChange={() => toggleNotif(m.key)} />
              </div>
            ))}
          </div>
        </Panel>

        <SectionHeader index="02" title="VOICE COACH" hint="premium plans · provider abstraction" />
        <Panel>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">VOICE INPUT (SPEECH-TO-TEXT)</p>
                <p className="text-[10px] text-muted-foreground">dictate to your coach in the COACH module</p>
              </div>
              <Switch checked={effVoice.inputEnabled} onCheckedChange={() => toggleVoice("inputEnabled")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">VOICE OUTPUT (TEXT-TO-SPEECH)</p>
                <p className="text-[10px] text-muted-foreground">coach replies read aloud — always labeled synthetic</p>
              </div>
              <Switch checked={effVoice.outputEnabled} onCheckedChange={() => toggleVoice("outputEnabled")} />
            </div>
            <p className="border border-border bg-secondary/50 p-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Provider: WEB_SPEECH (browser). The abstraction supports swapping to a hosted provider without UI
              changes. Voice never claims to be a real human.
            </p>
          </div>
        </Panel>

        <SectionHeader index="03" title="PRIVACY &amp; AI MEMORY" hint="consent and memory, always yours" />
        <Panel>
          <div className="divide-y divide-border/60">
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-xs font-semibold">ANALYTICS CONSENT</p>
                <p className="text-[10px] text-muted-foreground">aggregate product-interest events only — never chat content</p>
              </div>
              <Switch checked={effPrivacy.consentAnalytics} onCheckedChange={() => togglePrivacy("consentAnalytics")} />
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-xs font-semibold">COACH LONG-TERM MEMORY</p>
                <p className="text-[10px] text-muted-foreground">let the coach remember durable preferences across sessions</p>
              </div>
              <Switch checked={effPrivacy.allowCoachMemory} onCheckedChange={() => togglePrivacy("allowCoachMemory")} />
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <div>
                <p className="text-xs font-semibold">AI MEMORY ENTRIES</p>
                <p className="text-[10px] text-muted-foreground">{memory?.length ?? 0} stored — delete any or all</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-none text-[10px]"
                disabled={!memory?.length}
                onClick={() => {
                  clearMemory({})
                    .then(() => toast.success("AI memory cleared."))
                    .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
                }}
              >
                CLEAR ALL
              </Button>
            </div>
            {(memory ?? []).map((m) => (
              <div key={m._id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-xs text-muted-foreground">{m.content}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <TerminalBadge tone={m.scope === "long_term" ? "info" : "ink"}>{m.scope}</TerminalBadge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-none px-2 text-[10px]"
                    onClick={() => deleteMemory({ id: m._id }).catch(() => undefined)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <SectionHeader index="04" title="DATA OWNERSHIP" hint="export or delete everything" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="EXPORT MY DATA">
            <p className="text-xs leading-5 text-muted-foreground">
              Download everything the engine holds for you as JSON — profile, goals, plans, logs, memory, subscription
              and settings.
            </p>
            <Button onClick={runExport} variant="outline" className="mt-3 rounded-none text-[10px] uppercase tracking-[0.12em]">
              DOWNLOAD JSON →
            </Button>
          </Panel>
          <Panel title="DELETE MY DATA" subtitle="irreversible">
            <p className="text-xs leading-5 text-muted-foreground">
              Permanently deletes your fitness data across all modules and anonymizes your account row. Audit entries
              (security accounting, no chat content) are retained.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="mt-3 rounded-none text-[10px] uppercase tracking-[0.12em]">
                  DELETE EVERYTHING…
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-none">
                <DialogHeader>
                  <DialogTitle className="text-sm uppercase tracking-[0.16em]">Confirm full deletion</DialogTitle>
                  <DialogDescription className="text-xs">
                    This deletes all fitness records, memory, analyses, reports and conversation history, then disables
                    your account. This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" className="rounded-none text-[10px]">
                    CANCEL
                  </Button>
                  <Button variant="destructive" className="rounded-none text-[10px]" onClick={runDelete}>
                    CONFIRM DELETE
                  </Button>
                </DialogFooter>
                <p className="text-[10px] text-muted-foreground">Signed in as {user?.email ?? "user"}</p>
              </DialogContent>
            </Dialog>
          </Panel>
        </div>

        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          SECURITY: ROLE-BASED ACCESS · SERVER-SIDE AUTHORIZATION · AUDIT LOGGING ·{" "}
          <Link to="/profile" className="text-status-ok underline underline-offset-4">
            PROFILE →
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
