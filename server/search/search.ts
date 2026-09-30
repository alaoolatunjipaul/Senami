import type { SearchResultGroup } from "@/features/shell/global-search";

/**
 * Global search provider (server action).
 *
 * The shell's search UI (debounce, grouping, keyboard navigation) is fully
 * implemented; this module is the data seam it queries. Results arrive with the
 * data phases (5-6) once conversations, customers and cases are indexed. Until
 * then it returns no results rather than fabricated ones.
 */
export async function searchAll(query: string): Promise<readonly SearchResultGroup[]> {
  void query;
  return [];
}
