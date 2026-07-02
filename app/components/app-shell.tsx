"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  DatabaseZap,
  FileChartColumn,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

import { useAuth } from "../lib/auth-context";
import { LogOut } from "lucide-react";

const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Locations", href: "/locations", icon: Building2 },
  { label: "Competitors", href: "/competitors", icon: Building2 },
  { label: "Fetch Jobs", href: "/fetch-jobs", icon: DatabaseZap },
  { label: "Reviews", href: "/reviews", icon: MessageSquareText },
  { label: "Analysis", href: "/analysis", icon: Bot },
  { label: "Insights", href: "/insights", icon: Sparkles },
  { label: "Reports", href: "/reports", icon: FileChartColumn },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-400">Memeriksa sesi pengguna...</p>
        </div>
      </div>
    );
  }

  // If loading is done and there's no user, redirecting is already handled by AuthProvider.
  // We double check and return null to prevent rendering protected components briefly.
  if (!user && pathname !== "/login") {
    return null;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand-block" href="/dashboard">
          <div className="brand-mark">H</div>
          <div>
            <p>{user?.company_name || "Hermina"}</p>
            <strong>Review Intelligence</strong>
          </div>
        </Link>

        <nav className="nav-list" aria-label="Navigasi utama">
          {navItems.map(({ label, href, icon: Icon }) => {
            // Hide competitor menu if company doesn't have analyze_competitor_flag
            if (label === "Competitors" && user && !user.analyze_competitor_flag) {
              return null;
            }
            return (
              <Link className={pathname === href ? "active" : ""} href={href} key={href}>
                <Icon aria-hidden="true" size={16} strokeWidth={2.15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="mt-auto border-t border-white/10 pt-4 flex flex-col gap-2">
            <div className="px-2 text-xs">
              <span className="block font-semibold text-slate-200">{user.full_name || "Administrator"}</span>
              <span className="block text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">{user.email}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-400 hover:bg-white/5 active:scale-95 transition-all w-full text-left"
            >
              <LogOut size={15} />
              Keluar
            </button>
          </div>
        )}

        <div className="sidebar-intel-card mt-2">
          <span className="label-with-icon font-semibold">Features Entitled</span>
          <div className="space-y-1.5 mt-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>AI Analysis:</span>
              <span className={user?.ai_enable_flag ? "text-emerald-400" : "text-slate-500"}>
                {user?.ai_enable_flag ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Comp Tracker:</span>
              <span className={user?.analyze_competitor_flag ? "text-emerald-400" : "text-slate-500"}>
                {user?.analyze_competitor_flag ? "ENABLED" : "DISABLED"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Scrape Limit:</span>
              <span className="text-slate-200">{user?.total_enable_review || 100}</span>
            </div>
          </div>
        </div>

        <div className="sidebar-status">
          <span className="status-dot online" />
          <div>
            <strong>Backend target</strong>
            <p>{API_BASE_URL}</p>
          </div>
        </div>
      </aside>

      <section className="workspace">{children}</section>
    </main>
  );
}
