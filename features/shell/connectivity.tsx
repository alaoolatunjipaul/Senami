"use client";

import { useEffect, useState } from "react";

import { OfflineBanner } from "@/components/ui/states";

/**
 * Online/offline detection (§42 resilience).
 *
 * The banner itself is in `components/ui/states`. This hook feeds it real
 * connectivity state; messages and queues become read-only guidance until the
 * connection returns.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}

export function ConnectivityBanner() {
  const online = useOnlineStatus();
  return <OfflineBanner isOffline={!online} />;
}
