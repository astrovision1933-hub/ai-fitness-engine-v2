import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * <AIFitnessRobot /> — the visual identity of the AI Fitness Engine.
 * A friendly, athletic AI coach robot: black metallic body, brushed titanium
 * armor, neon lime circuits and glowing eyes. Pure SVG + CSS animation
 * (calm, premium, reduced-motion aware — see index.css).
 *
 * States: idle | thinking | speaking | listening | success | warning | loading
 */
export type RobotState =
  | "idle"
  | "thinking"
  | "speaking"
  | "listening"
  | "success"
  | "warning"
  | "loading";

export function AIFitnessRobot({
  state = "idle",
  className,
  photoSrc = null,
}: {
  state?: RobotState;
  className?: string;
  /**
   * Optional studio render / portrait to show for the calm `idle` hero state.
   * Drop the image in `public/` and it is picked up automatically; if the file
   * is missing or fails to load, the SVG robot takes over so the hero never
   * renders a broken image. Live states (thinking / speaking / listening / …)
   * always use the animated SVG.
   */
  photoSrc?: string | null;
}) {
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const armor = `afer-armor-${uid}`;
  const armorDark = `afer-dark-${uid}`;
  const neon = `afer-neon-${uid}`;
  const fade = `afer-fade-${uid}`;
  const glow = `afer-glow-${uid}`;
  const visor = `afer-visor-${uid}`;

  const accent = "var(--robot-accent)";

  const photo = state === "idle" && photoSrc && !photoFailed ? photoSrc : null;

  if (photo) {
    return (
      <div
        className={cn("robot-stage relative", `robot-${state}`, className)}
        data-state={state}
        aria-hidden
      >
        <img
          src={photo}
          alt=""
          onLoad={() => setPhotoLoaded(true)}
          onError={() => setPhotoFailed(true)}
          className={cn(
            "h-full w-full object-contain drop-shadow-[0_0_44px_rgba(163,230,53,0.16)] transition-opacity duration-700",
            photoLoaded ? "opacity-100" : "opacity-0",
          )}
        />
        {!photoLoaded && <AIFitnessRobot state={state} className="absolute inset-0" />}
      </div>
    );
  }

  return (
    <div className={cn("robot-stage", `robot-${state}`, className)} data-state={state} aria-hidden>
      <svg viewBox="0 0 420 560" className="h-full w-full" role="img" aria-label="AI Fitness Coach robot">
        <defs>
          <linearGradient id={armor} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a524a" />
            <stop offset="45%" stopColor="#2b312b" />
            <stop offset="100%" stopColor="#141814" />
          </linearGradient>
          <linearGradient id={armorDark} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#222822" />
            <stop offset="100%" stopColor="#0d110d" />
          </linearGradient>
          <linearGradient id={neon} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d0ff67" />
            <stop offset="100%" stopColor="#65d413" />
          </linearGradient>
          <linearGradient id={visor} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a0e0a" />
            <stop offset="50%" stopColor="#131a12" />
            <stop offset="100%" stopColor="#0a0e0a" />
          </linearGradient>
          <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" />
            <stop offset="72%" stopColor="white" stopOpacity="0.85" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${fade}-m`}>
            <rect x="0" y="0" width="420" height="560" fill={`url(#${fade})`} />
          </mask>
          <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ambient neon backdrop */}
        <ellipse cx="210" cy="300" rx="180" ry="220" fill={accent} opacity="0.07" style={{ filter: `url(#${glow})` }} />

        {/* holographic halo arcs behind shoulders */}
        <g className="anim-halo" opacity="0.5" style={{ transformBox: "fill-box" }}>
          <ellipse cx="210" cy="285" rx="150" ry="42" fill="none" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="10 14" />
          <ellipse cx="210" cy="285" rx="120" ry="30" fill="none" stroke={accent} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 10" />
        </g>

        {/* floating holographic particles */}
        <g fill={accent}>
          <circle className="anim-particle" cx="66" cy="180" r="2.4" style={{ animationDelay: "0s" }} />
          <circle className="anim-particle" cx="352" cy="140" r="2" style={{ animationDelay: "1.2s" }} />
          <circle className="anim-particle" cx="38" cy="330" r="1.8" style={{ animationDelay: "2.1s" }} />
          <circle className="anim-particle" cx="382" cy="300" r="2.6" style={{ animationDelay: "0.7s" }} />
          <circle className="anim-particle" cx="90" cy="90" r="1.6" style={{ animationDelay: "3s" }} />
          <circle className="anim-particle" cx="330" cy="420" r="2.2" style={{ animationDelay: "1.8s" }} />
        </g>

        {/* ============ BODY ============ */}
        <g mask={`url(#${fade}-m)`}>
          <g className="anim-breathe" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            {/* --- head --- */}
            <g>
              {/* listening ring (visible only in listening state) */}
              <circle className="anim-ring" cx="210" cy="106" r="86" fill="none" stroke={accent} strokeWidth="2" />
              <rect x="158" y="52" width="104" height="96" rx="36" fill={`url(#${armor})`} stroke="#000" strokeOpacity="0.4" />
              {/* crest */}
              <rect x="196" y="44" width="28" height="12" rx="6" fill={`url(#${armorDark})`} />
              <rect x="203" y="40" width="14" height="6" rx="3" style={{ fill: accent }} filter={`url(#${glow})`} />
              {/* visor */}
              <rect x="170" y="78" width="80" height="34" rx="17" fill={`url(#${visor})`} stroke={accent} strokeOpacity="0.35" />
              {/* eyes */}
              <g className="anim-eye" filter={`url(#${glow})`}>
                <rect x="183" y="89" width="16" height="9" rx="4.5" style={{ fill: accent }} />
                <rect x="221" y="89" width="16" height="9" rx="4.5" style={{ fill: accent }} />
              </g>
              {/* speaking mouth-wave (speaking state) */}
              <g className="anim-wave-mouth" filter={`url(#${glow})`}>
                <rect x="196" y="122" width="3" height="8" rx="1.5" style={{ fill: accent }} />
                <rect x="203" y="119" width="3" height="11" rx="1.5" style={{ fill: accent }} />
                <rect x="210" y="121" width="3" height="9" rx="1.5" style={{ fill: accent }} />
                <rect x="217" y="119" width="3" height="11" rx="1.5" style={{ fill: accent }} />
                <rect x="224" y="122" width="3" height="8" rx="1.5" style={{ fill: accent }} />
              </g>
              {/* ear pods */}
              <rect x="146" y="86" width="14" height="26" rx="7" fill={`url(#${armorDark})`} />
              <rect x="260" y="86" width="14" height="26" rx="7" fill={`url(#${armorDark})`} />
              <circle cx="153" cy="99" r="2.4" style={{ fill: accent }} opacity="0.9" />
              <circle cx="267" cy="99" r="2.4" style={{ fill: accent }} opacity="0.9" />
            </g>

            {/* --- neck --- */}
            <path d="M186 148 h48 v18 a10 10 0 0 1 -10 10 h-28 a10 10 0 0 1 -10 -10 z" fill={`url(#${armorDark})`} />
            <line x1="192" y1="160" x2="228" y2="160" stroke={accent} strokeOpacity="0.55" strokeWidth="1.6" />

            {/* --- shoulders (broad athletic armor) --- */}
            <path d="M96 196 q6 -34 46 -40 l48 -2 v52 h-88 q-8 0 -6 -10z" fill={`url(#${armor})`} stroke="#000" strokeOpacity="0.35" />
            <path d="M324 196 q-6 -34 -46 -40 l-48 -2 v52 h88 q8 0 6 -10z" fill={`url(#${armor})`} stroke="#000" strokeOpacity="0.35" />
            <path d="M112 190 q10 -22 40 -26" fill="none" stroke={accent} strokeOpacity="0.6" strokeWidth="1.8" />
            <path d="M308 190 q-10 -22 -40 -26" fill="none" stroke={accent} strokeOpacity="0.6" strokeWidth="1.8" />

            {/* --- chest plate with engine core --- */}
            <path d="M150 166 h120 q22 0 24 22 l6 78 q2 26 -22 34 l-52 14 q-16 4 -32 0 l-52 -14 q-24 -8 -22 -34 l6 -78 q2 -22 24 -22z" fill={`url(#${armor})`} stroke="#000" strokeOpacity="0.35" />
            {/* pec seams */}
            <path d="M170 190 q40 18 80 0" fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="2" />
            {/* engine core + logo */}
            <circle className="anim-core" cx="210" cy="238" r="30" fill="#0a0e0a" stroke={accent} strokeWidth="2" filter={`url(#${glow})`} />
            <g fill={`url(#${neon})`}>
              <rect x="196" y="224" width="28" height="8" rx="2" />
              <rect x="196" y="234" width="8" height="22" rx="2" />
              <rect x="206" y="238" width="14" height="8" rx="2" />
              <rect x="206" y="248" width="14" height="8" rx="2" />
            </g>
            {/* chest circuits */}
            <g stroke={accent} strokeOpacity="0.45" strokeWidth="1.4" fill="none">
              <path d="M170 260 q-8 24 6 40" />
              <path d="M250 260 q8 24 -6 40" />
              <path d="M182 210 h-20" />
              <path d="M238 210 h20" />
            </g>
            <circle cx="163" cy="210" r="2.2" style={{ fill: accent }} opacity="0.8" />
            <circle cx="257" cy="210" r="2.2" style={{ fill: accent }} opacity="0.8" />

            {/* --- arms (relaxed coach pose) --- */}
            <g>
              {/* left */}
              <rect x="84" y="206" width="44" height="88" rx="22" fill={`url(#${armor})`} stroke="#000" strokeOpacity="0.35" />
              <rect x="88" y="292" width="36" height="86" rx="18" fill={`url(#${armorDark})`} stroke="#000" strokeOpacity="0.35" />
              <rect x="92" y="376" width="28" height="40" rx="12" fill={`url(#${armor})`} />
              <line x1="106" y1="226" x2="106" y2="270" stroke={accent} strokeOpacity="0.5" strokeWidth="1.6" />
              {/* right */}
              <rect x="292" y="206" width="44" height="88" rx="22" fill={`url(#${armor})`} stroke="#000" strokeOpacity="0.35" />
              <rect x="296" y="292" width="36" height="86" rx="18" fill={`url(#${armorDark})`} stroke="#000" strokeOpacity="0.35" />
              <rect x="300" y="376" width="28" height="40" rx="12" fill={`url(#${armor})`} />
              <line x1="314" y1="226" x2="314" y2="270" stroke={accent} strokeOpacity="0.5" strokeWidth="1.6" />
            </g>

            {/* --- waist segments (fade into the interface) --- */}
            <path d="M160 314 h100 l-6 26 h-88 z" fill={`url(#${armorDark})`} />
            <path d="M168 348 h84 l-8 24 h-68 z" fill={`url(#${armorDark})`} opacity="0.85" />
            <g stroke={accent} strokeOpacity="0.5" strokeWidth="1.4">
              <line x1="166" y1="322" x2="254" y2="322" />
              <line x1="174" y1="354" x2="246" y2="354" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
