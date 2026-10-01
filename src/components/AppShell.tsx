import { useAuth } from "@/hooks/use-auth";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";
import { Link, NavLink, useNavigate } from "react-router";
import { useEffect, useState } from "react";

const PRIMARY_NAV = [
  { to: "/dashboard", label: "HOME" },
  { to: "/coach", label: "COACH" },
  { to: "/workout", label: "WORKOUT" },
  { to: "/nutrition", label: "NUTRITION" },
  { to: "/progress", label: "PROGRESS" },
  { to: "/profile", label: "PROFILE" },
];

const SECONDARY_NAV = [
  { to: "/goals", label: "GOALS" },
  { to: "/checkin", label: "CHECK-IN" },
  { to: "/bodybuilding", label: "BODYBUILDING" },
  { to: "/supplements", label: "SUPPLEMENTS" },
  { to: "/products", label: "PRODUCTS" },
  { to: "/reports", label: "REPORTS" },
];

const ACCOUNT_NAV = [
  { to: "/settings", label: "SETTINGS" },
  { to: "/subscription", label: "PLAN" },
];

const ADMIN_NAV = { to: "/admin", label: "ADMIN" };

const FOOTER_MODULES = [
  { to: "/supplements", label: "SUPPLEMENTS" },
  { to: "/products", label: "PRODUCTS" },
  { to: "/reports", label: "REPORTS" },
  { to: "/settings", label: "SETTINGS" },
  { to: "/subscription", label: "PLAN" },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = useClock();
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      {/* top command bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => navigate("/dashboard")}
          >
            <span className="border border-terminal-green/50 bg-[#eef3ea] px-1.5 py-0.5 text-[11px] font-bold tracking-[0.2em] text-status-ok">
              AFE
            </span>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.22em] sm:inline">
              AI Fitness Engine
            </span>
          </button>

          <nav className="hidden items-center gap-1 md:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                    isActive
                      ? "border border-terminal-green/50 bg-[#eef3ea] text-status-ok"
                      : "border border-transparent text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {SECONDARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "px-2 py-1.5 text-[11px] uppercase tracking-[0.16em] transition-colors",
                    isActive
                      ? "border border-terminal-amber/50 bg-[#fdf3e7] text-status-warn"
                      : "border border-transparent text-muted-foreground/70 hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            {ACCOUNT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "px-2 py-1.5 text-[11px] uppercase tracking-[0.16em] transition-colors",
                    isActive
                      ? "border border-border bg-muted text-foreground"
                      : "border border-transparent text-muted-foreground/70 hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to={ADMIN_NAV.to}
                className={({ isActive }) =>
                  cn(
                    "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
                    isActive
                      ? "border border-status-warn/60 bg-[#fdf3e7] text-status-warn"
                      : "border border-transparent text-status-warn/80 hover:text-status-warn",
                  )
                }
              >
                {ADMIN_NAV.label}
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] text-muted-foreground lg:inline">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · SESSION ACTIVE
            </span>
            <SignOutButton />
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex justify-between gap-1 overflow-x-auto border-t border-border px-2 py-1.5 md:hidden">
          {[...PRIMARY_NAV, ...SECONDARY_NAV, ...ACCOUNT_NAV, ...(isAdmin ? [ADMIN_NAV] : [])].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex-1 whitespace-nowrap px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em]",
                  isActive ? "text-status-ok underline underline-offset-4" : "text-muted-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>AI FITNESS ENGINE — CORE v0.1 · PART 4/4 · ALL MODULES LIVE</span>
          <span className="flex flex-wrap items-center gap-3">
            {FOOTER_MODULES.map((m) => (
              <Link key={m.to} to={m.to} className="transition-colors hover:text-foreground">
                {m.label}
              </Link>
            ))}
          </span>
          <span>SIGNED IN AS {user?.email ?? "GUEST"}</span>
        </div>
      </footer>
    </div>
  );
}
