/**
 * Static application configuration.
 *
 * This module is safe to import from both server and client components. It
 * contains no secrets and no environment-dependent runtime state - environment
 * access lives exclusively in `lib/env.ts`.
 */
export const APP_CONFIG = {
  name: "FIRSTASSIST",
  shortName: "FIRSTASSIST",
  deskName: "Response Desk",
  tagline: "FirstBank Response Desk & Service Operations",
  description:
    "FirstBank FIRSTASSIST unifies customer emails, protected communications, and enquiries into a single operational workspace with SLA control, AI assistance, escalation routing, and complete audit trail.",
  supportEmail: "firstcontact@firstbankgroup.com",
} as const;

/**
 * Demo configuration.
 */
export const DEMO_CONFIG = {
  enabled: false,
  label: "DEMO ENVIRONMENT",
  description: "FirstBank FIRSTASSIST Response Desk simulation.",
} as const;

/** Default response time targets, in minutes, keyed by priority. */
export const DEFAULT_SLA_MINUTES = {
  critical: 15,
  high: 60,
  medium: 240,
  low: 480,
  normal: 480,
} as const;

export type SlaPriority = keyof typeof DEFAULT_SLA_MINUTES;

/** Initial channels (spec section 4). All are simulated providers. */
export const CHANNELS = ["instagram", "facebook", "x", "tiktok"] as const;

export type ChannelId = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
};
