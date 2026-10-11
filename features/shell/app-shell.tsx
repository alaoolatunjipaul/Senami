"use client";

import { useState } from "react";
import { ChevronDown, Moon, PanelsTopLeft, Sun, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { GlobalSearch, type SearchResultGroup } from "@/features/shell/global-search";
import { ProfileMenu } from "@/features/shell/profile-menu";
import { SessionProvider } from "@/features/shell/session-context";
import { Sidebar } from "@/features/shell/sidebar";
import { useTheme } from "@/features/shell/use-theme";
import type { Session } from "@/lib/domain/user";
import type { NavCounts } from "@/lib/domain/navigation";
import type { ReactNode } from "react";

export interface AppShellProps {
  session: Session;
  counts?: NavCounts;
  search: (query: string) => Promise<readonly SearchResultGroup[]> | readonly SearchResultGroup[];
  notifications?: readonly unknown[];
  onSignOut?: () => void;
  children: ReactNode;
}

export function AppShell({
  session,
  search,
  onSignOut,
  children,
}: AppShellProps) {
  const { mode, setMode } = useTheme();
  const [status, setStatus] = useState<"Online" | "Away" | "Busy" | "Offline">("Online");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  function toggleTheme() {
    const nextMode = mode === "dark" ? "light" : "dark";
    setMode(nextMode);
    toast.info(`Switched to ${nextMode} theme`);
  }

  function toggleSound() {
    setSoundEnabled(!soundEnabled);
    toast.info(soundEnabled ? "Audio notifications muted" : "Audio notifications enabled");
  }

  return (
    <SessionProvider session={session}>
      <div className="bg-canvas flex h-dvh flex-col font-sans">
        <div className="flex min-h-0 flex-1">
          <Sidebar role={session.user.role} />
          
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Top Header Bar matching the screenshot */}
            <header className="border-line bg-surface flex h-14 shrink-0 items-center justify-between border-b px-4 gap-4 select-none">
              {/* Left Title */}
              <div className="flex items-center shrink-0">
                <h1 className="text-ink text-base md:text-lg font-bold tracking-tight">
                  Response Desk
                </h1>
              </div>

              {/* Center Search Input */}
              <div className="flex-1 max-w-xl">
                <GlobalSearch
                  search={search}
                  placeholder="Search email ID, sender, account, subject."
                  className="w-full"
                />
              </div>

              {/* Right Action Controls */}
              <div className="flex shrink-0 items-center gap-2">
                {/* Status Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                    className="border-line bg-surface hover:bg-surface-muted text-ink inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                  >
                    <span
                      className={`size-2 rounded-full ${
                        status === "Online"
                          ? "bg-emerald-500"
                          : status === "Away"
                            ? "bg-amber-500"
                            : status === "Busy"
                              ? "bg-red-500"
                              : "bg-slate-400"
                      }`}
                    />
                    <span>{status}</span>
                    <ChevronDown className="size-3 text-ink-muted" />
                  </button>

                  {statusMenuOpen && (
                    <div className="border-line bg-surface absolute right-0 top-full mt-1.5 w-32 rounded-lg border shadow-lg py-1 z-50 text-xs">
                      {(["Online", "Away", "Busy", "Offline"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setStatus(s);
                            setStatusMenuOpen(false);
                            toast.success(`Agent status set to ${s}`);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-surface-muted text-ink flex items-center gap-2"
                        >
                          <span
                            className={`size-2 rounded-full ${
                              s === "Online"
                                ? "bg-emerald-500"
                                : s === "Away"
                                  ? "bg-amber-500"
                                  : s === "Busy"
                                    ? "bg-red-500"
                                    : "bg-slate-400"
                            }`}
                          />
                          <span>{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* View/Layout Icon Button */}
                <button
                  type="button"
                  onClick={() => toast.info("Display layout configured for Response Desk 3-column split view.")}
                  className="border-line text-ink-secondary hover:text-ink hover:bg-surface-muted flex size-8 items-center justify-center rounded-lg border transition-colors"
                  title="Layout switcher"
                >
                  <PanelsTopLeft className="size-4" />
                </button>

                {/* Sound Toggle Button */}
                <button
                  type="button"
                  onClick={toggleSound}
                  className="border-line text-ink-secondary hover:text-ink hover:bg-surface-muted flex size-8 items-center justify-center rounded-lg border transition-colors"
                  title={soundEnabled ? "Mute audio alerts" : "Enable audio alerts"}
                >
                  {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </button>

                {/* Theme Toggle Button */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="border-line text-ink-secondary hover:text-ink hover:bg-surface-muted flex size-8 items-center justify-center rounded-lg border transition-colors"
                  title={mode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                >
                  {mode === "dark" ? <Sun className="size-4" /> : <Sun className="size-4" />}
                </button>

                {/* Profile Avatar / Menu */}
                <ProfileMenu session={session} onSignOut={onSignOut} />
              </div>
            </header>

            {/* Main view container */}
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}
