"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DatabaseZap, Play, RefreshCcw, Zap } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { fetchJson, postJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import type { ActionMessage, FetchLog, Location, PublicSettings } from "../lib/types";

export default function FetchJobsClient() {
  const [isMounted, setIsMounted] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [logs, setLogs] = useState<FetchLog[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">("");
  const [targetReviewCount, setTargetReviewCount] = useState(50);
  const [datePreset, setDatePreset] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

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
  const filteredLogs = useMemo(() => {
    return statusFilter === "all" ? logs : logs.filter((log) => log.status === statusFilter);
  }, [logs, statusFilter]);
  const logStatuses = useMemo(() => Array.from(new Set(logs.map((log) => log.status))).sort(), [logs]);

  const logColumns: Array<DataTableColumn<FetchLog>> = [
    {
      id: "location",
      header: "Location",
      accessor: (log) => `${log.location} ${log.source} ${log.status}`,
      render: (log) => (
        <div className="table-primary-cell">
          <strong>{log.location}</strong>
          <span>{formatDate(log.started_at)} → {formatDate(log.finished_at)}</span>
        </div>
      ),
      width: "28%",
    },
    {
      id: "status",
      header: "Status",
      render: (log) => <Badge tone={log.status === "success" ? "positive" : log.status === "dry_run" ? "info" : "danger"}>{log.status}</Badge>,
    },
    { id: "source", header: "Source", accessor: (log) => log.source },
    { id: "fetched", header: "Fetched", align: "right", accessor: (log) => log.total_fetched },
    { id: "inserted", header: "Inserted", align: "right", accessor: (log) => log.total_inserted },
    { id: "duplicate", header: "Duplicate", align: "right", accessor: (log) => log.total_duplicate },
    { id: "failed", header: "Failed", align: "right", accessor: (log) => log.total_failed },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Fetch Jobs"
        title="Operasikan pipeline scraping"
        helper="Run fetch, dry-run, dan monitor log crawler realtime dari backend."
        action={
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={!isMounted || isActionRunning}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh
          </button>
        }
      />

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      {!isMounted ? (
        <section className="panel page-panel"><EmptyState title="Menyiapkan halaman" detail="Menunggu client siap untuk mencegah hydration mismatch dari extension browser." /></section>
      ) : (
        <section className="split-page-grid">
          <article className="panel page-panel">
            <SectionHeader
              kicker="Run Fetch"
              title="Fetch satu lokasi"
              helper={`Source aktif: ${settings?.review_source_mode ?? "unknown"}. Untuk Selenium, Chrome akan jalan dari backend.`}
            />
            <div className="action-controls fetch-controls">
              <label>
                <span>Location</span>
                <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(Number(event.target.value) || "")}>
                  <option value="">Pilih lokasi</option>
                  {locations.map((location) => (
                    <option value={location.id} key={location.id}>
                      {location.branch_name} · {location.source} · {location.is_active ? "active" : "inactive"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Target Reviews</span>
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
                <span>{selectedLocation?.external_place_id ?? "Pilih location untuk melihat external place id."}</span>
              </div>
              <div className="button-row">
                <button type="button" className="primary-action" disabled={isActionRunning || !selectedLocationId} onClick={() => runAction("Run Fetch", () => postJson("/api/fetch-jobs", { location_id: requireSelectedLocation(), source: settings?.review_source_mode, target_review_count: targetReviewCount, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                  <Zap aria-hidden="true" size={15} /> Run Fetch
                </button>
                <button type="button" disabled={isActionRunning || !selectedLocationId} onClick={() => runAction("Dry Run Fetch", () => postJson("/api/fetch-jobs", { location_id: requireSelectedLocation(), source: settings?.review_source_mode, target_review_count: targetReviewCount, dry_run: true, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                  <Play aria-hidden="true" size={15} /> Dry Run
                </button>
              </div>
            </div>
          </article>

          <article className="panel page-panel">
            <SectionHeader
              kicker="Batch Operation"
              title={`${formatNumber(activeLocations.length)} active locations`}
              helper="Gunakan dry-run all untuk validasi cepat sebelum scraping beneran."
            />
            <div className="batch-card">
              <DatabaseZap aria-hidden="true" size={22} />
              <div>
                <strong>All active locations</strong>
                <p>Backend akan proses semua cabang aktif memakai source mode saat ini.</p>
              </div>
            </div>
            <div className="button-row module-actions">
              <button type="button" className="primary-action" disabled={isActionRunning || activeLocations.length === 0} onClick={() => runAction("Fetch All Active", () => postJson("/api/fetch-jobs/all-active", { dry_run: false, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                Fetch all active
              </button>
              <button type="button" disabled={isActionRunning || activeLocations.length === 0} onClick={() => runAction("Dry Run All Active", () => postJson("/api/fetch-jobs/all-active", { dry_run: true, date_preset: datePreset === "all" ? undefined : datePreset }))}>
                Dry run all
              </button>
            </div>
          </article>

          <article className="panel page-panel panel-wide">
            <SectionHeader
              kicker="Fetch Logs"
              title="Riwayat crawler"
              helper={latestLog ? `Latest: ${latestLog.location} · ${formatDate(latestLog.started_at)}` : "Belum ada log fetch."}
            />
            <DataTable
              title="Data fetch log"
              description="Search, filter status, dan pagination riwayat crawler."
              data={filteredLogs}
              columns={logColumns}
              getRowKey={(log) => log.id}
              isLoading={isLoading}
              emptyTitle="Belum ada fetch log"
              emptyDetail="Jalankan dry-run atau fetch untuk mulai mencatat aktivitas."
              searchPlaceholder="Cari lokasi, source, atau status..."
              pageSize={10}
              filters={
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">All status</option>
                  {logStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
                </select>
              }
            />
          </article>
        </section>
      )}
    </AppShell>
  );
}
