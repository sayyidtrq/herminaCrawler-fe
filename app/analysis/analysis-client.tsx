"use client";
import { X } from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Filter, RefreshCcw, Search, Sparkles, Star, XCircle } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { ActionMessagePanel, BackendWarning, Badge, EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { fetchJson, postJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
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

  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterLocationId, setFilterLocationId] = useState<number | "">("");
  const [filterSentiment, setFilterSentiment] = useState("all");
  const [filterSortOrder, setFilterSortOrder] = useState("terbaru");
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterUrgency, setFilterUrgency] = useState("all");
  const [filterRating, setFilterRating] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterIssueCategory, setFilterIssueCategory] = useState("");
  const [filterPatientSafety, setFilterPatientSafety] = useState(false);

  const resetFilters = () => {
    setSearchKeyword("");
    setFilterLocationId("");
    setFilterSentiment("all");
    setFilterSortOrder("terbaru");
    setFilterUrgency("all");
    setFilterRating("all");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterIssueCategory("");
    setFilterPatientSafety(false);
  };

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
  const analyzedReviews = useMemo(() => {
    let filtered = reviews.filter((review) => review.sentiment || review.issue_category || review.recommended_action);
    
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.reviewer_name?.toLowerCase().includes(q) ||
          r.review_text?.toLowerCase().includes(q) ||
          r.recommended_action?.toLowerCase().includes(q) ||
          r.location?.toLowerCase().includes(q)
      );
    }
    
    if (filterLocationId !== "") {
      filtered = filtered.filter((r) => r.location_id === filterLocationId);
    }
    
    if (filterSentiment !== "all") {
      filtered = filtered.filter((r) => r.sentiment === filterSentiment);
    }
    
    if (filterUrgency !== "all") {
      filtered = filtered.filter((r) => r.urgency === filterUrgency);
    }
    
    if (filterRating !== "all") {
      filtered = filtered.filter((r) => String(r.rating) === filterRating);
    }
    
    if (filterIssueCategory.trim()) {
      const q = filterIssueCategory.toLowerCase();
      filtered = filtered.filter((r) => r.issue_category?.toLowerCase().includes(q));
    }
    
    if (filterPatientSafety) {
      filtered = filtered.filter((r) => r.is_patient_safety_issue);
    }
    
    if (filterStartDate) {
      filtered = filtered.filter((r) => r.review_time && new Date(r.review_time) >= new Date(filterStartDate));
    }
    
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => r.review_time && new Date(r.review_time) <= end);
    }
    
    filtered.sort((a, b) => {
      if (filterSortOrder === "terbaru") {
        return new Date(b.review_time || 0).getTime() - new Date(a.review_time || 0).getTime();
      }
      if (filterSortOrder === "terlama") {
        return new Date(a.review_time || 0).getTime() - new Date(b.review_time || 0).getTime();
      }
      const sentOrder = { positive: 3, mixed: 2, neutral: 2, negative: 1, unknown: 0 };
      const valA = sentOrder[(a.sentiment || "unknown") as keyof typeof sentOrder] || 0;
      const valB = sentOrder[(b.sentiment || "unknown") as keyof typeof sentOrder] || 0;
      
      if (filterSortOrder === "positif_dulu") {
        return valB - valA || new Date(b.review_time || 0).getTime() - new Date(a.review_time || 0).getTime();
      }
      if (filterSortOrder === "negatif_dulu") {
        return valA - valB || new Date(b.review_time || 0).getTime() - new Date(a.review_time || 0).getTime();
      }
      return 0;
    });
    
    return filtered;
  }, [reviews, searchKeyword, filterLocationId, filterSentiment, filterSortOrder, filterUrgency, filterRating, filterStartDate, filterEndDate, filterIssueCategory, filterPatientSafety]);

  const sentimentCounts = useMemo(() => {
    return analyzedReviews.reduce<Record<string, number>>((acc, review) => {
      const key = review.sentiment ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [analyzedReviews]);

  return (
    <AppShell>
      <header className="page-header dashboard-hero-header">
        <div>
          <p className="kicker">Analysis</p>
          <h1>AI Analysis Operations</h1>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading || isActionRunning}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh
          </button>
        </div>
      </header>

      {error ? <BackendWarning error={error} /> : null}
      <ActionMessagePanel message={actionMessage} />

      <section className="locations-page-stack">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#172e25] text-white rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-[#2c5340]">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 mb-2">Total Review</span>
            <div>
              <strong className="text-2xl font-bold block">{formatNumber(overview?.total_reviews ?? 0)}</strong>
              <span className="text-[10px] text-emerald-400/60">Semua review masuk</span>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Positif</span>
            <div>
              <strong className="text-2xl font-bold block text-emerald-800">{formatNumber(sentimentCounts.positive ?? 0)}</strong>
              <span className="text-[10px] text-emerald-600/70">Dari halaman ini</span>
            </div>
          </div>
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-600 mb-2">Netral</span>
            <div>
              <strong className="text-2xl font-bold block text-sky-800">{formatNumber(sentimentCounts.neutral ?? 0)}</strong>
              <span className="text-[10px] text-sky-600/70">Dari halaman ini</span>
            </div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">Negatif</span>
            <div>
              <strong className="text-2xl font-bold block text-red-800">{formatNumber(sentimentCounts.negative ?? 0)}</strong>
              <span className="text-[10px] text-red-600/70">Dari halaman ini</span>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Total Lokasi</span>
            <div>
              <strong className="text-2xl font-bold block text-slate-800">{locations.length}</strong>
              <span className="text-[10px] text-slate-500">Cabang aktif</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Main Analyzed List */}
        <article className="xl:col-span-8 flex flex-col gap-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 pb-4">
              <SectionHeader kicker="Analyzed Window" title="Hasil analisis terbaru" helper="Sample review yang sudah memiliki output AI." />
              
              <div className="mt-6 flex flex-col xl:flex-row xl:items-center gap-4 justify-between bg-slate-50 border border-slate-200 p-2 rounded-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    className="w-full h-10 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder="Cari nama, keyword review..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    type="button" 
                    onClick={() => setIsFilterOpen(true)}
                    className="bg-white hover:bg-slate-50 border border-slate-200 rounded-lg h-10 w-10 flex items-center justify-center transition-colors shrink-0 shadow-sm"
                    title="Extended Filters"
                  >
                    <Filter className="w-4 h-4 text-emerald-600" />
                  </button>
                  
                  <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-lg h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={filterLocationId} onChange={(e) => setFilterLocationId(Number(e.target.value) || "")}>
                    <option value="">Semua Lokasi</option>
                    {locations.map((loc) => <option value={loc.id} key={loc.id}>{loc.branch_name}</option>)}
                  </select>
                  
                  <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-lg h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)}>
                    <option value="all">Semua Sentimen</option>
                    <option value="positive">Positif</option>
                    <option value="neutral">Netral</option>
                    <option value="negative">Negatif</option>
                  </select>
                  
                  <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-lg h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={filterSortOrder} onChange={(e) => setFilterSortOrder(e.target.value)}>
                    <option value="terbaru">Terbaru</option>
                    <option value="terlama">Terlama</option>
                    <option value="positif_dulu">Positif First</option>
                    <option value="negatif_dulu">Negatif First</option>
                  </select>
                  
                  <button 
                    type="button" 
                    onClick={resetFilters}
                    className="text-sm font-bold text-slate-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg h-10 flex items-center gap-1.5 transition-colors px-3"
                  >
                    <XCircle className="w-4 h-4" /> Reset
                  </button>
                </div>
              </div>
            </div>
            
            {/* List */}
            <div className="flex-1 border-t border-slate-200">
              <DataTable
                data={analyzedReviews.slice(0, 15)}
                columns={[
                  {
                    id: "review",
                    header: "NAMA PASIEN",
                    accessor: (review) => review.reviewer_name,
                    render: (review) => (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 border border-slate-200">
                          {review.reviewer_name ? review.reviewer_name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-800">
                            {review.reviewer_name || "Unknown"}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{review.location}</span>
                        </div>
                      </div>
                    ),
                    width: "35%",
                  },
                  {
                    id: "date",
                    header: "TANGGAL & RATING",
                    render: (review) => (
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500 font-medium">{formatDate(review.review_time)}</span>
                        <span className="text-xs font-bold text-slate-700 mt-1 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {review.rating}/5
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: "sentiment",
                    header: "SENTIMEN",
                    render: (review) => (
                      <Badge tone={toneForSentiment(review.sentiment)}>{sentimentLabel(review.sentiment)}</Badge>
                    ),
                  },
                  {
                    id: "urgency",
                    header: "URGENSI",
                    render: (review) => (
                      <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                    ),
                  },
                  {
                    id: "category",
                    header: "KATEGORI",
                    render: (review) => (
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        {issueLabel(review.issue_category)}
                      </span>
                    ),
                  }
                ]}
                getRowKey={(review) => review.id}
                isLoading={isLoading}
                emptyTitle="Belum ada hasil analisis"
                emptyDetail="Coba jalankan pending queue di panel sebelah kanan."
                hideToolbar={true}
                manualPagination={true}
              />
            </div>
          </div>
        </article>

        {/* RIGHT COLUMN: Controls, Coverage, and Pending */}
        <aside className="xl:col-span-4 flex flex-col gap-6">
          
          {/* Run Analysis Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <SectionHeader
              kicker="Run Analysis"
              title="Analyze pending queue"
              helper={`Model: ${settings?.local_llm_model ?? "unknown"} · batch ${settings?.analysis_batch_size ?? "—"}`}
            />
            <div className="flex flex-col gap-4 mt-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location Scope</span>
                <select 
                  className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                  value={selectedLocationId} 
                  onChange={(event) => setSelectedLocationId(Number(event.target.value) || "")}
                >
                  <option value="">Semua lokasi</option>
                  {locations.map((location) => <option value={location.id} key={location.id}>{location.branch_name}</option>)}
                </select>
              </label>
              
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rating Filter</span>
                <select 
                  className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                  value={ratingFilter} 
                  onChange={(event) => setRatingFilter(event.target.value)}
                >
                  <option value="all">All ratings</option>
                  <option value="1">1 star</option>
                  <option value="2">2 stars</option>
                  <option value="3">3 stars</option>
                  <option value="4">4 stars</option>
                  <option value="5">5 stars</option>
                </select>
              </label>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2"
                  disabled={isActionRunning}
                  onClick={() => runAction("Analyze Pending", () => postJson("/api/analysis/pending", {
                    location_id: selectedLocationOrNull(),
                    rating: ratingFilter === "all" ? null : Number(ratingFilter),
                  }))}
                >
                  <Bot size={15} /> Analyze
                </button>
                <button
                  type="button"
                  className="flex-1 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  disabled={isActionRunning || !selectedLocationId}
                  onClick={() => runAction("Rerun Location Analysis", () => postJson(`/api/analysis/locations/${selectedLocationId}/rerun`))}
                >
                  <RefreshCcw size={15} /> Rerun loc
                </button>
              </div>
            </div>
          </div>

          {/* Coverage Panel (Donut Chart) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <SectionHeader kicker="Coverage" title={`${analyzedCoverage}% analyzed`} helper="Coverage dihitung dari summary backend." />
            
            <div className="flex justify-center my-8">
              <div className="w-40 h-40 rounded-full border-[16px] border-slate-50 relative flex items-center justify-center shadow-inner">
                {/* Simulated circle stroke for analyzed coverage */}
                <div 
                  className="absolute inset-0 rounded-full border-[16px] border-emerald-500" 
                  style={{ clipPath: analyzedCoverage > 50 ? 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 50%)' : 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)', transform: 'rotate(-90deg)' }}
                ></div>
                <div className="text-center z-10 bg-white w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-sm border border-slate-100">
                  <span className="block text-3xl font-black text-slate-800">{analyzedCoverage}%</span>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Analyzed</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 border-t border-slate-100 pt-6">
              <div className="flex flex-col border border-slate-100 rounded-xl p-3 bg-slate-50">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Reviews</span>
                <span className="text-lg font-black text-slate-800">{formatNumber(overview?.total_reviews)}</span>
              </div>
              <div className="flex flex-col border border-emerald-100 rounded-xl p-3 bg-emerald-50">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Analyzed</span>
                <span className="text-lg font-black text-emerald-800">{formatNumber(overview?.analyzed_reviews)}</span>
              </div>
              <div className="flex flex-col border border-amber-100 rounded-xl p-3 bg-amber-50">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Pending</span>
                <span className="text-lg font-black text-amber-800">{formatNumber(overview?.pending_analysis)}</span>
              </div>
              <div className="flex flex-col border border-red-100 rounded-xl p-3 bg-red-50">
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Critical</span>
                <span className="text-lg font-black text-red-800">{formatNumber(overview?.critical_issues)}</span>
              </div>
            </div>
          </div>

          {/* Pending Window Panel */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[500px]">
            <SectionHeader kicker="Pending Window" title="Review belum dianalisis" helper="Sample dari latest review window." />
            
            <div className="flex-1 overflow-y-auto mt-4 pr-2 space-y-4">
              {isLoading ? <EmptyState title="Loading data" detail="Sedang mengambil dari backend..." /> : null}
              {!isLoading && pendingReviews.length === 0 ? <EmptyState title="Tidak ada pending" detail="Semua review sudah dianalisis." /> : null}
              
              {pendingReviews.map((review) => (
                <div key={review.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm">
                        {review.reviewer_name?.charAt(0).toUpperCase() || "U"}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs truncate max-w-[120px]">{review.reviewer_name || "Unknown"}</h4>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" /> {review.rating}/5
                        </span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      disabled={isActionRunning} 
                      onClick={() => runAction("Rerun Review Analysis", () => postJson(`/api/analysis/reviews/${review.id}/rerun`))}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded-md transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <Sparkles size={10} /> Analyze
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 font-medium line-clamp-3 leading-relaxed">
                    {review.review_text || "Tidak ada teks review."}
                  </p>
                </div>
              ))}
            </div>
          </div>
          
        </aside>
      </div>
      </section>

      {/* Filter Sidebar Drawer */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          <div 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" 
            onClick={() => setIsFilterOpen(false)}
          />
          
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-600" /> Extended Filters
              </h2>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pencarian Spesifik</label>
                <input
                  type="text"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="Cari nama pasien, teks review..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Lokasi</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={filterLocationId} onChange={(e) => setFilterLocationId(Number(e.target.value) || "")}>
                  <option value="">Semua Lokasi</option>
                  {locations.map((loc) => <option value={loc.id} key={loc.id}>{loc.branch_name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Sentimen</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={filterSentiment} onChange={(e) => setFilterSentiment(e.target.value)}>
                  <option value="all">Semua Sentimen</option>
                  <option value="positive">Positif</option>
                  <option value="neutral">Netral</option>
                  <option value="negative">Negatif</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tingkat Urgensi</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)}>
                  <option value="all">Semua Urgensi</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rating Bintang</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
                  <option value="all">Semua Rating</option>
                  <option value="5">5 Bintang</option>
                  <option value="4">4 Bintang</option>
                  <option value="3">3 Bintang</option>
                  <option value="2">2 Bintang</option>
                  <option value="1">1 Bintang</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rentang Tanggal (Start Date - End Date)</label>
                <div className="flex gap-2">
                  <input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors" />
                  <input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Urutkan Berdasarkan</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={filterSortOrder} onChange={(e) => setFilterSortOrder(e.target.value)}>
                  <option value="terbaru">Terbaru (Newest)</option>
                  <option value="terlama">Terlama (Oldest)</option>
                  <option value="positif_dulu">Positif First</option>
                  <option value="negatif_dulu">Negatif First</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kategori Isu</label>
                <input
                  type="text"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="Ketik kategori isu..."
                  value={filterIssueCategory}
                  onChange={(e) => setFilterIssueCategory(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="patientSafety"
                  checked={filterPatientSafety}
                  onChange={(e) => setFilterPatientSafety(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="patientSafety" className="text-sm font-bold text-slate-800 cursor-pointer">
                  Patient Safety Issue
                </label>
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button 
                type="button" 
                onClick={resetFilters}
                className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-700 transition-colors"
              >
                Reset
              </button>
              <button 
                type="button" 
                onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-bold text-white transition-colors"
              >
                Terapkan Filter
              </button>
            </div>
          </div>
        </div>
      )}

    </AppShell>
  );
}
