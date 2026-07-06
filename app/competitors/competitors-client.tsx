"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, DatabaseZap, MapPin, Pencil, Plus, RefreshCcw, Swords, Trash2, X } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, SectionHeader } from "../components/ui";
import { deleteJson, fetchJson, patchJson, postJson } from "../lib/api";
import { formatNumber } from "../lib/format";
import type { ActionMessage } from "../lib/types";

interface Competitor {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  external_place_id: string;
  google_maps_url: string | null;
  google_reviews_url: string | null;
  target_review_count: number;
  is_active: boolean;
}

interface CompetitorFormState {
  name: string;
  city: string;
  address: string;
  latitude: string;
  longitude: string;
  source: string;
  external_place_id: string;
  google_maps_url: string;
  google_reviews_url: string;
  target_review_count: number;
  is_active: boolean;
}

const initialCompetitorForm: CompetitorFormState = {
  name: "",
  city: "",
  address: "",
  latitude: "",
  longitude: "",
  source: "selenium",
  external_place_id: "",
  google_maps_url: "",
  google_reviews_url: "",
  target_review_count: 100,
  is_active: true,
};

type CoordinateStatus = "valid" | "missing" | "invalid" | "outside";

function coordinateStatus(comp: Pick<Competitor, "latitude" | "longitude">): CoordinateStatus {
  if (comp.latitude === null || comp.longitude === null) return "missing";
  const latitude = Number(comp.latitude);
  const longitude = Number(comp.longitude);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return "invalid";
  if (latitude < -11 || latitude > 6 || longitude < 95 || longitude > 141) return "outside";
  return "valid";
}

function coordinateStatusLabel(status: CoordinateStatus) {
  if (status === "valid") return "Valid";
  if (status === "missing") return "Koordinat kosong";
  if (status === "outside") return "Di luar Indonesia";
  return "Tidak valid";
}

function coordinateBadgeTone(status: CoordinateStatus) {
  if (status === "valid") return "positive";
  if (status === "missing") return "warning";
  return "critical";
}

