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
  MapPin,
  MessageCircle,
  RefreshCcw,
  ShieldCheck,
  Star,
} from "lucide-react";
import { AppShell } from "../components/app-shell";
import { BackendWarning, Badge, EmptyState, SectionHeader } from "../components/ui";
import { fetchJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import { issueLabel, toneForUrgency } from "../lib/review-labels";
import type { FetchLog, Health, Location, Overview, PublicSettings, Review } from "../lib/types";
import type { DashboardMapMarker } from "./dashboard-map";

const DashboardMap = dynamic(() => import("./dashboard-map").then((module) => module.DashboardMap), {
  ssr: false,
  loading: () => <EmptyState title="Menyiapkan peta" detail="Peta Indonesia sedang dimuat..." />,
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
  unansweredCount: number;
  latestReview: string;
};

type DashboardDateRange = "all" | "30" | "90";
type DashboardRiskFilter = "all" | "stable" | "watch" | "critical";
type DashboardView = "map" | "chart" | "insight";
type DashboardBadgeTone = "positive" | "danger" | "warning" | "info" | "critical" | "neutral";
type ActionTrackerRow = {
  key: string;
  branch: string;
  issue: string | null;
  action: string;
  unit: string;
  pic: string;
  sla: string;
  status: string;
  tone: DashboardBadgeTone;
  href: string;
};

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

function riskLabel(risk: DashboardRiskFilter | BranchIntelligence["risk"]) {
  if (risk === "critical") return "Kritis";
  if (risk === "watch") return "Perlu dipantau";
  if (risk === "stable") return "Stabil";
  return "Semua risiko";
}

function monitoringStatusLabel(risk: BranchIntelligence["risk"]) {
  if (risk === "critical") return "Kritis";
  if (risk === "watch") return "Warning";
  return "Normal";
}

function metricHelperText(params: { empty: boolean; emptyText: string; filledText: string }) {
  return params.empty ? params.emptyText : params.filledText;
}

function reviewExcerpt(text: string) {
  if (!text) return "Tidak ada teks review.";
  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
}

function formatShortDate(value: string | null) {
  if (!value) return "Tanpa tanggal";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Tanpa tanggal";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(parsed);
}

function RatingStars({ rating }: { rating: number | null }) {
  const activeStars = Math.round(rating ?? 0);
  return (
    <span className="rating-stars" aria-label={rating ? `${rating} dari 5` : "Belum ada rating"}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star aria-hidden="true" className={star <= activeStars ? "active" : ""} key={star} size={11} />
      ))}
    </span>
  );
}

function ratingTone(rating: number) {
  if (rating <= 2) return "danger";
  if (rating === 3) return "warning";
  return "positive";
}

