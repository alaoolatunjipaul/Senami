import { describe, expect, it } from "vitest";

import { canAccessRoute, homePathForRole, routePermissionFor } from "@/server/rbac/routes";

describe("route authorization", () => {
  it("maps admin, supervisor, qa, performance and workspace prefixes to permissions", () => {
    expect(routePermissionFor("/admin")).toBe("users.manage");
    expect(routePermissionFor("/admin/users")).toBe("users.manage");
    expect(routePermissionFor("/supervisor/queue")).toBe("supervisor.queue.view");
    expect(routePermissionFor("/supervisor/ai")).toBe("supervisor.ai.view");
    expect(routePermissionFor("/qa")).toBe("qa.view");
    expect(routePermissionFor("/qa/scoring")).toBe("qa.view");
    expect(routePermissionFor("/performance")).toBe("performance.view");
    expect(routePermissionFor("/inbox")).toBe("inbox.view");
  });

  it("leaves unknown and public routes unrestricted", () => {
    expect(routePermissionFor("/api/conversations")).toBeNull();
    expect(routePermissionFor("/login")).toBeNull();
    expect(routePermissionFor("/")).toBeNull();
  });

  it("lets each role open exactly its own sections", () => {
    expect(canAccessRoute("AGENT", "/inbox")).toBe(true);
    expect(canAccessRoute("AGENT", "/admin")).toBe(false);
    expect(canAccessRoute("AGENT", "/supervisor/queue")).toBe(false);
    expect(canAccessRoute("AGENT", "/performance")).toBe(true);

    expect(canAccessRoute("SUPERVISOR", "/supervisor/team")).toBe(true);
    expect(canAccessRoute("SUPERVISOR", "/qa")).toBe(true);
    expect(canAccessRoute("SUPERVISOR", "/admin")).toBe(false);

    expect(canAccessRoute("QA", "/qa/scoring")).toBe(true);
    expect(canAccessRoute("QA", "/admin")).toBe(false);

    expect(canAccessRoute("ADMIN", "/admin/audit")).toBe(true);
    expect(canAccessRoute("ADMIN", "/supervisor/ai")).toBe(true);
  });

  it("maps signed-out visitors and operatives to sane homes", () => {
    expect(homePathForRole(null)).toBe("/login");
    expect(homePathForRole("AGENT")).toBe("/inbox");
    expect(homePathForRole("ADMIN")).toBe("/inbox");
  });
});