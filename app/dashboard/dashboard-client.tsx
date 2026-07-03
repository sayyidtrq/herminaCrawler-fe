"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  DatabaseZap,
  Frown,
  Lightbulb,
  Map as MapIcon,
  MessageCircle,
  RefreshCcw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { BackendWarning, Badge, EmptyState, SectionHeader } from "../components/ui";
import { fetchJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import { issueLabel, sentimentLabel, toneForSentiment, toneForUrgency, urgencyLabel } from "../lib/review-labels";
import type { FetchLog, Health, Location, Overview, PublicSettings, Review } from "../lib/types";
import type { DashboardMapMarker } from "./dashboard-map";

const DashboardMap = dynamic(() => import("./dashboard-map").then((module) => module.DashboardMap), {
  ssr: false,
  loading: () => <EmptyState title="Menyiapkan peta" detail="Map Indonesia sedang dimuat..." />,
});

type DashboardData = {
  health: Health;
  settings: PublicSettings;
  locations: { items: Location[]; total: number };
  overview: Overview;
  latestFetch: { item: FetchLog | null };
  reviews: { items: Review[]; total: number };
  criticalReviews: { items: DashboardSignalReview[]; total: number };
  negativeReviews: { items: DashboardSignalReview[]; total: number };
};

type DashboardSignalReview = {
  location: string;
  rating: number | null;
  review_text: string;
  sentiment?: string | null;
  issue_category: string | null;
  urgency: string | null;
  recommended_action?: string | null;
};

type BranchIntelligence = DashboardMapMarker & {
  targetReviewCount: number;
  source: string;
};

type DashboardDateRange = "all" | "30" | "90";
type DashboardRiskFilter = "all" | "stable" | "watch" | "critical";
type DashboardView = "map" | "chart" | "insight";

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  jakarta: { latitude: -6.2088, longitude: 106.8456 },
  depok: { latitude: -6.4025, longitude: 106.7942 },
  bekasi: { latitude: -6.2383, longitude: 106.9756 },
  bogor: { latitude: -6.595, longitude: 106.8166 },
  tangerang: { latitude: -6.1783, longitude: 106.6319 },
  bandung: { latitude: -6.9175, longitude: 107.6191 },
  semarang: { latitude: -6.9667, longitude: 110.4167 },
  surabaya: { latitude: -7.2575, longitude: 112.7521 },
  yogyakarta: { latitude: -7.7956, longitude: 110.3695 },
  solo: { latitude: -7.5755, longitude: 110.8243 },
  malang: { latitude: -7.9666, longitude: 112.6326 },
  medan: { latitude: 3.5952, longitude: 98.6722 },
  palembang: { latitude: -2.9761, longitude: 104.7754 },
  makassar: { latitude: -5.1477, longitude: 119.4327 },
  denpasar: { latitude: -8.6705, longitude: 115.2126 },
  pekanbaru: { latitude: 0.5071, longitude: 101.4478 },
  balikpapan: { latitude: -1.2379, longitude: 116.8529 },
  samarinda: { latitude: -0.5022, longitude: 117.1536 },
  pontianak: { latitude: -0.0263, longitude: 109.3425 },
  banjarmasin: { latitude: -3.3186, longitude: 114.5944 },
  manado: { latitude: 1.4748, longitude: 124.8421 },
  padang: { latitude: -0.9471, longitude: 100.4172 },
  lampung: { latitude: -5.3971, longitude: 105.2668 },
  cirebon: { latitude: -6.732, longitude: 108.5523 },
};

