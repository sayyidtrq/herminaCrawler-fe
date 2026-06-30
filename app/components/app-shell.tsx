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

const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Locations", href: "/locations", icon: Building2 },
  { label: "Fetch Jobs", href: "/fetch-jobs", icon: DatabaseZap },
  { label: "Reviews", href: "/reviews", icon: MessageSquareText },
  { label: "Analysis", href: "/analysis", icon: Bot },
  { label: "Insights", href: "/insights", icon: Sparkles },
  { label: "Reports", href: "/reports", icon: FileChartColumn },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand-block" href="/dashboard">
          <div className="brand-mark">H</div>
          <div>
            <p>Hermina</p>
            <strong>Review Intelligence</strong>
          </div>
        </Link>

        <nav className="nav-list" aria-label="Navigasi utama">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link className={pathname === href ? "active" : ""} href={href} key={href}>
              <Icon aria-hidden="true" size={16} strokeWidth={2.15} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-intel-card">
          <span className="label-with-icon">Product Mode</span>
          <strong>Web MVP</strong>
          <p>Route-based workflow untuk scraping, review intelligence, dan reporting.</p>
          <div className="mini-meter">
            <i style={{ width: "58%" }} />
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
