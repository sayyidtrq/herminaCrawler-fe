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
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Pencil,
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
type DashboardView = "map" | "chart";
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

function actionToneForStatus(status: string): DashboardBadgeTone {
  const normalized = status.toLowerCase();
  if (normalized.includes("resolved") || normalized.includes("selesai")) return "positive";
  if (normalized.includes("progress")) return "info";
  if (normalized.includes("waiting") || normalized.includes("tunggu") || normalized.includes("open")) return "warning";
  if (normalized.includes("kritis") || normalized.includes("critical")) return "critical";
  return "neutral";
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
  const [manualActionRows, setManualActionRows] = useState<ActionTrackerRow[]>([]);
  const [actionOverrides, setActionOverrides] = useState<Record<string, Partial<ActionTrackerRow>>>({});
  const [editingAction, setEditingAction] = useState<ActionTrackerRow | null>(null);
  const [actionEditForm, setActionEditForm] = useState({ action: "", pic: "", sla: "", status: "" });

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
        .filter((review) => typeof review.rating === "number" && review.rating <= 2)
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
  const trendVolumeLinePoints = trendBuckets.map((bucket, index) => {
    const x = trendBuckets.length <= 1 ? 50 : (index / (trendBuckets.length - 1)) * 100;
    const y = 92 - (bucket.volume / trendMaxVolume) * 58;
    return { x, y };
  });
  const trendPolyline = trendLinePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const trendVolumePolyline = trendVolumeLinePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const trendVolumeArea = trendVolumeLinePoints.length
    ? `0,92 ${trendVolumePolyline} 100,92`
    : "";
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
  const baseActionRows = manualActionRows.length || actionTrackerRows.length
    ? [...manualActionRows, ...actionTrackerRows].slice(0, 5)
    : defaultActionRows;
  const displayedActionRows = baseActionRows.map((row) => ({ ...row, ...(actionOverrides[row.key] ?? {}) }));
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

  function reviewActionKey(review: Review) {
    return `review-${review.id}`;
  }

  function scrollToActionTracker() {
    window.requestAnimationFrame(() => {
      document.getElementById("dashboard-action-followup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function createActionFromReview(review: Review) {
    const key = reviewActionKey(review);
    const row: ActionTrackerRow = {
      key,
      branch: review.location,
      issue: review.issue_category,
      action: review.recommended_action || "Hubungi pasien dan catat tindak lanjut review.",
      unit: ownerUnitForIssue(review.issue_category),
      pic: "Belum ditugaskan",
      sla: review.urgency === "critical" || review.urgency === "high" || (review.rating ?? 5) <= 1 ? "4 jam" : "24 jam",
      status: "Draft",
      tone: "neutral",
      href: `/reviews?location_id=${review.location_id}`,
    };

    setManualActionRows((current) => {
      if (current.some((item) => item.key === key)) return current;
      return [row, ...current].slice(0, 5);
    });
    scrollToActionTracker();
  }

  function openActionEditor(row: ActionTrackerRow) {
    setEditingAction(row);
    setActionEditForm({
      action: row.action,
      pic: row.pic,
      sla: row.sla,
      status: row.status,
    });
  }

  function saveActionEdit() {
    if (!editingAction) return;
    setActionOverrides((current) => ({
      ...current,
      [editingAction.key]: {
        action: actionEditForm.action.trim() || editingAction.action,
        pic: actionEditForm.pic.trim() || "Belum ditugaskan",
        sla: actionEditForm.sla.trim() || editingAction.sla,
        status: actionEditForm.status,
        tone: actionToneForStatus(actionEditForm.status),
      },
    }));
    setEditingAction(null);
  }

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
        </section>

        <section className={`map-intelligence-grid ${activeView === "map" ? "" : "single-column"}`}>
          <div className="map-main-column">
            <article className={`panel page-panel map-panel dashboard-view-panel ${activeView === "chart" ? "chart-view-panel" : ""}`}>
              {activeView === "map" ? (
                <>
                  <SectionHeader
                    kicker="Peta Risiko Cabang"
                    title="Sebaran risiko cabang"
                    action={<span className="map-meta">{formatNumber(mapMarkers.length)} lokasi tampil</span>}
                  />
                  {isLoading ? <EmptyState title="Memuat peta" detail="Mengambil data cabang terbaru." /> : null}
                  {!isLoading && mapMarkers.length > 0 ? <DashboardMap markers={mapMarkers} /> : null}
                  {!isLoading && mapMarkers.length === 0 ? (
                    <EmptyState title="Belum ada lokasi di peta" detail="Lengkapi data kota atau koordinat cabang." />
                  ) : null}
                </>
              ) : (
                <>
                  <div className="dashboard-chart-grid">
                    <article className="panel page-panel chart-section-card trend-section-card">
                      <SectionHeader
                        kicker="Tren"
                        title="Trend Rating & Volume Review"
                        action={<span className="map-meta">{formatNumber(scopedReviews.length)} review</span>}
                      />
                      <div className="trend-legend" aria-hidden="true">
                        <span className="rating-line">Rating rata-rata</span>
                        <span className="volume-line">Jumlah review</span>
                      </div>
                      {trendBuckets.length ? (
                        <div className="trend-line-chart">
                          <div className="trend-line-plot">
                            <div className="trend-y-axis trend-y-axis-left" aria-hidden="true">
                              <span>5.0</span>
                              <span>4.0</span>
                              <span>3.0</span>
                              <span>2.0</span>
                              <span>1.0</span>
                            </div>
                            <div className="trend-y-axis trend-y-axis-right" aria-hidden="true">
                              <span>{formatNumber(trendMaxVolume)}</span>
                              <span>{formatNumber(Math.round(trendMaxVolume / 2))}</span>
                              <span>0</span>
                            </div>
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                              <line x1="0" x2="100" y1="14" y2="14" />
                              <line x1="0" x2="100" y1="33.5" y2="33.5" />
                              <line x1="0" x2="100" y1="53" y2="53" />
                              <line x1="0" x2="100" y1="72.5" y2="72.5" />
                              <line x1="0" x2="100" y1="92" y2="92" />
                              <polygon className="trend-volume-area" points={trendVolumeArea} />
                              <polyline className="trend-volume-line" points={trendVolumePolyline} />
                              {trendVolumeLinePoints.map((point, index) => (
                                <circle className="trend-volume-dot" cx={point.x} cy={point.y} key={`volume-${point.x}-${index}`} r="1.15" />
                              ))}
                              <polyline className="trend-rating-line" points={trendPolyline} />
                              {trendLinePoints.map((point, index) => (
                                <circle className="trend-rating-dot" cx={point.x} cy={point.y} key={`rating-${point.x}-${index}`} r="1.15" />
                              ))}
                              {trendLinePoints.map((point, index) => (
                                <text className="trend-rating-label" x={point.x} y={Math.max(8, point.y - 7)} key={`rating-label-${point.x}-${index}`}>
                                  {trendBuckets[index].rating ? trendBuckets[index].rating.toFixed(1) : "—"}
                                </text>
                              ))}
                              {trendVolumeLinePoints.map((point, index) => (
                                <text className="trend-volume-label" x={point.x} y={Math.min(96, point.y + 11)} key={`volume-label-${point.x}-${index}`}>
                                  {formatNumber(trendBuckets[index].volume)}
                                </text>
                              ))}
                            </svg>
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
                      <SectionHeader kicker="Rating" title="Distribusi Rating Bintang" />
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
                      <SectionHeader kicker="Isu Utama" title="Top Issue dari Google Review" />
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
              )}
            </article>

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
            <div className="map-followup-left">
              <article className="panel page-panel recent-negative-panel">
                <SectionHeader
                  kicker="Review Negatif Terbaru"
                  title="Review negatif terbaru"
                  action={<a className="map-meta" href="/reviews?rating_max=2">Lihat semua</a>}
                />
                <div className="recent-negative-list">
                  {recentNegativeReviews.map((review) => {
                    const actionExists = displayedActionRows.some((row) => row.key === reviewActionKey(review));
                    return (
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
                          <button type="button" onClick={() => createActionFromReview(review)}>
                            {actionExists ? "Action dibuat" : "Buat action"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!isLoading && recentNegativeReviews.length === 0 ? (
                    <EmptyState title="Belum ada review negatif" detail="Tidak ada review rating 1-2 pada filter ini." />
                  ) : null}
                </div>
              </article>

              <article className="panel page-panel branch-distribution-panel monitoring-panel">
                <SectionHeader
                  kicker="Monitoring Cabang"
                  title="Monitoring cabang"
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
                <div className="monitoring-footer">
                  <a href="/locations">Lihat semua cabang</a>
                </div>
              </article>
            </div>

            <aside className="map-followup-right">
              <article className="panel page-panel insight-tab-card">
                <SectionHeader
                  kicker="AI Insight Summary"
                  title="Ringkasan insight AI"
                  action={<a className="map-meta" href="/insights">Buka Insights</a>}
                />
                <div className="insight-risk-block">
                  <div className="insight-risk-column">
                    <div className="insight-risk-title">
                      <strong>Ringkasan Risiko Cabang</strong>
                    </div>
                    <div className="insight-risk-list">
                      <div className="insight-risk-row risk-red">
                        <i />
                        <div>
                          <strong>{formatNumber(criticalBranchCount)} cabang kritis</strong>
                          <span>Butuh eskalasi paling cepat.</span>
                        </div>
                      </div>
                      <div className="insight-risk-row risk-orange">
                        <i />
                        <div>
                          <strong>{formatNumber(watchBranchCount)} perlu dipantau</strong>
                          <span>Rating atau review negatif mulai naik.</span>
                        </div>
                      </div>
                      <div className="insight-risk-row risk-green">
                        <i />
                        <div>
                          <strong>{formatNumber(stableBranchCount)} cabang stabil</strong>
                          <span>Tidak ada sinyal risiko tinggi.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="insight-risk-column">
                    <div className="insight-risk-title">
                      <strong>Rekomendasi Utama</strong>
                    </div>
                    <div className="insight-recommendation-list">
                      <div>
                        <i />
                        <span>{topIssues[0] ? `Prioritaskan isu ${issueLabel(topIssues[0].issue)}.` : "Belum ada isu dominan."}</span>
                      </div>
                      <div>
                        <i />
                        <span>{priorityBranches.length ? `Pantau ${formatNumber(priorityBranches.length)} cabang prioritas.` : "Cabang stabil."}</span>
                      </div>
                      <div>
                        <i />
                        <span>{unansweredCount ? `Balas ${formatNumber(unansweredCount)} review belum dibalas.` : "Tidak ada backlog respons."}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </aside>

            <div className="dashboard-action-followup-section" id="dashboard-action-followup">
              <article className="panel page-panel insight-tab-card">
                <SectionHeader kicker="Tindak Lanjut" title="Action & follow up terintegrasi" />
                <div className="action-followup-table">
                  <div className="action-followup-head">
                    <span>Sumber</span>
                    <span>Cabang</span>
                    <span>Issue</span>
                    <span>Jenis tindakan</span>
                    <span>PIC</span>
                    <span>SLA</span>
                    <span>Status</span>
                    <span>Aksi</span>
                  </div>
                  {displayedActionRows.map((row) => (
                    <div className="action-followup-row" key={row.key}>
                      <span className="source-avatar" aria-label="Google">G</span>
                      <strong>{row.branch}</strong>
                      <span>{row.issue ? issueLabel(row.issue) : "Belum ada isu"}</span>
                      <p>{row.action}</p>
                      <span>{row.pic}</span>
                      <span>{row.sla}</span>
                      <Badge tone={row.tone}>{row.status}</Badge>
                      <span className="action-followup-actions">
                        <a href={row.href} aria-label="Buka review" title="Buka review"><MessageCircle aria-hidden="true" size={13} /></a>
                        <button type="button" onClick={() => openActionEditor(row)} title="Edit PIC, SLA, dan status" aria-label="Edit tindak lanjut">
                          <Pencil aria-hidden="true" size={13} />
                        </button>
                      </span>
                    </div>
                  ))}
                  {!isLoading && displayedActionRows.length === 0 ? (
                    <EmptyState title="Belum ada tindak lanjut" detail="Action tracker akan terisi setelah ada review atau cabang aktif." />
                  ) : null}
                </div>
              </article>
            </div>

          </section>
        ) : null}

        {editingAction ? (
          <div className="action-edit-backdrop" role="presentation">
            <article className="panel page-panel action-edit-modal" role="dialog" aria-modal="true" aria-label="Edit tindak lanjut">
              <SectionHeader kicker="Edit Tindak Lanjut" title="Update action tracker" />
              <form
                className="action-edit-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveActionEdit();
                }}
              >
                <label>
                  <span>PIC</span>
                  <input
                    value={actionEditForm.pic}
                    onChange={(event) => setActionEditForm((current) => ({ ...current, pic: event.target.value }))}
                    placeholder="Nama PIC"
                  />
                </label>
                <label>
                  <span>SLA</span>
                  <input
                    value={actionEditForm.sla}
                    onChange={(event) => setActionEditForm((current) => ({ ...current, sla: event.target.value }))}
                    placeholder="Contoh: 24 jam"
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={actionEditForm.status}
                    onChange={(event) => setActionEditForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option>Draft</option>
                    <option>Open</option>
                    <option>In Progress</option>
                    <option>Waiting</option>
                    <option>Resolved</option>
                  </select>
                </label>
                <label className="action-edit-wide">
                  <span>Jenis tindakan</span>
                  <textarea
                    value={actionEditForm.action}
                    onChange={(event) => setActionEditForm((current) => ({ ...current, action: event.target.value }))}
                    rows={3}
                  />
                </label>
                <div className="action-edit-buttons">
                  <button type="button" onClick={() => setEditingAction(null)}>Batal</button>
                  <button type="submit">Simpan</button>
                </div>
              </form>
            </article>
          </div>
        ) : null}

      </section>
    </AppShell>
  );
}
