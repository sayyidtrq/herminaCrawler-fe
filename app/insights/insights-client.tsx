"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCcw, ShieldAlert, Sparkles, TrendingDown } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { BackendWarning, Badge, EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { fetchJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import { issueLabel, toneForUrgency, urgencyLabel } from "../lib/review-labels";
import type { Overview, Review } from "../lib/types";

type InsightReview = {
  location: string;
  rating: number | null;
  review_text: string;
  issue_category: string | null;
  urgency: string | null;
  recommended_action?: string | null;
};

export default function InsightsClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [criticalReviews, setCriticalReviews] = useState<InsightReview[]>([]);
  const [negativeReviews, setNegativeReviews] = useState<InsightReview[]>([]);
  const [recommendationReviews, setRecommendationReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewPayload, criticalPayload, negativePayload, reviewsPayload] = await Promise.all([
        fetchJson<Overview>("/api/dashboard/overview"),
        fetchJson<{ items: InsightReview[]; total: number }>("/api/dashboard/critical-issues"),
        fetchJson<{ items: InsightReview[]; total: number }>("/api/dashboard/negative-reviews"),
        fetchJson<{ items: Review[]; total: number }>("/api/reviews?page_size=120&latest_first=true"),
      ]);
      setOverview(overviewPayload);
      setCriticalReviews(criticalPayload.items);
      setNegativeReviews(negativePayload.items);
      setRecommendationReviews(reviewsPayload.items.filter((review) => review.recommended_action));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setOverview(null);
      setCriticalReviews([]);
      setNegativeReviews([]);
      setRecommendationReviews([]);
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

  const topIssues = useMemo(() => {
    return (overview?.top_issues ?? []).map((row) => ({
      label: issueLabel(String(row.issue_category ?? row.category ?? "other")),
      count: Number(row.count ?? 0),
    }));
  }, [overview?.top_issues]);

  const negativeCount = overview?.sentiments.negative ?? 0;
  const criticalCount = overview?.critical_issues ?? 0;
  const riskScore = Math.min(100, criticalCount * 18 + negativeCount * 4);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Insights"
        title="Operational intelligence"
        helper="Insight ringkas untuk patient safety, reputasi, issue dominan, dan rekomendasi tindakan."
        action={
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh
          </button>
        }
      />

      {error ? <BackendWarning error={error} /> : null}

      <section className="insights-grid">
        <article className="panel page-panel risk-card">
          <SectionHeader kicker="Risk Signal" title={`${riskScore}% reputation risk`} helper="Heuristic dari critical signals + negative sentiment." />
          <div className="risk-score-orb" style={{ "--coverage": `${riskScore}%` } as React.CSSProperties}>
            <strong>{riskScore}%</strong>
            <span>risk</span>
          </div>
          <div className="insight-kpi-row">
            <div><ShieldAlert aria-hidden="true" size={16} /><strong>{formatNumber(criticalCount)}</strong><span>critical</span></div>
            <div><TrendingDown aria-hidden="true" size={16} /><strong>{formatNumber(negativeCount)}</strong><span>negative</span></div>
            <div><Sparkles aria-hidden="true" size={16} /><strong>{formatNumber(recommendationReviews.length)}</strong><span>actions</span></div>
          </div>
        </article>

        <article className="panel page-panel">
          <SectionHeader kicker="Top Issues" title="Issue paling sering muncul" helper="Dari summary backend." />
          {isLoading ? <EmptyState title="Loading insights" detail="Mengambil summary dari backend..." /> : null}
          {!isLoading && topIssues.length === 0 ? <EmptyState title="Belum ada issue" detail="Jalankan analysis untuk mengisi issue category." /> : null}
          <div className="issue-rank-list">
            {topIssues.slice(0, 8).map((issue, index) => (
              <div className="issue-rank-row" key={issue.label}>
                <span>#{index + 1}</span>
                <strong>{issue.label}</strong>
                <em>{formatNumber(issue.count)}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="panel page-panel">
          <SectionHeader kicker="Critical Alerts" title="Patient safety / viral risk" helper="Prioritas tertinggi untuk follow-up." />
          {criticalReviews.length === 0 ? <EmptyState title="Tidak ada critical issue" detail="Tidak ada critical signal dari backend saat ini." /> : null}
          <div className="compact-review-list">
            {criticalReviews.slice(0, 8).map((review, index) => (
              <div className="compact-review-row analyzed" key={`${review.location}-${index}`}>
                <div>
                  <strong>{review.location}</strong>
                  <p>{review.review_text || issueLabel(review.issue_category)}</p>
                  <div className="signal-meta">
                    <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                  </div>
                </div>
                <AlertTriangle aria-hidden="true" size={18} />
              </div>
            ))}
          </div>
        </article>

        <article className="panel page-panel">
          <SectionHeader kicker="Recommended Actions" title="AI action queue" helper="Rekomendasi dari hasil analysis." />
          {recommendationReviews.length === 0 ? <EmptyState title="Belum ada rekomendasi" detail="Jalankan analysis untuk menghasilkan action recommendation." /> : null}
          <div className="compact-review-list">
            {recommendationReviews.slice(0, 10).map((review) => (
              <div className="compact-review-row analyzed" key={review.id}>
                <div>
                  <strong>{review.location}</strong>
                  <p>{review.recommended_action}</p>
                  <span className="muted-line">{formatDate(review.review_time)} · {issueLabel(review.issue_category)}</span>
                </div>
                <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
              </div>
            ))}
          </div>
        </article>

        <article className="panel page-panel">
          <SectionHeader kicker="Negative Reviews" title="Reputation watchlist" helper="Review negatif terbaru dari backend." />
          {negativeReviews.length === 0 ? <EmptyState title="Tidak ada negative review" detail="Tidak ada data negative review dari backend saat ini." /> : null}
          <div className="compact-review-list">
            {negativeReviews.slice(0, 8).map((review, index) => (
              <div className="compact-review-row" key={`${review.location}-${index}`}>
                <div>
                  <strong>{review.location}</strong>
                  <p>{review.review_text || "Tidak ada teks review."}</p>
                </div>
                <Badge tone="danger">Negative</Badge>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}
