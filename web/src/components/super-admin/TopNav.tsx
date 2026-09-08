"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Search, Shield, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

interface TopNavProps {
  onMenuClick: () => void;
  systemStatus: "operational" | "degraded";
  onStatusClick?: () => void;
  notifications?: { id: string; description: string; time: string }[];
}

export function TopNav({
  onMenuClick,
  systemStatus,
  onStatusClick,
  notifications = [],
}: TopNavProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search platform..."
              className="w-64 rounded-xl border border-border bg-glass py-2 pl-10 pr-4 text-sm outline-none placeholder:text-muted/50 focus:border-accent/40 lg:w-80"
              onFocus={() => router.push("/super-admin/users")}
              readOnly
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle size="sm" />
          <button
            type="button"
            onClick={onStatusClick}
            className={cn(
              "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex",
              systemStatus === "operational"
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                : "border-amber-500/20 bg-amber-500/5 text-amber-400"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                systemStatus === "operational" ? "bg-emerald-400 animate-pulse-glow" : "bg-amber-400"
              )}
            />
            {systemStatus === "operational" ? "All Systems Operational" : "System Issue Detected"}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
              )}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface-elevated p-2 shadow-xl"
                >
                  <p className="px-3 py-2 text-xs font-semibold tracking-wider text-muted uppercase">
                    Notifications
                  </p>
                  {notifications.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted">No recent notifications</p>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        className="rounded-lg px-3 py-2 text-sm hover:bg-glass"
                      >
                        <p className="text-foreground/90">{n.description}</p>
                        <p className="mt-1 text-xs text-muted">{n.time}</p>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 rounded-xl border border-border bg-glass px-3 py-1.5 text-sm hover:bg-glass-hover"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
                <User className="h-4 w-4 text-accent" />
              </div>
              <span className="hidden max-w-[120px] truncate md:inline">{user?.name}</span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 mt-2 w-52 rounded-xl border border-border bg-surface-elevated py-2 shadow-xl"
                >
                  <Link
                    href="/super-admin/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:bg-glass hover:text-foreground"
                    onClick={() => setProfileOpen(false)}
                  >
                    <User className="h-4 w-4" /> My Profile
                  </Link>
                  <Link
                    href="/super-admin/security"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:bg-glass hover:text-foreground"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Shield className="h-4 w-4" /> Security
                  </Link>
                  <Link
                    href="/super-admin/settings"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:bg-glass hover:text-foreground"
                    onClick={() => setProfileOpen(false)}
                  >
                    Settings
                  </Link>
                  <hr className="my-2 border-border" />
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/5"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
