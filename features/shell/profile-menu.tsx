"use client";

import Link from "next/link";
import { BarChart3, LogOut, UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuAction,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type Session } from "@/lib/domain/user";

import { AppearanceMenuGroup } from "./appearance-menu";

/**
 * Profile menu in the header.
 *
 * "Sign out" ships with the auth flows (Phase 4); until then the menu stays
 * honest and simply omits the item rather than rendering a dead button.
 */

export interface ProfileMenuProps {
  session: Session;
  onSignOut?: () => void;
  className?: string;
}

export function ProfileMenu({ session, onSignOut, className }: ProfileMenuProps) {
  const { user } = session;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={className}>
        <button
          type="button"
          aria-label={`Account menu for ${user.name}`}
          className="hover:bg-surface-muted duration-fast flex items-center gap-2 rounded-md p-1 pr-2 transition-colors"
        >
          <Avatar name={user.name} size="sm" />
          <span className="text-ink-secondary hidden min-w-0 text-left text-[13px] leading-tight lg:block">
            <span className="block truncate font-medium">{user.name}</span>
            <span className="text-ink-muted block truncate text-[11px]">
              {ROLE_LABELS[user.role]}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="pb-1">
          <span className="block truncate">{user.name}</span>
          <span className="text-ink-subtle mt-0.5 block truncate font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <UserRound aria-hidden="true" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/performance">
            <BarChart3 aria-hidden="true" />
            My performance
          </Link>
        </DropdownMenuItem>

        <div className="px-2 pt-1.5 pb-1">
          <Badge tone="neutral">{ROLE_LABELS[user.role]}</Badge>
        </div>
        <DropdownMenuSeparator />
        <AppearanceMenuGroup />
        {onSignOut ? (
          <DropdownMenuAction
            label="Sign out"
            icon={<LogOut aria-hidden="true" />}
            onSelect={() => {
              onSignOut();
            }}
          />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