function CompactMetric({
  label,
  value,
  helper,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  icon?: ReactNode;
  tone?: "positive" | "danger" | "warning" | "info" | "neutral";
}) {
  return (
    <article className={`compact-metric metric-${tone}`}>
      <div className="metric-title-row">
        <span>{label}</span>
        {icon ? <i>{icon}</i> : null}
      </div>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function normalizeIssueRow(row: Overview["top_issues"][number]) {
  if (Array.isArray(row)) {
    return {
      issue: String(row[0] ?? "other"),
      count: Number(row[1] ?? 0),
    };
  }
  const issue = row.issue_category ?? row.issue ?? row[0] ?? "other";
  const count = row.count ?? row[1] ?? 0;
  return {
    issue: String(issue ?? "other"),
    count: Number(count ?? 0),
  };
}

function buildReviewLookup(reviews: Review[]) {
  return reviews.reduce<Record<number, Review[]>>((acc, review) => {
    acc[review.location_id] = acc[review.location_id] ?? [];
    acc[review.location_id].push(review);
    return acc;
  }, {});
}

function getRisk(params: { criticalCount: number; negativeCount: number; averageRating: number | null }) {
  if (params.criticalCount > 0 || (params.averageRating !== null && params.averageRating < 3.5)) return "critical";
  if (params.negativeCount > 3 || (params.averageRating !== null && params.averageRating < 4)) return "watch";
  return "stable";
}

function reviewExcerpt(text: string) {
  if (!text) return "Tidak ada teks review.";
  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
}

function formatShortDate(value: string | null) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No date";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(parsed);
}

function ratingTone(rating: number) {
  if (rating <= 2) return "danger";
  if (rating === 3) return "warning";
  return "positive";
}

function isWithinDateRange(review: Review, dateRange: DashboardDateRange) {
  if (dateRange === "all" || !review.review_time) return true;
  const reviewedAt = new Date(review.review_time).getTime();
  if (Number.isNaN(reviewedAt)) return true;
  const days = Number(dateRange);
  return reviewedAt >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function resolveLocationCoordinates(location: Location) {
  if (location.latitude !== null && location.longitude !== null) {
    return {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      isEstimatedCoordinate: false,
    };
  }

  const haystack = `${location.city ?? ""} ${location.branch_name}`.toLowerCase();
  const match = Object.entries(CITY_COORDINATES).find(([city]) => haystack.includes(city));
  if (!match) {
    return {
      latitude: 0,
      longitude: 0,
      isEstimatedCoordinate: true,
    };
  }

  return {
    latitude: match[1].latitude,
    longitude: match[1].longitude,
    isEstimatedCoordinate: true,
  };
}

export default function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DashboardDateRange>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<DashboardRiskFilter>("all");
  const [activeView, setActiveView] = useState<DashboardView>("map");

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
      const [reviews, criticalReviews, negativeReviews] = await Promise.all([
        fetchJson<DashboardData["reviews"]>("/api/reviews?page_size=200&latest_first=true"),
        fetchJson<DashboardData["criticalReviews"]>("/api/dashboard/critical-issues"),
        fetchJson<DashboardData["negativeReviews"]>("/api/dashboard/negative-reviews"),
      ]);
      setData({ health, settings, locations, overview, latestFetch, reviews, criticalReviews, negativeReviews });
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

  const sourceOptions = useMemo(
    () => Array.from(new Set(data?.locations.items.map((location) => location.source) ?? [])).sort(),
    [data?.locations.items],
  );
  const scopedLocations = useMemo(() => {
    return (data?.locations.items ?? []).filter((location) => {
      const matchesSource = sourceFilter === "all" || location.source === sourceFilter;
      const matchesLocation = locationFilter === "all" || location.id === Number(locationFilter);
      return matchesSource && matchesLocation;
    });
  }, [data?.locations.items, locationFilter, sourceFilter]);
  const scopedLocationIds = useMemo(() => new Set(scopedLocations.map((location) => location.id)), [scopedLocations]);
  const scopedReviews = useMemo(() => {
    return (data?.reviews.items ?? []).filter(
      (review) => scopedLocationIds.has(review.location_id) && isWithinDateRange(review, dateRange),
    );
  }, [data?.reviews.items, dateRange, scopedLocationIds]);
  const branchIntelligence = useMemo<BranchIntelligence[]>(() => {
    if (!data) return [];
    const reviewsByLocation = buildReviewLookup(scopedReviews);
    return scopedLocations.map((location) => {
      const locationReviews = reviewsByLocation[location.id] ?? [];
      const ratings = locationReviews
        .map((review) => review.rating)
        .filter((rating): rating is number => typeof rating === "number");
      const averageRating = ratings.length
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : null;
      const negativeCount = locationReviews.filter((review) => review.sentiment === "negative").length;
      const criticalCount = locationReviews.filter(
        (review) => ["high", "critical"].includes(review.urgency ?? "") || review.is_patient_safety_issue,
      ).length;
      const issueCounts = locationReviews.reduce<Record<string, number>>((acc, review) => {
        const key = review.issue_category ?? "other";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
      const topIssue = Object.entries(issueCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const coordinates = resolveLocationCoordinates(location);

      return {
        id: location.id,
        name: location.branch_name,
        city: location.city,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        isEstimatedCoordinate: coordinates.isEstimatedCoordinate,
        reviews: locationReviews.length,
        averageRating,
        negativeCount,
        criticalCount,
        risk: getRisk({ criticalCount, negativeCount, averageRating }),
        topIssue,
        isActive: location.is_active,
        targetReviewCount: location.target_review_count,
        source: location.source,
        latestFetch: formatDate(data.latestFetch.item?.started_at),
      };
    });
  }, [data, scopedLocations, scopedReviews]);
  const visibleBranches = useMemo(
    () => branchIntelligence.filter((branch) => riskFilter === "all" || branch.risk === riskFilter),
    [branchIntelligence, riskFilter],
  );
  const mapMarkers = useMemo(
    () => visibleBranches.filter((branch) => branch.latitude !== 0 && branch.longitude !== 0),
    [visibleBranches],
  );
  const rankedBranches = useMemo(() => {
    const riskWeight = { critical: 3, watch: 2, stable: 1 };
    return [...visibleBranches].sort((a, b) => {
      const riskDiff = riskWeight[b.risk] - riskWeight[a.risk];
      if (riskDiff) return riskDiff;
      const criticalDiff = b.criticalCount - a.criticalCount;
      if (criticalDiff) return criticalDiff;
      return b.negativeCount - a.negativeCount;
    });
  }, [visibleBranches]);
  const averageRating = useMemo(() => {
    const ratings = scopedReviews
      .map((review) => review.rating)
      .filter((rating): rating is number => typeof rating === "number") ?? [];
    if (!ratings.length) return null;
    return ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
  }, [scopedReviews]);
  const activeLocations = visibleBranches.filter((branch) => branch.isActive).length;
  const missingCoordinates = scopedLocations.filter((location) => location.latitude === null || location.longitude === null).length;
  const analyzedInScope = scopedReviews.filter((review) => review.sentiment || review.issue_category || review.urgency).length;
  const analysisCoverage = scopedReviews.length ? Math.round((analyzedInScope / scopedReviews.length) * 100) : 0;
  const criticalSignals = scopedReviews.filter(
    (review) => ["high", "critical"].includes(review.urgency ?? "") || review.is_patient_safety_issue,
  ).length;
  const negativeCount = scopedReviews.filter((review) => review.sentiment === "negative").length;
  const unansweredCount = scopedReviews.filter((review) => !review.owner_response_text).length;
  const priorityReviewCount = scopedReviews.filter(
    (review) =>
      review.sentiment === "negative" ||
      ["high", "critical"].includes(review.urgency ?? "") ||
      review.is_patient_safety_issue,
  ).length;
  const actionReadyCount = scopedReviews.filter((review) => review.recommended_action).length;
  const followUpCoverage = priorityReviewCount ? Math.round((actionReadyCount / priorityReviewCount) * 100) : 0;
  const topIssues = useMemo(() => {
    if (sourceFilter === "all" && locationFilter === "all" && dateRange === "all" && riskFilter === "all") {
      return data?.overview.top_issues.map(normalizeIssueRow) ?? [];
    }
    const counts = scopedReviews.reduce<Record<string, number>>((acc, review) => {
      const key = review.issue_category ?? "other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data?.overview.top_issues, dateRange, locationFilter, riskFilter, scopedReviews, sourceFilter]);
  const priorityBranches = rankedBranches.filter((branch) => branch.risk !== "stable");
  const criticalBranchCount = visibleBranches.filter((branch) => branch.risk === "critical").length;
  const watchBranchCount = visibleBranches.filter((branch) => branch.risk === "watch").length;
  const hasActiveFilters = dateRange !== "all" || sourceFilter !== "all" || locationFilter !== "all" || riskFilter !== "all";
  const scopedCriticalReviews = useMemo(() => {
    const allowedLocationNames = new Set(scopedLocations.map((location) => location.branch_name));
    return (data?.criticalReviews.items ?? []).filter((review) => allowedLocationNames.has(review.location));
  }, [data?.criticalReviews.items, scopedLocations]);
  const previewBranch = rankedBranches[0] ?? visibleBranches[0] ?? null;
  const totalReviewsValue = hasActiveFilters ? scopedReviews.length : data?.overview.total_reviews ?? 0;
  const recentNegativeReviews = useMemo(
    () =>
      [...scopedReviews]
        .filter((review) => review.sentiment === "negative")
        .sort((a, b) => {
          const aTime = a.review_time ? new Date(a.review_time).getTime() : 0;
          const bTime = b.review_time ? new Date(b.review_time).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5),
    [scopedReviews],
  );
  const ratingDistribution = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: scopedReviews.filter((review) => review.rating === rating).length,
      color:
        rating === 5
          ? "var(--green)"
          : rating === 4
            ? "#65c66f"
            : rating === 3
              ? "var(--amber)"
              : rating === 2
                ? "#fb923c"
                : "var(--red)",
    }));
    return counts;
  }, [scopedReviews]);
  const ratingTotal = ratingDistribution.reduce((total, item) => total + item.count, 0);
  const ratingDenominator = Math.max(ratingTotal, 1);
  let ratingCursor = 0;
  const ratingGradient = ratingTotal
    ? ratingDistribution
        .map((item) => {
          const start = ratingCursor;
          ratingCursor += (item.count / ratingDenominator) * 360;
          return `${item.color} ${start}deg ${ratingCursor}deg`;
        })
        .join(", ")
    : "rgba(15, 23, 42, 0.08) 0deg 360deg";
  const ratingDoughnutStyle = {
    background: `conic-gradient(${ratingGradient})`,
  };
  const trendBuckets = useMemo(() => {
    const buckets = new Map<string, { label: string; reviews: Review[] }>();
    scopedReviews.forEach((review) => {
      const parsed = review.review_time ? new Date(review.review_time) : null;
      const key = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "unknown";
      const label = parsed && !Number.isNaN(parsed.getTime()) ? formatShortDate(review.review_time) : "No date";
      const existing = buckets.get(key) ?? { label, reviews: [] };
      existing.reviews.push(review);
      buckets.set(key, existing);
    });
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, bucket]) => {
        const ratings = bucket.reviews
          .map((review) => review.rating)
          .filter((rating): rating is number => typeof rating === "number");
        return {
          label: bucket.label,
          volume: bucket.reviews.length,
          rating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0,
        };
      });
  }, [scopedReviews]);
  const trendMaxVolume = Math.max(...trendBuckets.map((bucket) => bucket.volume), 1);
  const stableBranchCount = visibleBranches.filter((branch) => branch.risk === "stable").length;
  const riskTotal = visibleBranches.length;
  const branchChartMax = Math.max(...rankedBranches.map((branch) => branch.reviews), 1);
  const healthTone = isLoading ? "warning checking" : data?.health.status === "ok" ? "ok" : "warning";
  const healthLabel = isLoading ? "Checking system" : data?.health.status === "ok" ? "System healthy" : "System warning";

  return (
    <AppShell>
      <header className="page-header dashboard-hero-header">
        <div>
          <p className="kicker">Dashboard</p>
          <h1>Indonesia Review Command Center</h1>
          <span>Pantau reputasi cabang, sinyal kritis, dan prioritas tindak lanjut lintas lokasi Hermina.</span>
        </div>
        <div className="dashboard-header-actions">
          <span className={`health-pill ${healthTone}`}>{healthLabel}</span>
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh
          </button>
        </div>
      </header>

      {error ? <BackendWarning error={error} /> : null}

      <section className="dashboard-intelligence">
        <section className="dashboard-filter-bar" aria-label="Dashboard filters">
          <label>
            <span>Date range</span>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DashboardDateRange)}>
              <option value="all">All time</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          <label>
            <span>Source</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">All sources</option>
              {sourceOptions.map((source) => <option value={source} key={source}>{source}</option>)}
            </select>
          </label>
          <label>
            <span>Location</span>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="all">All locations</option>
              {(data?.locations.items ?? []).map((location) => (
                <option value={location.id} key={location.id}>{location.branch_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Risk level</span>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as DashboardRiskFilter)}>
              <option value="all">All risk</option>
              <option value="critical">Critical</option>
              <option value="watch">Watch</option>
              <option value="stable">Stable</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setDateRange("all");
              setSourceFilter("all");
              setLocationFilter("all");
              setRiskFilter("all");
            }}
            disabled={!hasActiveFilters}
          >
            Reset
          </button>
        </section>

        <div className="dashboard-kpi-strip">
          <CompactMetric
            label="Total Reviews"
            value={formatNumber(totalReviewsValue)}
            helper={hasActiveFilters ? "Sesuai filter aktif" : "Review tersimpan"}
            icon={<MessageCircle aria-hidden="true" size={16} />}
          />
          <CompactMetric
            label="Rating Rata-rata"
            value={averageRating ? averageRating.toFixed(1) : "—"}
            helper="Kualitas pengalaman pasien"
            icon={<Star aria-hidden="true" size={16} />}
            tone="positive"
          />
          <CompactMetric
            label="Review Negatif"
            value={formatNumber(negativeCount)}
            helper="Keluhan yang perlu dipantau"
            icon={<Frown aria-hidden="true" size={16} />}
            tone="danger"
          />
          <CompactMetric
            label="Belum Dibalas"
            value={formatNumber(unansweredCount)}
            helper="Belum ada respons owner"
            icon={<MessageCircle aria-hidden="true" size={16} />}
            tone="warning"
          />
          <CompactMetric
            label="SLA Follow Up"
            value={`${followUpCoverage}%`}
            helper={`${formatNumber(actionReadyCount)} rekomendasi siap`}
            icon={<ShieldCheck aria-hidden="true" size={16} />}
            tone="info"
          />
          <CompactMetric
            label="Cabang Risiko Tinggi"
            value={formatNumber(priorityBranches.length)}
            helper={`${formatNumber(criticalBranchCount)} critical branch`}
            icon={<AlertTriangle aria-hidden="true" size={16} />}
          />
        </div>

        <section className="dashboard-view-tabs" aria-label="Dashboard view">
          <button type="button" className={activeView === "map" ? "active" : ""} onClick={() => setActiveView("map")}>
            <MapIcon aria-hidden="true" size={15} /> Map
          </button>
          <button type="button" className={activeView === "chart" ? "active" : ""} onClick={() => setActiveView("chart")}>
            <BarChart3 aria-hidden="true" size={15} /> Chart
          </button>
          <button type="button" className={activeView === "insight" ? "active" : ""} onClick={() => setActiveView("insight")}>
            <Lightbulb aria-hidden="true" size={15} /> Insight
          </button>
        </section>

        <section className="map-intelligence-grid">
          <div className="map-main-column">
            <article className="panel page-panel map-panel dashboard-view-panel">
              {activeView === "map" ? (
                <>
                  <SectionHeader
                    kicker="Map"
                    title="Risiko cabang berdasarkan lokasi"
                    helper="Sebaran cabang dan status risiko di seluruh lokasi."
                    action={<span className="map-meta">{formatNumber(mapMarkers.length)} lokasi tampil</span>}
                  />
                  {isLoading ? <EmptyState title="Memuat peta" detail="Mengambil data cabang terbaru." /> : null}
                  {!isLoading && mapMarkers.length > 0 ? <DashboardMap markers={mapMarkers} /> : null}
                  {!isLoading && mapMarkers.length === 0 ? (
                    <EmptyState title="Belum ada lokasi di peta" detail="Lengkapi data kota atau koordinat cabang." />
                  ) : null}
                </>
              ) : activeView === "chart" ? (
                <>
                  <SectionHeader
                    kicker="Chart"
                    title="Tren dan distribusi review"
                    helper="Visualisasi rating, volume review, dan issue dominan."
                    action={<span className="map-meta">{formatNumber(scopedReviews.length)} review</span>}
                  />
                  <div className="dashboard-chart-grid">
                    <article className="chart-section-card trend-section-card">
                      <SectionHeader kicker="Trend" title="Rating & volume review" helper="Pergerakan rating rata-rata dan jumlah review." />
                      <div className="trend-chart">
                        {trendBuckets.map((bucket) => (
                          <div className="trend-column" key={bucket.label}>
                            <span className="trend-rating">{bucket.rating ? bucket.rating.toFixed(1) : "—"}</span>
                            <div className="trend-bar-track">
                              <i style={{ height: `${Math.max(8, (bucket.volume / trendMaxVolume) * 100)}%` }} />
                            </div>
                            <strong>{formatNumber(bucket.volume)}</strong>
                            <span>{bucket.label}</span>
                          </div>
                        ))}
                        {!isLoading && trendBuckets.length === 0 ? (
                          <EmptyState title="Belum ada tren" detail="Belum ada review pada filter ini." />
                        ) : null}
                      </div>
                    </article>
                    <article className="chart-section-card">
                      <SectionHeader kicker="Rating" title="Distribusi rating bintang" helper="Komposisi rating dari review yang sedang difilter." />
                      <div className="rating-distribution-grid">
                        <div className="doughnut-chart rating-doughnut" style={ratingDoughnutStyle}>
                          <div>
                            <strong>{formatNumber(ratingTotal)}</strong>
                            <span>review</span>
                          </div>
                        </div>
                        <div className="rating-list">
                          {ratingDistribution.map((item) => (
                            <div className={`rating-row metric-${ratingTone(item.rating)}`} key={item.rating}>
                              <span>{item.rating} Bintang</span>
                              <div><i style={{ width: `${ratingTotal ? Math.max(4, (item.count / ratingTotal) * 100) : 0}%` }} /></div>
                              <strong>{formatNumber(item.count)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                    <article className="chart-section-card top-issue-chart-card">
                      <SectionHeader kicker="Top Issues" title="Top issue dari Google Review" helper="Kategori keluhan paling sering muncul." />
                      <div className="issue-bar-list">
                        {topIssues.slice(0, 7).map((issue) => {
                          const maxIssue = Math.max(...topIssues.map((item) => item.count), 1);
                          return (
                            <div className="issue-bar-row" key={issue.issue}>
                              <span>{issueLabel(issue.issue)}</span>
                              <div><i style={{ width: `${Math.max(4, (issue.count / maxIssue) * 100)}%` }} /></div>
                              <strong>{formatNumber(issue.count)}</strong>
                            </div>
                          );
                        })}
                        {!isLoading && topIssues.length === 0 ? (
                          <EmptyState title="Belum ada issue" detail="Belum ada kategori keluhan untuk filter ini." />
                        ) : null}
                      </div>
                    </article>
                  </div>
                </>
              ) : (
                <>
                  <SectionHeader
                    kicker="Insight"
                    title="AI insight summary"
                    helper="Ringkasan prioritas dan rekomendasi follow-up."
                    action={<span className="map-meta">{formatNumber(actionReadyCount)} action ready</span>}
                  />
                  <div className="insight-summary-grid">
                    <article className="insight-summary-card">
                      <span>Ringkasan Risiko</span>
                      <strong>{priorityBranches.length ? `${formatNumber(priorityBranches.length)} cabang perlu dipantau` : "Semua cabang stabil"}</strong>
                      <p>{negativeCount ? `${formatNumber(negativeCount)} review negatif pada filter aktif.` : "Belum ada review negatif pada filter ini."}</p>
                    </article>
                    <article className="insight-summary-card">
                      <span>Rekomendasi Utama</span>
                      <strong>{topIssues[0] ? issueLabel(topIssues[0].issue) : "Belum ada issue"}</strong>
                      <p>{topIssues[0] ? "Prioritaskan kategori issue tertinggi." : "Jalankan analisis untuk mengisi rekomendasi."}</p>
                    </article>
                    <article className="insight-summary-card">
                      <span>Follow Up</span>
                      <strong>{formatNumber(actionReadyCount)} action</strong>
                      <p>{followUpCoverage}% prioritas sudah punya rekomendasi tindak lanjut.</p>
                    </article>
                  </div>
                  <div className="action-followup-table">
                    <div className="action-followup-head">
                      <span>Cabang</span>
                      <span>Issue</span>
                      <span>Action</span>
                      <span>Status</span>
                    </div>
                    {scopedCriticalReviews.slice(0, 5).map((review, index) => (
                      <div className="action-followup-row" key={`${review.location}-${index}`}>
                        <strong>{review.location}</strong>
                        <span>{issueLabel(review.issue_category)}</span>
                        <p>{review.recommended_action || "Review perlu dicek manual."}</p>
                        <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                      </div>
                    ))}
                    {!isLoading && scopedCriticalReviews.length === 0 ? (
                      <EmptyState title="Belum ada action prioritas" detail="Tidak ada review kritis pada filter ini." />
                    ) : null}
                  </div>
                </>
              )}
            </article>

            {activeView !== "insight" ? (
              <article className="panel page-panel branch-distribution-panel">
                <SectionHeader
                  kicker="Branch Distribution"
                  title="Persebaran review per cabang"
                  helper="Cabang dengan review terbanyak pada filter aktif."
                  action={<span className="map-meta">{formatNumber(rankedBranches.length)} cabang</span>}
                />
                <div className="branch-distribution-list">
                  {rankedBranches.slice(0, 6).map((branch) => {
                    const percent = Math.max(4, (branch.reviews / branchChartMax) * 100);
                    return (
                      <a className="branch-distribution-row" href={`/reviews?location_id=${branch.id}`} key={branch.id}>
                        <div className="branch-distribution-label">
                          <strong>{branch.name}</strong>
                          <span>{branch.city ?? "Tanpa kota"} · {branch.risk}</span>
                        </div>
                        <div className="branch-distribution-track">
                          <i className={`risk-${branch.risk}`} style={{ width: `${percent}%` }} />
                        </div>
                        <strong className="branch-distribution-value">{formatNumber(branch.reviews)}</strong>
                      </a>
                    );
                  })}
                  {!isLoading && rankedBranches.length === 0 ? (
                    <EmptyState title="Belum ada cabang" detail="Tidak ada cabang pada filter ini." />
                  ) : null}
                </div>
              </article>
            ) : null}
          </div>

          <aside className="panel page-panel risk-panel">
            <SectionHeader
              kicker="Risk Summary"
              title={priorityBranches.length ? `${formatNumber(priorityBranches.length)} cabang perlu dipantau` : "Semua cabang stabil"}
              helper={`Update terakhir: ${formatDate(data?.latestFetch.item?.started_at)}`}
            />
            <dl className="risk-snapshot">
              <div className="metric-danger"><dt>Critical</dt><dd>{formatNumber(criticalBranchCount)}</dd></div>
              <div className="metric-warning"><dt>Watch</dt><dd>{formatNumber(watchBranchCount)}</dd></div>
              <div className="metric-neutral"><dt>Top issue</dt><dd>{topIssues[0] ? issueLabel(topIssues[0].issue) : "None"}</dd></div>
              <div className="metric-info"><dt>AI coverage</dt><dd>{analysisCoverage}%</dd></div>
            </dl>
            <div className="risk-summary-list">
              {rankedBranches.slice(0, 5).map((branch) => (
                <a className="risk-summary-row" href={`/reviews?location_id=${branch.id}`} key={branch.id}>
                  <div>
                    <strong>{branch.name}</strong>
                    <span>{branch.city ?? "Tanpa kota"} · {formatNumber(branch.reviews)} reviews</span>
                  </div>
                  <Badge tone={branch.risk === "critical" ? "critical" : branch.risk === "watch" ? "warning" : "positive"}>
                    {branch.risk === "critical" ? "Critical" : branch.risk === "watch" ? "Watch" : "Stable"}
                  </Badge>
                </a>
              ))}
            </div>
            {previewBranch ? (
              <article className="location-preview-card">
                <div>
                  <span>Cabang Pilihan</span>
                  <strong>{previewBranch.name}</strong>
                  <p>{previewBranch.city ?? "Tanpa kota"} · {formatNumber(previewBranch.reviews)} reviews · {previewBranch.averageRating ? `${previewBranch.averageRating.toFixed(1)} avg` : "No rating"}</p>
                </div>
                <dl>
                  <div className="metric-warning"><dt>Negative</dt><dd>{formatNumber(previewBranch.negativeCount)}</dd></div>
                  <div className="metric-danger"><dt>Critical</dt><dd>{formatNumber(previewBranch.criticalCount)}</dd></div>
                </dl>
                <div className="location-preview-actions">
                  <a href={`/locations?location_id=${previewBranch.id}`}>Detail cabang</a>
                  <a href={`/reviews?location_id=${previewBranch.id}`}>Review cabang</a>
                </div>
              </article>
            ) : null}
            <div className="priority-action-list">
              <a href="/reviews"><AlertTriangle aria-hidden="true" size={15} /> Lihat review prioritas</a>
              <a href="/analysis"><Activity aria-hidden="true" size={15} /> Analisis {formatNumber(data?.overview.pending_analysis)} review tertunda</a>
              <a href="/fetch-jobs"><DatabaseZap aria-hidden="true" size={15} /> Update review cabang aktif</a>
              <a href="/locations"><Building2 aria-hidden="true" size={15} /> Lengkapi {formatNumber(missingCoordinates)} koordinat</a>
            </div>
          </aside>
        </section>

        {activeView === "insight" ? (
        <section className="dashboard-lower-grid">
          <article className="panel page-panel critical-panel">
            <SectionHeader
              kicker="Review Negatif"
              title="Review negatif terbaru"
              helper={`${formatNumber(recentNegativeReviews.length)} review negatif pada filter aktif.`}
            />
            <div className="critical-review-list">
              {recentNegativeReviews.map((review) => (
                <div className="critical-review-row" key={review.id}>
                  <div className="critical-review-topline">
                    <strong>{review.location}</strong>
                    <div className="critical-review-badges">
                      <Badge tone={toneForSentiment(review.sentiment)}>{sentimentLabel(review.sentiment)}</Badge>
                      <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                    </div>
                  </div>
                  <p>{reviewExcerpt(review.review_text)}</p>
                  <div className="signal-meta">
                    <span>{review.rating ? `${review.rating}/5` : "No rating"}</span>
                    <span>{issueLabel(review.issue_category)}</span>
                  </div>
                  {review.recommended_action ? <div className="recommendation-line">{review.recommended_action}</div> : null}
                </div>
              ))}
              {!isLoading && recentNegativeReviews.length === 0 ? (
                <EmptyState title="Tidak ada review negatif" detail="Belum ada review negatif untuk filter ini." />
              ) : null}
            </div>
          </article>

          <article className="panel page-panel branch-panel">
            <SectionHeader
              kicker="Branch Ranking"
              title="Prioritas cabang"
              helper="Cabang diurutkan dari risiko tertinggi."
            />
            <div className="branch-priority-list">
              {rankedBranches.slice(0, 6).map((branch, index) => (
                <div className="branch-priority-row" key={branch.id}>
                  <span className="rank">#{index + 1}</span>
                  <div>
                    <strong>{branch.name}</strong>
                    <p>
                      {branch.city ?? "Tanpa kota"} · {formatNumber(branch.reviews)} reviews ·{" "}
                      {branch.averageRating ? `${branch.averageRating.toFixed(1)} avg` : "No rating"} ·{" "}
                      {formatNumber(branch.negativeCount)} negative · {formatNumber(branch.criticalCount)} critical
                    </p>
                  </div>
                  <Badge tone={branch.risk === "critical" ? "critical" : branch.risk === "watch" ? "warning" : "positive"}>
                    {branch.risk}
                  </Badge>
                </div>
              ))}
            </div>
          </article>

          <article className="panel page-panel issues-panel">
            <SectionHeader
              kicker="Top Issues"
              title="Tema masalah dominan"
              helper="Kategori keluhan yang paling sering muncul."
            />
            <div className="issue-rank-list">
              {topIssues.slice(0, 5).map((issue, index) => (
                <div className="issue-rank-row compact" key={`${issue.issue}-${index}`}>
                  <span className="rank">#{index + 1}</span>
                  <div>
                    <strong>{issueLabel(issue.issue)}</strong>
                    <p>{formatNumber(issue.count)} review</p>
                  </div>
                </div>
              ))}
              {!isLoading && topIssues.length === 0 ? (
                <EmptyState title="Belum ada issue" detail="Belum ada kategori keluhan untuk filter ini." />
              ) : null}
            </div>
          </article>
        </section>
        ) : null}
      </section>
    </AppShell>
  );
}
