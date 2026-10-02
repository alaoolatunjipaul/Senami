"use client";

import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useSupervisorPermissions } from "@/features/supervisor/use-supervisor";

export function SupervisorPermissionsView() {
  const { data, isLoading, isError, refetch } = useSupervisorPermissions();

  if (isLoading) {
    return <LoadingState label="Loading permissions" />;
  }
  if (isError || !data) {
    return <ErrorState title="Unable to load permissions" description="Could not fetch permission summary." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 space-y-2">
        <p className="text-ink text-sm font-medium">Granted: {data.granted}/{data.total}</p>
        <p className="text-ink-muted text-xs">Role: {data.roleLabel}</p>
      </Card>
    </div>
  );
}
