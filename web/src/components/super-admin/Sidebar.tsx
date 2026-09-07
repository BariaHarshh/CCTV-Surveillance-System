"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Building2,
  ChevronLeft,
  Inbox,
  LayoutDashboard,
  ScrollText,
  Server,
  Settings,
  Shield,
  UserCog,
  Users,
  X,
  Flag,
  Megaphone,
  Wrench,
  Database,
  AlertOctagon,
  FlaskConical,
  Bot,
  Scale,
  ListTodo,
  ServerCog,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { usePersistScroll } from "@/hooks/usePersistScroll";

const navSections = [
  {
    title: "Overview",
    items: [{ href: "/super-admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Management",
    items: [
      { href: "/super-admin/organizations", label: "Organizations", icon: Building2 },
      { href: "/super-admin/administrators", label: "Administrators", icon: UserCog },
      { href: "/super-admin/users", label: "Users", icon: Users },
      { href: "/super-admin/inquiries", label: "Purchase Inquiries", icon: Inbox },
    ],
  },
  {
    title: "Security",
    items: [
      { href: "/super-admin/security-center", label: "Security Center", icon: Shield },
      { href: "/super-admin/audit-logs", label: "Audit Logs", icon: ScrollText },
      { href: "/super-admin/sessions", label: "Sessions", icon: Activity },
    ],
  },
  {
    title: "AI Platform",
    items: [
      { href: "/super-admin/ai/models", label: "AI Models", icon: Brain },
      { href: "/super-admin/ai/observability", label: "Observability", icon: Activity },
      { href: "/super-admin/ai/testing", label: "Testing", icon: FlaskConical },
      { href: "/super-admin/ai-agents", label: "AI Agents", icon: Bot },
      { href: "/super-admin/ai-governance", label: "AI Governance", icon: Scale },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/super-admin/system-health", label: "System Health", icon: Server },
      { href: "/super-admin/system/jobs", label: "Jobs", icon: ListTodo },
      { href: "/super-admin/services", label: "Services", icon: ServerCog },
      { href: "/super-admin/incidents/postmortems", label: "Postmortems", icon: FileSearch },
      { href: "/super-admin/analytics", label: "Platform Analytics", icon: BarChart3 },
      { href: "/super-admin/emergency-overview", label: "Emergency Overview", icon: AlertTriangle },
      { href: "/super-admin/feature-flags", label: "Feature Flags", icon: Flag },
      { href: "/super-admin/announcements", label: "Announcements", icon: Megaphone },
      { href: "/super-admin/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/super-admin/backups", label: "Backups", icon: Database },
      { href: "/super-admin/platform-incidents", label: "Platform Incidents", icon: AlertOctagon },
      { href: "/super-admin/settings", label: "Platform Settings", icon: Settings },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/super-admin/profile", label: "My Profile", icon: Users }],
  },
];

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const navScrollRef = usePersistScroll<HTMLElement>("super-admin-sidebar-nav");

  const renderContent = (persistScroll: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/super-admin" className="text-xs font-semibold tracking-[0.15em] text-accent">
            AI CAMPUS GUARDIAN
          </Link>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden rounded-lg p-2 text-muted hover:bg-glass hover:text-foreground lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-muted hover:text-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav
        ref={persistScroll ? navScrollRef : undefined}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-muted uppercase">
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/super-admin" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        active
                          ? "bg-accent/10 text-accent"
                          : "text-muted hover:bg-glass hover:text-foreground",
                        collapsed && "justify-center px-2"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
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

      <div
        className={cn(
          "border-t border-border p-3",
          collapsed ? "flex justify-center" : "flex items-center justify-between gap-2"
        )}
      >
        {!collapsed && (
          <p className="px-1 text-[10px] font-medium tracking-wider text-muted uppercase">Appearance</p>
        )}
        <ThemeToggle size="sm" />
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-surface/95 backdrop-blur-xl transition-all lg:block",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {renderContent(true)}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface lg:hidden"
            >
              {renderContent(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
