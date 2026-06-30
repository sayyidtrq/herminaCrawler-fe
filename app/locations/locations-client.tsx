"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MapPin, Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, PageHeader, SectionHeader } from "../components/ui";
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

export default function LocationsClient() {
  const [isMounted, setIsMounted] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [locationForm, setLocationForm] = useState<LocationFormState>(initialLocationForm);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetLocationForm() {
    setEditingLocationId(null);
    setLocationForm(initialLocationForm);
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
      return matchesStatus && matchesSource;
    });
  }, [locations, sourceFilter, statusFilter]);

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
      width: "28%",
    },
    {
      id: "status",
      header: "Status",
      render: (location) => <Badge tone={location.is_active ? "positive" : "neutral"}>{location.is_active ? "Active" : "Inactive"}</Badge>,
    },
    {
      id: "reviews",
      header: "Reviews",
      align: "right",
      accessor: (location) => scores[location.id]?.reviews ?? 0,
      render: (location) => `${formatNumber(scores[location.id]?.reviews ?? 0)} reviews`,
    },
    {
      id: "rating",
      header: "Avg",
      align: "right",
      render: (location) => scores[location.id]?.avgRating ? scores[location.id].avgRating?.toFixed(1) : "—",
    },
    {
      id: "risk",
      header: "Risk",
      render: (location) => {
        const risk = scores[location.id]?.risk ?? "Stable";
        return <Badge tone={risk === "Critical" ? "critical" : risk === "Watch" ? "warning" : "positive"}>{risk}</Badge>;
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
      header: "Actions",
      align: "right",
      render: (location) => (
        <div className="table-actions">
          <button type="button" onClick={() => editLocation(location)} disabled={isActionRunning} aria-label="Edit location"><Pencil aria-hidden="true" size={14} /></button>
          <button type="button" onClick={() => runAction("Toggle Location", () => postJson(`/api/locations/${location.id}/toggle-active`))} disabled={isActionRunning} aria-label="Toggle active"><RefreshCcw aria-hidden="true" size={14} /></button>
          <button type="button" className="danger-action" onClick={() => runAction("Delete Location", () => deleteJson(`/api/locations/${location.id}`))} disabled={isActionRunning} aria-label="Delete location"><Trash2 aria-hidden="true" size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Locations"
        title="Kelola cabang Hermina"
        helper="Tambah, update, activate/deactivate, dan hapus lokasi. Semua perubahan langsung ke backend real."
        action={
          <button type="button" className="ghost-action" onClick={resetLocationForm} disabled={!isMounted || isActionRunning}>
            <Plus aria-hidden="true" size={15} /> Lokasi baru
          </button>
        }
      />

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      {!isMounted ? (
        <section className="panel page-panel"><EmptyState title="Menyiapkan halaman" detail="Menunggu client siap untuk mencegah hydration mismatch dari extension browser." /></section>
      ) : (
        <section className="locations-page-stack">
          <article className="panel page-panel">
            <SectionHeader
              kicker={editingLocationId ? "Edit Location" : "Create Location"}
              title={editingLocationId ? "Update data cabang" : "Tambah cabang baru"}
              helper="Gunakan source selenium untuk scraping realtime Google Maps."
            />
            <form
              className="location-editor clean-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(editingLocationId ? "Update Location" : "Create Location", () => {
                  const payload = compactLocationPayload();
                  return editingLocationId
                    ? patchJson(`/api/locations/${editingLocationId}`, payload)
                    : postJson("/api/locations", payload);
                });
              }}
            >
              <div className="form-grid">
                <label><span>Hospital</span><input value={locationForm.hospital_name} onChange={(event) => updateLocationField("hospital_name", event.target.value)} /></label>
                <label><span>Branch</span><input value={locationForm.branch_name} onChange={(event) => updateLocationField("branch_name", event.target.value)} placeholder="Hermina Bekasi" required /></label>
                <label><span>City</span><input value={locationForm.city} onChange={(event) => updateLocationField("city", event.target.value)} placeholder="Bekasi" /></label>
                <label><span>Source</span><select value={locationForm.source} onChange={(event) => updateLocationField("source", event.target.value)}><option value="selenium">selenium</option><option value="selenium_google_maps">selenium_google_maps</option><option value="google_places">google_places</option><option value="mock">mock</option></select></label>
                <label className="span-2"><span>External Place ID</span><input value={locationForm.external_place_id} onChange={(event) => updateLocationField("external_place_id", event.target.value)} placeholder="Google Maps place/data ID" required /></label>
                <label><span>Latitude</span><input value={locationForm.latitude} onChange={(event) => updateLocationField("latitude", event.target.value)} placeholder="-6.2416574" /></label>
                <label><span>Longitude</span><input value={locationForm.longitude} onChange={(event) => updateLocationField("longitude", event.target.value)} placeholder="106.994774" /></label>
                <label className="span-2"><span>Address</span><input value={locationForm.address} onChange={(event) => updateLocationField("address", event.target.value)} placeholder="Alamat cabang" /></label>
                <label className="span-2"><span>Google Maps URL</span><input value={locationForm.google_maps_url} onChange={(event) => updateLocationField("google_maps_url", event.target.value)} placeholder="https://maps.google.com/..." /></label>
                <label><span>Target Reviews</span><input type="number" min={1} max={300} value={locationForm.target_review_count} onChange={(event) => updateLocationField("target_review_count", Number(event.target.value))} /></label>
                <label className="toggle-field"><input type="checkbox" checked={locationForm.is_active} onChange={(event) => updateLocationField("is_active", event.target.checked)} /><span>Active location</span></label>
              </div>
              <div className="button-row">
                <button type="submit" className="primary-action" disabled={isActionRunning}>
                  <CheckCircle2 aria-hidden="true" size={15} /> {editingLocationId ? "Update Location" : "Create Location"}
                </button>
                <button type="button" onClick={resetLocationForm} disabled={isActionRunning}>Reset</button>
              </div>
            </form>
          </article>

          <article className="panel page-panel panel-wide">
            <SectionHeader
              kicker="Location Registry"
              title={`${formatNumber(locations.length)} cabang terdaftar`}
              helper="Ranking sederhana dari review yang sedang termuat."
            />
            <DataTable
              title="Data lokasi"
              description="Search, filter, dan pagination location registry."
              data={filteredLocations}
              columns={locationColumns}
              getRowKey={(location) => location.id}
              isLoading={isLoading}
              emptyTitle="Belum ada location"
              emptyDetail="Tambah cabang pertama untuk mulai fetch review."
              searchPlaceholder="Cari cabang, kota, source, atau place id..."
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
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                    <option value="all">All source</option>
                    {locationSources.map((source) => <option value={source} key={source}>{source}</option>)}
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
