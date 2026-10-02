import { useState } from "react";
import { cn } from "@/lib/utils";
import { coachPortrait } from "@/lib/coach-media";

/**
 * <CoachAvatar /> — a persona's real portrait photo in an accent ring, with a
 * live "online" pulse. If the photo cannot load (offline, blocked CDN, or a
 * persona with no portrait yet) it degrades to the neon initials badge, so the
 * roster always renders something premium.
 */
export function CoachAvatar({
  name,
  accent,
  className,
}: {
  name: string;
  accent: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = coachPortrait(name);
  const showPhoto = Boolean(src) && !failed;

  return (
    <span
      style={{ borderColor: `${accent}66`, color: accent, background: "#0c110c" }}
      className={cn(
        "relative flex size-14 shrink-0 items-center justify-center overflow-visible rounded-full border font-display text-lg font-bold",
        className,
      )}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full rounded-full object-cover ring-1 ring-black/50"
        />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
      <span className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-background">
        <span
          className="size-2 animate-pulse rounded-full bg-primary shadow-[0_0_6px_var(--neon-glow)]"
          aria-hidden
        />
      </span>
    </span>
  );
}
