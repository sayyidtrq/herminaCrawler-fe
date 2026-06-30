"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bot, Building2, DatabaseZap, MessageSquareText, ShieldAlert } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { BackendWarning, EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { fetchJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import type { FetchLog, Health, Location, Overview, PublicSettings } from "../lib/types";

type DashboardData = {
  health: Health;
  settings: PublicSettings;
  locations: { items: Location[]; total: number };
  overview: Overview;
  latestFetch: { item: FetchLog | null };
};

function StatTile({
  label,
  value,
  helper,
  icon: Icon,
  tone = "positive",
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: true }>;
  tone?: "positive" | "danger" | "warning" | "info";
}) {
  return (
    <article className={`stat-tile stat-${tone}`}>
      <div className="stat-icon-row">
        <span>{label}</span>
        <Icon aria-hidden size={17} strokeWidth={2.2} />
      </div>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [health, settings, locations, overview, latestFetch] = await Promise.all([
        fetchJson<Health>("/api/health"),
        fetchJson<PublicSettings>("/api/settings"),
        fetchJson<DashboardData["locations"]>("/api/locations"),
        fetchJson<Overview>("/api/dashboard/overview"),
        fetchJson<DashboardData["latestFetch"]>("/api/fetch-logs/latest"),
      ]);
      setData({ health, settings, locations, overview, latestFetch });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const activeLocations = useMemo(
    () => data?.locations.items.filter((location) => location.is_active).length ?? 0,
    [data?.locations.items],
  );
  const analysisCoverage = data
    ? Math.round((data.overview.analyzed_reviews / Math.max(data.overview.total_reviews, 1)) * 100)
    : 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Patient Experience Mission Control"
        helper="Overview reputasi, coverage AI, dan status pipeline. Modul operasional dipisah ke page sendiri."
      />

      {error ? <BackendWarning error={error} /> : null}

      <section className="dashboard-grid">
        <article className="command-deck route-dashboard-card">
          <div className="deck-copy">
            <p className="kicker">Executive Overview</p>
            <h2>Hospital review intelligence yang siap dioperasikan per modul.</h2>
            <p>
              Gunakan page Locations untuk registry cabang, dan Fetch Jobs untuk scraping/dry-run. Dashboard ini hanya
              menjadi ringkasan keputusan.
            </p>
          </div>
          <div className="deck-metrics">
            <StatTile label="Total Reviews" value={formatNumber(data?.overview.total_reviews)} helper="Database coverage" icon={MessageSquareText} />
            <StatTile label="AI Coverage" value={`${analysisCoverage}%`} helper={`${formatNumber(data?.overview.analyzed_reviews)} analyzed`} icon={Bot} tone="info" />
            <StatTile label="Critical Signals" value={formatNumber(data?.overview.critical_issues)} helper="Need management attention" icon={ShieldAlert} tone="danger" />
            <StatTile label="Pending AI" value={formatNumber(data?.overview.pending_analysis)} helper="Queue for model analysis" icon={Activity} tone="warning" />
          </div>
        </article>

        <article className="panel page-panel">
          <SectionHeader
            kicker="Runtime"
            title="Backend status"
            helper={isLoading ? "Loading backend state..." : `Mode fetch: ${data?.settings.review_source_mode ?? "unknown"}`}
          />
          {isLoading ? <EmptyState title="Loading dashboard" detail="Mengambil data dari backend..." /> : null}
          {!isLoading && data ? (
            <dl className="settings-list">
              <div><dt>Health</dt><dd>{data.health.status}</dd></div>
              <div><dt>Active Locations</dt><dd>{formatNumber(activeLocations)}</dd></div>
              <div><dt>Latest Fetch</dt><dd>{formatDate(data.latestFetch.item?.started_at)}</dd></div>
              <div><dt>Gemini Mode</dt><dd>{data.settings.gemini_mode}</dd></div>
              <div><dt>Google Key</dt><dd>{data.settings.google_maps_api_key_configured ? "Configured" : "Missing"}</dd></div>
            </dl>
          ) : null}
        </article>

        <article className="panel page-panel">
          <SectionHeader
            kicker="Next Actions"
            title="Workflow terpisah"
            helper="Setiap modul sekarang punya route sendiri, bukan anchor section di satu page."
          />
          <div className="quick-route-list">
            <a href="/locations"><Building2 aria-hidden="true" size={16} /> Kelola Locations</a>
            <a href="/fetch-jobs"><DatabaseZap aria-hidden="true" size={16} /> Jalankan Fetch Jobs</a>
            <a href="/reviews"><MessageSquareText aria-hidden="true" size={16} /> Review Feed</a>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
