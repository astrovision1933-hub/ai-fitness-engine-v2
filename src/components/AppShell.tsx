import { useAuth } from "@/hooks/use-auth";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
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

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const MAIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/coach", label: "AI Coach", icon: Bot },
  { to: "/workout", label: "Workout", icon: Dumbbell },
  { to: "/nutrition", label: "Nutrition", icon: Apple },
  { to: "/progress", label: "Progress", icon: TrendingUp },
];

const MODULE_NAV: NavItem[] = [
  { to: "/supplements", label: "Supplements", icon: Pill },
  { to: "/products", label: "Products", icon: Package },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/bodybuilding", label: "Competition", icon: Trophy },
  { to: "/checkin", label: "Check-In", icon: ClipboardCheck },
  { to: "/reports", label: "Reports", icon: FileText },
];

const ACCOUNT_NAV: NavItem[] = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/subscription", label: "Plan", icon: CreditCard },
];

const ADMIN_NAV: NavItem = { to: "/admin", label: "Admin", icon: ShieldCheck };

const SEARCH_INDEX = [
  { label: "Dashboard", to: "/dashboard", keys: "home overview start" },
  { label: "AI Coach", to: "/coach", keys: "chat bot assistant ask coach" },
  { label: "Workout", to: "/workout", keys: "training plan exercise gym create" },
  { label: "Nutrition", to: "/nutrition", keys: "diet food meal calories protein log" },
  { label: "Progress", to: "/progress", keys: "stats charts tracking history" },
  { label: "Supplements", to: "/supplements", keys: "label analyze verify stack" },
  { label: "Products", to: "/products", keys: "compare market recommendations buy" },
  { label: "Goals", to: "/goals", keys: "target aim" },
  { label: "Competition", to: "/bodybuilding", keys: "bodybuilding contest prep stage" },
  { label: "Check-In", to: "/checkin", keys: "daily log weigh in" },
  { label: "Reports", to: "/reports", keys: "weekly monthly summary" },
  { label: "Profile", to: "/profile", keys: "account body stats personal" },
  { label: "Settings", to: "/settings", keys: "preferences privacy voice" },
  { label: "Plan", to: "/subscription", keys: "premium upgrade trial billing price" },
];

function EngineMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#0c110c" stroke="var(--terminal-green)" strokeOpacity="0.6" />
      <g fill="var(--terminal-green)">
        <rect x="9" y="8.5" width="14" height="3.2" rx="1" />
        <rect x="9" y="13.5" width="4.2" height="11" rx="1" />
        <rect x="14.5" y="15.5" width="8.5" height="3.2" rx="1" />
        <rect x="14.5" y="20.3" width="8.5" height="3.2" rx="1" />
      </g>
    </svg>
  );
}

function NavLinkRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
          isActive
            ? "border border-primary/25 bg-primary/10 text-primary-foreground text-[#dcff8a] shadow-[inset_0_0_18px_rgba(163,230,53,0.08)]"
            : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--neon-glow)] transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
            aria-hidden
          />
          <Icon
            className={cn(
              "size-[18px] shrink-0 transition-all duration-200",
              isActive ? "text-primary drop-shadow-[0_0_6px_var(--neon-glow)]" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          <span className="font-display tracking-wide">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function SidebarBody({ isAdmin, planLabel, onNavigate }: { isAdmin: boolean; planLabel: string; onNavigate?: () => void }) {
  return (
    <>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Primary">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">Main</p>
          {MAIN_NAV.map((item) => (
            <NavLinkRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">Modules</p>
          {MODULE_NAV.map((item) => (
            <NavLinkRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">Account</p>
          {ACCOUNT_NAV.map((item) => (
            <NavLinkRow key={item.to} item={item} onNavigate={onNavigate} />
          ))}
          {isAdmin && <NavLinkRow item={ADMIN_NAV} onNavigate={onNavigate} />}
        </div>
      </nav>

      {/* premium upgrade card */}
      <div className="p-3">
        {planLabel.toLowerCase() === "free" ? (
          <div className="gold-glow relative overflow-hidden rounded-xl border border-[#f0b429]/25 bg-gradient-to-b from-[#191408] to-[#0d110c] p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>👑</span>
              <p className="font-display text-sm font-bold uppercase tracking-[0.14em] text-[#f0b429]">
                Upgrade to Premium
              </p>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-[11px] text-foreground/85">
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
              className="mt-3 block rounded-lg bg-gradient-to-r from-[#f0b429] to-[#d0ff67] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#1a1405] transition-all duration-200 hover:brightness-110 hover:-translate-y-px"
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
  const location = useLocation();
  const isAdmin = user?.role === "admin";

  const notifications = useQuery(api.profile.getNotifications);
  const ent = useQuery(api.subscriptions.getMyEntitlement, {});
  const planLabel = ent?.planName ?? "Free";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Close overlays on navigation.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter(
      (r) => r.label.toLowerCase().includes(q) || r.keys.includes(q),
    ).slice(0, 6);
  }, [query]);

  function runSearch(to: string) {
    setQuery("");
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
              placeholder="Search workouts, diet, supplements, goals..."
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
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              className="relative rounded-lg border border-border p-2 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:text-foreground"
              onClick={() => navigate("/dashboard")}
              aria-label={`Notifications${notifCount ? ` (${notifications?.length ?? 0})` : ""}`}
            >
              <Bell className="size-[18px]" />
              {notifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-[0_0_8px_var(--neon-glow)]">
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
                        onClick={() => navigate(item.to)}
                      >
                        <item.icon className="size-4 text-primary" aria-hidden />
                        {item.label}
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
      <aside className="fixed bottom-0 left-0 top-16 z-40 hidden w-[248px] flex-col border-r border-border bg-sidebar/85 backdrop-blur-md lg:flex">
        <SidebarBody isAdmin={isAdmin} planLabel={planLabel} />
      </aside>

      {/* ================= CONTENT ================= */}
      <div className="lg:pl-[248px]">
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
              {item.label}
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
