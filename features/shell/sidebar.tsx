"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  CornerUpRight,
  Edit3,
  FileText,
  HelpCircle,
  Mail,
  MessageSquare,
  PenSquare,
} from "lucide-react";

import { FirstBankLogo } from "@/components/ui/firstbank-logo";
import { NewEmailDialog } from "@/features/inbox/new-email-dialog";
import type { Role } from "@/lib/domain/user";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  role?: Role | null;
  counts?: Record<string, number>;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [newEmailOpen, setNewEmailOpen] = useState(false);

  const activeView = searchParams.get("view") ?? (searchParams.get("intent") ? "" : "review");
  const activeIntent = searchParams.get("intent") ?? "";

  const queues = [
    { id: "urgent", label: "Urgent", count: 0, icon: AlertTriangle, href: "/inbox?sentiment=urgent" },
    {
      id: "review",
      label: "Needs review",
      count: 40,
      icon: CheckSquare,
      href: "/inbox?view=review",
      active: activeView === "review" && activeIntent === "",
    },
    { id: "awaiting", label: "Awaiting customer", count: 0, icon: Clock, href: "/inbox?view=awaiting" },
    { id: "all", label: "All", count: 41, icon: Mail, href: "/inbox?view=all", active: activeView === "all" },
    { id: "sent", label: "Sent", count: 1, icon: ArrowUpRight, href: "/inbox?view=sent", active: activeView === "sent" },
    { id: "manual", label: "Manual", count: 0, icon: Edit3, href: "/inbox?view=manual" },
  ];

  const folders = [
    { id: "complaint", label: "Complaints", count: 0, icon: AlertTriangle, href: "/inbox?intent=complaint", active: activeIntent === "complaint" },
    { id: "request", label: "Requests", count: 0, icon: FileText, href: "/inbox?intent=request", active: activeIntent === "request" },
    { id: "enquiry", label: "Enquiries", count: 41, icon: HelpCircle, href: "/inbox?intent=enquiry", active: activeIntent === "enquiry" },
    { id: "feedback", label: "Feedback", count: 0, icon: MessageSquare, href: "/inbox?intent=feedback", active: activeIntent === "feedback" },
    { id: "followup", label: "Follow-ups", count: 0, icon: CornerUpRight, href: "/inbox?intent=followup", active: activeIntent === "followup" },
  ];

  return (
    <>
      <aside
        className={cn(
          "bg-surface border-line flex shrink-0 flex-col border-r transition-all duration-200 select-none",
          collapsed ? "w-16" : "w-56 2xl:w-60",
        )}
      >
        {/* Header */}
        <div className="border-line flex h-14 shrink-0 items-center justify-between border-b px-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <FirstBankLogo size="md" className="shrink-0" />
            {!collapsed && (
              <div className="min-w-0 flex-1 truncate">
                <span className="text-ink block text-xs font-bold tracking-tight uppercase">
                  FIRSTASSIST
                </span>
                <span className="text-ink-muted -mt-0.5 block truncate text-[11px]">
                  Response Desk
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-ink-subtle hover:text-ink hover:bg-surface-muted rounded p-1 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => setNewEmailOpen(true)}
            className={cn(
              "bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 rounded-lg font-medium shadow-xs transition-colors duration-150",
              collapsed ? "size-10 p-0" : "w-full py-2 px-3 text-xs",
            )}
            title="Compose new email"
          >
            <PenSquare className="size-3.5 shrink-0" />
            {!collapsed && <span>New email</span>}
          </button>
        </div>

        {/* Nav lists */}
        <nav className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 space-y-4" aria-label="Queues and folders">
          {/* Main Queues */}
          <div>
            <ul className="space-y-0.5">
              {queues.map((item) => {
                const Icon = item.icon;
                const isSelected = item.active ?? (item.id === "review" && activeView === "review");

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-ink-secondary hover:bg-surface-muted hover:text-ink font-medium",
                      )}
                      title={collapsed ? `${item.label} (${item.count})` : undefined}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={cn(
                            "size-3.5 shrink-0",
                            isSelected ? "text-blue-600 dark:text-blue-400" : "text-ink-muted group-hover:text-ink",
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!collapsed && (
                        <span
                          className={cn(
                            "ml-auto text-xs",
                            isSelected ? "text-blue-600 dark:text-blue-400 font-bold" : "text-ink-muted",
                          )}
                          data-numeric
                        >
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Folders */}
          <div>
            {!collapsed && (
              <p className="text-ink-subtle px-2.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                FOLDERS
              </p>
            )}
            <ul className="space-y-0.5">
              {folders.map((item) => {
                const Icon = item.icon;
                const isSelected = item.active;

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold"
                          : "text-ink-secondary hover:bg-surface-muted hover:text-ink font-medium",
                      )}
                      title={collapsed ? `${item.label} (${item.count})` : undefined}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={cn(
                            "size-3.5 shrink-0",
                            isSelected ? "text-blue-600 dark:text-blue-400" : "text-ink-muted group-hover:text-ink",
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!collapsed && (
                        <span
                          className={cn(
                            "ml-auto text-xs",
                            isSelected ? "text-blue-600 dark:text-blue-400 font-bold" : "text-ink-muted",
                          )}
                          data-numeric
                        >
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom Live Sync Card */}
        {!collapsed && (
          <div className="p-2.5">
            <div className="bg-emerald-50/70 border border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-900/40 rounded-xl p-2.5 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 rounded px-1.5 py-0.5 font-bold text-[10px] tracking-wide uppercase">
                  LIVE
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live - synced now</span>
              </div>
              <div className="text-ink-subtle text-[10px] mt-1 font-mono">
                Build 2026.09.28-0408
              </div>
            </div>
          </div>
        )}

        {/* Bottom User Card */}
        <div className="border-line border-t p-2.5">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              OA
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 truncate">
                <span className="text-ink block truncate text-xs font-bold uppercase tracking-tight">
                  OLATUNJI ALAO
                </span>
                <span className="text-ink-muted block text-[11px] truncate">
                  Response agent
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <NewEmailDialog open={newEmailOpen} onOpenChange={setNewEmailOpen} />
    </>
  );
}
