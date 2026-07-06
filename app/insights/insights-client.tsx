"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Filter, RefreshCcw, Search, ShieldAlert, Sparkles, TrendingDown, X, XCircle } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { BackendWarning, Badge, EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { fetchJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import { issueLabel, toneForUrgency, urgencyLabel } from "../lib/review-labels";
import type { Location, Overview, Review } from "../lib/types";

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
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [negativePage, setNegativePage] = useState(1);
  const itemsPerPage = 3;

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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewPayload, criticalPayload, negativePayload, reviewsPayload, locationsPayload] = await Promise.all([
        fetchJson<Overview>("/api/dashboard/overview"),
        fetchJson<{ items: InsightReview[]; total: number }>("/api/dashboard/critical-issues"),
        fetchJson<{ items: InsightReview[]; total: number }>("/api/dashboard/negative-reviews"),
        fetchJson<{ items: Review[]; total: number }>("/api/reviews?page_size=120&latest_first=true"),
        fetchJson<{ items: Location[]; total: number }>("/api/locations"),
      ]);
      setOverview(overviewPayload);
      setCriticalReviews(criticalPayload.items);
      setNegativeReviews(negativePayload.items);
      setRecommendationReviews(reviewsPayload.items.filter((review) => review.recommended_action));
      setLocations(locationsPayload.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setOverview(null);
      setCriticalReviews([]);
      setNegativeReviews([]);
      setRecommendationReviews([]);
      setLocations([]);
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

  const filteredActionQueue = useMemo(() => {
    let filtered = [...recommendationReviews];
    
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
      // First sort by urgency
      const urgencyOrder = { high: 3, medium: 2, low: 1, unknown: 0 };
      const valA = urgencyOrder[(a.urgency || "unknown") as keyof typeof urgencyOrder] || 0;
      const valB = urgencyOrder[(b.urgency || "unknown") as keyof typeof urgencyOrder] || 0;
      
      if (valA !== valB) {
        return valB - valA; // High to Low
      }
      
      if (filterSortOrder === "terbaru") {
        return new Date(b.review_time || 0).getTime() - new Date(a.review_time || 0).getTime();
      }
      if (filterSortOrder === "terlama") {
        return new Date(a.review_time || 0).getTime() - new Date(b.review_time || 0).getTime();
      }
      
      const sentOrder = { positive: 3, mixed: 2, neutral: 2, negative: 1, unknown: 0 };
      const sentA = sentOrder[(a.sentiment || "unknown") as keyof typeof sentOrder] || 0;
      const sentB = sentOrder[(b.sentiment || "unknown") as keyof typeof sentOrder] || 0;
      
      if (filterSortOrder === "positif_dulu") {
        return sentB - sentA || new Date(b.review_time || 0).getTime() - new Date(a.review_time || 0).getTime();
      }
      if (filterSortOrder === "negatif_dulu") {
        return sentA - sentB || new Date(b.review_time || 0).getTime() - new Date(a.review_time || 0).getTime();
      }
      return 0;
    });
    
    return filtered;
  }, [recommendationReviews, searchKeyword, filterLocationId, filterSentiment, filterSortOrder, filterUrgency, filterRating, filterStartDate, filterEndDate, filterIssueCategory, filterPatientSafety]);

  const actionQueueColumns: Array<DataTableColumn<Review>> = [
    {
      id: "review",
      header: "NAMA PASIEN",
      accessor: (r) => r.reviewer_name,
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 border border-slate-200 shadow-sm">
            {r.reviewer_name ? r.reviewer_name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="flex flex-col">
            <strong className="text-sm font-extrabold text-slate-800">
              {r.reviewer_name || "Unknown"}
            </strong>
            <span className="text-xs text-slate-500 font-medium">{r.location}</span>
          </div>
        </div>
      ),
      width: "25%",
    },
    {
      id: "datetime",
      header: "TANGGAL & KATEGORI",
      render: (r) => (
        <div className="flex flex-col gap-1 items-start">
          <span className="text-xs font-medium text-slate-500">{formatDate(r.review_time)}</span>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {issueLabel(r.issue_category)}
          </span>
        </div>
      ),
      width: "25%",
    },
    {
      id: "urgency",
      header: "URGENSI",
      render: (r) => <Badge tone={toneForUrgency(r.urgency)}>{urgencyLabel(r.urgency)}</Badge>,
      width: "15%",
    },
    {
      id: "action",
      header: "REKOMENDASI AI",
      render: (r) => <span className="text-sm font-medium text-slate-700">{r.recommended_action}</span>,
    }
  ];

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

      <section className="flex flex-col gap-6 mt-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          <div className="xl:col-span-5 flex flex-col gap-6">
            <article className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="relative z-10">
                <SectionHeader kicker="Risk Signal" title={`${riskScore}% reputation risk`} helper="Heuristic dari critical signals + negative sentiment." />
                <div className="flex justify-center my-6">
                   <div className="relative w-32 h-32 flex flex-col items-center justify-center rounded-full border-[12px] border-slate-50 shadow-inner">
                     <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                       <circle cx="50" cy="50" r="44" fill="none" stroke="#ef4444" strokeWidth="12" strokeDasharray={`${riskScore * 2.76} 276`} className="transition-all duration-1000 ease-out" />
                     </svg>
                     <strong className="text-3xl font-black text-slate-800">{riskScore}%</strong>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">risk</span>
                   </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-auto">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex flex-col gap-2">
                    <ShieldAlert className="text-red-500" size={16} />
                    <div>
                      <strong className="block text-xl font-black text-red-800">{formatNumber(criticalCount)}</strong>
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">critical</span>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex flex-col gap-2">
                    <TrendingDown className="text-amber-500" size={16} />
                    <div>
                      <strong className="block text-xl font-black text-amber-800">{formatNumber(negativeCount)}</strong>
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">negative</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col gap-2">
                    <Sparkles className="text-emerald-500" size={16} />
                    <div>
                      <strong className="block text-xl font-black text-emerald-800">{formatNumber(recommendationReviews.length)}</strong>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">actions</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex-1">
              <SectionHeader kicker="Critical Alerts" title="Patient safety / viral risk" helper="Prioritas tertinggi untuk follow-up." />
              {criticalReviews.length === 0 ? <EmptyState title="Tidak ada critical issue" detail="Tidak ada critical signal dari backend saat ini." /> : null}
              <div className="flex flex-col gap-4 mt-4">
                {criticalReviews.slice(0, 8).map((review, index) => (
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 flex justify-between items-start" key={`${review.location}-${index}`}>
                    <div className="flex flex-col gap-1.5 items-start">
                      <strong className="text-sm font-extrabold text-slate-800">{review.location}</strong>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">{review.review_text || <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{issueLabel(review.issue_category)}</span>}</p>
                      <div className="mt-2">
                        <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
                      </div>
                    </div>
                    <AlertTriangle className="text-red-500 shrink-0 mt-1" size={18} />
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="xl:col-span-7 flex flex-col gap-6">
            <article className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <SectionHeader kicker="Top Issues" title="Issue paling sering muncul" helper="Dari summary backend." />
              {isLoading ? <EmptyState title="Loading insights" detail="Mengambil summary dari backend..." /> : null}
              {!isLoading && topIssues.length === 0 ? <EmptyState title="Belum ada issue" detail="Jalankan analysis untuk mengisi issue category." /> : null}
              <div className="flex flex-col gap-3 mt-4">
                {topIssues.slice(0, 3).map((issue, index) => (
                  <div className="flex items-center justify-between p-4 bg-sky-50 border border-sky-100 rounded-xl" key={issue.label}>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-sky-500 w-5">#{index + 1}</span>
                      <strong className="text-sm font-extrabold text-slate-800">{issue.label}</strong>
                    </div>
                    <em className="text-sm font-black text-sky-600 not-italic">{formatNumber(issue.count)}</em>
                  </div>
                ))}
              </div>
            </article>

            <article className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex-1 flex flex-col">
              <SectionHeader kicker="Negative Reviews" title="Reputation watchlist" helper="Review negatif terbaru dari backend." />
              {negativeReviews.length === 0 ? <EmptyState title="Tidak ada negative review" detail="Tidak ada data negative review dari backend saat ini." /> : null}
              <div className="flex flex-col gap-4 mt-4 flex-1">
                {negativeReviews.slice((negativePage - 1) * itemsPerPage, negativePage * itemsPerPage).map((review, index) => (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col" key={`${review.location}-${index}`}>
                     <div className="flex justify-between items-start mb-2">
                       <strong className="text-sm font-extrabold text-slate-800">{review.location}</strong>
                       <Badge tone="danger">Negative</Badge>
                     </div>
                     <p className="text-sm font-medium text-slate-600 leading-relaxed line-clamp-3">{review.review_text || "Tidak ada teks review."}</p>
                  </div>
                ))}
              </div>
              
              {negativeReviews.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500">
                    Menampilkan {(negativePage - 1) * itemsPerPage + 1}-{Math.min(negativePage * itemsPerPage, negativeReviews.length)} dari {negativeReviews.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNegativePage(p => Math.max(1, p - 1))}
                      disabled={negativePage === 1}
                      className="text-xs font-bold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                    >
                      <ChevronLeft className="inline-block w-3 h-3 mr-1" /> Sebelumnya
                    </button>
                    <span className="text-xs font-bold text-slate-800">
                      Halaman {negativePage} / {Math.ceil(negativeReviews.length / itemsPerPage)}
                    </span>
                    <button
                      onClick={() => setNegativePage(p => Math.min(Math.ceil(negativeReviews.length / itemsPerPage), p + 1))}
                      disabled={negativePage === Math.ceil(negativeReviews.length / itemsPerPage)}
                      className="text-xs font-bold text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                    >
                      Berikutnya <ChevronRight className="inline-block w-3 h-3 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </article>
          </div>
        </div>

        <article className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden mt-2">
          <div className="p-6 pb-4">
             <SectionHeader kicker="Recommended Actions" title="AI action queue" helper="Rekomendasi dari hasil analysis." />
             
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
                    className="text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg h-10 px-3 flex items-center gap-1.5 transition-colors"
                  >
                    <Filter className="w-4 h-4 text-emerald-600" /> Extended Filters
                  </button>
                  
                  <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-lg h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={filterLocationId} onChange={(e) => setFilterLocationId(Number(e.target.value) || "")}>
                    <option value="">Semua Lokasi</option>
                    {locations.map((loc) => <option value={loc.id} key={loc.id}>{loc.branch_name}</option>)}
                  </select>
                  
                  <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-lg h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={filterUrgency} onChange={(e) => setFilterUrgency(e.target.value)}>
                    <option value="all">Semua Urgensi</option>
                    <option value="high">High Urgency</option>
                    <option value="medium">Medium Urgency</option>
                    <option value="low">Low Urgency</option>
                    <option value="unknown">Unknown</option>
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
          
          <div className="border-t border-slate-200 flex-1">
             <DataTable
                data={filteredActionQueue}
                columns={actionQueueColumns}
                getRowKey={(r) => r.id}
                isLoading={isLoading}
                emptyTitle="Belum ada rekomendasi"
                emptyDetail="Jalankan analysis atau ubah filter untuk menghasilkan action recommendation."
                hideToolbar={true}
                manualPagination={false}
                pageSize={10}
              />
          </div>
        </article>
      </section>

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
