"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { APP_CONFIG, DEMO_CONFIG } from "@/lib/config";
import { channelDotClass } from "@/lib/domain/channel-visuals";
import {
  activeNavItemId,
  navSectionsForRole,
  navItemsForRole,
  NAV_SECTION_LABELS,
  type NavCounts,
  type NavItem,
  type NavItemId,
} from "@/lib/domain/navigation";
import type { Role } from "@/lib/domain/user";
import { cn } from "@/lib/utils";

const CHANNEL_ITEM_IDS = new Set<NavItemId>(["instagram", "facebook", "x", "tiktok"]);

export interface SidebarProps {
  role: Role | null;
  counts?: NavCounts;
}

export function Sidebar({ role, counts }: SidebarProps) {
  const pathname = usePathname();
  const activeId = activeNavItemId(pathname, role);
  const sections = navSectionsForRole(role);
  const items = navItemsForRole(role);

  return (
    <aside className="bg-surface border-line flex w-64 shrink-0 flex-col border-r">
      <div className="border-line flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
        <span className="bg-primary text-primary-ink flex size-7 items-center justify-center rounded-md">
          <LifeBuoy className="size-4" aria-hidden="true" />
        </span>
        <span className="text-ink truncate text-sm font-semibold tracking-tight">
          {APP_CONFIG.name}
        </span>
        {DEMO_CONFIG.enabled ? <Badge tone="warning">DEMO</Badge> : null}
      </div>

      <nav className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {sections.map((section) => (
          <div key={section} className="mb-5">
            <p className="text-ink-subtle px-3 pb-1.5 text-[11px] font-semibold tracking-wider uppercase">
              {NAV_SECTION_LABELS[section]}
            </p>
            <ul className="space-y-0.5">
              {items
                .filter((item) => item.section === section)
                .map((item) => (
                  <li key={item.id}>
                    <NavLink
                      item={item}
                      active={item.id === activeId}
                      count={counts?.[item.id]}
                      isChannel={CHANNEL_ITEM_IDS.has(item.id)}
                    />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-line border-t p-3">
        <div className="bg-canvas border-line rounded-md border p-3">
          <p className="text-ink-secondary text-xs font-semibold">Integration mode</p>
          <p className="text-ink-muted mt-0.5 text-[11px] leading-relaxed">
            All social channels are simulated. Live connections appear here when credentials are
            configured.
          </p>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  count,
  isChannel,
}: {
  item: NavItem;
  active: boolean;
  count?: number;
  isChannel?: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group duration-fast flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-primary-subtle text-primary-ink font-medium"
          : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
      )}
    >
      <span className={cn("relative flex items-center justify-center", isChannel && "size-4")}>
        {isChannel ? (
          <span
            aria-hidden="true"
            className={cn("size-1.5 rounded-full", channelDotClass(item.id))}
          />
        ) : (
          <Icon className="size-4 shrink-0" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {count !== undefined ? (
        <Badge tone="neutral" className="px-1.5 text-[10px]" srPrefix="Count">
          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
        </Badge>
      ) : null}
    </Link>
  );
}
