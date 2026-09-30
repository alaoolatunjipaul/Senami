import { describe, expect, it } from "vitest";

import {
  PERMISSIONS,
  can,
  ForbiddenError,
  requirePermission,
  permissionsForRole,
} from "@/server/rbac/permissions";

describe("RBAC permission catalogue", () => {
  it("denies everything to an unknown or missing role (deny by default)", () => {
    for (const permission of PERMISSIONS) {
      expect(can(null, permission)).toBe(false);
    }
  });

  it("grants agents the inbox and conversation actions but nothing administrative", () => {
    expect(can("AGENT", "inbox.view")).toBe(true);
    expect(can("AGENT", "conversation.reply")).toBe(true);
    expect(can("AGENT", "performance.view")).toBe(true);
    expect(can("AGENT", "supervisor.queue.view")).toBe(false);
    expect(can("AGENT", "qa.review")).toBe(false);
    expect(can("AGENT", "users.manage")).toBe(false);
  });

  it("grants supervisors oversight and QA visibility but not admin mutation", () => {
    expect(can("SUPERVISOR", "supervisor.queue.view")).toBe(true);
    expect(can("SUPERVISOR", "supervisor.sla.view")).toBe(true);
    expect(can("SUPERVISOR", "qa.view")).toBe(true);
    expect(can("SUPERVISOR", "conversation.reply")).toBe(false);
    expect(can("SUPERVISOR", "users.manage")).toBe(false);
    expect(can("SUPERVISOR", "performance.view")).toBe(false);
  });

  it("grants QA review powers without operations or admin powers", () => {
    expect(can("QA", "qa.review")).toBe(true);
    expect(can("QA", "conversation.read")).toBe(true);
    expect(can("QA", "conversation.reply")).toBe(false);
    expect(can("QA", "supervisor.queue.view")).toBe(false);
    expect(can("QA", "users.manage")).toBe(false);
  });

  it("grants administrators every permission in the catalogue", () => {
    for (const permission of PERMISSIONS) {
      expect(can("ADMIN", permission)).toBe(true);
    }
  });

  it("requirePermission asserts the role or throws ForbiddenError", () => {
    expect(() => requirePermission("ADMIN", "audit.view")).not.toThrow();

    expect(() => requirePermission("AGENT", "ai.manage")).toThrow(ForbiddenError);
    expect(() => requirePermission(null, "inbox.view")).toThrow(ForbiddenError);
  });

  it("lists a role's permissions in canonical order", () => {
    const agent = permissionsForRole("AGENT");
    expect(agent).toEqual(PERMISSIONS.filter((p) => can("AGENT", p)));
    expect(permissionsForRole("ADMIN")).toEqual([...PERMISSIONS]);
  });
});