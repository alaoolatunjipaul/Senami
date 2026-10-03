/**
 * AI policy store (Phase 10, section 27).
 *
 * The single writable copy of the AI policy. Everything that reads policy - the
 * assistant, the governance screen, the tests - reads it from here, so a change
 * made by an administrator takes effect everywhere immediately and is recorded
 * once.
 *
 * Bump `version` whenever the policy changes: every suggestion stores the
 * version in force when it was produced, which is what makes an old audit entry
 * interpretable after the rules have moved on.
 */

import { DEFAULT_AI_POLICY, type AiPolicy } from "@/lib/domain/ai-governance";

export interface AiPolicyChange {
  readonly at: string;
  readonly actor: string;
  readonly summary: string;
}

let policy: AiPolicy = DEFAULT_AI_POLICY;
let changes: AiPolicyChange[] = [];

export function currentAiPolicy(): AiPolicy {
  return policy;
}

export function aiPolicyHistory(): readonly AiPolicyChange[] {
  return changes;
}

/**
 * Replace the policy. Bumps the version automatically so a stored suggestion
 * can never claim to have been produced under the rules that follow it.
 */
export function updateAiPolicy(
  next: AiPolicy,
  actor: string,
  now: Date = new Date(),
): AiPolicy {
  const updated: AiPolicy = { ...next, version: bumpVersion(policy.version) };
  const changed = describeChange(policy, updated);
  policy = updated;
  if (changed !== null) {
    changes = [
      { at: now.toISOString(), actor, summary: changed },
      ...changes,
    ];
  }
  return policy;
}

export function resetAiPolicy(): AiPolicy {
  policy = DEFAULT_AI_POLICY;
  changes = [];
  return policy;
}

/** `2026.10.1` -> `2026.10.2`. */
function bumpVersion(version: string): string {
  const parts = version.split(".");
  const last = Number(parts[parts.length - 1]);
  if (!Number.isFinite(last)) return `${version}.1`;
  return [...parts.slice(0, -1), String(last + 1)].join(".");
}

/** Human-readable list of what actually changed, or null when nothing did. */
function describeChange(before: AiPolicy, after: AiPolicy): string | null {
  const changes: string[] = [];
  if (before.mode !== after.mode) {
    changes.push(`mode ${before.mode} -> ${after.mode}`);
  }
  if (before.redactSensitiveData !== after.redactSensitiveData) {
    changes.push(`sensitive data redaction ${after.redactSensitiveData ? "on" : "off"}`);
  }
  if (before.escalateOnLowConfidence !== after.escalateOnLowConfidence) {
    changes.push(`low-confidence escalation ${after.escalateOnLowConfidence ? "on" : "off"}`);
  }
  if (before.shareReviewedSuggestions !== after.shareReviewedSuggestions) {
    changes.push(`reuse of reviewed replies ${after.shareReviewedSuggestions ? "on" : "off"}`);
  }
  const addedActions = after.enabledActions.filter((a) => !before.enabledActions.includes(a));
  if (addedActions.length > 0) changes.push(`enabled ${addedActions.join(", ")}`);
  const removedActions = before.enabledActions.filter((a) => !after.enabledActions.includes(a));
  if (removedActions.length > 0) changes.push(`disabled ${removedActions.join(", ")}`);
  const blocked = after.blockedIntents.filter((i) => !before.blockedIntents.includes(i));
  if (blocked.length > 0) changes.push(`blocked ${blocked.join(", ")}`);
  return changes.length > 0 ? changes.join("; ") : null;
}