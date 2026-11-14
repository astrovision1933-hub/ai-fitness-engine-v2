import { useAuth } from "@/hooks/use-auth";
import { SignOutButton } from "@/components/SignOutButton";
import { LanguageSelector } from "@/components/language-selector";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Link, NavLink, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Apple,
  Bell,
  Bot,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  FileText,
  Home,
  Menu,
  Package,
  Pill,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  User,
  X,
} from "lucide-react";

type NavItem = {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
};

const MAIN_NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.home", icon: Home },
  { to: "/coach", labelKey: "nav.coach", icon: Bot },
  { to: "/workout", labelKey: "nav.workout", icon: Dumbbell },
  { to: "/nutrition", labelKey: "nav.nutrition", icon: Apple },
  { to: "/progress", labelKey: "nav.progress", icon: TrendingUp },
];

const MODULE_NAV: NavItem[] = [
  { to: "/supplements", labelKey: "nav.supplements", icon: Pill },
  { to: "/products", labelKey: "nav.products", icon: Package },
  { to: "/goals", labelKey: "nav.goals", icon: Target },
  { to: "/bodybuilding", labelKey: "nav.competition", icon: Trophy },
  { to: "/checkin", labelKey: "nav.checkin", icon: ClipboardCheck },
  { to: "/reports", labelKey: "nav.reports", icon: FileText },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: "/profile", labelKey: "nav.profile", icon: User },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
  { to: "/subscription", labelKey: "nav.plan", icon: CreditCard },
];

const ADMIN_NAV: NavItem = { to: "/admin", labelKey: "nav.admin", icon: ShieldCheck };

const SEARCH_INDEX = [
  { labelKey: "nav.home", to: "/dashboard", keys: "home overview start dashboard" },
  { labelKey: "nav.coach", to: "/coach", keys: "chat bot assistant ask coach" },
  { labelKey: "nav.workout", to: "/workout", keys: "training plan exercise gym create" },
  { labelKey: "nav.nutrition", to: "/nutrition", keys: "diet food meal calories protein log" },
  { labelKey: "nav.progress", to: "/progress", keys: "stats charts tracking history" },
  { labelKey: "nav.supplements", to: "/supplements", keys: "label analyze verify stack" },
  { labelKey: "nav.products", to: "/products", keys: "compare market recommendations buy" },
  { labelKey: "nav.goals", to: "/goals", keys: "target aim" },
  { labelKey: "nav.competition", to: "/bodybuilding", keys: "bodybuilding contest prep stage" },
  { labelKey: "nav.checkin", to: "/checkin", keys: "daily log weigh in" },
  { labelKey: "nav.reports", to: "/reports", keys: "weekly monthly summary" },
  { labelKey: "nav.profile", to: "/profile", keys: "account body stats personal" },
  { labelKey: "nav.settings", to: "/settings", keys: "preferences privacy voice" },
  { labelKey: "nav.plan", to: "/subscription", keys: "premium upgrade trial billing price" },
];

function EngineMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M20 2.5 35.5 11.5v17L20 37.5 4.5 28.5v-17z"
        fill="#0b100b"
        stroke="var(--terminal-green)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g fill="var(--terminal-green)">
        <rect x="13" y="10" width="14" height="3.2" rx="1.2" />
        <rect x="13" y="15" width="4.4" height="15" rx="1.2" />
        <rect x="18.5" y="17" width="8.5" height="3.2" rx="1.2" />
        <rect x="18.5" y="22" width="8.5" height="3.2" rx="1.2" />
      </g>
    </svg>
  );
}

function NavLinkRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  const { t } = useI18n();
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-[#d0ff67] via-[#a3e635] to-[#65d413] text-[#0a1205] shadow-[0_0_22px_var(--neon-glow)]"
            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "size-[18px] shrink-0 transition-all duration-200",
              isActive ? "text-[#0a1205]" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          <span className="tracking-wide">{t(item.labelKey)}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarBody({ isAdmin, planLabel, onNavigate }: { isAdmin: boolean; planLabel: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4" aria-label="Primary">
        {[...MAIN_NAV, ...MODULE_NAV, ...ACCOUNT_NAV].map((item) => (
          <NavLinkRow key={item.to} item={item} onNavigate={onNavigate} />
        ))}
        {isAdmin && <NavLinkRow item={ADMIN_NAV} onNavigate={onNavigate} />}
      </nav>

      {/* premium upgrade card */}
      <div className="p-3">
        {planLabel.toLowerCase() === "free" ? (
          <div className="gold-glow relative overflow-hidden rounded-xl border border-[#f0b429]/35 bg-gradient-to-b from-[#191408] to-[#0d110c] p-4">
            <div className="flex flex-col items-center text-center">
              <span className="text-xl" aria-hidden>👑</span>
              <p className="font-display mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f0b429]/80">
                Upgrade to
              </p>
              <p className="font-display text-lg font-bold uppercase tracking-[0.1em] text-[#f0b429]">
                Premium
              </p>
            </div>
            <ul className="mt-3 space-y-1.5 text-[11px] text-foreground/85">
              {["Personalized Plans", "Advanced AI Coach", "Detailed Analytics", "Product Recommendations"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary" aria-hidden>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/subscription"
              onClick={onNavigate}
              className="mt-3.5 block rounded-lg bg-gradient-to-r from-[#f0b429] to-[#d0ff67] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#1a1405] transition-all duration-200 hover:brightness-110 hover:-translate-y-px"
            >
              Upgrade Now
            </Link>
          </div>
        ) : (
          <div className="neon-glow rounded-xl border border-primary/25 bg-primary/10 p-4 text-center">
            <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-[#dcff8a]">{planLabel} Active</p>
            <p className="mt-1 text-[11px] text-muted-foreground">All engine modules unlocked.</p>
          </div>
        )}
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const notifications = useQuery(api.profile.getNotifications);
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});
  const planLabel = ent?.planName ?? "Free";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Overlays close in the navigation handlers themselves (no state writes in
  // effects on every route change).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { t } = useI18n();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter(
      (r) => t(r.labelKey).toLowerCase().includes(q) || r.keys.includes(q),
    ).slice(0, 6);
  }, [query, t]);

  function runSearch(to: string) {
    setQuery("");
    setMenuOpen(false);
    setDrawerOpen(false);
    navigate(to);
  }

  const initials = (user?.name ?? user?.email ?? "G")
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const notifCount = Math.min(notifications?.length ?? 0, 9);

  return (
    <div className="min-h-screen bg-atmo">
      {/* ================= TOP COMMAND BAR ================= */}
      <header className="glass fixed inset-x-0 top-0 z-50 border-b border-border">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
          <button
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
          >
            <Menu className="size-5" />
          </button>
          <button
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </button>

          <button className="flex items-center gap-2.5 text-left" onClick={() => navigate("/dashboard")} aria-label="Go to dashboard">
            <EngineMark className="size-9 drop-shadow-[0_0_8px_var(--neon-glow)]" />
            <span className="leading-tight">
              <span className="font-display block text-[15px] font-bold tracking-wide">
                AI <span className="neon-text">FITNESS</span> ENGINE
              </span>
              <span className="hidden text-[9px] font-medium uppercase tracking-[0.34em] text-muted-foreground sm:block">
                Train • Track • Transform
              </span>
            </span>
          </button>

          {/* intelligent search */}
          <div className="relative mx-auto hidden w-full max-w-xl md:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) runSearch(results[0].to);
              }}
              placeholder={t("nav.search")}
              aria-label="Search the engine"
              className="h-10 w-full rounded-full border border-border bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-all duration-200 focus:border-primary/40 focus:bg-secondary focus:shadow-[0_0_0_3px_rgba(163,230,53,0.12)]"
            />
            {results.length > 0 && (
              <ul className="glass absolute inset-x-0 top-12 z-50 overflow-hidden rounded-xl py-1 shadow-2xl">
                {results.map((r) => (
                  <li key={r.to}>
                    <button
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-primary/10 hover:text-[#dcff8a]"
                      onClick={() => runSearch(r.to)}
                    >
                      <Search className="size-3.5 text-primary" aria-hidden />
                      {t(r.labelKey)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LanguageSelector />
            <button
              className="relative rounded-lg border border-border p-2 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-foreground"
              onClick={() => navigate("/dashboard")}
              aria-label={`Notifications${notifCount ? ` (${notifications?.length ?? 0})` : ""}`}
            >
              <Bell className="size-[18px]" />
              {notifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#ef4444] text-[9px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.55)]">
                  {notifCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                className="flex items-center gap-2.5 rounded-full border border-border py-1 pl-1 pr-2.5 transition-all duration-200 hover:border-primary/30"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
              >
                <span className="neon-glow flex size-8 items-center justify-center rounded-full border border-primary/40 bg-primary/15 font-display text-xs font-bold text-[#dcff8a]">
                  {initials || "G"}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[120px] truncate text-xs font-semibold">{user?.name ?? "Guest User"}</span>
                  <span className="block text-[10px] font-medium text-primary">{planLabel} Plan</span>
                </span>
                <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div className="glass absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl py-1.5 shadow-2xl" role="menu">
                    <p className="truncate px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {user?.email ?? "guest"}
                    </p>
                    {ACCOUNT_NAV.map((item) => (
                      <button
                        key={item.to}
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-primary/10 hover:text-[#dcff8a]"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate(item.to);
                        }}
                      >
                        <item.icon className="size-4 text-primary" aria-hidden />
                        {t(item.labelKey)}
                      </button>
                    ))}
                    {isAdmin && (
                      <button
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-primary/10 hover:text-[#dcff8a]"
                        onClick={() => navigate(ADMIN_NAV.to)}
                      >
                        <ShieldCheck className="size-4 text-primary" aria-hidden />
                        Admin Console
                      </button>
                    )}
                    <div className="my-1 border-t border-border" />
                    <div className="px-4 py-1.5">
                      <SignOutButton />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ================= LEFT SIDEBAR (desktop) ================= */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-16 z-40 hidden w-[248px] flex-col border-r border-border bg-sidebar/85 backdrop-blur-md transition-transform duration-300 lg:flex",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarBody isAdmin={isAdmin} planLabel={planLabel} />
      </aside>

      {/* ================= CONTENT ================= */}
      <div className={cn("transition-[padding] duration-300", sidebarOpen ? "lg:pl-[248px]" : "lg:pl-0")}>
        <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-5 sm:px-5 lg:pb-10">{children}</main>

        <footer className="border-t border-border/60 px-5 py-4 lg:pl-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>AI Fitness Engine — Core v0.1 · Part 4/4 · All Modules Live</span>
            <span>Signed in as {user?.email ?? "guest"}</span>
          </div>
        </footer>
      </div>

      {/* ================= MOBILE BOTTOM NAV ================= */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 border-t border-border lg:hidden" aria-label="Primary mobile">
        <div className="flex items-stretch justify-around px-2 py-1.5">
          {MAIN_NAV.slice(0, 4).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {t(item.labelKey)}
            </NavLink>
          ))}
          <button
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium text-muted-foreground"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-5" />
            More
          </button>
        </div>
      </nav>

      {/* ================= MOBILE DRAWER ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="glass absolute left-0 top-0 flex h-full w-72 flex-col border-r border-border shadow-2xl" role="dialog" aria-label="Navigation">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-display flex items-center gap-2 text-sm font-bold">
                <EngineMark className="size-7" /> AI <span className="neon-text">FITNESS</span> ENGINE
              </span>
              <button className="rounded-lg border border-border p-1.5 text-muted-foreground" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <SidebarBody isAdmin={isAdmin} planLabel={planLabel} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
