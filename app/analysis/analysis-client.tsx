"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, RefreshCcw, Sparkles } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { fetchJson, postJson } from "../lib/api";
import { formatNumber } from "../lib/format";
import { issueLabel, sentimentLabel, toneForSentiment, toneForUrgency, urgencyLabel } from "../lib/review-labels";
import type { ActionMessage, Location, Overview, PublicSettings, Review } from "../lib/types";

export default function AnalysisClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoading(true);
    setError(null);
    try {
      const [locationPayload, settingsPayload, overviewPayload, reviewPayload] = await Promise.all([
        fetchJson<{ items: Location[]; total: number }>("/api/locations"),
        fetchJson<PublicSettings>("/api/settings"),
        fetchJson<Overview>("/api/dashboard/overview"),
        fetchJson<{ items: Review[]; total: number }>("/api/reviews?page_size=60&latest_first=true"),
      ]);
      setLocations(locationPayload.items);
      setSettings(settingsPayload);
      setOverview(overviewPayload);
      setReviews(reviewPayload.items);
      setSelectedLocationId((current) => current || locationPayload.items[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setOverview(null);
      setReviews([]);
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

  async function runAction(title: string, action: () => Promise<unknown>) {
    setIsActionRunning(true);
    setActionMessage({ type: "info", title, detail: "Request analysis sedang diproses backend..." });
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

  function selectedLocationOrNull() {
    return selectedLocationId ? Number(selectedLocationId) : null;
  }

  const analyzedCoverage = overview
    ? Math.round((overview.analyzed_reviews / Math.max(overview.total_reviews, 1)) * 100)
    : 0;
  const pendingReviews = useMemo(
    () => reviews.filter((review) => !review.sentiment && !review.issue_category && !review.recommended_action),
    [reviews],
  );
  const analyzedReviews = useMemo(
    () => reviews.filter((review) => review.sentiment || review.issue_category || review.recommended_action),
    [reviews],
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Analysis"
        title="AI analysis operations"
        helper="Jalankan pending analysis, rerun per location, dan monitor coverage analisis."
        action={
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading || isActionRunning}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh
          </button>
        }
      />

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      <section className="analysis-grid">
        <article className="panel page-panel">
          <SectionHeader
            kicker="Run Analysis"
            title="Analyze pending queue"
            helper={`Gemini mode: ${settings?.gemini_mode ?? "unknown"} · batch ${settings?.analysis_batch_size ?? "—"}`}
          />
          <div className="action-controls fetch-controls">
            <label>
              <span>Location Scope</span>
              <select value={selectedLocationId} onChange={(event) => setSelectedLocationId(Number(event.target.value) || "")}>
                <option value="">Semua lokasi</option>
                {locations.map((location) => <option value={location.id} key={location.id}>{location.branch_name}</option>)}
              </select>
            </label>
            <label>
              <span>Rating Filter</span>
              <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)}>
                <option value="all">All ratings</option>
                <option value="1">1 star</option>
                <option value="2">2 stars</option>
                <option value="3">3 stars</option>
                <option value="4">4 stars</option>
                <option value="5">5 stars</option>
              </select>
            </label>
            <div className="button-row">
              <button
                type="button"
                className="primary-action"
                disabled={isActionRunning}
                onClick={() => runAction("Analyze Pending", () => postJson("/api/analysis/pending", {
                  location_id: selectedLocationOrNull(),
                  rating: ratingFilter === "all" ? null : Number(ratingFilter),
                }))}
              >
                <Bot aria-hidden="true" size={15} /> Analyze pending
              </button>
              <button
                type="button"
                disabled={isActionRunning || !selectedLocationId}
                onClick={() => runAction("Rerun Location Analysis", () => postJson(`/api/analysis/locations/${selectedLocationId}/rerun`))}
              >
                <RefreshCcw aria-hidden="true" size={15} /> Rerun location
              </button>
            </div>
          </div>
        </article>

        <article className="panel page-panel">
          <SectionHeader kicker="Coverage" title={`${analyzedCoverage}% analyzed`} helper="Coverage dihitung dari summary backend." />
          <div className="coverage-ring" style={{ "--coverage": `${analyzedCoverage}%` } as React.CSSProperties}>
            <strong>{analyzedCoverage}%</strong>
            <span>analyzed</span>
          </div>
          <dl className="settings-list">
            <div><dt>Total Reviews</dt><dd>{formatNumber(overview?.total_reviews)}</dd></div>
            <div><dt>Analyzed</dt><dd>{formatNumber(overview?.analyzed_reviews)}</dd></div>
            <div><dt>Pending</dt><dd>{formatNumber(overview?.pending_analysis)}</dd></div>
            <div><dt>Critical</dt><dd>{formatNumber(overview?.critical_issues)}</dd></div>
          </dl>
        </article>

        <article className="panel page-panel">
          <SectionHeader kicker="Pending Window" title="Review belum dianalisis" helper="Sample dari latest review window." />
          {isLoading ? <EmptyState title="Loading analysis data" detail="Mengambil data dari backend..." /> : null}
          {!isLoading && pendingReviews.length === 0 ? <EmptyState title="Tidak ada pending sample" detail="Queue mungkin kosong atau review window sudah dianalisis." /> : null}
          <div className="compact-review-list">
            {pendingReviews.slice(0, 8).map((review) => (
              <div className="compact-review-row" key={review.id}>
                <div>
                  <strong>{review.location}</strong>
                  <p>{review.review_text || "Tidak ada teks review."}</p>
                </div>
                <button type="button" disabled={isActionRunning} onClick={() => runAction("Rerun Review Analysis", () => postJson(`/api/analysis/reviews/${review.id}/rerun`))}>
                  <Sparkles aria-hidden="true" size={14} /> Analyze
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="panel page-panel">
          <SectionHeader kicker="Analyzed Window" title="Hasil analisis terbaru" helper="Sample review yang sudah memiliki output AI." />
          <div className="compact-review-list">
            {analyzedReviews.slice(0, 8).map((review) => (
              <div className="compact-review-row analyzed" key={review.id}>
                <div>
                  <strong>{review.location}</strong>
                  <p>{review.recommended_action || review.review_text || "Tidak ada teks review."}</p>
                  <div className="signal-meta">
                    <Badge tone={toneForSentiment(review.sentiment)}>{sentimentLabel(review.sentiment)}</Badge>
                    <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                    <span>{issueLabel(review.issue_category)}</span>
                  </div>
                </div>
                <button type="button" disabled={isActionRunning} onClick={() => runAction("Rerun Review Analysis", () => postJson(`/api/analysis/reviews/${review.id}/rerun`))}>
                  <RefreshCcw aria-hidden="true" size={14} /> Rerun
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
