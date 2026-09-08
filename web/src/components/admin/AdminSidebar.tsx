"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Camera,
  Brain,
  ChevronLeft,
  DoorOpen,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  Monitor,
  ScrollText,
  Settings,
  Shield,
  UserCircle,
  Users,
  X,
  Bell,
  CreditCard,
  ClipboardList,
  HardDrive,
  Plug,
  UserPlus,
  Rocket,
  Workflow,
  CheckSquare,
  LifeBuoy,
  GraduationCap,
  Activity,
  Download,
  Map,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersistScroll } from "@/hooks/usePersistScroll";

const navSections = [
  {
    title: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Organization",
    items: [
      { href: "/admin/organization", label: "Organization Profile", icon: Building2 },
      { href: "/admin/campus", label: "Campus Overview", icon: Building2 },
    ],
  },
  {
    title: "Campus",
    items: [
      { href: "/map", label: "Digital Campus Map", icon: Map },
      { href: "/admin/campus/buildings", label: "Buildings", icon: Building2 },
      { href: "/admin/campus/rooms", label: "Rooms", icon: DoorOpen },
      { href: "/admin/cameras", label: "Cameras", icon: Camera },
      { href: "/video", label: "Video Intelligence", icon: Video },
      { href: "/mobile", label: "Mobile / Field Ops", icon: Monitor },
      { href: "/tasks", label: "Tasks", icon: ClipboardList },
      { href: "/teams", label: "Response Teams", icon: Users },
      { href: "/admin/video/ai", label: "Video AI", icon: Video },
      { href: "/admin/video/inventory", label: "Camera Inventory", icon: Camera },
      { href: "/admin/video/privacy", label: "Video Privacy", icon: Shield },
      { href: "/analytics/video", label: "Video Analytics", icon: LineChart },
      { href: "/assets/map", label: "Asset Map", icon: HardDrive },
      { href: "/analytics/map", label: "Map Analytics", icon: LineChart },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/staff", label: "Staff", icon: Users },
      { href: "/admin/users", label: "Users", icon: UserCircle },
      { href: "/admin/users/invitations", label: "Invitations", icon: UserPlus },
    ],
  },
  {
    title: "Command",
    items: [
      { href: "/admin/command-center", label: "Command Center", icon: Monitor },
      { href: "/command/video-wall", label: "Video Wall", icon: Video },
      { href: "/map?mode=EMERGENCY", label: "Emergency Map", icon: AlertTriangle },
      { href: "/admin/emergency", label: "Emergency", icon: AlertTriangle },
      { href: "/admin/response-teams", label: "Response Teams", icon: Users },
      { href: "/admin/playbooks", label: "Playbooks", icon: ScrollText },
      { href: "/admin/emergency-contacts", label: "Emergency Contacts", icon: Bell },
    ],
  },
  {
    title: "AI Intelligence",
    items: [
      { href: "/ai-copilot", label: "Copilot", icon: Brain },
      { href: "/admin/ai", label: "AI Intelligence", icon: Brain },
      { href: "/admin/ai/knowledge", label: "Knowledge", icon: ScrollText },
      { href: "/ai/daily-briefing", label: "Daily Briefing", icon: Lightbulb },
      { href: "/ai/predictive-risk", label: "Predictive Risk", icon: LineChart },
      { href: "/ai/recommendations", label: "Recommendations", icon: ClipboardList },
      { href: "/admin/ai/privacy", label: "Privacy", icon: Shield },
      { href: "/admin/incidents", label: "Incidents", icon: Shield },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { href: "/admin/monitoring", label: "Live Monitoring", icon: Monitor },
      { href: "/admin/events", label: "Events", icon: ScrollText },
      { href: "/admin/alerts", label: "Alert Center", icon: AlertTriangle },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Security",
    items: [
      { href: "/admin/security", label: "Security Activity", icon: Shield },
      { href: "/admin/security/login-history", label: "Login History", icon: ScrollText },
      { href: "/admin/sessions", label: "Sessions", icon: ScrollText },
      { href: "/admin/settings/escalation", label: "Escalation Rules", icon: Settings },
    ],
  },
  {
    title: "Enterprise",
    items: [
      { href: "/admin/automation", label: "Automation", icon: Workflow },
      { href: "/approvals", label: "Approvals", icon: CheckSquare },
      { href: "/admin/policies", label: "Policies", icon: Shield },
      { href: "/enterprise", label: "Enterprise Dashboard", icon: LayoutDashboard },
      { href: "/workspace", label: "Workspace", icon: ClipboardList },
      { href: "/support", label: "Support", icon: LifeBuoy },
      { href: "/admin/training", label: "Training", icon: GraduationCap },
      { href: "/admin/system-readiness", label: "System Readiness", icon: Activity },
      { href: "/admin/exports", label: "Exports", icon: Download },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/billing", label: "Billing", icon: CreditCard },
      { href: "/admin/onboarding", label: "Onboarding", icon: Rocket },
      { href: "/admin/integrations", label: "Integrations", icon: Plug },
      { href: "/admin/audit", label: "Audit", icon: ScrollText },
      { href: "/admin/departments", label: "Departments", icon: Building2 },
      { href: "/admin/storage", label: "Storage", icon: HardDrive },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/executive", label: "Executive Command", icon: BarChart3 },
      { href: "/admin/analytics", label: "Safety Intelligence", icon: LineChart },
      { href: "/admin/executive", label: "Executive Overview", icon: BarChart3 },
      { href: "/governance", label: "Governance", icon: Shield },
      { href: "/strategy", label: "Strategy", icon: ClipboardList },
      { href: "/admin/insights", label: "Insights", icon: Lightbulb },
      { href: "/admin/actions", label: "Corrective Actions", icon: ClipboardList },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/reports/executive", label: "Executive Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/settings/profile", label: "My Profile", icon: UserCircle },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

interface AdminSidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export function AdminSidebar({ open, collapsed, onClose, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();
  const navScrollRef = usePersistScroll<HTMLElement>("admin-sidebar-nav");

  const renderContent = (persistScroll: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <Link href="/admin/dashboard" className="text-xs font-semibold tracking-[0.15em] text-accent">
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
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:text-foreground lg:hidden" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav ref={persistScroll ? navScrollRef : undefined} className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-muted uppercase">{section.title}</p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        active ? "bg-accent/10 text-accent" : "text-muted hover:bg-glass hover:text-foreground",
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
    </div>
  );

  return (
    <>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-surface/95 backdrop-blur-xl transition-all lg:block", collapsed ? "w-[72px]" : "w-64")}>
        {renderContent(true)}
      </aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-surface lg:hidden">
              {renderContent(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
