import { describe, expect, it } from "vitest";

import {
  activeNavItemId,
  navItemsForRole,
  navSectionsForRole,
  NAV_SECTIONS,
} from "@/lib/domain/navigation";

describe("navigation model", () => {
  it("exposes shared items to every role", () => {
    for (const role of ["AGENT", "SUPERVISOR", "QA", "ADMIN"] as const) {
      const ids = navItemsForRole(role).map((item) => item.id);
      expect(ids).toContain("instagram");
      expect(ids).toContain("comments");
    }
  });

  it("gives agents the inbox and performance but no oversight or administration", () => {
    const ids = navItemsForRole("AGENT").map((item) => item.id);

    expect(ids).toContain("inbox");
    expect(ids).toContain("myPerformance");
    expect(ids).not.toContain("overview");
    expect(ids).not.toContain("qaReviews");
    expect(ids).not.toContain("users");
  });

  it("gives supervisors oversight and quality but not administration", () => {
    const ids = navItemsForRole("SUPERVISOR").map((item) => item.id);

    expect(ids).toContain("liveQueue");
    expect(ids).toContain("qaReviews");
    expect(ids).not.toContain("users");
    expect(ids).not.toContain("myPerformance");
  });

  it("gives QA the reviews but not performance, oversight or administration", () => {
    const ids = navItemsForRole("QA").map((item) => item.id);

    expect(ids).toContain("qaReviews");
    expect(ids).toContain("qaCalibration");
    expect(ids).not.toContain("myPerformance");
    expect(ids).not.toContain("liveQueue");
    expect(ids).not.toContain("users");
  });

  it("gives administrators all administration, oversight and quality views", () => {
    const ids = navItemsForRole("ADMIN").map((item) => item.id);

    expect(ids).toContain("users");
    expect(ids).toContain("auditLog");
    expect(ids).toContain("liveQueue");
    expect(ids).toContain("qaReviews");
    expect(ids).toContain("channelConfig");
    // Some views stay out of the admin console by design.
    expect(ids).not.toContain("inbox");
    expect(ids).not.toContain("myPerformance");
  });

  it("exposes only un-scoped items when no role is known", () => {
    const ids = navItemsForRole(null).map((item) => item.id);

    expect(ids).toEqual(
      navItemsForRole(null)
        .filter((item) => item.roles.length === 0)
        .map((item) => item.id),
    );
  });

  it("orders sections consistently with the canonical list", () => {
    expect(navSectionsForRole(null)).toEqual(
      NAV_SECTIONS.filter((section) =>
        navItemsForRole(null).some((item) => item.section === section),
      ),
    );
    // A supervisor sees every section except administration and agent-only
    // performance, in order.
    expect(navSectionsForRole("SUPERVISOR")).toEqual([
      "work",
      "channels",
      "interactions",
      "cases",
      "oversight",
      "quality",
    ]);
    expect(navSectionsForRole("ADMIN")).toEqual([
      "channels",
      "interactions",
      "cases",
      "oversight",
      "quality",
      "administration",
    ]);
  });

  it("matches an active item by exact path and by section prefix", () => {
    expect(activeNavItemId("/inbox", "AGENT")).toBe("inbox");
    expect(activeNavItemId("/supervisor/queue", "SUPERVISOR")).toBe("liveQueue");
    expect(activeNavItemId("/channels/instagram", "AGENT")).toBe("instagram");
  });

  it("never matches a section a role cannot see", () => {
    expect(activeNavItemId("/admin/users", "AGENT")).toBeNull();
    expect(activeNavItemId("/admin/users", "ADMIN")).toBe("users");
  });
});
