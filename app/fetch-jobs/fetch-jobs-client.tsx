"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [locationPickerQuery, setLocationPickerQuery] = useState("");
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [statusTab, setStatusTab] = useState("all");
  const [logLocationFilter, setLogLocationFilter] = useState<number | "">("");
  const [logLocationPickerQuery, setLogLocationPickerQuery] = useState("Semua lokasi");
  const [isLogLocationPickerOpen, setIsLogLocationPickerOpen] = useState(false);
  const [logSourceFilter, setLogSourceFilter] = useState("all");
  const [logDatePreset, setLogDatePreset] = useState("all");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");
  const [logResultFilter, setLogResultFilter] = useState("all");
  const [logFetchedFilter, setLogFetchedFilter] = useState("all");
  const [logInsertedFilter, setLogInsertedFilter] = useState("all");
  const [logDuplicateFilter, setLogDuplicateFilter] = useState("all");
  const [logErrorFilter, setLogErrorFilter] = useState("all");
  const [logSortFilter, setLogSortFilter] = useState("newest");

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

  function buildFetchPayload(options?: { dryRun?: boolean; locationId?: number | "" }) {
    return {
      location_id: options?.locationId || requireSelectedLocation(),
      source: selectedSource || settings?.review_source_mode,
      target_review_count: targetReviewCount,
      dry_run: options?.dryRun || undefined,
      date_preset: datePreset === "all" || datePreset === "custom" ? undefined : datePreset,
      start_date: datePreset === "custom" && customStartDate ? customStartDate : undefined,
      end_date: datePreset === "custom" && customEndDate ? customEndDate : undefined,
    };
  }

  function buildBatchPayload(options?: { dryRun?: boolean }) {
    return {
      dry_run: options?.dryRun || false,
      date_preset: datePreset === "all" || datePreset === "custom" ? undefined : datePreset,
      start_date: datePreset === "custom" && customStartDate ? customStartDate : undefined,
      end_date: datePreset === "custom" && customEndDate ? customEndDate : undefined,
    };
  }

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );
  const selectableLocations = useMemo(() => {
    const query = locationPickerQuery.trim().toLowerCase();
    if (!query) return locations;
    return locations.filter((location) =>
      [location.branch_name, location.city, location.source, location.external_place_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [locationPickerQuery, locations]);
  const logLocationOptions = useMemo(() => {
    const query = logLocationPickerQuery.trim().toLowerCase();
    if (!query || query === "semua lokasi") return locations;
    return locations.filter((location) =>
      [location.branch_name, location.city, location.source, location.external_place_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [locations, logLocationPickerQuery]);
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
    const dateMatches = (log: FetchLog) => {
      const timestamp = log.started_at ? new Date(log.started_at).getTime() : 0;
      if (!timestamp) return logDatePreset === "all";
      const now = new Date();
      if (logDatePreset === "today") return new Date(timestamp).toDateString() === now.toDateString();
      if (logDatePreset === "last_7_days") return timestamp >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
      if (logDatePreset === "last_30_days") return timestamp >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
      if (logDatePreset === "custom") {
        const start = logStartDate ? new Date(`${logStartDate}T00:00:00`).getTime() : 0;
        const end = logEndDate ? new Date(`${logEndDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
        return timestamp >= start && timestamp <= end;
      }
      return true;
    };

    const resultMatches = (log: FetchLog) => {
      const totalFailed = log.total_failed ?? 0;
      const totalInserted = log.total_inserted ?? 0;
      if (logResultFilter === "with_failed") return totalFailed > 0 || log.status === "failed";
      if (logResultFilter === "with_inserted") return totalInserted > 0;
      if (logResultFilter === "empty") return totalInserted === 0 && totalFailed === 0;
      return true;
    };
    const numberMatches = (value: number | null | undefined, filter: string) => {
      const total = value ?? 0;
      if (filter === "zero") return total === 0;
      if (filter === "one_plus") return total > 0;
      if (filter === "ten_plus") return total >= 10;
      if (filter === "fifty_plus") return total >= 50;
      return true;
    };
    const errorMatches = (log: FetchLog) => {
      if (logErrorFilter === "with_error") return Boolean(log.error_message?.trim()) || (log.total_failed ?? 0) > 0;
      if (logErrorFilter === "without_error") return !log.error_message?.trim() && (log.total_failed ?? 0) === 0;
      return true;
    };

    return logs.filter((log) => {
      const matchesStatus = statusTab === "all" || log.status === statusTab;
      const matchesLocation = !logLocationFilter || log.location_id === logLocationFilter;
      const matchesSource = logSourceFilter === "all" || log.source === logSourceFilter;
      return (
        matchesStatus &&
        matchesLocation &&
        matchesSource &&
        dateMatches(log) &&
        resultMatches(log) &&
        numberMatches(log.total_fetched, logFetchedFilter) &&
        numberMatches(log.total_inserted, logInsertedFilter) &&
        numberMatches(log.total_duplicate, logDuplicateFilter) &&
        errorMatches(log)
      );
    }).sort((a, b) => {
      if (logSortFilter === "oldest") {
        return new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime();
      }
      if (logSortFilter === "failed_desc") return (b.total_failed ?? 0) - (a.total_failed ?? 0);
      if (logSortFilter === "inserted_desc") return (b.total_inserted ?? 0) - (a.total_inserted ?? 0);
      return new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime();
    });
  }, [logDatePreset, logDuplicateFilter, logEndDate, logErrorFilter, logFetchedFilter, logInsertedFilter, logLocationFilter, logResultFilter, logSortFilter, logSourceFilter, logStartDate, logs, statusTab]);

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

              <div className="action-controls fetch-controls">
                <label className="fetch-location-selector">
                  <span>Pilih lokasi</span>
                  <div className="location-combobox">
                    <input
                      value={locationPickerQuery}
                      onFocus={() => setIsLocationPickerOpen(true)}
                      onChange={(event) => {
                        setLocationPickerQuery(event.target.value);
                        setSelectedLocationId("");
                        setIsLocationPickerOpen(true);
                      }}
                      placeholder="Cari cabang atau kota..."
                      disabled={isActionRunning}
                    />
                    <button type="button" onClick={() => setIsLocationPickerOpen((current) => !current)} disabled={isActionRunning}>
                      <ChevronDown aria-hidden="true" size={17} />
                    </button>
                    {isLocationPickerOpen ? (
                      <div className="location-combobox-menu">
                        {selectableLocations.slice(0, 8).map((location) => (
                          <button
                            type="button"
                            key={location.id}
                            onClick={() => {
                              setSelectedLocationId(location.id);
                              setLocationPickerQuery(location.branch_name);
                              setIsLocationPickerOpen(false);
                            }}
                          >
                            <strong>{location.branch_name}</strong>
                            <span>{location.city ?? "Tanpa kota"} · {location.source}</span>
                          </button>
                        ))}
                        {selectableLocations.length === 0 ? <p>Tidak ada cabang yang cocok.</p> : null}
                      </div>
                    ) : null}
                  </div>
                </label>
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
                    <option value="custom">Tanggal spesifik</option>
                  </select>
                </label>
                {datePreset === "custom" ? (
                  <div className="fetch-date-range">
                    <label>
                      <span>Mulai</span>
                      <input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
                    </label>
                    <label>
                      <span>Sampai</span>
                      <input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
                    </label>
                  </div>
                ) : null}
                <div className="selected-location-card">
                  <strong>{selectedLocation?.branch_name ?? "Belum pilih lokasi"}</strong>
                  <span>{selectedLocation?.external_place_id ?? "Pilih lokasi di atas untuk melihat external place id."}</span>
                </div>
                <div className="button-row">
                  <button type="button" className="primary-action" disabled={isActionRunning || !selectedLocationId} onClick={() => runAction("Run Fetch", () => postJson("/api/fetch-jobs", buildFetchPayload()))}>
                    <Zap aria-hidden="true" size={15} /> Jalankan Fetch
                  </button>
                  <button type="button" disabled={isActionRunning || !selectedLocationId} onClick={() => runAction("Dry Run Fetch", () => postJson("/api/fetch-jobs", buildFetchPayload({ dryRun: true })))}>
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
                  <div><span>Rentang</span><strong>{datePreset === "custom" ? "Tanggal spesifik" : datePreset === "all" ? "Semua" : datePreset.replaceAll("_", " ")}</strong></div>
                </div>
              </div>
              <div className="button-row module-actions">
                <button type="button" className="primary-action" disabled={isActionRunning || activeLocations.length === 0} onClick={() => runAction("Fetch All Active", () => postJson("/api/fetch-jobs/all-active", buildBatchPayload()))}>
                  Fetch Semua Aktif
                </button>
                <button type="button" disabled={isActionRunning || activeLocations.length === 0} onClick={() => runAction("Dry Run All Active", () => postJson("/api/fetch-jobs/all-active", buildBatchPayload({ dryRun: true })))}>
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
                    <div className="location-combobox table-location-combobox">
                      <input
                        value={logLocationPickerQuery}
                        onFocus={() => setIsLogLocationPickerOpen(true)}
                        onChange={(event) => {
                          setLogLocationPickerQuery(event.target.value);
                          setLogLocationFilter("");
                          setIsLogLocationPickerOpen(true);
                        }}
                        placeholder="Semua lokasi"
                      />
                      <button type="button" onClick={() => setIsLogLocationPickerOpen((current) => !current)}>
                        <ChevronDown aria-hidden="true" size={17} />
                      </button>
                      {isLogLocationPickerOpen ? (
                        <div className="location-combobox-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setLogLocationFilter("");
                              setLogLocationPickerQuery("Semua lokasi");
                              setIsLogLocationPickerOpen(false);
                            }}
                          >
                            <strong>Semua lokasi</strong>
                            <span>Tampilkan semua fetch log</span>
                          </button>
                          {logLocationOptions.slice(0, 10).map((location) => (
                            <button
                              type="button"
                              key={location.id}
                              onClick={() => {
                                setLogLocationFilter(location.id);
                                setLogLocationPickerQuery(location.branch_name);
                                setIsLogLocationPickerOpen(false);
                              }}
                            >
                              <strong>{location.branch_name}</strong>
                              <span>{location.city ?? "Tanpa kota"} · {location.source}</span>
                            </button>
                          ))}
                          {logLocationOptions.length === 0 ? <p>Tidak ada cabang yang cocok.</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                }
                extendedFilterTitle="Extended Filters"
                onResetFilters={() => {
                  setStatusTab("all");
                  setLogLocationFilter("");
                  setLogLocationPickerQuery("Semua lokasi");
                  setLogSourceFilter("all");
                  setLogDatePreset("all");
                  setLogStartDate("");
                  setLogEndDate("");
                  setLogResultFilter("all");
                  setLogFetchedFilter("all");
                  setLogInsertedFilter("all");
                  setLogDuplicateFilter("all");
                  setLogErrorFilter("all");
                  setLogSortFilter("newest");
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
                    <div className="location-combobox extended-combobox">
                      <input
                        value={logLocationPickerQuery}
                        onFocus={() => setIsLogLocationPickerOpen(true)}
                        onChange={(event) => {
                          setLogLocationPickerQuery(event.target.value);
                          setLogLocationFilter("");
                          setIsLogLocationPickerOpen(true);
                        }}
                        placeholder="Cari lokasi..."
                      />
                      <button type="button" onClick={() => setIsLogLocationPickerOpen((current) => !current)}>
                        <ChevronDown aria-hidden="true" size={17} />
                      </button>
                      {isLogLocationPickerOpen ? (
                        <div className="location-combobox-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setLogLocationFilter("");
                              setLogLocationPickerQuery("Semua lokasi");
                              setIsLogLocationPickerOpen(false);
                            }}
                          >
                            <strong>Semua lokasi</strong>
                            <span>Tampilkan semua fetch log</span>
                          </button>
                          {logLocationOptions.slice(0, 10).map((location) => (
                            <button
                              type="button"
                              key={location.id}
                              onClick={() => {
                                setLogLocationFilter(location.id);
                                setLogLocationPickerQuery(location.branch_name);
                                setIsLogLocationPickerOpen(false);
                              }}
                            >
                              <strong>{location.branch_name}</strong>
                              <span>{location.city ?? "Tanpa kota"} · {location.source}</span>
                            </button>
                          ))}
                          {logLocationOptions.length === 0 ? <p>Tidak ada cabang yang cocok.</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </label>
                  <label>
                    <span>Sumber review</span>
                      <select value={logSourceFilter} onChange={(event) => setLogSourceFilter(event.target.value)}>
                        <option value="all">Semua sumber</option>
                        {logSources.map((source) => <option value={source} key={source}>{source}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Total fetched</span>
                    <select value={logFetchedFilter} onChange={(event) => setLogFetchedFilter(event.target.value)}>
                      <option value="all">Semua jumlah</option>
                      <option value="zero">0 review</option>
                      <option value="one_plus">Ada review</option>
                      <option value="ten_plus">Minimal 10</option>
                      <option value="fifty_plus">Minimal 50</option>
                    </select>
                  </label>
                  <label>
                    <span>Total inserted</span>
                    <select value={logInsertedFilter} onChange={(event) => setLogInsertedFilter(event.target.value)}>
                      <option value="all">Semua jumlah</option>
                      <option value="zero">Tidak ada review baru</option>
                      <option value="one_plus">Ada review baru</option>
                      <option value="ten_plus">Minimal 10</option>
                      <option value="fifty_plus">Minimal 50</option>
                    </select>
                  </label>
                  <label>
                    <span>Total duplicate</span>
                    <select value={logDuplicateFilter} onChange={(event) => setLogDuplicateFilter(event.target.value)}>
                      <option value="all">Semua duplicate</option>
                      <option value="zero">Tanpa duplicate</option>
                      <option value="one_plus">Ada duplicate</option>
                      <option value="ten_plus">Minimal 10</option>
                    </select>
                  </label>
                  <label>
                    <span>Error message</span>
                    <select value={logErrorFilter} onChange={(event) => setLogErrorFilter(event.target.value)}>
                      <option value="all">Semua log</option>
                      <option value="with_error">Ada error</option>
                      <option value="without_error">Tanpa error</option>
                    </select>
                  </label>
                    <label>
                      <span>Rentang tanggal log</span>
                      <select value={logDatePreset} onChange={(event) => setLogDatePreset(event.target.value)}>
                        <option value="all">Semua tanggal</option>
                        <option value="today">Hari ini</option>
                        <option value="last_7_days">7 hari terakhir</option>
                        <option value="last_30_days">30 hari terakhir</option>
                        <option value="custom">Tanggal spesifik</option>
                      </select>
                    </label>
                    {logDatePreset === "custom" ? (
                      <div className="extended-filter-date-row">
                        <label>
                          <span>Start date</span>
                          <input type="date" value={logStartDate} onChange={(event) => setLogStartDate(event.target.value)} />
                        </label>
                        <label>
                          <span>End date</span>
                          <input type="date" value={logEndDate} onChange={(event) => setLogEndDate(event.target.value)} />
                        </label>
                      </div>
                    ) : null}
                    <label>
                      <span>Hasil fetch</span>
                      <select value={logResultFilter} onChange={(event) => setLogResultFilter(event.target.value)}>
                        <option value="all">Semua hasil</option>
                        <option value="with_inserted">Ada review baru</option>
                        <option value="with_failed">Ada gagal/error</option>
                        <option value="empty">Tidak ada perubahan</option>
                      </select>
                    </label>
                    <label>
                      <span>Urutkan berdasarkan</span>
                      <select value={logSortFilter} onChange={(event) => setLogSortFilter(event.target.value)}>
                        <option value="newest">Terbaru</option>
                        <option value="oldest">Terlama</option>
                        <option value="inserted_desc">Review baru terbanyak</option>
                        <option value="failed_desc">Gagal terbanyak</option>
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
