"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "acg-sound-notifications";

export function useSoundNotificationsEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const toggle = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    setEnabled(value);
  }, []);

  return { enabled, toggle };
}

export function useCriticalAlertSound(enabled: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    audioRef.current = new Audio("/sounds/critical-alert.mp3");
    audioRef.current.volume = 0.5;

    const unlock = () => {
      unlockedRef.current = true;
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const play = useCallback(() => {
    if (!enabled || !unlockedRef.current || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [enabled]);

  return { play };
}
