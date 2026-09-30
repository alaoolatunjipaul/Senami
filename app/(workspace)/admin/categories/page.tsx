import type { Metadata } from "next";

import { ScopeNotice } from "@/features/shell/scope-notice";

export const metadata: Metadata = { title: "Categories" };

export default function AdminCategoriesPage() {
  return (
    <ScopeNotice
      title="Categories"
      phase="Phase 15"
      description="Category trees, labels and prioritisation arrive with the administration phase."
    />
  );
}
