"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Persist an element's scrollTop across remounts (sessionStorage).
 * Restores in useLayoutEffect to avoid a visible jump to top.
 */
export function usePersistScroll<T extends HTMLElement>(
  storageKey: string
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const key = `acg-scroll:${storageKey}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) {
        const y = Number(raw);
        if (Number.isFinite(y) && y > 0) {
          el.scrollTop = y;
        }
      }
    } catch {
      /* private mode */
    }

    const onScroll = () => {
      try {
        sessionStorage.setItem(key, String(el.scrollTop));
      } catch {
        /* ignore */
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key]);

  return ref;
}

export function readPersistedBool(storageKey: string, fallback = false): boolean {
  try {
    const v = sessionStorage.getItem(`acg-bool:${storageKey}`);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writePersistedBool(storageKey: string, value: boolean) {
  try {
    sessionStorage.setItem(`acg-bool:${storageKey}`, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}