function CompetitorMetric({
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

export default function CompetitorsClient() {
  const [isMounted, setIsMounted] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [competitorForm, setCompetitorForm] = useState<CompetitorFormState>(initialCompetitorForm);
  const [editingCompetitorId, setEditingCompetitorId] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [mapStatusFilter, setMapStatusFilter] = useState<CoordinateStatus | "all">("all");

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      const response = await fetchJson<{ items: Competitor[]; total: number }>("/api/competitors");
      setCompetitors(response.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setCompetitors([]);
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
      resetCompetitorForm();
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

  function updateCompetitorField<K extends keyof CompetitorFormState>(field: K, value: CompetitorFormState[K]) {
    setCompetitorForm((current) => ({ ...current, [field]: value }));
  }

  function competitorToForm(comp: Competitor): CompetitorFormState {
    return {
      name: comp.name,
      city: comp.city ?? "",
      address: comp.address ?? "",
      latitude: comp.latitude?.toString() ?? "",
      longitude: comp.longitude?.toString() ?? "",
      source: comp.source || "selenium",
      external_place_id: comp.external_place_id,
      google_maps_url: comp.google_maps_url ?? "",
      google_reviews_url: comp.google_reviews_url ?? "",
      target_review_count: comp.target_review_count,
      is_active: comp.is_active,
    };
  }

  function compactCompetitorPayload() {
    const latitude = competitorForm.latitude.trim() ? Number(competitorForm.latitude) : null;
    const longitude = competitorForm.longitude.trim() ? Number(competitorForm.longitude) : null;
    if (!competitorForm.name.trim()) throw new Error("Nama Kompetitor wajib diisi.");
    if (!competitorForm.external_place_id.trim()) throw new Error("External place ID wajib diisi.");
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) throw new Error("Latitude/longitude harus angka valid.");

    return {
      name: competitorForm.name.trim(),
      city: competitorForm.city.trim() || null,
      address: competitorForm.address.trim() || null,
      latitude,
      longitude,
      source: competitorForm.source.trim() || "selenium",
      external_place_id: competitorForm.external_place_id.trim(),
      google_maps_url: competitorForm.google_maps_url.trim() || null,
      google_reviews_url: competitorForm.google_reviews_url.trim() || null,
      target_review_count: competitorForm.target_review_count,
      is_active: competitorForm.is_active,
    };
  }

  function editCompetitor(comp: Competitor) {
    setEditingCompetitorId(comp.id);
    setCompetitorForm(competitorToForm(comp));
    setIsEditorOpen(true);
  }

  function startCreateCompetitor() {
    setEditingCompetitorId(null);
    setCompetitorForm(initialCompetitorForm);
    setIsEditorOpen(true);
  }

  function resetCompetitorForm() {
    setEditingCompetitorId(null);
    setCompetitorForm(initialCompetitorForm);
    setIsEditorOpen(false);
  }

  const filteredCompetitors = useMemo(() => {
    return competitors.filter((comp) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && comp.is_active) ||
        (statusFilter === "inactive" && !comp.is_active);
      const matchesSource = sourceFilter === "all" || comp.source === sourceFilter;
      const matchesMapStatus = mapStatusFilter === "all" || coordinateStatus(comp) === mapStatusFilter;
      return matchesStatus && matchesSource && matchesMapStatus;
    });
  }, [competitors, mapStatusFilter, sourceFilter, statusFilter]);

  const competitorSources = useMemo(() => {
    return Array.from(new Set(competitors.map((comp) => comp.source))).sort();
  }, [competitors]);

  const activeCompetitors = competitors.filter((comp) => comp.is_active).length;
  const missingCoordinates = competitors.filter((comp) => coordinateStatus(comp) !== "valid").length;
  const sourceCount = competitorSources.length;
  const avgTargetReviews = competitors.length
    ? Math.round(competitors.reduce((total, comp) => total + comp.target_review_count, 0) / competitors.length)
    : 0;

  const competitorColumns: Array<DataTableColumn<Competitor>> = [
    {
      id: "name",
      header: "Nama Kompetitor",
      accessor: (comp) => `${comp.name} ${comp.city ?? ""} ${comp.source}`,
      render: (comp) => (
        <div className="table-primary-cell">
          <strong><MapPin aria-hidden="true" size={13} /> {comp.name}</strong>
          <span>{comp.city ?? "Tanpa kota"} · {comp.source}</span>
        </div>
      ),
      width: "20%",
    },
    {
      id: "source",
      header: "Sumber",
      accessor: (comp) => comp.source,
      render: (comp) => <Badge tone="info">{comp.source}</Badge>,
    },
    {
      id: "map",
      header: "Peta",
      render: (comp) => {
        const status = coordinateStatus(comp);
        return <Badge tone={coordinateBadgeTone(status)}>{coordinateStatusLabel(status)}</Badge>;
      },
    },
    {
      id: "status",
      header: "Status",
      render: (comp) => <Badge tone={comp.is_active ? "positive" : "neutral"}>{comp.is_active ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      id: "place_id",
      header: "Place ID",
      accessor: (comp) => comp.external_place_id,
      render: (comp) => <code className="table-code-cell">{comp.external_place_id}</code>,
    },
    {
      id: "target",
      header: "Target Reviews",
      align: "right",
      accessor: (comp) => comp.target_review_count,
    },
    {
      id: "actions",
      header: "Aksi",
      align: "right",
      width: "116px",
      render: (comp) => (
        <div className="table-actions">
          <button type="button" onClick={() => editCompetitor(comp)} disabled={isActionRunning} aria-label="Edit kompetitor"><Pencil aria-hidden="true" size={14} /></button>
          <button type="button" onClick={() => runAction(comp.is_active ? "Nonaktifkan Kompetitor" : "Aktifkan Kompetitor", () => postJson(`/api/competitors/${comp.id}/toggle-active`))} disabled={isActionRunning} aria-label={comp.is_active ? "Nonaktifkan kompetitor" : "Aktifkan kompetitor"}><RefreshCcw aria-hidden="true" size={14} /></button>
          <button
            type="button"
            className="danger-action"
            onClick={() => {
              if (window.confirm(`Hapus ${comp.name}? Data kompetitor akan dihapus dari registry.`)) {
                void runAction("Hapus Kompetitor", () => deleteJson(`/api/competitors/${comp.id}`));
              }
            }}
            disabled={isActionRunning}
            aria-label="Hapus kompetitor"
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <header className="page-header dashboard-hero-header">
        <div>
          <p className="kicker">Competitors</p>
          <h1>Registry Kompetitor Rumah Sakit</h1>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={!isMounted || isActionRunning || isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Muat ulang
          </button>
          <button type="button" className="ghost-action primary-location-action" onClick={startCreateCompetitor} disabled={!isMounted || isActionRunning}>
            <Plus aria-hidden="true" size={15} /> Kompetitor baru
          </button>
        </div>
      </header>

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      {!isMounted ? (
        <section className="panel page-panel"><EmptyState title="Menyiapkan halaman" detail="Menunggu client..." /></section>
      ) : (
        <section className="locations-page-stack">
          <section className="dashboard-kpi-strip location-summary-strip">
            <CompetitorMetric
              label="Total Kompetitor"
              value={formatNumber(competitors.length)}
              icon={<Building2 aria-hidden="true" size={16} />}
            />
            <CompetitorMetric
              label="Kompetitor Aktif"
              value={formatNumber(activeCompetitors)}
              tone="positive"
              icon={<CheckCircle2 aria-hidden="true" size={16} />}
            />
            <CompetitorMetric
              label="Koordinat Perlu Dicek"
              value={formatNumber(missingCoordinates)}
              tone="warning"
              icon={<MapPin aria-hidden="true" size={16} />}
            />
            <CompetitorMetric
              label="Rata-rata Target Review"
              value={formatNumber(avgTargetReviews)}
              tone="danger"
              icon={<Swords aria-hidden="true" size={16} />}
            />
            <CompetitorMetric
              label="Sumber Data"
              value={formatNumber(sourceCount)}
              tone="info"
              icon={<DatabaseZap aria-hidden="true" size={16} />}
            />
          </section>

          {isEditorOpen ? (
            <div className="location-modal-backdrop" role="presentation">
              <article className="location-modal panel page-panel" role="dialog" aria-modal="true" aria-labelledby="competitor-modal-title">
                <div className="location-modal-header">
                  <SectionHeader
                    kicker={editingCompetitorId ? "Edit Competitor" : "Create Competitor"}
                    title={editingCompetitorId ? "Update data kompetitor" : "Tambah kompetitor baru"}
                    helper="Dapatkan Google Place ID melalui Map Resolver di bawah."
                  />
                  <button type="button" className="location-modal-close" onClick={resetCompetitorForm} disabled={isActionRunning} aria-label="Tutup form">
                    <X aria-hidden="true" size={18} />
                  </button>
                </div>
                <form
                  className="location-editor clean-form location-modal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runAction(editingCompetitorId ? "Update Competitor" : "Create Competitor", () => {
                      const payload = compactCompetitorPayload();
                      return editingCompetitorId
                        ? patchJson(`/api/competitors/${editingCompetitorId}`, payload)
                        : postJson("/api/competitors", payload);
                    });
                  }}
                >
                  <div className="form-grid">
                    <label className="span-2"><span>Nama Kompetitor</span><input value={competitorForm.name} onChange={(event) => updateCompetitorField("name", event.target.value)} placeholder="RS Mitra Keluarga Bekasi" required /></label>
                    <label><span>City</span><input value={competitorForm.city} onChange={(event) => updateCompetitorField("city", event.target.value)} placeholder="Bekasi" /></label>
                    <label><span>Source</span><select value={competitorForm.source} onChange={(event) => updateCompetitorField("source", event.target.value)}><option value="selenium">selenium</option><option value="google_places">google_places</option><option value="mock">mock</option></select></label>
                    <label className="span-2"><span>External Place ID</span><input value={competitorForm.external_place_id} onChange={(event) => updateCompetitorField("external_place_id", event.target.value)} placeholder="Google Maps place/data ID" required /></label>
                    <label><span>Latitude</span><input value={competitorForm.latitude} onChange={(event) => updateCompetitorField("latitude", event.target.value)} placeholder="-6.241657" /></label>
                    <label><span>Longitude</span><input value={competitorForm.longitude} onChange={(event) => updateCompetitorField("longitude", event.target.value)} placeholder="106.994774" /></label>
                    <label className="span-2"><span>Address</span><input value={competitorForm.address} onChange={(event) => updateCompetitorField("address", event.target.value)} placeholder="Alamat cabang kompetitor" /></label>
                    <label className="span-2"><span>Google Maps URL</span><input value={competitorForm.google_maps_url} onChange={(event) => updateCompetitorField("google_maps_url", event.target.value)} placeholder="https://maps.google.com/..." /></label>
                    <label><span>Target Reviews</span><input type="number" min={1} max={300} value={competitorForm.target_review_count} onChange={(event) => updateCompetitorField("target_review_count", Number(event.target.value))} /></label>
                    <label className="toggle-field"><input type="checkbox" checked={competitorForm.is_active} onChange={(event) => updateCompetitorField("is_active", event.target.checked)} /><span>Active tracking</span></label>
                  </div>
                  <div className="button-row">
                    <button type="submit" className="primary-action" disabled={isActionRunning}>
                      <CheckCircle2 aria-hidden="true" size={15} /> {editingCompetitorId ? "Update Competitor" : "Create Competitor"}
                    </button>
                    <button type="button" onClick={resetCompetitorForm} disabled={isActionRunning}>Batal</button>
                  </div>
                </form>
              </article>
            </div>
          ) : null}

          <article className="panel page-panel panel-wide location-registry-panel">
            <SectionHeader
              kicker="Registry Kompetitor"
              title="Registry kompetitor"
            />
            <DataTable
              title="Data Kompetitor"
              data={filteredCompetitors}
              columns={competitorColumns}
              getRowKey={(comp) => comp.id}
              isLoading={isLoading}
              emptyTitle="Belum ada kompetitor"
              emptyDetail="Tambah kompetitor pertama Anda untuk mulai pelacakan."
              searchPlaceholder="Cari kompetitor..."
              pageSize={8}
              searchableText={(comp) => [
                comp.name,
                comp.city,
                comp.source,
                comp.external_place_id,
                comp.address,
              ].filter(Boolean).join(" ")}
              filters={
                <>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">Semua status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                  <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                    <option value="all">Semua sumber</option>
                    {competitorSources.map((source) => <option value={source} key={source}>{source}</option>)}
                  </select>
                  <select value={mapStatusFilter} onChange={(event) => setMapStatusFilter(event.target.value as CoordinateStatus | "all")}>
                    <option value="all">Semua peta</option>
                    <option value="valid">Koordinat valid</option>
                    <option value="missing">Koordinat kosong</option>
                    <option value="invalid">Koordinat tidak valid</option>
                    <option value="outside">Di luar Indonesia</option>
                  </select>
                </>
              }
            />
          </article>
        </section>
      )}
    </AppShell>
  );
}