function ownerUnitForIssue(issue: string | null) {
  const normalized = (issue ?? "").toLowerCase();
  if (normalized.includes("wait") || normalized.includes("antri") || normalized.includes("queue")) return "Operasional";
  if (normalized.includes("admin") || normalized.includes("billing") || normalized.includes("claim")) return "Administrasi";
  if (normalized.includes("doctor") || normalized.includes("dokter") || normalized.includes("medical")) return "Layanan Medis";
  if (normalized.includes("facility") || normalized.includes("fasilitas")) return "Fasilitas";
  return "Customer Care";
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
  const [branchSearch, setBranchSearch] = useState("");
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
    const query = branchSearch.trim().toLowerCase();
    return (data?.locations.items ?? []).filter((location) => {
      const matchesSource = sourceFilter === "all" || location.source === sourceFilter;
      const matchesLocation = locationFilter === "all" || location.id === Number(locationFilter);
      const matchesSearch =
        !query ||
        [location.branch_name, location.city, location.address, location.source]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesSource && matchesLocation && matchesSearch;
    });
  }, [branchSearch, data?.locations.items, locationFilter, sourceFilter]);
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
      const unansweredCount = locationReviews.filter((review) => !review.owner_response_text).length;
      const latestReview = [...locationReviews].sort((a, b) => {
        const aTime = a.review_time ? new Date(a.review_time).getTime() : 0;
        const bTime = b.review_time ? new Date(b.review_time).getTime() : 0;
        return bTime - aTime;
      })[0]?.review_time ?? null;

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
        unansweredCount,
        latestReview: formatDate(latestReview),
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
  const missingCoordinates = scopedLocations.filter((location) => location.latitude === null || location.longitude === null).length;
  const analyzedInScope = scopedReviews.filter((review) => review.sentiment || review.issue_category || review.urgency).length;
  const analysisCoverage = scopedReviews.length ? Math.round((analyzedInScope / scopedReviews.length) * 100) : 0;
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
    if (
      sourceFilter === "all" &&
      locationFilter === "all" &&
      dateRange === "all" &&
      riskFilter === "all" &&
      !branchSearch.trim()
    ) {
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
  }, [branchSearch, data?.overview.top_issues, dateRange, locationFilter, riskFilter, scopedReviews, sourceFilter]);
  const priorityBranches = rankedBranches.filter((branch) => branch.risk !== "stable");
  const criticalBranchCount = visibleBranches.filter((branch) => branch.risk === "critical").length;
  const watchBranchCount = visibleBranches.filter((branch) => branch.risk === "watch").length;
  const stableBranchCount = visibleBranches.filter((branch) => branch.risk === "stable").length;
  const hasActiveFilters =
    dateRange !== "all" ||
    sourceFilter !== "all" ||
    locationFilter !== "all" ||
    riskFilter !== "all" ||
    branchSearch.trim().length > 0;
  const scopedCriticalReviews = useMemo(() => {
    const allowedLocationNames = new Set(scopedLocations.map((location) => location.branch_name));
    return (data?.criticalReviews.items ?? []).filter((review) => allowedLocationNames.has(review.location));
  }, [data?.criticalReviews.items, scopedLocations]);
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
          ? "#047857"
          : rating === 4
            ? "var(--green)"
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
      const label = parsed && !Number.isNaN(parsed.getTime()) ? formatShortDate(review.review_time) : "Tanpa tanggal";
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
  const trendLinePoints = trendBuckets.map((bucket, index) => {
    const x = trendBuckets.length <= 1 ? 50 : (index / (trendBuckets.length - 1)) * 100;
    const y = 92 - (Math.max(0, Math.min(bucket.rating, 5)) / 5) * 78;
    return { x, y };
  });
  const trendPolyline = trendLinePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const maxTopIssue = Math.max(...topIssues.map((issue) => issue.count), 1);
  const defaultActionRows: ActionTrackerRow[] = rankedBranches.slice(0, Math.min(3, Math.max(1, rankedBranches.length))).map((branch) => ({
    key: `placeholder-${branch.id}`,
    branch: branch.name,
    issue: branch.topIssue,
    action: branch.topIssue
      ? `Tinjau isu ${issueLabel(branch.topIssue)} di cabang ini.`
      : "Siapkan action setelah ada review prioritas.",
    unit: ownerUnitForIssue(branch.topIssue),
    pic: "Belum ditugaskan",
    sla: branch.risk === "critical" ? "4 jam" : branch.risk === "watch" ? "24 jam" : "3 hari",
    status: "Draft",
    tone: branch.risk === "critical" ? "critical" : branch.risk === "watch" ? "warning" : "neutral",
    href: `/reviews?location_id=${branch.id}`,
  }));
  const actionTrackerRows: ActionTrackerRow[] = scopedCriticalReviews.slice(0, 5).map((review, index) => ({
    branch: review.location,
    issue: review.issue_category,
    action: review.recommended_action || "Review perlu dicek manual.",
    unit: ownerUnitForIssue(review.issue_category),
    pic: "Belum ditugaskan",
    sla: review.urgency === "critical" || review.urgency === "high" ? "4 jam" : "24 jam",
    status: "Perlu dicek",
    tone: toneForUrgency(review.urgency),
    href: "/reviews",
    key: `${review.location}-${index}`,
  }));
  const displayedActionRows = actionTrackerRows.length ? actionTrackerRows : defaultActionRows;
  const totalReviewHelper = metricHelperText({
    empty: totalReviewsValue === 0,
    emptyText: "Belum ada review pada filter ini",
    filledText: `${formatNumber(totalReviewsValue)} review dalam filter aktif`,
  });
  const averageRatingHelper = metricHelperText({
    empty: averageRating === null,
    emptyText: "Belum ada rating pada filter ini",
    filledText: "Rating rata-rata dari review terpilih",
  });
  const negativeHelper = metricHelperText({
    empty: negativeCount === 0,
    emptyText: "Belum ada review negatif",
    filledText: `${formatNumber(negativeCount)} review negatif perlu dipantau`,
  });
  const unansweredHelper = metricHelperText({
    empty: totalReviewsValue === 0,
    emptyText: "Belum ada review untuk dibalas",
    filledText: unansweredCount ? `${formatNumber(unansweredCount)} review belum dibalas` : "Semua review sudah dibalas",
  });
  const followUpHelper = metricHelperText({
    empty: priorityReviewCount === 0,
    emptyText: "Belum ada prioritas follow up",
    filledText: `${formatNumber(actionReadyCount)} rekomendasi dari ${formatNumber(priorityReviewCount)} prioritas`,
  });
  const highRiskBranchHelper = metricHelperText({
    empty: priorityBranches.length === 0,
    emptyText: "Tidak ada cabang risiko tinggi",
    filledText: `${formatNumber(priorityBranches.length)} cabang perlu dipantau`,
  });
  const healthTone = isLoading ? "warning checking" : data?.health.status === "ok" ? "ok" : "warning";
  const healthLabel = isLoading ? "Cek sistem" : data?.health.status === "ok" ? "Sistem sehat" : "Sistem perlu dicek";

  return (
    <AppShell>
      <header className="page-header dashboard-hero-header">
        <div>
          <p className="kicker">Dashboard</p>
          <h1>Pusat Pantau Review Indonesia</h1>
          <span>Pantau reputasi cabang, sinyal kritis, dan prioritas tindak lanjut lintas lokasi Hermina.</span>
        </div>
        <div className="dashboard-header-actions">
          <span className={`health-pill ${healthTone}`}>{healthLabel}</span>
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Muat ulang
          </button>
        </div>
      </header>

      {error ? <BackendWarning error={error} /> : null}

      <section className="dashboard-intelligence">
        <section className="dashboard-filter-bar" aria-label="Dashboard filters">
          <label>
            <span>Rentang waktu</span>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DashboardDateRange)}>
              <option value="all">Semua waktu</option>
              <option value="30">30 hari terakhir</option>
              <option value="90">90 hari terakhir</option>
            </select>
          </label>
          <label>
            <span>Sumber</span>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">Semua sumber</option>
              {sourceOptions.map((source) => <option value={source} key={source}>{source}</option>)}
            </select>
          </label>
          <label>
            <span>Lokasi</span>
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
              <option value="all">Semua lokasi</option>
              {(data?.locations.items ?? []).map((location) => (
                <option value={location.id} key={location.id}>{location.branch_name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Level risiko</span>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as DashboardRiskFilter)}>
              <option value="all">Semua risiko</option>
              <option value="critical">Kritis</option>
              <option value="watch">Perlu dipantau</option>
              <option value="stable">Stabil</option>
            </select>
          </label>
          <label>
            <span>Cari cabang</span>
            <input
              type="search"
              value={branchSearch}
              onChange={(event) => setBranchSearch(event.target.value)}
              placeholder="Cari cabang atau kota..."
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setDateRange("all");
              setSourceFilter("all");
              setLocationFilter("all");
              setRiskFilter("all");
              setBranchSearch("");
            }}
            disabled={!hasActiveFilters}
          >
            Reset
          </button>
        </section>

        <div className="dashboard-kpi-strip">
          <CompactMetric
            label="Total Review"
            value={formatNumber(totalReviewsValue)}
            helper={totalReviewHelper}
            icon={<MessageCircle aria-hidden="true" size={16} />}
          />
          <CompactMetric
            label="Rating Rata-rata"
            value={averageRating ? averageRating.toFixed(1) : "—"}
            helper={averageRatingHelper}
            icon={<Star aria-hidden="true" size={16} />}
            tone="positive"
          />
          <CompactMetric
            label="Review Negatif"
            value={formatNumber(negativeCount)}
            helper={negativeHelper}
            icon={<Frown aria-hidden="true" size={16} />}
            tone="danger"
          />
          <CompactMetric
            label="Belum Dibalas"
            value={formatNumber(unansweredCount)}
            helper={unansweredHelper}
            icon={<MessageCircle aria-hidden="true" size={16} />}
            tone="warning"
          />
          <CompactMetric
            label="SLA Follow Up"
            value={`${followUpCoverage}%`}
            helper={followUpHelper}
            icon={<ShieldCheck aria-hidden="true" size={16} />}
            tone="info"
          />
          <CompactMetric
            label="Cabang Risiko Tinggi"
            value={formatNumber(priorityBranches.length)}
            helper={highRiskBranchHelper}
            icon={<AlertTriangle aria-hidden="true" size={16} />}
          />
        </div>

        <section className="dashboard-view-tabs" aria-label="Dashboard view">
          <button type="button" className={activeView === "map" ? "active" : ""} onClick={() => setActiveView("map")}>
            <MapIcon aria-hidden="true" size={15} /> Peta
          </button>
          <button type="button" className={activeView === "chart" ? "active" : ""} onClick={() => setActiveView("chart")}>
            <BarChart3 aria-hidden="true" size={15} /> Grafik
          </button>
          <button type="button" className={activeView === "insight" ? "active" : ""} onClick={() => setActiveView("insight")}>
            <Lightbulb aria-hidden="true" size={15} /> Wawasan
          </button>
        </section>

        <section className={`map-intelligence-grid ${activeView === "map" ? "" : "single-column"}`}>
          <div className="map-main-column">
            <article className={`panel page-panel map-panel dashboard-view-panel ${activeView === "chart" ? "chart-view-panel" : ""} ${activeView === "insight" ? "insight-view-panel" : ""}`}>
              {activeView === "map" ? (
                <>
                  <SectionHeader
                    kicker="Peta Risiko Cabang"
                    title="Sebaran risiko cabang"
                    helper="Risiko rendah, sedang, tinggi, dan sangat tinggi berdasarkan lokasi cabang."
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
                  <div className="dashboard-chart-grid">
                    <article className="panel page-panel chart-section-card trend-section-card">
                      <SectionHeader
                        kicker="Tren"
                        title="Trend Rating & Volume Review"
                        helper="Pergerakan rating rata-rata dan jumlah review."
                        action={<span className="map-meta">{formatNumber(scopedReviews.length)} review</span>}
                      />
                      <div className="trend-legend" aria-hidden="true">
                        <span className="rating-line">Rating rata-rata</span>
                        <span className="volume-line">Jumlah review</span>
                      </div>
                      {trendBuckets.length ? (
                        <div className="trend-line-chart">
                          <div className="trend-line-plot">
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                              <line x1="0" x2="100" y1="14" y2="14" />
                              <line x1="0" x2="100" y1="53" y2="53" />
                              <line x1="0" x2="100" y1="92" y2="92" />
                              <polyline points={trendPolyline} />
                              {trendLinePoints.map((point, index) => (
                                <circle cx={point.x} cy={point.y} key={`${point.x}-${index}`} r="2.2" />
                              ))}
                            </svg>
                            <div className="trend-volume-bars" style={{ gridTemplateColumns: `repeat(${trendBuckets.length}, minmax(22px, 1fr))` }}>
                              {trendBuckets.map((bucket) => (
                                <i
                                  aria-label={`${bucket.label}: ${formatNumber(bucket.volume)} review`}
                                  key={bucket.label}
                                  style={{ height: `${Math.max(8, (bucket.volume / trendMaxVolume) * 100)}%` }}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="trend-axis-labels" style={{ gridTemplateColumns: `repeat(${trendBuckets.length}, minmax(0, 1fr))` }}>
                            {trendBuckets.map((bucket) => (
                              <span key={bucket.label}>
                                <strong>{bucket.rating ? bucket.rating.toFixed(1) : "—"}</strong>
                                {bucket.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : !isLoading ? (
                        <div className="chart-empty-state">
                          <EmptyState title="Belum ada tren" detail="Belum ada review pada filter ini." />
                        </div>
                      ) : null}
                    </article>
                    <article className="panel page-panel chart-section-card">
                      <SectionHeader kicker="Rating" title="Distribusi Rating Bintang" helper="Komposisi rating dari review yang sedang difilter." />
                      <div className="rating-distribution-grid">
                        <div className="doughnut-chart rating-doughnut" style={ratingDoughnutStyle}>
                          <div>
                            <strong>{formatNumber(ratingTotal)}</strong>
                            <span>review</span>
                          </div>
                        </div>
                        <div className="rating-list">
                          {ratingDistribution.map((item) => (
                            <div className={`rating-row metric-${ratingTone(item.rating)} rating-${item.rating}`} key={item.rating}>
                              <span>{item.rating} Bintang</span>
                              <div><i style={{ width: `${ratingTotal ? Math.max(4, (item.count / ratingTotal) * 100) : 0}%` }} /></div>
                              <strong>{formatNumber(item.count)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                    <article className="panel page-panel chart-section-card top-issue-chart-card">
                      <SectionHeader kicker="Isu Utama" title="Top Issue dari Google Review" helper="Kategori keluhan yang paling sering muncul." />
                      <div className="issue-bar-list">
                        {topIssues.slice(0, 7).map((issue) => {
                          return (
                            <div className="issue-bar-row dashboard-issue-row" key={issue.issue}>
                              <span>{issueLabel(issue.issue)}</span>
                              <div><i style={{ width: `${Math.max(5, (issue.count / maxTopIssue) * 100)}%` }} /></div>
                              <strong>{formatNumber(issue.count)}</strong>
                            </div>
                          );
                        })}
                        {!isLoading && topIssues.length === 0 ? (
                          <div className="chart-empty-state">
                            <EmptyState title="Belum ada isu" detail="Belum ada kategori keluhan untuk filter ini." />
                          </div>
                        ) : null}
                      </div>
                    </article>
                  </div>
                </>
              ) : (
                <>
                  <div className="insight-tab-grid">
                    <article className="panel page-panel insight-tab-card">
                      <SectionHeader
                        kicker="AI Insight Summary"
                        title="✨ Ringkasan insight AI"
                        helper="Hal utama yang perlu diperhatikan dari data review."
                        action={<span className="map-meta">{formatNumber(actionReadyCount)} rekomendasi siap</span>}
                      />
                      <div className="insight-risk-block">
                        <div className="insight-risk-column">
                          <div className="insight-risk-title">
                            <strong>Ringkasan Risiko Cabang</strong>
                            <span>Merah = kritis, oranye = perlu dipantau, hijau = stabil.</span>
                          </div>
                          <div className="insight-risk-list">
                            <div className="insight-risk-row risk-red">
                              <i />
                              <div>
                                <strong>{formatNumber(criticalBranchCount)} cabang kritis</strong>
                                <span>Perlu perhatian operasional paling cepat.</span>
                              </div>
                            </div>
                            <div className="insight-risk-row risk-orange">
                              <i />
                              <div>
                                <strong>{formatNumber(watchBranchCount)} cabang perlu dipantau</strong>
                                <span>Risiko sedang dari rating atau review negatif.</span>
                              </div>
                            </div>
                            <div className="insight-risk-row risk-green">
                              <i />
                              <div>
                                <strong>{formatNumber(stableBranchCount)} cabang stabil</strong>
                                <span>Tidak ada sinyal risiko tinggi pada filter ini.</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="insight-risk-column">
                          <div className="insight-risk-title">
                            <strong>Rekomendasi Utama</strong>
                            <span>Prioritas tindak lanjut dari filter aktif.</span>
                          </div>
                          <div className="insight-recommendation-list">
                            <div>
                              <i />
                              <span>{topIssues[0] ? `Prioritaskan isu ${issueLabel(topIssues[0].issue)}.` : "Belum ada isu dominan untuk diprioritaskan."}</span>
                            </div>
                            <div>
                              <i />
                              <span>{priorityBranches.length ? `Pantau ${formatNumber(priorityBranches.length)} cabang dengan risiko tertinggi.` : "Pertahankan performa cabang stabil."}</span>
                            </div>
                            <div>
                              <i />
                              <span>{unansweredCount ? `Balas ${formatNumber(unansweredCount)} review yang belum direspons.` : "Tidak ada backlog respons review pada filter ini."}</span>
                            </div>
                            <div>
                              <i />
                              <span>{actionReadyCount ? `${formatNumber(actionReadyCount)} rekomendasi tindak lanjut sudah siap.` : "Belum ada rekomendasi tindak lanjut dari AI."}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>

                    <article className="panel page-panel insight-tab-card">
                      <SectionHeader kicker="Tindak Lanjut" title="Action & follow up terintegrasi" helper="Daftar tindak lanjut yang bisa diprioritaskan tim operasional." />
                      <div className="action-followup-table">
                        <div className="action-followup-head">
                          <span>Cabang</span>
                          <span>Isu</span>
                          <span>Unit owner</span>
                          <span>PIC</span>
                          <span>SLA</span>
                          <span>Tindak lanjut</span>
                          <span>Status</span>
                          <span>Aksi</span>
                        </div>
                        {displayedActionRows.map((row) => (
                          <div className="action-followup-row" key={row.key}>
                            <strong>{row.branch}</strong>
                            <span>{row.issue ? issueLabel(row.issue) : "Belum ada isu"}</span>
                            <span>{row.unit}</span>
                            <span>{row.pic}</span>
                            <span>{row.sla}</span>
                            <p>{row.action}</p>
                            <Badge tone={row.tone}>{row.status}</Badge>
                            <a href={row.href}>Buka review</a>
                          </div>
                        ))}
                        {!isLoading && displayedActionRows.length === 0 ? (
                          <EmptyState title="Belum ada tindak lanjut" detail="Action tracker akan terisi setelah ada review atau cabang aktif." />
                        ) : null}
                      </div>
                    </article>
                  </div>
                </>
              )}
            </article>

            {activeView === "map" ? (
              <article className="panel page-panel recent-negative-panel">
                <SectionHeader
                  kicker="Review Negatif Terbaru"
                  title="Review negatif terbaru"
                  helper="Review yang perlu dicek lebih dulu setelah melihat sebaran cabang."
                  action={<a className="map-meta" href="/reviews?sentiment=negative">Lihat semua</a>}
                />
                <div className="recent-negative-list">
                  {recentNegativeReviews.map((review) => (
                    <article className="recent-negative-row" key={review.id}>
                      <div className="negative-signal-icon">
                        <Frown aria-hidden="true" size={15} />
                      </div>
                      <div className="negative-review-main">
                        <div className="negative-review-meta">
                          <RatingStars rating={review.rating} />
                          <strong>{review.location}</strong>
                          <span>{formatDate(review.review_time)}</span>
                        </div>
                        <p>{reviewExcerpt(review.review_text)}</p>
                      </div>
                      <div className="review-inbox-actions">
                        <a href={`/reviews?location_id=${review.location_id}`}>Balas</a>
                        <button type="button" disabled>{review.recommended_action ? "Buat action" : "Assign"}</button>
                      </div>
                    </article>
                  ))}
                  {!isLoading && recentNegativeReviews.length === 0 ? (
                    <EmptyState title="Belum ada review negatif" detail="Tidak ada review negatif pada filter ini." />
                  ) : null}
                </div>
              </article>
            ) : null}

          </div>

          {activeView === "map" ? (
            <aside className="panel page-panel risk-panel">
              <SectionHeader
                kicker="Ringkasan Risiko"
                title={priorityBranches.length ? `${formatNumber(priorityBranches.length)} cabang perlu dipantau` : "Semua cabang stabil"}
                helper={`Update terakhir: ${formatDate(data?.latestFetch.item?.started_at)}`}
              />
              <dl className="risk-snapshot">
                <div className="metric-danger"><dt>Kritis</dt><dd>{formatNumber(criticalBranchCount)}</dd></div>
                <div className="metric-warning"><dt>Perlu dipantau</dt><dd>{formatNumber(watchBranchCount)}</dd></div>
                <div className="metric-neutral"><dt>Isu utama</dt><dd>{topIssues[0] ? issueLabel(topIssues[0].issue) : "Belum ada"}</dd></div>
                <div className="metric-info"><dt>Cakupan AI</dt><dd>{analysisCoverage}%</dd></div>
              </dl>
              <div className="risk-list-heading">
                <div>
                  <strong>Prioritas cabang</strong>
                  <span>{rankedBranches.length > 1 ? "Diurutkan dari risiko tertinggi." : "Akan berisi beberapa cabang saat data bertambah."}</span>
                </div>
                <a href="/reviews">Lihat semua review</a>
              </div>
              <div className="risk-summary-list">
                {rankedBranches.slice(0, 5).map((branch) => (
                  <a className="risk-summary-row" href={`/reviews?location_id=${branch.id}`} key={branch.id}>
                    <div>
                      <strong>{branch.name}</strong>
                      <span>{branch.city ?? "Tanpa kota"} · {formatNumber(branch.reviews)} review</span>
                    </div>
                    <Badge tone={branch.risk === "critical" ? "critical" : branch.risk === "watch" ? "warning" : "positive"}>
                      {riskLabel(branch.risk)}
                    </Badge>
                  </a>
                ))}
              </div>
              <div className="priority-action-list compact">
                <a href="/analysis"><Activity aria-hidden="true" size={14} /> Analisis {formatNumber(data?.overview.pending_analysis)} review tertunda</a>
                <a href="/fetch-jobs"><DatabaseZap aria-hidden="true" size={14} /> Update review cabang aktif</a>
                <a href="/locations"><Building2 aria-hidden="true" size={14} /> Lengkapi {formatNumber(missingCoordinates)} koordinat</a>
              </div>
            </aside>
          ) : null}
        </section>

        {activeView === "map" ? (
          <section className="map-followup-grid">
            <article className="panel page-panel branch-distribution-panel monitoring-panel">
              <SectionHeader
                kicker="Monitoring Cabang"
                title="Monitoring cabang"
                helper="Performa cabang berdasarkan review pada filter aktif."
                action={<a className="map-meta" href="/locations">Lihat semua cabang</a>}
              />
              <div className="monitoring-table">
                <div className="monitoring-head">
                  <span>Cabang</span>
                  <span>Rating</span>
                  <span>Total review</span>
                  <span>Review negatif</span>
                  <span>Belum dibalas</span>
                  <span>Review terakhir</span>
                  <span>Status</span>
                </div>
                {rankedBranches.slice(0, 5).map((branch) => {
                  const negativePercent = branch.reviews ? Math.round((branch.negativeCount / branch.reviews) * 100) : 0;
                  return (
                    <a className="monitoring-row" href={`/reviews?location_id=${branch.id}`} key={branch.id}>
                      <span className="monitoring-branch">
                        <MapPin aria-hidden="true" size={14} />
                        <strong>{branch.name}</strong>
                      </span>
                      <span className="monitoring-rating">
                        <b>{branch.averageRating ? branch.averageRating.toFixed(1) : "—"}</b>
                        <RatingStars rating={branch.averageRating} />
                      </span>
                      <span>{formatNumber(branch.reviews)}</span>
                      <span>{formatNumber(branch.negativeCount)} ({negativePercent}%)</span>
                      <span>{formatNumber(branch.unansweredCount)}</span>
                      <span>{branch.latestReview}</span>
                      <Badge tone={branch.risk === "critical" ? "critical" : branch.risk === "watch" ? "warning" : "positive"}>
                        {monitoringStatusLabel(branch.risk)}
                      </Badge>
                    </a>
                  );
                })}
                {!isLoading && rankedBranches.length === 0 ? (
                  <EmptyState title="Belum ada cabang" detail="Tidak ada cabang pada filter ini." />
                ) : null}
              </div>
            </article>

          </section>
        ) : null}

      </section>
    </AppShell>
  );
}
