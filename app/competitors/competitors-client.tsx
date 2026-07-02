"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MapPin, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, PageHeader, SectionHeader } from "../components/ui";
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

export default function CompetitorsClient() {
  const [isMounted, setIsMounted] = useState(false);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [competitorForm, setCompetitorForm] = useState<CompetitorFormState>(initialCompetitorForm);
  const [editingCompetitorId, setEditingCompetitorId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetCompetitorForm() {
    setEditingCompetitorId(null);
    setCompetitorForm(initialCompetitorForm);
  }

  const filteredCompetitors = useMemo(() => {
    return competitors.filter((comp) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && comp.is_active) ||
        (statusFilter === "inactive" && !comp.is_active);
      return matchesStatus;
    });
  }, [competitors, statusFilter]);

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
      width: "35%",
    },
    {
      id: "status",
      header: "Status",
      render: (comp) => <Badge tone={comp.is_active ? "positive" : "neutral"}>{comp.is_active ? "Active" : "Inactive"}</Badge>,
    },
    {
      id: "place_id",
      header: "Place ID",
      accessor: (comp) => comp.external_place_id,
      render: (comp) => <code className="bg-slate-900/40 px-1 py-0.5 rounded font-mono text-[10px]">{comp.external_place_id}</code>,
    },
    {
      id: "target",
      header: "Target Reviews",
      align: "right",
      accessor: (comp) => comp.target_review_count,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      render: (comp) => (
        <div className="table-actions">
          <button type="button" onClick={() => editCompetitor(comp)} disabled={isActionRunning} aria-label="Edit competitor"><Pencil aria-hidden="true" size={14} /></button>
          <button type="button" onClick={() => runAction("Toggle Competitor", () => postJson(`/api/competitors/${comp.id}/toggle-active`))} disabled={isActionRunning} aria-label="Toggle active"><RefreshCcw aria-hidden="true" size={14} /></button>
          <button type="button" className="danger-action" onClick={() => runAction("Delete Competitor", () => deleteJson(`/api/competitors/${comp.id}`))} disabled={isActionRunning} aria-label="Delete competitor"><Trash2 aria-hidden="true" size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Competitors"
        title="Analisis Kompetitor Rumah Sakit"
        helper="Registry kompetitor terdekat. Tambahkan kompetitor Anda untuk memantau performa, rating, dan sentimen mereka."
        action={
          <button type="button" className="ghost-action" onClick={resetCompetitorForm} disabled={!isMounted || isActionRunning}>
            <Plus aria-hidden="true" size={15} /> Kompetitor baru
          </button>
        }
      />

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      {!isMounted ? (
        <section className="panel page-panel"><EmptyState title="Menyiapkan halaman" detail="Menunggu client..." /></section>
      ) : (
        <section className="locations-page-stack">
          <article className="panel page-panel">
            <SectionHeader
              kicker={editingCompetitorId ? "Edit Competitor" : "Create Competitor"}
              title={editingCompetitorId ? "Update data kompetitor" : "Tambah kompetitor baru"}
              helper="Dapatkan Google Place ID melalui Map Resolver di bawah."
            />
            <form
              className="location-editor clean-form"
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
                <button type="button" onClick={resetCompetitorForm} disabled={isActionRunning}>Reset</button>
              </div>
            </form>
          </article>

          <article className="panel page-panel panel-wide">
            <SectionHeader
              kicker="Competitors Tracking Registry"
              title={`${formatNumber(competitors.length)} kompetitor terdaftar`}
              helper="Daftar kompetitor yang dipantau oleh perusahaan Anda."
            />
            <DataTable
              title="Data Kompetitor"
              description="Search, filter, dan kelola kompetitor rumah sakit."
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
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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
