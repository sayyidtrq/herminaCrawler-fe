"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, CheckCircle2, DatabaseZap, MapPin, Pencil, Plus, Power, RefreshCcw, Trash2, X } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, SectionHeader } from "../components/ui";
import { deleteJson, fetchJson, patchJson, postJson } from "../lib/api";
import { formatNumber } from "../lib/format";
import type { ActionMessage, Location, LocationFormState, Review } from "../lib/types";

const initialLocationForm: LocationFormState = {
  hospital_name: "Hermina",
  branch_name: "",
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

type BranchScore = {
  id: number;
  reviews: number;
  avgRating: number | null;
  risk: "Stable" | "Watch" | "Critical";
};

type CoordinateStatus = "valid" | "missing" | "invalid" | "outside";

function coordinateStatus(location: Pick<Location, "latitude" | "longitude">): CoordinateStatus {
  if (location.latitude === null || location.longitude === null) return "missing";
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
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

function riskLabel(risk: BranchScore["risk"]) {
  if (risk === "Critical") return "Kritis";
  if (risk === "Watch") return "Perlu dipantau";
  return "Stabil";
}

function LocationMetric({
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

export default function LocationsClient() {
  const searchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [locationForm, setLocationForm] = useState<LocationFormState>(initialLocationForm);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "all");
  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") ?? "all");
  const [locationIdFilter, setLocationIdFilter] = useState<number | "">(Number(searchParams.get("location_id")) || "");
  const [mapStatusFilter, setMapStatusFilter] = useState<CoordinateStatus | "all">("all");

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      const [locationPayload, reviewPayload] = await Promise.all([
        fetchJson<{ items: Location[]; total: number }>("/api/locations"),
        fetchJson<{ items: Review[]; total: number }>("/api/reviews?page_size=200&latest_first=true"),
      ]);
      setLocations(locationPayload.items);
      setReviews(reviewPayload.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setLocations([]);
      setReviews([]);
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
      resetLocationForm();
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

  function updateLocationField<K extends keyof LocationFormState>(field: K, value: LocationFormState[K]) {
    setLocationForm((current) => ({ ...current, [field]: value }));
  }

  function locationToForm(location: Location): LocationFormState {
    return {
      hospital_name: location.hospital_name || "Hermina",
      branch_name: location.branch_name,
      city: location.city ?? "",
      address: location.address ?? "",
      latitude: location.latitude?.toString() ?? "",
      longitude: location.longitude?.toString() ?? "",
      source: location.source || "selenium",
      external_place_id: location.external_place_id,
      google_maps_url: location.google_maps_url ?? "",
      google_reviews_url: location.google_reviews_url ?? "",
      target_review_count: location.target_review_count,
      is_active: location.is_active,
    };
  }

  function compactLocationPayload() {
    const latitude = locationForm.latitude.trim() ? Number(locationForm.latitude) : null;
    const longitude = locationForm.longitude.trim() ? Number(locationForm.longitude) : null;
    if (!locationForm.branch_name.trim()) throw new Error("Branch name wajib diisi.");
    if (!locationForm.external_place_id.trim()) throw new Error("External place ID wajib diisi.");
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) throw new Error("Latitude/longitude harus angka valid.");

    return {
      hospital_name: locationForm.hospital_name.trim() || "Hermina",
      branch_name: locationForm.branch_name.trim(),
      city: locationForm.city.trim() || null,
      address: locationForm.address.trim() || null,
      latitude,
      longitude,
      source: locationForm.source.trim() || "selenium",
      external_place_id: locationForm.external_place_id.trim(),
      google_maps_url: locationForm.google_maps_url.trim() || null,
      google_reviews_url: locationForm.google_reviews_url.trim() || null,
      target_review_count: locationForm.target_review_count,
      is_active: locationForm.is_active,
    };
  }

  function editLocation(location: Location) {
    setEditingLocationId(location.id);
    setLocationForm(locationToForm(location));
    setIsEditorOpen(true);
  }

  function startCreateLocation() {
    setEditingLocationId(null);
    setLocationForm(initialLocationForm);
    setIsEditorOpen(true);
  }

  function resetLocationForm() {
    setEditingLocationId(null);
    setLocationForm(initialLocationForm);
    setIsEditorOpen(false);
  }

  const locationSources = useMemo(() => {
    return Array.from(new Set(locations.map((location) => location.source))).sort();
  }, [locations]);

  const filteredLocations = useMemo(() => {
    return locations.filter((location) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && location.is_active) ||
        (statusFilter === "inactive" && !location.is_active);
      const matchesSource = sourceFilter === "all" || location.source === sourceFilter;
      const matchesLocation = !locationIdFilter || location.id === locationIdFilter;
      const matchesMapStatus = mapStatusFilter === "all" || coordinateStatus(location) === mapStatusFilter;
      return matchesStatus && matchesSource && matchesLocation && matchesMapStatus;
    });
  }, [locationIdFilter, locations, mapStatusFilter, sourceFilter, statusFilter]);

  const scores = useMemo<Record<number, BranchScore>>(() => {
    return Object.fromEntries(
      locations.map((location) => {
        const locationReviews = reviews.filter(
          (review) => review.location_id === location.id || review.location === location.branch_name,
        );
        const ratings = locationReviews
          .map((review) => review.rating)
          .filter((rating): rating is number => typeof rating === "number");
        const avgRating = ratings.length
          ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
          : null;
        const critical = locationReviews.filter((review) =>
          ["high", "critical"].includes(review.urgency ?? "") || review.is_patient_safety_issue,
        ).length;
        const negative = locationReviews.filter((review) => review.sentiment === "negative").length;
        const risk = critical > 0 ? "Critical" : negative > 3 ? "Watch" : "Stable";
        return [location.id, { id: location.id, reviews: locationReviews.length, avgRating, risk }];
      }),
    );
  }, [locations, reviews]);

  const activeLocations = locations.filter((location) => location.is_active).length;
  const missingCoordinates = locations.filter((location) => coordinateStatus(location) !== "valid").length;
  const criticalBranches = locations.filter((location) => scores[location.id]?.risk === "Critical").length;
  const sourceCount = locationSources.length;
  const locationFormCoordinateStatus = coordinateStatus({
    latitude: locationForm.latitude.trim() ? Number(locationForm.latitude) : null,
    longitude: locationForm.longitude.trim() ? Number(locationForm.longitude) : null,
  });

  const locationColumns: Array<DataTableColumn<Location>> = [
    {
      id: "branch",
      header: "Cabang",
      accessor: (location) => `${location.branch_name} ${location.city ?? ""} ${location.source} ${location.external_place_id}`,
      render: (location) => (
        <div className="table-primary-cell">
          <strong><MapPin aria-hidden="true" size={13} /> {location.branch_name}</strong>
          <span>{location.city ?? "Tanpa kota"} · {location.source}</span>
        </div>
      ),
      width: "20%",
    },
    {
      id: "city",
      header: "Kota",
      accessor: (location) => location.city ?? "",
      render: (location) => location.city ?? "Tanpa kota",
    },
    {
      id: "source",
      header: "Sumber",
      accessor: (location) => location.source,
      render: (location) => <Badge tone="info">{location.source}</Badge>,
    },
    {
      id: "map",
      header: "Peta",
      render: (location) => {
        const status = coordinateStatus(location);
        return <Badge tone={coordinateBadgeTone(status)}>{coordinateStatusLabel(status)}</Badge>;
      },
    },
    {
      id: "status",
      header: "Status",
      render: (location) => <Badge tone={location.is_active ? "positive" : "neutral"}>{location.is_active ? "Aktif" : "Nonaktif"}</Badge>,
    },
    {
      id: "reviews",
      header: "Review",
      align: "right",
      accessor: (location) => scores[location.id]?.reviews ?? 0,
      render: (location) => formatNumber(scores[location.id]?.reviews ?? 0),
    },
    {
      id: "rating",
      header: "Rating",
      align: "right",
      render: (location) => scores[location.id]?.avgRating ? scores[location.id].avgRating?.toFixed(1) : "—",
    },
    {
      id: "risk",
      header: "Risiko",
      render: (location) => {
        const risk = scores[location.id]?.risk ?? "Stable";
        return <Badge tone={risk === "Critical" ? "critical" : risk === "Watch" ? "warning" : "positive"}>{riskLabel(risk)}</Badge>;
      },
    },
    {
      id: "target",
      header: "Target",
      align: "right",
      accessor: (location) => location.target_review_count,
    },
    {
      id: "actions",
      header: "Aksi",
      align: "right",
      width: "116px",
      render: (location) => (
        <div className="table-actions">
          <button type="button" onClick={() => editLocation(location)} disabled={isActionRunning} aria-label="Edit cabang"><Pencil aria-hidden="true" size={14} /></button>
          <button type="button" onClick={() => runAction(location.is_active ? "Nonaktifkan Cabang" : "Aktifkan Cabang", () => postJson(`/api/locations/${location.id}/toggle-active`))} disabled={isActionRunning} aria-label={location.is_active ? "Nonaktifkan cabang" : "Aktifkan cabang"}><Power aria-hidden="true" size={14} /></button>
          <button
            type="button"
            className="danger-action"
            onClick={() => {
              if (window.confirm(`Hapus ${location.branch_name}? Data cabang akan dihapus dari registry.`)) {
                void runAction("Hapus Cabang", () => deleteJson(`/api/locations/${location.id}`));
              }
            }}
            disabled={isActionRunning}
            aria-label="Hapus cabang"
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
          <p className="kicker">Cabang</p>
          <h1>Registry Cabang Hermina</h1>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={!isMounted || isActionRunning || isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Muat ulang
          </button>
          <button type="button" className="ghost-action primary-location-action" onClick={startCreateLocation} disabled={!isMounted || isActionRunning}>
            <Plus aria-hidden="true" size={15} /> Tambah cabang
          </button>
        </div>
      </header>

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      {!isMounted ? (
        <section className="panel page-panel"><EmptyState title="Menyiapkan halaman" detail="Tampilan registry sedang dimuat." /></section>
      ) : (
        <section className="locations-page-stack">
          <section className="dashboard-kpi-strip location-summary-strip">
            <LocationMetric
              label="Total Cabang"
              value={formatNumber(locations.length)}
              icon={<Building2 aria-hidden="true" size={16} />}
            />
            <LocationMetric
              label="Cabang Aktif"
              value={formatNumber(activeLocations)}
              tone="positive"
              icon={<CheckCircle2 aria-hidden="true" size={16} />}
            />
            <LocationMetric
              label="Koordinat Perlu Dicek"
              value={formatNumber(missingCoordinates)}
              tone="warning"
              icon={<MapPin aria-hidden="true" size={16} />}
            />
            <LocationMetric
              label="Cabang Kritis"
              value={formatNumber(criticalBranches)}
              tone="danger"
              icon={<AlertTriangle aria-hidden="true" size={16} />}
            />
            <LocationMetric
              label="Sumber Review"
              value={formatNumber(sourceCount)}
              tone="info"
              icon={<DatabaseZap aria-hidden="true" size={16} />}
            />
          </section>

          {isEditorOpen ? (
            <div className="location-modal-backdrop" role="presentation">
              <article className="location-modal panel page-panel" role="dialog" aria-modal="true" aria-labelledby="location-modal-title">
                <div className="location-modal-header">
                  <SectionHeader
                    kicker={editingLocationId ? "Edit Cabang" : "Tambah Cabang"}
                    title={editingLocationId ? "Update data cabang" : "Tambah cabang baru"}
                  />
                  <button type="button" className="location-modal-close" onClick={resetLocationForm} disabled={isActionRunning} aria-label="Tutup form">
                    <X aria-hidden="true" size={18} />
                  </button>
                </div>
                <form
                  className="location-editor clean-form location-modal-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runAction(editingLocationId ? "Update Cabang" : "Tambah Cabang", () => {
                      const payload = compactLocationPayload();
                      return editingLocationId
                        ? patchJson(`/api/locations/${editingLocationId}`, payload)
                        : postJson("/api/locations", payload);
                    });
                  }}
                >
                  <div className="location-form-section">
                    <div>
                      <strong>Informasi cabang</strong>
                    </div>
                    <div className="form-grid">
                      <label><span>Rumah sakit</span><input value={locationForm.hospital_name} onChange={(event) => updateLocationField("hospital_name", event.target.value)} /></label>
                      <label><span>Nama cabang</span><input value={locationForm.branch_name} onChange={(event) => updateLocationField("branch_name", event.target.value)} placeholder="Hermina Bekasi" required /></label>
                      <label><span>Kota</span><input value={locationForm.city} onChange={(event) => updateLocationField("city", event.target.value)} placeholder="Bekasi" /></label>
                      <label className="toggle-field"><input type="checkbox" checked={locationForm.is_active} onChange={(event) => updateLocationField("is_active", event.target.checked)} /><span>Cabang aktif</span></label>
                      <label className="span-2"><span>Alamat</span><input value={locationForm.address} onChange={(event) => updateLocationField("address", event.target.value)} placeholder="Alamat cabang" /></label>
                    </div>
                  </div>

                  <div className="location-form-section">
                    <div>
                      <strong>Koordinat peta</strong>
                    </div>
                    <div className="form-grid">
                      <label><span>Latitude</span><input value={locationForm.latitude} onChange={(event) => updateLocationField("latitude", event.target.value)} placeholder="-6.2416574" /></label>
                      <label><span>Longitude</span><input value={locationForm.longitude} onChange={(event) => updateLocationField("longitude", event.target.value)} placeholder="106.994774" /></label>
                      <div className={`coordinate-preview coordinate-${locationFormCoordinateStatus}`}>
                        <MapPin aria-hidden="true" size={18} />
                        <div>
                          <strong>{coordinateStatusLabel(locationFormCoordinateStatus)}</strong>
                          <span>Batas Indonesia: latitude -11 sampai 6, longitude 95 sampai 141.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="location-form-section">
                    <div>
                      <strong>Sumber review</strong>
                    </div>
                    <div className="form-grid">
                      <label><span>Sumber</span><select value={locationForm.source} onChange={(event) => updateLocationField("source", event.target.value)}><option value="selenium">selenium</option><option value="selenium_google_maps">selenium_google_maps</option><option value="google_places">google_places</option><option value="mock">mock</option></select></label>
                      <label><span>Target review</span><input type="number" min={1} max={300} value={locationForm.target_review_count} onChange={(event) => updateLocationField("target_review_count", Number(event.target.value))} /></label>
                      <label className="span-2"><span>External Place ID</span><input value={locationForm.external_place_id} onChange={(event) => updateLocationField("external_place_id", event.target.value)} placeholder="Google Maps place/data ID" required /></label>
                      <label className="span-2"><span>Google Maps URL</span><input value={locationForm.google_maps_url} onChange={(event) => updateLocationField("google_maps_url", event.target.value)} placeholder="https://maps.google.com/..." /></label>
                      <label className="span-2"><span>Google Reviews URL</span><input value={locationForm.google_reviews_url} onChange={(event) => updateLocationField("google_reviews_url", event.target.value)} placeholder="https://www.google.com/search?..." /></label>
                    </div>
                  </div>

                  <div className="button-row">
                    <button type="submit" className="primary-action" disabled={isActionRunning}>
                      <CheckCircle2 aria-hidden="true" size={15} /> {editingLocationId ? "Update cabang" : "Simpan cabang"}
                    </button>
                    <button type="button" onClick={resetLocationForm} disabled={isActionRunning}>Batal</button>
                  </div>
                </form>
              </article>
            </div>
          ) : null}

          <article className="panel page-panel panel-wide location-registry-panel">
            <SectionHeader
              kicker="Registry Cabang"
              title="Registry cabang"
            />
            <DataTable
              title="Data cabang"
              data={filteredLocations}
              columns={locationColumns}
              getRowKey={(location) => location.id}
              isLoading={isLoading}
              emptyTitle="Belum ada cabang"
              emptyDetail="Tambah cabang pertama untuk mulai fetch review."
              searchPlaceholder="Cari cabang..."
              pageSize={8}
              searchableText={(location) => [
                location.hospital_name,
                location.branch_name,
                location.city,
                location.source,
                location.external_place_id,
                location.address,
              ].filter(Boolean).join(" ")}
              filters={
                <>
                  <select value={locationIdFilter} onChange={(event) => setLocationIdFilter(Number(event.target.value) || "")}>
                    <option value="">Semua cabang</option>
                    {locations.map((location) => <option value={location.id} key={location.id}>{location.branch_name}</option>)}
                  </select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">Semua status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                  <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                    <option value="all">Semua sumber</option>
                    {locationSources.map((source) => <option value={source} key={source}>{source}</option>)}
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
