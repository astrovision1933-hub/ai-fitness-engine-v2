import { cn } from "@/lib/utils";

/* Reusable Terminal-theme primitives shared across all pages. */

export function Panel({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-border bg-card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-2">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</h2>
            {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

export function StatChip({ label, value, tone = "ink" }: { label: string; value: React.ReactNode; tone?: "ink" | "ok" | "warn" | "info" }) {
  const toneClass =
    tone === "ok" ? "text-status-ok" : tone === "warn" ? "text-status-warn" : tone === "info" ? "text-status-info" : "";
  return (
    <div className="border border-border bg-secondary/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold", toneClass)}>{value}</div>
    </div>
  );
}

export function SectionHeader({ index, title, hint }: { index: string; title: string; hint?: string }) {
  return (
    <div className="mb-1 flex items-baseline gap-2">
      <span className="text-status-ok">[{index}]</span>
      <span className="text-xs font-semibold uppercase tracking-[0.18em]">{title}</span>
      {hint && <span className="hidden text-[11px] text-muted-foreground sm:inline">— {hint}</span>}
    </div>
  );
}

export function TerminalBadge({
  children,
  tone = "ink",
}: {
  children: React.ReactNode;
  tone?: "ink" | "ok" | "warn" | "info";
}) {
  const toneClass =
    tone === "ok"
      ? "border-terminal-green/40 bg-[#eef3ea] text-status-ok"
      : tone === "warn"
        ? "border-terminal-amber/40 bg-[#fdf3e7] text-status-warn"
        : tone === "info"
          ? "border-terminal-cyan/40 bg-[#e8f4f6] text-status-info"
          : "border-border bg-secondary text-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em]",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

export function AsciiBar({ value, width = 20 }: { value: number; width?: number }) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * width);
  return (
    <span className="font-mono text-[11px] tracking-tight text-status-ok" aria-label={`${Math.round(value * 100)}%`}>
      [{"█".repeat(filled)}{"·".repeat(width - filled)}]
    </span>
  );
}

export function StatusDot({ tone = "ok", pulse = false }: { tone?: "ok" | "warn" | "info" | "off"; pulse?: boolean }) {
  const color =
    tone === "ok" ? "bg-[#23a03c]" : tone === "warn" ? "bg-[#b45309]" : tone === "info" ? "bg-[#0e7490]" : "bg-muted-foreground/40";
  return (
    <span
      className={cn("inline-block size-1.5 rounded-full", color, pulse && "animate-pulse")}
      aria-hidden
    />
  );
}
