import {
  Activity,
  AtSign,
  BarChart3,
  Clapperboard,
  ClipboardCheck,
  FilePlus2,
  Flag,
  Folders,
  Gauge,
  GitPullRequestArrow,
  HelpCircle,
  Inbox,
  Mail,
  MessageSquareText,
  MessagesSquare,
  MonitorCheck,
  Newspaper,
  RotateCcw,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Speech,
  Star,
  ThumbsUp,
  Timer,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/domain/user";

export const NAV_SECTIONS = [
  "work",
  "channels",
  "interactions",
  "cases",
  "performance",
  "oversight",
  "quality",
  "administration",
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

export const NAV_SECTION_LABELS: Record<NavSection, string> = {
  work: "Work",
  channels: "Channels",
  interactions: "Interactions",
  cases: "Cases",
  performance: "Performance",
  oversight: "Oversight",
  quality: "Quality",
  administration: "Administration",
};

export type NavItemId =
  | "inbox"
  | "instagram"
  | "facebook"
  | "x"
  | "tiktok"
  | "publicPosts"
  | "comments"
  | "directMessages"
  | "mentions"
  | "complaints"
  | "enquiries"
  | "requests"
  | "followups"
  | "myPerformance"
  | "overview"
  | "liveQueue"
  | "team"
  | "escalations"
  | "slaPanel"
  | "aiUsage"
  | "reports"
  | "qaReviews"
  | "qaScoring"
  | "qaCalibration"
  | "adminOverview"
  | "users"
  | "channelConfig"
  | "slaConfig"
  | "aiConfig"
  | "categories"
  | "auditLog";

export interface NavItem {
  readonly id: NavItemId;
  readonly label: string;
  /** A short helper shown on hover / secondary text. */
  readonly helper?: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly section: NavSection;
  /** Roles that may see this item. Empty means available to every role. */
  readonly roles: readonly Role[];
}

/**
 * Canonical navigation model (§10 agent workbench, §26 supervisor, §27 QA,
 * §28 administrator). Single source of truth for the sidebar; each phase adds
 * the routes and dynamic counts for its items.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  // Work – agent-facing
  {
    id: "inbox",
    label: "Inbox",
    helper: "All assigned conversations",
    href: "/inbox",
    icon: Inbox,
    section: "work",
    roles: ["AGENT", "SUPERVISOR", "QA"],
  },

  // Channels – shared
  {
    id: "instagram",
    label: "Instagram",
    href: "/channels/instagram",
    icon: Speech,
    section: "channels",
    roles: [],
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "/channels/facebook",
    icon: ThumbsUp,
    section: "channels",
    roles: [],
  },
  {
    id: "x",
    label: "X (Twitter)",
    href: "/channels/x",
    icon: MessagesSquare,
    section: "channels",
    roles: [],
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: "/channels/tiktok",
    icon: Clapperboard,
    section: "channels",
    roles: [],
  },

  // Interactions – shared
  {
    id: "publicPosts",
    label: "Public posts",
    href: "/interactions/public-posts",
    icon: Newspaper,
    section: "interactions",
    roles: [],
  },
  {
    id: "comments",
    label: "Comments",
    href: "/interactions/comments",
    icon: MessageSquareText,
    section: "interactions",
    roles: [],
  },
  {
    id: "directMessages",
    label: "Direct messages",
    href: "/interactions/direct-messages",
    icon: Mail,
    section: "interactions",
    roles: [],
  },
  {
    id: "mentions",
    label: "Mentions",
    href: "/interactions/mentions",
    icon: AtSign,
    section: "interactions",
    roles: [],
  },

  // Cases – shared
  {
    id: "complaints",
    label: "Complaints",
    href: "/cases/complaints",
    icon: Flag,
    section: "cases",
    roles: [],
  },
  {
    id: "enquiries",
    label: "Enquiries",
    href: "/cases/enquiries",
    icon: HelpCircle,
    section: "cases",
    roles: [],
  },
  {
    id: "requests",
    label: "Requests",
    href: "/cases/requests",
    icon: FilePlus2,
    section: "cases",
    roles: [],
  },
  {
    id: "followups",
    label: "Follow-ups",
    href: "/cases/follow-ups",
    icon: RotateCcw,
    section: "cases",
    roles: [],
  },

  // Performance – agent only
  {
    id: "myPerformance",
    label: "My performance",
    href: "/performance",
    icon: BarChart3,
    section: "performance",
    roles: ["AGENT"],
  },

  // Oversight – supervisor + admin
  {
    id: "overview",
    label: "Overview",
    href: "/supervisor",
    icon: MonitorCheck,
    section: "oversight",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    id: "liveQueue",
    label: "Live queue",
    href: "/supervisor/queue",
    icon: Activity,
    section: "oversight",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    id: "team",
    label: "Team",
    href: "/supervisor/team",
    icon: Users,
    section: "oversight",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    id: "escalations",
    label: "Escalations",
    href: "/supervisor/escalations",
    icon: GitPullRequestArrow,
    section: "oversight",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    id: "slaPanel",
    label: "SLA overview",
    href: "/supervisor/sla",
    icon: Timer,
    section: "oversight",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    id: "aiUsage",
    label: "AI usage",
    href: "/supervisor/ai",
    icon: Sparkles,
    section: "oversight",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/supervisor/reports",
    icon: Gauge,
    section: "oversight",
    roles: ["SUPERVISOR", "ADMIN"],
  },

  // Quality – QA + supervisor + admin
  {
    id: "qaReviews",
    label: "Reviews",
    href: "/qa",
    icon: ClipboardCheck,
    section: "quality",
    roles: ["QA", "SUPERVISOR", "ADMIN"],
  },
  {
    id: "qaScoring",
    label: "Scoring",
    href: "/qa/scoring",
    icon: Star,
    section: "quality",
    roles: ["QA", "SUPERVISOR", "ADMIN"],
  },
  {
    id: "qaCalibration",
    label: "Calibration",
    href: "/qa/calibration",
    icon: SlidersHorizontal,
    section: "quality",
    roles: ["QA", "SUPERVISOR", "ADMIN"],
  },

  // Administration – admin only
  {
    id: "adminOverview",
    label: "Overview",
    href: "/admin",
    icon: Settings,
    section: "administration",
    roles: ["ADMIN"],
  },
  {
    id: "users",
    label: "Users & teams",
    href: "/admin/users",
    icon: UserCheck,
    section: "administration",
    roles: ["ADMIN"],
  },
  {
    id: "channelConfig",
    label: "Channels",
    href: "/admin/channels",
    icon: Share2,
    section: "administration",
    roles: ["ADMIN"],
  },
  {
    id: "slaConfig",
    label: "SLA policies",
    href: "/admin/sla",
    icon: Timer,
    section: "administration",
    roles: ["ADMIN"],
  },
  {
    id: "aiConfig",
    label: "AI settings",
    href: "/admin/ai",
    icon: Sparkles,
    section: "administration",
    roles: ["ADMIN"],
  },
  {
    id: "categories",
    label: "Categories",
    href: "/admin/categories",
    icon: Folders,
    section: "administration",
    roles: ["ADMIN"],
  },
  {
    id: "auditLog",
    label: "Audit log",
    href: "/admin/audit",
    icon: ShieldCheck,
    section: "administration",
    roles: ["ADMIN"],
  },
];

/** Items visible to a given role, in canonical section order. */
export function navItemsForRole(role: Role | null): ReadonlyArray<NavItem> {
  return NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || (role !== null && item.roles.includes(role)),
  );
}

export function navSectionsForRole(role: Role | null): ReadonlyArray<NavSection> {
  const sections = new Set<NavSection>();
  for (const item of navItemsForRole(role)) sections.add(item.section);
  return NAV_SECTIONS.filter((section) => sections.has(section));
}

export type NavCounts = Partial<Record<NavItemId, number>>;

/** Returns an active NavItemId from a pathname, honoring exact and prefix matches. */
export function activeNavItemId(pathname: string, role: Role | null): NavItemId | null {
  const items = navItemsForRole(role);
  for (const item of items) if (item.href === pathname) return item.id;
  for (const item of items) if (pathname.startsWith(`${item.href}/`)) return item.id;
  return null;
}
