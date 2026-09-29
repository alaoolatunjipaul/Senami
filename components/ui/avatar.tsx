import { cn } from "@/lib/utils";

/**
 * Deterministic avatar.
 *
 * Uses a hash of the seed string to pick one of a small set of muted,
 * professional background tints, so the same person is always the same colour
 * across the inbox, the customer panel and session lists. Initials are always
 * rendered as the accessible name, which means no image request is required
 * for the demo dataset.
 */

const AVATAR_TONES = [
  "bg-primary-subtle text-primary-ink",
  "bg-info-subtle text-info",
  "bg-ai-subtle text-ai",
  "bg-success-subtle text-success",
  "bg-warning-subtle text-warning",
  "bg-critical-subtle text-critical",
] as const;

const AVATAR_SIZES = {
  xs: "size-5 text-[10px]",
  sm: "size-6 text-[11px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-14 text-lg",
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Derive up to two initials from a display name. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();

  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export interface AvatarProps {
  name: string;
  size?: AvatarSize;
  /** Optional presence marker, e.g. an online dot. */
  presence?: "online" | "offline" | "busy";
  className?: string;
}

export function Avatar({ name, size = "md", presence, className }: AvatarProps) {
  const tone = AVATAR_TONES[hashString(name) % AVATAR_TONES.length] ?? AVATAR_TONES[0];
  const presenceColor =
    presence === "online"
      ? "bg-success"
      : presence === "busy"
        ? "bg-critical"
        : presence === "offline"
          ? "bg-ink-subtle"
          : null;

  return (
    <span
      // The name is the accessible name; a decorative avatar adds nothing.
      role="img"
      aria-label={name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        tone,
        AVATAR_SIZES[size],
        className,
      )}
    >
      {getInitials(name)}
      {presenceColor ? (
        <span
          aria-hidden="true"
          className={cn(
            "ring-surface absolute right-0 bottom-0 size-2.5 rounded-full ring-2",
            presenceColor,
          )}
        />
      ) : null}
    </span>
  );
}
