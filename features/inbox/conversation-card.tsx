"use client";

import { Clock } from "lucide-react";
import { slaEvaluationOf, type InboxConversationDto } from "@/lib/domain/inbox";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ConversationCardProps {
  item: InboxConversationDto;
  selected: boolean;
  onSelect: () => void;
  now: Date;
}

// Avatar color palette based on name/handle
function getAvatarStyle(name: string): { bg: string; text: string; initials: string } {
  if (name.includes("Personal")) {
    return { bg: "bg-slate-200 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", initials: "PB" };
  }
  if (name.includes("HCMD")) {
    return { bg: "bg-teal-100 dark:bg-teal-950/60", text: "text-teal-800 dark:text-teal-300", initials: "H" };
  }
  if (name.includes("Announcement")) {
    return { bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-700 dark:text-rose-300", initials: "A" };
  }
  if (name.includes("PR1MUS")) {
    return { bg: "bg-slate-200 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", initials: "P" };
  }

  const parts = name.trim().split(/\s+/);
  const initials = parts.length >= 2 ? `${parts[0]?.[0]}${parts[1]?.[0]}` : name.slice(0, 2);
  return { bg: "bg-blue-100 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300", initials: initials.toUpperCase() };
}

export function ConversationCard({ item, selected, onSelect, now }: ConversationCardProps) {
  const sla = slaEvaluationOf(item, now);
  const avatar = getAvatarStyle(item.customer.name);
  const subject = item.subject || "FirstBank Customer Enquiry";
  const overdueText = item.slaOverdueDisplay || `${sla.label}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "border-line w-full border-b px-4 py-3.5 text-left transition-colors cursor-pointer select-none",
        "outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        selected
          ? "bg-blue-50/70 dark:bg-blue-950/30 border-l-4 border-l-blue-600"
          : "bg-surface hover:bg-surface-muted",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            avatar.bg,
            avatar.text,
          )}
        >
          {avatar.initials}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Top line: Sender · Time · New */}
          <div className="flex items-center justify-between gap-1 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-ink font-semibold truncate text-[13px]">
                {item.customer.name}
              </span>
              <span className="text-ink-subtle text-[11px] shrink-0">
                {formatRelativeTime(item.lastMessageAt, now)}
              </span>
            </div>

            {item.unread && (
              <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 rounded-full px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0">
                <span className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                New
              </span>
            )}
          </div>

          {/* Subject */}
          <h3 className="text-ink font-bold text-xs mt-1 truncate leading-tight">
            {subject}
          </h3>

          {/* Preview Snippet */}
          <p className="text-ink-secondary text-[11px] line-clamp-2 mt-1 leading-relaxed">
            {item.preview}
          </p>

          {/* Tags */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
              Enquiry
            </span>

            <span className="bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-900/40 rounded-full px-2.5 py-0.5 text-[11px] font-medium inline-flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              <span>{overdueText}</span>
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}