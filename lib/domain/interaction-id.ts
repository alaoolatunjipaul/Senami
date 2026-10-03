import type { ChannelId } from "@/lib/config";

/**
 * Interaction identity.
 *
 * Every interaction a customer has with Senami carries a human-facing reference
 * an agent can read out over the phone or paste into a search box, for example
 * `INT-SOC-20261001-00421`. The rules are deliberately boring so the value can
 * be produced identically by the demo store, an API handler and a future
 * PostgreSQL/Prisma writer:
 *
 * - deterministic: the same interaction always yields the same reference
 * - stable: it never changes once assigned, because it is derived from data the
 *   interaction already owns (its channel family, its calendar day, its ordinal)
 * - unique: the sequence is scoped to the channel family and calendar day
 * - sortable: the embedded day and zero-padded sequence sort chronologically
 *
 * The internal conversation `id` remains the primary key; this is an additional
 * indexed column, never a replacement for it.
 */

/** Channel family codes. Every current channel is social; more can be added. */
export const INTERACTION_CHANNEL_CODES: Record<ChannelId, string> = {
  instagram: "SOC",
  facebook: "SOC",
  x: "SOC",
  tiktok: "SOC",
};

/** Matches every reference this module can produce. */
export const INTERACTION_ID_PATTERN = /^INT-([A-Z]{2,4})-(\d{8})-(\d{5})$/;

/** Longest sequence rendered before the counter is truncated to five digits. */
const MAX_SEQUENCE = 99_999;

function dayStamp(receivedAt: Date): string {
  const year = String(receivedAt.getUTCFullYear()).padStart(4, "0");
  const month = String(receivedAt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(receivedAt.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Build the reference for an interaction.
 *
 * @param channel  the channel the interaction arrived on
 * @param receivedAt  when the interaction started; the calendar day is part of
 *   the value so references sort chronologically as plain text
 * @param sequence  1-based ordinal of the interaction within that channel family
 *   and calendar day
 */
export function interactionIdFor(channel: ChannelId, receivedAt: Date, sequence: number): string {
  const code = INTERACTION_CHANNEL_CODES[channel];
  const ordinal = Math.max(1, Math.min(Math.trunc(sequence), MAX_SEQUENCE));
  return `INT-${code}-${dayStamp(receivedAt)}-${String(ordinal).padStart(5, "0")}`;
}

/** Whether a string is a well-formed interaction reference. */
export function isInteractionId(value: string): boolean {
  return INTERACTION_ID_PATTERN.test(value.trim().toUpperCase());
}

/** Normalise operator input so `int-soc-...` and padded variants still match. */
export function normaliseInteractionId(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (!isInteractionId(trimmed)) return trimmed;
  const [, code, day, sequence] = trimmed.match(INTERACTION_ID_PATTERN) ?? [];
  return `INT-${code}-${day}-${sequence}`;
}

export interface InteractionIdentityInput {
  readonly id: string;
  readonly interactionId?: string | null;
}

/**
 * The reference to display and search for. Legacy rows that predate interaction
 * references fall back to their internal id so the UI never renders a blank.
 */
export function interactionReference(record: InteractionIdentityInput): string {
  return record.interactionId ?? record.id;
}