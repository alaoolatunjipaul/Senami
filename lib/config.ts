/**
 * Static application configuration.
 *
 * This module is safe to import from both server and client components. It
 * contains no secrets and no environment-dependent runtime state - environment
 * access lives exclusively in `lib/env.ts`.
 */
export const APP_CONFIG = {
  name: "Senami",
  shortName: "Senami",
  tagline: "Social Customer Service & Response Management",
  description:
    "Senami unifies public posts, comments, mentions and direct messages into a single " +
    "operational inbox for customer service teams, with SLA control, AI assistance, " +
    "escalation routing, QA and a complete audit trail.",
  supportEmail: "support@senami.example",
} as const;

/**
 * Senami is a demonstration platform. Every customer, social account, message
 * and transaction in this build is synthetic (spec sections 5 and 47).
 *
 * The flag is surfaced in the UI so synthetic accounts can never be mistaken
 * for live social integrations.
 */
export const DEMO_CONFIG = {
  enabled: true,
  label: "DEMO ENVIRONMENT",
  description: "All data, social accounts and AI responses in Senami are synthetic.",
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
