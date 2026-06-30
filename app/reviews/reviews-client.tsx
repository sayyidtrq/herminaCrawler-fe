"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { BackendWarning, Badge, PageHeader, SectionHeader } from "../components/ui";
import { fetchJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import { issueLabel, sentimentLabel, toneForSentiment, toneForUrgency, urgencyLabel } from "../lib/review-labels";
import type { Location, Review } from "../lib/types";

type ReviewsPayload = {
  items: Review[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export default function ReviewsClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviewsPayload, setReviewsPayload] = useState<ReviewsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [sentiment, setSentiment] = useState("all");
  const [rating, setRating] = useState("all");
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "20",
        latest_first: "true",
      });
      if (keyword.trim()) params.set("keyword", keyword.trim());
      if (locationId) params.set("location_id", String(locationId));
      if (sentiment !== "all") params.set("sentiment", sentiment);
      if (rating !== "all") params.set("rating", rating);

      const [locationPayload, reviewPayload] = await Promise.all([
        fetchJson<{ items: Location[]; total: number }>("/api/locations"),
        fetchJson<ReviewsPayload>(`/api/reviews?${params.toString()}`),
      ]);
      setLocations(locationPayload.items);
      setReviewsPayload(reviewPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setReviewsPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [keyword, locationId, page, rating, sentiment]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const reviews = useMemo(() => reviewsPayload?.items ?? [], [reviewsPayload?.items]);
  const totalPages = reviewsPayload?.total_pages ?? 1;
  const sentimentCounts = useMemo(() => {
    return reviews.reduce<Record<string, number>>((acc, review) => {
      const key = review.sentiment ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [reviews]);

  const reviewColumns: Array<DataTableColumn<Review>> = [
    {
      id: "review",
      header: "Review",
      accessor: (review) => `${review.location} ${review.reviewer_name} ${review.review_text} ${review.issue_category ?? ""}`,
      render: (review) => (
        <div className="table-review-cell">
          <strong>{review.location}</strong>
          <span>{review.reviewer_name || "Anonymous"} · {formatDate(review.review_time)}</span>
          <p>{review.review_text || "Tidak ada teks review."}</p>
          {review.recommended_action ? <em>{review.recommended_action}</em> : null}
        </div>
      ),
      width: "46%",
    },
    {
      id: "rating",
      header: "Rating",
      align: "right",
      accessor: (review) => review.rating,
      render: (review) => review.rating ? `${review.rating}/5` : "No rating",
    },
    {
      id: "sentiment",
      header: "Sentiment",
      render: (review) => <Badge tone={toneForSentiment(review.sentiment)}>{sentimentLabel(review.sentiment)}</Badge>,
    },
    {
      id: "urgency",
      header: "Urgency",
      render: (review) => <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>,
    },
    {
      id: "issue",
      header: "Issue",
      accessor: (review) => issueLabel(review.issue_category),
      render: (review) => <span className="table-muted">{issueLabel(review.issue_category)}</span>,
    },
    {
      id: "flags",
      header: "Flags",
      render: (review) => (
        <div className="table-badge-stack">
          {review.is_patient_safety_issue ? <Badge tone="critical">Safety</Badge> : null}
          {review.is_potential_viral ? <Badge tone="warning">Viral</Badge> : null}
          {!review.is_patient_safety_issue && !review.is_potential_viral ? <span className="table-muted">—</span> : null}
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reviews"
        title="Review intelligence feed"
        helper="Cari, filter, dan audit review mentah + hasil analisis AI dari backend."
        action={
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh
          </button>
        }
      />

      {error ? <BackendWarning error={error} /> : null}

      <section className="review-page-grid">
        <article className="panel page-panel panel-wide">
          <SectionHeader
            kicker="Feed"
            title="Loaded reviews"
            helper={`Page ${reviewsPayload?.page ?? 1} dari ${totalPages}. Total ${formatNumber(reviewsPayload?.total ?? 0)} review.`}
          />
          <DataTable
            title="Data review"
            description="Search, filter, dan pagination review dari backend."
            data={reviews}
            columns={reviewColumns}
            getRowKey={(review) => review.id}
            isLoading={isLoading}
            emptyTitle="Tidak ada review"
            emptyDetail="Ubah filter atau fetch review baru."
            searchPlaceholder="Cari keyword, keluhan, atau reviewer..."
            searchValue={keyword}
            onSearchChange={(value) => {
              setPage(1);
              setKeyword(value);
            }}
            page={page}
            pageSize={reviewsPayload?.page_size ?? 20}
            totalItems={reviewsPayload?.total ?? 0}
            onPageChange={setPage}
            manualPagination
            filters={
              <>
                <select value={locationId} onChange={(event) => { setPage(1); setLocationId(Number(event.target.value) || ""); }}>
                  <option value="">Semua lokasi</option>
                  {locations.map((location) => <option value={location.id} key={location.id}>{location.branch_name}</option>)}
                </select>
                <select value={sentiment} onChange={(event) => { setPage(1); setSentiment(event.target.value); }}>
                  <option value="all">All sentiment</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                  <option value="mixed">Mixed</option>
                </select>
                <select value={rating} onChange={(event) => { setPage(1); setRating(event.target.value); }}>
                  <option value="all">All rating</option>
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                  <option value="2">2 stars</option>
                  <option value="1">1 star</option>
                </select>
              </>
            }
          />
        </article>

        <aside className="panel page-panel">
          <SectionHeader kicker="Window Summary" title="Sentiment window" helper="Ringkasan dari page review yang sedang termuat." />
          <dl className="settings-list">
            <div><dt>Positive</dt><dd>{formatNumber(sentimentCounts.positive ?? 0)}</dd></div>
            <div><dt>Neutral</dt><dd>{formatNumber(sentimentCounts.neutral ?? 0)}</dd></div>
            <div><dt>Negative</dt><dd>{formatNumber(sentimentCounts.negative ?? 0)}</dd></div>
            <div><dt>Mixed</dt><dd>{formatNumber(sentimentCounts.mixed ?? 0)}</dd></div>
          </dl>
        </aside>
      </section>
    </AppShell>
  );
}
