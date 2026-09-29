import { Mic, Rss } from "lucide-react";
import { PLATFORM_LABELS } from "@/lib/labels";
import type { Platform } from "@/lib/types/content";
import { cn } from "@/lib/utils";

/** Couleur de marque de chaque plateforme. */
export const PLATFORM_COLORS: Record<Platform, string> = {
  linkedin: "#0a66c2",
  youtube: "#ff0000",
  reels: "#e4405f",
  newsletter: "#ff6719", // Substack
  podcast: "#8e44ad",
  blog: "#334155",
  twitter: "#000000",
};

/* Tracés officiels (Simple Icons, viewBox 24). */
const PATHS: Partial<Record<Platform, string>> = {
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  reels:
    "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
  newsletter:
    "M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z",
  twitter:
    "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
};

/** Plateformes sans logo de marque : une icône lucide plutôt qu'un micro par défaut. */
const FALLBACK_ICONS: Partial<Record<Platform, typeof Mic>> = {
  blog: Rss,
};

/**
 * Logo d'une plateforme, aux couleurs de la marque. `muted` = monochrome dans
 * la couleur du texte (cartes du calendrier et du kanban, où il doit rester discret).
 */
export function PlatformIcon({
  platform,
  className,
  muted = false,
}: {
  platform: Platform;
  className?: string;
  muted?: boolean;
}) {
  const path = PATHS[platform];
  const color = muted ? "currentColor" : PLATFORM_COLORS[platform];
  if (!path) {
    const Fallback = FALLBACK_ICONS[platform] ?? Mic;
    return (
      <Fallback
        className={cn("size-3.5 shrink-0", className)}
        style={{ color }}
        strokeWidth={2.4}
        aria-label={PLATFORM_LABELS[platform]}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-3.5 shrink-0", className)}
      fill={color}
      role="img"
      aria-label={PLATFORM_LABELS[platform]}
    >
      <path d={path} />
    </svg>
  );
}

/** Rangée de logos, une par plateforme du contenu. */
export function PlatformIcons({
  platforms,
  className,
  iconClassName,
  muted = false,
}: {
  platforms: readonly Platform[];
  className?: string;
  iconClassName?: string;
  muted?: boolean;
}) {
  if (platforms.length === 0) return null;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-0.5", className)}
      title={platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
    >
      {platforms.map((p) => (
        <PlatformIcon key={p} platform={p} className={iconClassName} muted={muted} />
      ))}
    </span>
  );
}
