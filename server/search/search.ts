"use server";

import type { SearchResultGroup } from "@/lib/domain/search";
import { demoInboxStore } from "@/server/inbox/store";

/**
 * Global search provider (server action, §13).
 *
 * Searches the inbox dataset for conversations and customers. Results are
 * grouped and each item carries an href the shell navigates to. The shell's
 * debounce, keyboard navigation and grouping live in
 * `features/shell/global-search.tsx`; this is only the data seam.
 */
export async function searchAll(query: string): Promise<readonly SearchResultGroup[]> {
  return demoInboxStore().search(query);
}