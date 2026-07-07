"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  ListChecks,
  MapPin,
  Play,
  RefreshCcw,
  Zap,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, SectionHeader } from "../components/ui";
import { fetchJson, postJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import type { ActionMessage, FetchLog, Location, PublicSettings } from "../lib/types";

function FetchJobsMetric({
  label,
  value,
  helper,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "positive" | "danger" | "warning" | "info" | "neutral";
  icon: React.ReactNode;
}) {
  return (
    <article className={`compact-metric metric-${tone}`}>
      <div className="metric-title-row">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
    </article>
  );
}

function logStatusTone(status: string): "positive" | "danger" | "warning" | "info" | "critical" | "neutral" {
  if (status === "success") return "positive";
  if (status === "partial_success") return "warning";
  if (status === "failed") return "critical";
  if (status === "dry_run") return "info";
  return "neutral";
}

function logStatusLabel(status: string) {
  if (status === "success") return "Berhasil";
  if (status === "partial_success") return "Sebagian";
  if (status === "failed") return "Gagal";
  if (status === "dry_run") return "Dry Run";
  if (status === "started") return "Berjalan";
  return status;
}

export default function FetchJobsClient() {
  const [isMounted, setIsMounted] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [logs, setLogs] = useState<FetchLog[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">("");
  const [selectedSource, setSelectedSource] = useState("");
  const [targetReviewCount, setTargetReviewCount] = useState(50);
  const [datePreset, setDatePreset] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [statusTab, setStatusTab] = useState("all");
  const [logLocationFilter, setLogLocationFilter] = useState<number | "">("");
  const [logSourceFilter, setLogSourceFilter] = useState("all");

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      const [locationPayload, settingsPayload, logPayload] = await Promise.all([
        fetchJson<{ items: Location[]; total: number }>("/api/locations?active_only=false"),
        fetchJson<PublicSettings>("/api/settings"),
        fetchJson<{ items: FetchLog[]; total: number }>("/api/fetch-logs?limit=50"),
      ]);
      setLocations(locationPayload.items);
      setSettings(settingsPayload);
      setLogs(logPayload.items);
      setSelectedLocationId((current) => current || locationPayload.items.find((item) => item.is_active)?.id || "");
      setSelectedSource((current) => current || settingsPayload.review_source_mode || locationPayload.items.find((item) => item.source)?.source || "mock");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setLocations([]);
      setLogs([]);
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsMounted(true);
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function runAction(title: string, action: () => Promise<unknown>) {
    setIsActionRunning(true);
    setActionMessage({ type: "info", title, detail: "Request sedang diproses backend..." });
    try {
      const result = await action();
      setActionMessage({ type: "success", title, detail: JSON.stringify(result, null, 2) });
      await loadData({ silent: true });
    } catch (caught) {
      setActionMessage({
        type: "error",
        title: `${title} gagal`,
        detail: caught instanceof Error ? caught.message : "Action gagal.",
      });
    } finally {
      setIsActionRunning(false);
    }
  }

  function requireSelectedLocation() {
    if (!selectedLocationId) throw new Error("Pilih lokasi dulu.");
    return selectedLocationId;
  }

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );
  const activeLocations = locations.filter((location) => location.is_active);
  const latestLog = logs[0] ?? null;
  const successCount = logs.filter((log) => log.status === "success").length;
  const failedCount = logs.filter((log) => log.status === "failed").length;
  const dryRunCount = logs.filter((log) => log.status === "dry_run").length;
  const totalFetched = logs.reduce((sum, log) => sum + (log.total_fetched ?? 0), 0);
  const totalInserted = logs.reduce((sum, log) => sum + (log.total_inserted ?? 0), 0);
  const successRate = logs.length ? Math.round((successCount / logs.length) * 100) : 0;

  const logStatuses = useMemo(() => Array.from(new Set(logs.map((log) => log.status))).sort(), [logs]);
  const logSources = useMemo(() => Array.from(new Set(logs.map((log) => log.source))).sort(), [logs]);
  const sourceOptions = useMemo(() => {
    const options = new Set<string>();
    if (settings?.review_source_mode) options.add(settings.review_source_mode);
    locations.forEach((location) => {
      if (location.source) options.add(location.source);
    });
    logSources.forEach((source) => options.add(source));
    ["mock", "selenium", "google_places", "third_party"].forEach((source) => options.add(source));
    return Array.from(options);
  }, [locations, logSources, settings?.review_source_mode]);
  const statusTabCounts = useMemo(() => {
    return logStatuses.map((status) => ({ status, count: logs.filter((log) => log.status === status).length }));
  }, [logStatuses, logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesStatus = statusTab === "all" || log.status === statusTab;
      const matchesLocation = !logLocationFilter || log.location_id === logLocationFilter;
      const matchesSource = logSourceFilter === "all" || log.source === logSourceFilter;
      return matchesStatus && matchesLocation && matchesSource;
    });
  }, [logLocationFilter, logSourceFilter, logs, statusTab]);

  const logColumns: Array<DataTableColumn<FetchLog>> = [
    {
      id: "location",
      header: "Lokasi",
      accessor: (log) => `${log.location} ${log.source} ${log.status}`,
      render: (log) => (
        <div className="table-primary-cell">
          <strong><MapPin aria-hidden="true" size={13} /> {log.location}</strong>
          <span>{formatDate(log.started_at)} - {formatDate(log.finished_at)}</span>
        </div>
      ),
      width: "24%",
    },
    {
      id: "source",
      header: "Sumber",
      render: (log) => <Badge tone="info">{log.source}</Badge>,
    },
    {
      id: "status",
      header: "Status",
      render: (log) => (
        <div className="table-primary-cell">
          <Badge tone={logStatusTone(log.status)}>{logStatusLabel(log.status)}</Badge>
          {log.error_message ? <span className="table-muted">{log.error_message}</span> : null}
        </div>
      ),
    },
    { id: "fetched", header: "Fetched", align: "right", accessor: (log) => log.total_fetched },
    { id: "inserted", header: "Inserted", align: "right", accessor: (log) => log.total_inserted },
    { id: "duplicate", header: "Duplicate", align: "right", accessor: (log) => log.total_duplicate },
    { id: "failed", header: "Failed", align: "right", accessor: (log) => log.total_failed },
  ];

  return (
    <AppShell>
      <header className="page-header dashboard-hero-header">
        <div>
          <p className="kicker">Fetch Jobs</p>
          <h1>Operasi Fetch Review</h1>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={!isMounted || isActionRunning || isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Muat ulang
          </button>
        </div>
      </header>

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      {!isMounted ? (
        <section className="panel page-panel"><EmptyState title="Menyiapkan halaman" detail="Menunggu client siap untuk mencegah hydration mismatch dari extension browser." /></section>
      ) : (
        <section className="locations-page-stack fetch-jobs-page">
          <section className="dashboard-kpi-strip location-summary-strip fetch-summary-strip">
            <FetchJobsMetric
              label="Total Lokasi"
              value={formatNumber(locations.length)}
              helper={`${formatNumber(activeLocations.length)} lokasi aktif`}
              icon={<MapPin aria-hidden="true" size={16} />}
            />
            <FetchJobsMetric
              label="Review Fetched"
              value={formatNumber(totalFetched)}
              tone="positive"
              helper={`${formatNumber(totalInserted)} review baru`}
              icon={<DatabaseZap aria-hidden="true" size={16} />}
            />
            <FetchJobsMetric
              label="Fetch Log"
              value={formatNumber(logs.length)}
              tone="info"
              helper={latestLog ? `Terakhir ${formatDate(latestLog.started_at)}` : "Belum ada log"}
              icon={<ListChecks aria-hidden="true" size={16} />}
            />
            <FetchJobsMetric
              label="Success Rate"
              value={`${successRate}%`}
              tone="positive"
              helper={`${formatNumber(successCount)} berhasil`}
              icon={<CheckCircle2 aria-hidden="true" size={16} />}
            />
            <FetchJobsMetric
              label="Issue"
              value={formatNumber(failedCount)}
              tone="danger"
              helper={`${formatNumber(dryRunCount)} dry run`}
              icon={<AlertTriangle aria-hidden="true" size={16} />}
            />
          </section>

          <section className="fetch-ops-grid">
            <article className="panel page-panel fetch-operation-card">
              <SectionHeader
                kicker="Fetch Lokasi"
                title="Fetch Satu Lokasi"
              />

              <div className="fetch-location-grid">
                {locations.map((location) => (
                  <button
                    type="button"
                    key={location.id}
                    className={`fetch-location-card${location.id === selectedLocationId ? " active" : ""}`}
                    onClick={() => setSelectedLocationId(location.id)}
                    disabled={isActionRunning}
                  >
                    <strong><MapPin aria-hidden="true" size={13} /> {location.branch_name}</strong>
                    <span>{location.city ?? "Tanpa kota"} · {location.source}</span>
                    <Badge tone={location.is_active ? "positive" : "neutral"}>{location.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </button>
                ))}
                {locations.length === 0 ? (
                  <EmptyState title="Belum ada lokasi" detail="Tambah cabang dulu di halaman Locations." />
                ) : null}
              </div>

              <div className="action-controls fetch-controls">
                <label>
                  <span>Sumber</span>
                  <select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)}>
                    {sourceOptions.map((source) => <option value={source} key={source}>{source}</option>)}
                  </select>
                </label>
                <label>
                  <span>Target Review</span>
                  <input type="number" min={1} max={300} value={targetReviewCount} onChange={(event) => setTargetReviewCount(Number(event.target.value))} />
                </label>
                <label>
                  <span>Rentang Tanggal</span>
                  <select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
                    <option value="all">Semua tanggal</option>
                    <option value="today">Hari ini</option>
                    <option value="yesterday">Kemarin</option>
                    <option value="last_7_days">7 hari terakhir</option>
                    <option value="last_30_days">30 hari terakhir</option>
                    <option value="this_month">Bulan ini</option>
                  </select>
                </label>
                <div className="selected-location-card">
                  <strong>{selectedLocation?.branch_name ?? "Belum pilih lokasi"}</strong>
                  <span>{selectedLocation?.external_place_id ?? "Pilih lokasi di atas untuk melihat external place id."}</span>
                </div>
                <div className="button-row">
                  <button type="button" className="primary-action" disabled={isActionRunning || !selectedLocationId} onClick={() => runAction("Run Fetch", () => postJson("/api/fetch-jobs", { location_id: requireSelectedLocation(), source: selectedSource || settings?.review_source_mode, target_review_count: targetReviewCount, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                    <Zap aria-hidden="true" size={15} /> Jalankan Fetch
                  </button>
                  <button type="button" disabled={isActionRunning || !selectedLocationId} onClick={() => runAction("Dry Run Fetch", () => postJson("/api/fetch-jobs", { location_id: requireSelectedLocation(), source: selectedSource || settings?.review_source_mode, target_review_count: targetReviewCount, dry_run: true, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                    <Play aria-hidden="true" size={15} /> Dry Run
                  </button>
                </div>
              </div>
            </article>

            <article className="panel page-panel fetch-batch-card">
              <SectionHeader
                kicker="Batch Operasi"
                title="Fetch Semua Lokasi Aktif"
              />
              <div className="batch-overview">
                <div className="batch-card primary">
                  <DatabaseZap aria-hidden="true" size={22} />
                  <div>
                    <strong>{formatNumber(activeLocations.length)} lokasi aktif</strong>
                    <p>Diproses berurutan agar kalau satu cabang gagal, cabang lain tetap lanjut.</p>
                  </div>
                </div>
                <div className="batch-stat-grid">
                  <div><span>Sumber</span><strong>{selectedSource || settings?.review_source_mode || "mock"}</strong></div>
                  <div><span>Target</span><strong>{formatNumber(targetReviewCount)}</strong></div>
                  <div><span>Rentang</span><strong>{datePreset === "all" ? "Semua" : datePreset.replaceAll("_", " ")}</strong></div>
                </div>
              </div>
              <div className="button-row module-actions">
                <button type="button" className="primary-action" disabled={isActionRunning || activeLocations.length === 0} onClick={() => runAction("Fetch All Active", () => postJson("/api/fetch-jobs/all-active", { dry_run: false, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                  Fetch Semua Aktif
                </button>
                <button type="button" disabled={isActionRunning || activeLocations.length === 0} onClick={() => runAction("Dry Run All Active", () => postJson("/api/fetch-jobs/all-active", { dry_run: true, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                  Dry Run Semua
                </button>
              </div>
              <div className="fetch-job-timeline">
                <div className={latestLog ? `job-node ${latestLog.status === "failed" ? "danger" : "success"}` : "job-node"}>
                  <span>Fetch terakhir</span>
                  <strong>{latestLog ? `${latestLog.location} · ${logStatusLabel(latestLog.status)}` : "Belum ada aktivitas"}</strong>
                </div>
                <div className={failedCount ? "job-node danger" : "job-node success"}>
                  <span>Audit log</span>
                  <strong>{failedCount ? `${formatNumber(failedCount)} job gagal perlu dicek` : "Tidak ada job gagal"}</strong>
                </div>
              </div>
            </article>

            <article className="panel page-panel panel-wide location-registry-panel fetch-log-panel">
              <SectionHeader
                kicker="Fetch Logs"
                title="Riwayat Fetch"
              />

              <DataTable
                data={filteredLogs}
                columns={logColumns}
                getRowKey={(log) => log.id}
                isLoading={isLoading}
                emptyTitle="Belum ada fetch log"
                emptyDetail="Jalankan dry-run atau fetch untuk mulai mencatat aktivitas."
                searchPlaceholder="Cari lokasi, source, atau status..."
                pageSize={10}
                searchableText={(log) => [log.location, log.source, log.status].filter(Boolean).join(" ")}
                filters={
                  <>
                    <select value={statusTab} onChange={(event) => setStatusTab(event.target.value)}>
                      <option value="all">Semua status</option>
                      {statusTabCounts.map(({ status, count }) => (
                        <option value={status} key={status}>{logStatusLabel(status)} ({formatNumber(count)})</option>
                      ))}
                    </select>
                    <select value={logLocationFilter} onChange={(event) => setLogLocationFilter(Number(event.target.value) || "")}>
                      <option value="">Semua lokasi</option>
                      {locations.map((location) => <option value={location.id} key={location.id}>{location.branch_name}</option>)}
                    </select>
                    <select value={logSourceFilter} onChange={(event) => setLogSourceFilter(event.target.value)}>
                      <option value="all">Semua sumber</option>
                      {logSources.map((source) => <option value={source} key={source}>{source}</option>)}
                    </select>
                  </>
                }
                extendedFilterTitle="Extended Filters"
                onResetFilters={() => {
                  setStatusTab("all");
                  setLogLocationFilter("");
                  setLogSourceFilter("all");
                }}
                extendedFilters={
                  <>
                    <label>
                      <span>Status fetch</span>
                      <select value={statusTab} onChange={(event) => setStatusTab(event.target.value)}>
                        <option value="all">Semua status</option>
                        {logStatuses.map((status) => <option value={status} key={status}>{logStatusLabel(status)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Pilih lokasi</span>
                      <select value={logLocationFilter} onChange={(event) => setLogLocationFilter(Number(event.target.value) || "")}>
                        <option value="">Semua lokasi</option>
                        {locations.map((location) => <option value={location.id} key={location.id}>{location.branch_name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Sumber review</span>
                      <select value={logSourceFilter} onChange={(event) => setLogSourceFilter(event.target.value)}>
                        <option value="all">Semua sumber</option>
                        {logSources.map((source) => <option value={source} key={source}>{source}</option>)}
                      </select>
                    </label>
                  </>
                }
              />
            </article>
          </section>
        </section>
      )}
    </AppShell>
  );
}
