import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/session";
import { homePathForRole } from "@/server/rbac/routes";

/**
 * Workspace landing route.
 *
 * Agents start on their own workspace, where the dashboard aggregates their
 * queue; every other role keeps the inbox as its home. Unauthenticated visitors
 * are sent to sign in.
 */
export default async function WorkspaceRoot() {
  const user = await getCurrentUser();
  redirect(homePathForRole(user?.role ?? null));
}