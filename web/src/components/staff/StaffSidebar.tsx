"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Camera,
  ChevronLeft,
  DoorOpen,
  LayoutDashboard,
  Monitor,
  ScrollText,
  Shield,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SafeUser } from "@/lib/auth/sanitize-user";
import type { IUser } from "@/models/User";
import { can } from "@/lib/permissions/capabilities";
import { usePersistScroll } from "@/hooks/usePersistScroll";

const ALL_NAV = [
  { section: "Overview", items: [{ href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" }] },
  {
    section: "Campus",
    items: [
      { href: "/staff/campus", label: "Campus Overview", icon: Building2, perm: "campus.view" },
      { href: "/staff/buildings", label: "Buildings", icon: Building2, perm: "building.view" },
      { href: "/staff/rooms", label: "Rooms", icon: DoorOpen, perm: "room.view" },
      { href: "/staff/cameras", label: "Cameras", icon: Camera, perm: "camera.view" },
    ],
  },
  {
    section: "Monitoring",
    items: [
      { href: "/staff/monitoring", label: "Live Monitoring", icon: Monitor, perm: "monitoring.view" },
      { href: "/staff/events", label: "Events", icon: ScrollText, perm: "event.view" },
      { href: "/staff/alerts", label: "Alerts", icon: AlertTriangle, perm: "alert.view" },
      { href: "/staff/incidents", label: "Incidents", icon: Shield, perm: "incident.view" },
    ],
  },
  {
    section: "Reports",
    items: [
      { href: "/staff/analytics", label: "Analytics", icon: BarChart3, perm: "report.view" },
      { href: "/staff/reports", label: "Reports", icon: BarChart3, perm: "report.view" },
    ],
  },
  {
    section: "Account",
    items: [
      { href: "/staff/profile", label: "My Profile", icon: User, perm: "dashboard.view" },
      { href: "/staff/security", label: "Security", icon: Shield, perm: "dashboard.view" },
      { href: "/staff/sessions", label: "Sessions", icon: ScrollText, perm: "dashboard.view" },
    ],
  },
];

interface StaffSidebarProps {
  user: SafeUser;
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function StaffSidebar({ user, open, collapsed, onClose, onToggleCollapse }: StaffSidebarProps) {
  const pathname = usePathname();
  const navScrollRef = usePersistScroll<HTMLElement>("staff-sidebar-nav");
  const navSections = ALL_NAV.map((s) => ({
    ...s,
    items: s.items.filter((item) => can({ role: user.role as IUser["role"], permissions: user.permissions ?? [] }, item.perm)),
  })).filter((s) => s.items.length > 0);

  const renderContent = (persistScroll: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && <Link href="/staff/dashboard" className="text-xs font-semibold tracking-[0.15em] text-accent">STAFF PORTAL</Link>}
        <button type="button" onClick={onToggleCollapse} className="hidden rounded-lg p-2 text-muted hover:text-foreground lg:flex" aria-label="Collapse">
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      <nav ref={persistScroll ? navScrollRef : undefined} className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.section} className="mb-6">
            {!collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted">{section.section}</p>}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={onClose} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all", active ? "bg-accent/10 text-accent" : "text-muted hover:bg-glass hover:text-foreground", collapsed && "justify-center px-2")}>
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-surface/95 backdrop-blur-xl lg:block", collapsed ? "w-[72px]" : "w-64")}>{renderContent(true)}</aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface lg:hidden">{renderContent(false)}</motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
