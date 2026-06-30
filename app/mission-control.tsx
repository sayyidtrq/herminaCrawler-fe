"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Building2,
  CheckCircle2,
  Command,
  DatabaseZap,
  Download,
  FileChartColumn,
  Pencil,
  Plus,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  MessageSquareText,
  Radar,
  RefreshCcw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wifi,
  Zap,
} from "lucide-react";

type Health = { status: string; app: string; env: string };
type PublicSettings = {
  review_source_mode: string;
  gemini_mode: string;
  selenium_max_target_reviews: number;
  analysis_batch_size: number;
  google_maps_api_key_configured: boolean;
  gemini_api_key_configured: boolean;
};
type Location = {
  id: number;
  hospital_name: string;
  branch_name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  external_place_id: string;
  google_maps_url: string | null;
  google_reviews_url: string | null;
  is_active: boolean;
  target_review_count: number;
};
type LocationFormState = {
  hospital_name: string;
  branch_name: string;
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
};
type DatabaseCheck = {
  status?: string;
  database?: string;
  host?: string;
  port?: number;
  detail?: string;
  [key: string]: unknown;
};
type Review = {
  id: number;
  location: string;
  location_id: number;
  reviewer_name: string;
  rating: number | null;
  review_text: string;
  review_time: string | null;
  sentiment: string | null;
  issue_category: string | null;
  urgency: string | null;
  recommended_action: string | null;
  is_patient_safety_issue: boolean;
  is_potential_viral: boolean;
};
type FetchLog = {
  id: number;
  location: string;
  source: string;
  status: string;
  total_fetched: number;
  total_inserted: number;
  total_duplicate: number;
  total_failed: number;
  started_at: string | null;
  finished_at: string | null;
};
type Overview = {
  total_locations: number;
  total_reviews: number;
  analyzed_reviews: number;
  pending_analysis: number;
  sentiments: Record<string, number>;
  top_issues: Array<Record<string, number | string | null>>;
  critical_issues: number;
  latest_fetch: string | null;
};
type ApiData = {
  health: Health;
  settings: PublicSettings;
  locations: { items: Location[]; total: number };
  reviews: { items: Review[]; total: number; page: number; page_size: number };
  overview: Overview;
  latestFetch: { item: FetchLog | null };
};
type ActionMessage = {
  type: "success" | "error" | "info";
  title: string;
  detail: string;
};
type BranchScore = {
  id: number;
  name: string;
  city: string;
  source: string;
  isActive: boolean;
  reviews: number;
  avgRating: number | null;
  negative: number;
  critical: number;
  coverage: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

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

const navItems: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: "Command", href: "#command", icon: Command },
  { label: "Dashboard", href: "#dashboard", icon: LayoutDashboard },
  { label: "Locations", href: "#locations", icon: Building2 },
  { label: "Fetch Jobs", href: "#fetch", icon: DatabaseZap },
  { label: "Reviews", href: "#reviews", icon: MessageSquareText },
  { label: "Analysis", href: "#analysis", icon: Bot },
  { label: "Insights", href: "#insights", icon: Sparkles },
  { label: "Reports", href: "#reports", icon: FileChartColumn },
  { label: "Settings", href: "#settings", icon: Settings },
];

const issueLabels: Record<string, string> = {
  doctor_service: "Layanan Dokter",
  nurse_service: "Layanan Perawat",
  administration: "Administrasi",
  waiting_time: "Waktu Tunggu",
  cleanliness: "Kebersihan",
  facility: "Fasilitas",
  parking: "Parkir",
  billing: "Billing",
  pharmacy: "Farmasi",
  emergency_room: "IGD",
  inpatient: "Rawat Inap",
  customer_service: "Customer Service",
  booking_system: "Sistem Booking",
  staff_communication: "Komunikasi Staff",
  security: "Keamanan",
  food: "Makanan",
  general_praise: "Pujian Umum",
  other: "Lainnya",
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      detail = payload?.error?.message ?? payload?.detail ?? detail;
    } catch {
      // Keep HTTP status text when backend does not return JSON.
    }
    throw new Error(String(detail));
  }
  const raw = await response.text();
  return (raw ? JSON.parse(raw) : {}) as T;
}

async function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function deleteJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: "DELETE" });
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Belum ada";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sentimentLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    positive: "Positif",
    neutral: "Netral",
    negative: "Negatif",
    mixed: "Campuran",
    unknown: "Unknown",
  };
  return labels[value ?? "unknown"] ?? value ?? "Unknown";
}

function urgencyLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
    unknown: "Unknown",
  };
  return labels[value ?? "unknown"] ?? value ?? "Unknown";
}

function issueLabel(value: string | null | undefined) {
  if (!value) return "Belum dianalisis";
  return issueLabels[value] ?? value;
}

function normalizeIssue(row: Record<string, number | string | null>) {
  const label = String(row.issue_category ?? row.category ?? "other");
  const count = Number(row.count ?? 0);
  return { label: issueLabel(label), count };
}

function toneForSentiment(value: string | null | undefined) {
  if (value === "positive") return "positive";
  if (value === "negative") return "danger";
  if (value === "mixed") return "warning";
  return "neutral";
}

function toneForUrgency(value: string | null | undefined) {
  if (value === "critical") return "critical";
  if (value === "high") return "danger";
  if (value === "medium") return "warning";
  return "neutral";
}

function riskLabel(critical: number, negative: number) {
  if (critical > 0) return "Critical";
  if (negative >= 3) return "High";
  if (negative > 0) return "Watch";
  return "Stable";
}

function scoreWidth(value: number, max: number) {
  if (max <= 0) return "4%";
  return `${Math.max((value / max) * 100, 4)}%`;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "positive" | "danger" | "warning" | "critical" | "info" | "neutral";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function StatTile({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  icon?: LucideIcon;
  tone?: "neutral" | "positive" | "warning" | "danger" | "info";
}) {
  return (
    <article className={`stat-tile stat-${tone}`}>
      <div className="stat-icon-row">
        <span>{label}</span>
        {Icon ? <Icon aria-hidden="true" size={17} strokeWidth={2.2} /> : null}
      </div>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function SectionHeader({
  kicker,
  title,
  helper,
  action,
}: {
  kicker: string;
  title: string;
  helper?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        {helper ? <span>{helper}</span> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}

function BarList({ rows }: { rows: Array<{ label: string; count: number; tone?: string }> }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-row-top">
            <span>{row.label}</span>
            <strong>{formatNumber(row.count)}</strong>
          </div>
          <div className="bar-track">
            <span className={`bar-fill ${row.tone ?? ""}`} style={{ width: scoreWidth(row.count, max) }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="skeleton-panel">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function MissionControl() {
  const [data, setData] = useState<ApiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [targetReviewCount, setTargetReviewCount] = useState(30);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [query, setQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [locationForm, setLocationForm] = useState<LocationFormState>(initialLocationForm);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [databaseCheck, setDatabaseCheck] = useState<DatabaseCheck | null>(null);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      const [health, settings, locations, reviews, overview, latestFetch] =
        await Promise.all([
          fetchJson<Health>("/api/health"),
          fetchJson<PublicSettings>("/api/settings"),
          fetchJson<ApiData["locations"]>("/api/locations"),
          fetchJson<ApiData["reviews"]>("/api/reviews?page_size=120&latest_first=true"),
          fetchJson<Overview>("/api/dashboard/overview"),
          fetchJson<ApiData["latestFetch"]>("/api/fetch-logs/latest"),
        ]);
      setData({ health, settings, locations, reviews, overview, latestFetch });
      setSelectedLocationId((current) => current ?? locations.items[0]?.id ?? null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Backend tidak merespons.";
      setError(message);
      setData(null);
    } finally {
      if (!options?.silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  async function runAction(title: string, action: () => Promise<unknown>) {
    setIsActionRunning(true);
    setActionMessage({
      type: "info",
      title,
      detail: "Request sedang diproses oleh backend real...",
    });
    try {
      const result = await action();
      const status = typeof result === "object" && result !== null && "status" in result
        ? (result as { status?: unknown }).status
        : undefined;
      if (status === "failed") throw new Error(JSON.stringify(result, null, 2));
      setActionMessage({ type: "success", title, detail: JSON.stringify(result, null, 2) });
      await loadData({ silent: true });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Action gagal.";
      setActionMessage({ type: "error", title: `${title} gagal`, detail: message });
    } finally {
      setIsActionRunning(false);
    }
  }

  function requireSelectedLocation() {
    if (!selectedLocationId) throw new Error("Pilih lokasi dulu sebelum menjalankan action.");
    return selectedLocationId;
  }

  function updateLocationField<K extends keyof LocationFormState>(
    field: K,
    value: LocationFormState[K],
  ) {
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
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error("Latitude/longitude harus angka valid.");
    }
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
    setSelectedLocationId(location.id);
    setLocationForm(locationToForm(location));
    document.getElementById("locations")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetLocationForm() {
    setEditingLocationId(null);
    setLocationForm(initialLocationForm);
  }

  const latestFetch = data?.latestFetch.item ?? null;
  const reviews = useMemo(() => data?.reviews.items ?? [], [data?.reviews.items]);
  const locations = useMemo(() => data?.locations.items ?? [], [data?.locations.items]);
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );
  const analyzedCoverage = data
    ? (data.overview.analyzed_reviews / Math.max(data.overview.total_reviews, 1)) * 100
    : 0;
  const negativeCount = data?.overview.sentiments.negative ?? 0;
  const positiveCount = data?.overview.sentiments.positive ?? 0;
  const operationalRisk = data
    ? Math.min(100, data.overview.critical_issues * 18 + negativeCount * 4)
    : 0;

  const sentimentRows = useMemo(() => {
    if (!data) return [];
    const sentiments = data.overview.sentiments ?? {};
    return [
      { label: "Positif", count: sentiments.positive ?? 0, tone: "positive" },
      { label: "Netral", count: sentiments.neutral ?? 0, tone: "info" },
      { label: "Negatif", count: sentiments.negative ?? 0, tone: "danger" },
      { label: "Campuran", count: sentiments.mixed ?? 0, tone: "warning" },
    ];
  }, [data]);

  const issueRows = useMemo(() => {
    if (!data) return [];
    return data.overview.top_issues.map(normalizeIssue);
  }, [data]);

  const branchScores = useMemo<BranchScore[]>(() => {
    return locations
      .map((location) => {
        const locationReviews = reviews.filter(
          (review) => review.location_id === location.id || review.location === location.branch_name,
        );
        const ratings = locationReviews
          .map((review) => review.rating)
          .filter((rating): rating is number => typeof rating === "number");
        const avgRating = ratings.length
          ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
          : null;
        const negative = locationReviews.filter((review) => review.sentiment === "negative").length;
        const critical = locationReviews.filter((review) =>
          ["high", "critical"].includes(review.urgency ?? ""),
        ).length;
        return {
          id: location.id,
          name: location.branch_name,
          city: location.city ?? "Tanpa kota",
          source: location.source,
          isActive: location.is_active,
          reviews: locationReviews.length,
          avgRating,
          negative,
          critical,
          coverage: Math.min(100, (locationReviews.length / Math.max(location.target_review_count, 1)) * 100),
        };
      })
      .sort((a, b) => b.critical - a.critical || b.negative - a.negative || b.reviews - a.reviews);
  }, [locations, reviews]);

  const filteredReviews = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesSentiment = sentimentFilter === "all" || review.sentiment === sentimentFilter;
      if (!matchesSentiment) return false;
      if (!loweredQuery) return true;
      const haystack = [
        review.location,
        review.reviewer_name,
        review.review_text,
        review.issue_category,
        review.urgency,
        review.recommended_action,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(loweredQuery);
    });
  }, [query, reviews, sentimentFilter]);

  const criticalReviews = useMemo(() => {
    return reviews.filter((review) => review.urgency === "critical" || review.is_patient_safety_issue);
  }, [reviews]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">H</div>
          <div>
            <p>Hermina</p>
            <strong>Review Intelligence</strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navigasi utama">
          {navItems.map(({ label, href, icon: Icon }, index) => (
            <a className={index === 0 ? "active" : ""} href={href} key={href}>
              <Icon aria-hidden="true" size={16} strokeWidth={2.15} />
              {label}
            </a>
          ))}
        </nav>

        <div className="sidebar-intel-card">
          <span className="label-with-icon"><Radar aria-hidden="true" size={13} /> Operational Risk</span>
          <strong>{formatPercent(operationalRisk)}</strong>
          <p>{data ? `${data.overview.critical_issues} high/critical signals` : "Backend required"}</p>
          <div className="mini-meter">
            <i style={{ width: `${operationalRisk}%` }} />
          </div>
        </div>

        <div className="sidebar-status">
          <span className={data?.health.status === "ok" ? "status-dot online" : "status-dot"} />
          <div>
            <strong>{data?.health.status === "ok" ? "Backend connected" : "Backend offline"}</strong>
            <p>{API_BASE_URL}</p>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar" id="command">
          <div className="breadcrumb-block">
            <p>Hermina / Intelligence / Mission Control</p>
            <h1>Patient Experience Mission Control</h1>
            <span>
              Realtime review intelligence, risk detection, and operational response for hospital branches.
            </span>
          </div>

          <div className="topbar-right">
            <label className="global-search">
              <Search aria-hidden="true" size={16} strokeWidth={2.2} />
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari cabang, reviewer, risiko, atau keyword..."
              />
            </label>
            <button className="command-button" type="button" onClick={() => setIsCommandOpen(true)}>
              <Command aria-hidden="true" size={16} strokeWidth={2.2} />
              <span>Ctrl K</span>
            </button>
            <a className="docs-link" href={`${API_BASE_URL}/api/docs`} target="_blank" rel="noreferrer">
              API Docs
            </a>
          </div>
        </header>

        {isCommandOpen ? (
          <section className="command-palette" role="dialog" aria-label="Command palette">
            <div className="command-head">
              <strong>Command Palette</strong>
              <button type="button" onClick={() => setIsCommandOpen(false)}>
                Close
              </button>
            </div>
            <div className="command-search-preview">
              <span><Command aria-hidden="true" size={14} /> Ctrl K · Command palette</span>
              <span><Zap aria-hidden="true" size={14} /> Run Fetch · ambil review terbaru</span>
              <span><Bot aria-hidden="true" size={14} /> Analyze Pending · proses AI</span>
              <span><Download aria-hidden="true" size={14} /> Export CSV · laporan operasional</span>
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="warning-panel" role="alert">
            <div>
              <strong>Backend belum terhubung.</strong>
              <p>UI ini tidak memakai mock data. Jalankan FastAPI dulu, lalu refresh halaman.</p>
            </div>
            <code>python -m uvicorn apps.api.main:app --reload --port 8000</code>
            <small>Detail error: {error}</small>
          </section>
        ) : null}

        <section className="hero-grid" id="dashboard">
          <article className="command-deck">
            <div className="deck-copy">
              <p className="kicker">Executive Overview</p>
              <h2>Hospital reputation intelligence, compressed into a decision cockpit.</h2>
              <p>
                Prioritaskan cabang, review, dan issue yang paling butuh intervensi. Semua data berasal dari backend real.
              </p>
            </div>
            <div className="deck-metrics">
              <StatTile label="Total Reviews" value={formatNumber(data?.overview.total_reviews)} helper="Database coverage" icon={MessageSquareText} />
              <StatTile
                label="AI Coverage"
                value={formatPercent(analyzedCoverage)}
                helper={`${formatNumber(data?.overview.analyzed_reviews)} analyzed`}
                icon={Bot}
                tone="info"
              />
              <StatTile
                label="Critical Signals"
                value={formatNumber(data?.overview.critical_issues)}
                helper="Need management attention"
                icon={ShieldAlert}
                tone="danger"
              />
              <StatTile
                label="Pending AI"
                value={formatNumber(data?.overview.pending_analysis)}
                helper="Queue for model analysis"
                icon={Activity}
                tone="warning"
              />
            </div>
          </article>

          <article className="action-panel">
            <SectionHeader kicker="Quick Actions" title="Operate the pipeline" helper="Fetch, analyze, and export with real backend calls." />
            <div className="action-controls">
              <label>
                <span>Location</span>
                <select
                  value={selectedLocationId ?? ""}
                  onChange={(event) => setSelectedLocationId(Number(event.target.value) || null)}
                  disabled={!data || isActionRunning}
                >
                  <option value="">Pilih lokasi</option>
                  {locations.map((location) => (
                    <option value={location.id} key={location.id}>
                      {location.branch_name} · {location.source}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Target Fetch</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={targetReviewCount}
                  onChange={(event) => setTargetReviewCount(Number(event.target.value))}
                  disabled={!data || isActionRunning}
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  className="primary-action"
                  disabled={!data || isActionRunning}
                  onClick={() =>
                    runAction("Run Fetch", () =>
                      postJson("/api/fetch-jobs", {
                        location_id: requireSelectedLocation(),
                        source: data?.settings.review_source_mode,
                        target_review_count: targetReviewCount,
                      }),
                    )
                  }
                >
                  <Zap aria-hidden="true" size={15} />
                  {isActionRunning ? "Processing" : "Run Fetch"}
                </button>
                <button
                  type="button"
                  disabled={!data || isActionRunning}
                  onClick={() =>
                    runAction("Dry Run Fetch", () =>
                      postJson("/api/fetch-jobs", {
                        location_id: requireSelectedLocation(),
                        source: data?.settings.review_source_mode,
                        target_review_count: targetReviewCount,
                        dry_run: true,
                      }),
                    )
                  }
                >
                  <RefreshCcw aria-hidden="true" size={15} />
                  Dry Run
                </button>
                <button
                  type="button"
                  disabled={!data || isActionRunning}
                  onClick={() =>
                    runAction("Analyze Pending", () =>
                      postJson("/api/analysis/pending", {
                        location_id: requireSelectedLocation(),
                      }),
                    )
                  }
                >
                  <Bot aria-hidden="true" size={15} />
                  Analyze
                </button>
                <button
                  type="button"
                  disabled={!data || isActionRunning}
                  onClick={() =>
                    runAction("Export CSV", () =>
                      postJson(`/api/exports/reviews/location/${requireSelectedLocation()}.csv`),
                    )
                  }
                >
                  <Download aria-hidden="true" size={15} />
                  Export
                </button>
              </div>
            </div>
          </article>
        </section>

        {actionMessage ? (
          <section className={`action-message ${actionMessage.type}`}>
            <div>
              <strong>{actionMessage.title}</strong>
              <span>{actionMessage.type === "info" ? "Processing" : "Backend response"}</span>
            </div>
            <pre>{actionMessage.detail}</pre>
          </section>
        ) : null}

        <section className="ops-strip">
          <div><span>Positive</span><strong>{formatNumber(positiveCount)}</strong></div>
          <div><span>Negative</span><strong>{formatNumber(negativeCount)}</strong></div>
          <div><span>Active Branches</span><strong>{formatNumber(locations.filter((location) => location.is_active).length)}</strong></div>
          <div><span>Latest Fetch</span><strong>{formatDate(data?.overview.latest_fetch)}</strong></div>
        </section>

        <section className="intelligence-grid">
          <article className="panel panel-large" id="reviews">
            <SectionHeader
              kicker="Review Intelligence Feed"
              title="Signals requiring human judgment"
              helper="Filtered by global search and sentiment state."
              action={
                <select value={sentimentFilter} onChange={(event) => setSentimentFilter(event.target.value)}>
                  <option value="all">All sentiment</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                  <option value="mixed">Mixed</option>
                </select>
              }
            />
            {isLoading ? <SkeletonPanel /> : null}
            {!isLoading && filteredReviews.length === 0 ? (
              <EmptyState title="Belum ada review yang cocok" detail="Pastikan backend terhubung atau ubah filter pencarian." />
            ) : null}
            <div className="intel-feed">
              {filteredReviews.slice(0, 12).map((review) => (
                <article className="review-signal" key={review.id}>
                  <div className="signal-rail">
                    <span className={`signal-dot ${toneForUrgency(review.urgency)}`} />
                  </div>
                  <div className="signal-body">
                    <div className="signal-topline">
                      <strong>{review.location}</strong>
                      <span>{formatDate(review.review_time)}</span>
                    </div>
                    <p>{review.review_text || "Tidak ada teks review."}</p>
                    <div className="signal-meta">
                      <Badge tone={toneForSentiment(review.sentiment)}>{sentimentLabel(review.sentiment)}</Badge>
                      <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                      <span>{issueLabel(review.issue_category)}</span>
                      <span>{review.rating ? `${review.rating}/5` : "No rating"}</span>
                    </div>
                    {review.recommended_action ? (
                      <div className="recommendation-line">{review.recommended_action}</div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </article>

          <aside className="side-stack">
            <article className="panel critical-panel">
              <SectionHeader
                kicker="Critical Alerts"
                title="Patient safety and reputation risk"
                helper={`${criticalReviews.length} signal(s) in loaded review window`}
              />
              {criticalReviews.length ? (
                <div className="alert-list">
                  {criticalReviews.slice(0, 5).map((review) => (
                    <div className="alert-item" key={review.id}>
                      <Badge tone="critical">Critical</Badge>
                      <strong>{review.location}</strong>
                      <p>{review.review_text || issueLabel(review.issue_category)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No critical alert" detail="Tidak ada patient-safety flag pada window data ini." />
              )}
            </article>

            <article className="panel" id="analysis">
              <SectionHeader
                kicker="Analysis Coverage"
                title="Model activity"
                helper={`${data?.settings.gemini_mode ?? "unknown"} mode · batch ${data?.settings.analysis_batch_size ?? "—"}`}
              />
              <div className="coverage-ring" style={{ "--coverage": `${analyzedCoverage}%` } as React.CSSProperties}>
                <strong>{formatPercent(analyzedCoverage)}</strong>
                <span>analyzed</span>
              </div>
              <BarList rows={sentimentRows} />
              <div className="button-row module-actions">
                <button type="button" onClick={() => runAction("Analyze Selected Location", () => postJson("/api/analysis/pending", { location_id: requireSelectedLocation() }))} disabled={!data || isActionRunning}>
                  <Bot aria-hidden="true" size={15} /> Analyze selected
                </button>
                <button type="button" onClick={() => runAction("Rerun Location Analysis", () => postJson(`/api/analysis/locations/${requireSelectedLocation()}/rerun`))} disabled={!data || isActionRunning}>
                  <RefreshCcw aria-hidden="true" size={15} /> Rerun selected
                </button>
              </div>
              <div className="issue-mini-list">
                {issueRows.slice(0, 4).map((issue) => (
                  <div key={issue.label}>
                    <span>{issue.label}</span>
                    <strong>{formatNumber(issue.count)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>

        <section className="lower-grid">
          <article className="panel panel-wide" id="locations">
            <SectionHeader
              kicker="Locations"
              title="Kelola cabang Hermina"
              helper="Tambah, update, activate/deactivate, dan hapus lokasi langsung ke backend."
              action={
                <button type="button" className="ghost-action" onClick={resetLocationForm} disabled={isActionRunning}>
                  <Plus aria-hidden="true" size={15} /> Lokasi baru
                </button>
              }
            />

            <form
              className="location-editor"
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
                <button type="submit" className="primary-action" disabled={!data || isActionRunning}>
                  <CheckCircle2 aria-hidden="true" size={15} />
                  {editingLocationId ? "Update Location" : "Create Location"}
                </button>
                <button type="button" onClick={resetLocationForm} disabled={isActionRunning}>Reset</button>
              </div>
            </form>

            <div className="branch-board">
              {branchScores.map((branch, index) => {
                const location = locations.find((item) => item.id === branch.id);
                if (!location) return null;
                return (
                  <div className="branch-row actionable" key={branch.id}>
                    <span className="rank">#{index + 1}</span>
                    <div className="branch-main">
                      <strong><MapPin aria-hidden="true" size={13} /> {branch.name}</strong>
                      <p>{branch.city} · {branch.source} · target {formatNumber(location.target_review_count)}</p>
                    </div>
                    <Badge tone={branch.isActive ? "positive" : "neutral"}>{branch.isActive ? "Active" : "Inactive"}</Badge>
                    <span>{formatNumber(branch.reviews)} reviews</span>
                    <span>{branch.avgRating ? branch.avgRating.toFixed(1) : "—"} avg</span>
                    <Badge tone={branch.critical ? "critical" : branch.negative ? "warning" : "positive"}>
                      {riskLabel(branch.critical, branch.negative)}
                    </Badge>
                    <div className="branch-actions">
                      <button type="button" onClick={() => editLocation(location)} disabled={isActionRunning} aria-label="Edit location"><Pencil aria-hidden="true" size={14} /></button>
                      <button type="button" onClick={() => runAction("Toggle Location", () => postJson(`/api/locations/${location.id}/toggle-active`))} disabled={isActionRunning} aria-label="Toggle active"><RefreshCcw aria-hidden="true" size={14} /></button>
                      <button type="button" className="danger-action" onClick={() => runAction("Delete Location", () => deleteJson(`/api/locations/${location.id}`))} disabled={isActionRunning} aria-label="Delete location"><Trash2 aria-hidden="true" size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel" id="fetch">
            <SectionHeader
              kicker="Fetch Jobs"
              title="Pipeline activity timeline"
              helper="Latest crawler/sync activity from backend logs."
              action={
                <div className="button-row compact-actions">
                  <button type="button" onClick={() => runAction("Fetch All Active", () => postJson("/api/fetch-jobs/all-active", { dry_run: false }))} disabled={!data || isActionRunning}>Fetch all</button>
                  <button type="button" onClick={() => runAction("Dry Run All Active", () => postJson("/api/fetch-jobs/all-active", { dry_run: true }))} disabled={!data || isActionRunning}>Dry run all</button>
                </div>
              }
            />
            {latestFetch ? (
              <div className="job-timeline">
                <div className="timeline-line" />
                <div className="job-node success"><span>Started</span><strong>{formatDate(latestFetch.started_at)}</strong></div>
                <div className="job-node"><span>{latestFetch.source}</span><strong>{latestFetch.location}</strong></div>
                <div className="job-node"><span>Fetched / Inserted / Duplicate</span><strong>{latestFetch.total_fetched} / {latestFetch.total_inserted} / {latestFetch.total_duplicate}</strong></div>
                <div className={`job-node ${latestFetch.status === "success" ? "success" : "danger"}`}><span>Status</span><strong>{latestFetch.status}</strong></div>
              </div>
            ) : (
              <EmptyState title="Belum ada fetch log" detail="Jalankan fetch pertama dari quick actions." />
            )}
          </article>
        </section>

        <section className="lower-grid compact">
          <article className="panel" id="insights">
            <SectionHeader kicker="Insights" title="Action-oriented recommendations" helper="Generated from available AI analysis fields." />
            <div className="insight-list">
              {filteredReviews
                .filter((review) => review.recommended_action)
                .slice(0, 5)
                .map((review) => (
                  <div className="insight-row" key={review.id}>
                    <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                    <p>{review.recommended_action}</p>
                  </div>
                ))}
              {!filteredReviews.some((review) => review.recommended_action) ? (
                <EmptyState title="Belum ada rekomendasi" detail="Jalankan analysis untuk menghasilkan action recommendation." />
              ) : null}
            </div>
          </article>

          <article className="panel" id="reports">
            <SectionHeader kicker="Reports" title="Report builder" helper="Generate file ke local exports/ dari backend." />
            <div className="report-preview">
              <div><span>Selected Branch</span><strong>{selectedLocation?.branch_name ?? "Pilih lokasi"}</strong></div>
              <div><span>Format</span><strong>CSV / JSON</strong></div>
              <div><span>Export Storage</span><strong>Local exports/</strong></div>
            </div>
            <div className="button-row module-actions">
              <button type="button" onClick={() => runAction("Export Selected Reviews", () => postJson(`/api/exports/reviews/location/${requireSelectedLocation()}.csv`))} disabled={!data || isActionRunning}><Download aria-hidden="true" size={15} /> Selected CSV</button>
              <button type="button" onClick={() => runAction("Export All Reviews", () => postJson("/api/exports/reviews/all.csv"))} disabled={!data || isActionRunning}>All CSV</button>
              <button type="button" onClick={() => runAction("Export Analysis Summary", () => postJson("/api/exports/analysis-summary.csv"))} disabled={!data || isActionRunning}>Analysis CSV</button>
              <button type="button" onClick={() => runAction("Export Raw JSON", () => postJson("/api/exports/raw-reviews.json"))} disabled={!data || isActionRunning}>Raw JSON</button>
            </div>
          </article>

          <article className="panel" id="settings">
            <SectionHeader
              kicker="Settings"
              title="Runtime configuration"
              helper="Masked and safe configuration from backend."
              action={
                <button type="button" className="ghost-action" onClick={() => runAction("Database Check", async () => {
                  const result = await fetchJson<DatabaseCheck>("/api/settings/database-check");
                  setDatabaseCheck(result);
                  return result;
                })} disabled={!data || isActionRunning}>
                  <Wifi aria-hidden="true" size={15} /> DB check
                </button>
              }
            />
            <dl className="settings-list">
              <div><dt>Review Source</dt><dd>{data?.settings.review_source_mode ?? "—"}</dd></div>
              <div><dt>Gemini Mode</dt><dd>{data?.settings.gemini_mode ?? "—"}</dd></div>
              <div><dt>Google Key</dt><dd>{data?.settings.google_maps_api_key_configured ? "Configured" : "Missing"}</dd></div>
              <div><dt>Gemini Key</dt><dd>{data?.settings.gemini_api_key_configured ? "Configured" : "Missing"}</dd></div>
              <div><dt>DB Status</dt><dd>{databaseCheck?.status ?? "Belum dicek"}</dd></div>
            </dl>
          </article>
        </section>
      </section>
    </main>
  );
}











