/**
 * Global search result shape.
 *
 * Lives in `lib` so both the shell UI (`features/shell/global-search.tsx`) and
 * the server-side provider (`server/search/search.ts`) agree on one contract
 * without the server importing a feature module.
 */
export interface SearchResultItem {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly href: string;
}

export interface SearchResultGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly SearchResultItem[];
}