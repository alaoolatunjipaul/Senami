import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/features/shell/page-header";
import { cn } from "@/lib/utils";

/**
 * Honest in-progress notice (§56).
 *
 * Navigation items only exist once their route exists, and every route renders
 * this until its phase ships the real workspace. The phase is named explicitly
 * so a route is never a blank page or a dead button.
 */
export interface ScopeNoticeProps {
  title: string;
  description: string;
  phase: string;
  className?: string;
}

export function ScopeNotice({ title, description, phase, className }: ScopeNoticeProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <PageHeader
        title={title}
        description="This workspace is part of the Senami roadmap and will arrive with its phase."
      />
      <div className="flex flex-1 items-start justify-center p-6">
        <div className="w-full max-w-lg">
          <EmptyState
            icon="inbox"
            title={`${title} is not built yet`}
            description={description}
            action={
              <span className="border-line bg-surface-muted text-ink-muted rounded-full border px-3 py-1 text-[11px] font-medium">
                Ships in {phase}
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}
