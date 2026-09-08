"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Search, Settings, Shield, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/auth/AuthProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

interface AdminTopNavProps {
  onMenuClick: () => void;
  organizationName?: string;
  organizationStatus?: string;
  notifications?: { id: string; description: string; time: string }[];
}

export function AdminTopNav({
  onMenuClick,
  organizationName,
  organizationStatus = "ACTIVE",
  notifications = [],
}: AdminTopNavProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; userId: string; role: string }[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchResults([]);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.results ?? []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const isActive = organizationStatus === "ACTIVE";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex flex-1 items-center gap-3">
          <button type="button" onClick={onMenuClick} className="rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden max-w-md flex-1 sm:block" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Search your organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-glass py-2 pl-10 pr-4 text-sm outline-none placeholder:text-muted/50 focus:border-accent/40"
            />
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border bg-surface py-2 shadow-xl">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      router.push(r.role === "STAFF" ? `/admin/staff/${r.id}` : "/admin/staff");
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="flex w-full flex-col px-4 py-2 text-left text-sm hover:bg-glass"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-muted">{r.userId} · {r.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle size="sm" />
          <span className={cn("hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex", isActive ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-amber-500/20 bg-amber-500/5 text-amber-400")}>
            <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-emerald-400" : "bg-amber-400")} />
            {isActive ? "Active" : organizationStatus}
          </span>
          <div className="relative">
            <button type="button" onClick={() => setNotifOpen(!notifOpen)} className="relative rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface p-4 shadow-xl">
                  <p className="text-sm font-semibold">Notifications</p>
                  {notifications.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">No new notifications</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {notifications.map((n) => (
                        <li key={n.id} className="text-sm text-muted">{n.description}</li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative" ref={profileRef}>
            <button type="button" onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-xl border border-border bg-glass px-3 py-1.5 text-sm hover:bg-glass">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="font-medium leading-tight">{user?.name}</p>
                <p className="text-xs text-muted">{user?.userId}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-surface py-2 shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted">Admin · {user?.userId}</p>
                    {organizationName && <p className="mt-1 text-xs text-accent">{organizationName}</p>}
                  </div>
                  <Link href="/admin/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-glass" onClick={() => setProfileOpen(false)}>
                    <User className="h-4 w-4" /> My Profile
                  </Link>
                  <Link href="/admin/security" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-glass" onClick={() => setProfileOpen(false)}>
                    <Shield className="h-4 w-4" /> Security
                  </Link>
                  <Link href="/admin/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-glass" onClick={() => setProfileOpen(false)}>
                    <Settings className="h-4 w-4" /> Settings
                  </Link>
                  <button type="button" onClick={() => logout()} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-glass">
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
