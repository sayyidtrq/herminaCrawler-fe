"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCcw, Search, Filter, XCircle, X, Star, Pen } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { BackendWarning, Badge, PageHeader } from "../components/ui";
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
  const searchParams = useSearchParams();
  const initialLocationId = Number(searchParams.get("location_id")) || "";
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviewsPayload, setReviewsPayload] = useState<ReviewsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // States for filtering
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const [locationId, setLocationId] = useState<number | "">(initialLocationId);
  const [sentiment, setSentiment] = useState(searchParams.get("sentiment") ?? "all");
  const [rating, setRating] = useState(searchParams.get("rating") ?? "all");
  const [datePreset, setDatePreset] = useState(searchParams.get("date_preset") ?? "all");
  const [sortOrder, setSortOrder] = useState("terbaru");
  const [page, setPage] = useState(1);
  
  const [urgency, setUrgency] = useState(searchParams.get("urgency") ?? "all");
  const [issueCategory, setIssueCategory] = useState(searchParams.get("issue_category") ?? "all");
  const [isPatientSafety, setIsPatientSafety] = useState(searchParams.get("is_patient_safety") ?? "all");
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // State for Modal
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editSentiment, setEditSentiment] = useState("");
  const [editUrgency, setEditUrgency] = useState("");

  useEffect(() => {
    setPage(1);
    setKeyword(searchParams.get("keyword") ?? "");
    setLocationId(Number(searchParams.get("location_id")) || "");
    setSentiment(searchParams.get("sentiment") ?? "all");
    setRating(searchParams.get("rating") ?? "all");
    setDatePreset(searchParams.get("date_preset") ?? "all");
  }, [searchParams]);

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
      if (datePreset !== "all") params.set("date_preset", datePreset);
      if (urgency !== "all") params.set("urgency", urgency);
      if (issueCategory !== "all") params.set("issue_category", issueCategory);
      if (isPatientSafety !== "all") params.set("is_patient_safety", isPatientSafety);

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
  }, [datePreset, keyword, locationId, page, rating, sentiment, urgency, issueCategory, isPatientSafety]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const reviews = useMemo(() => {
    let items = [...(reviewsPayload?.items ?? [])];
    if (sortOrder === "terlama") {
      items.reverse();
    } else if (sortOrder === "positif_dulu") {
      items.sort((a, b) => {
        const valA = a.sentiment === "positive" ? 3 : a.sentiment === "neutral" ? 2 : 1;
        const valB = b.sentiment === "positive" ? 3 : b.sentiment === "neutral" ? 2 : 1;
        return valB - valA;
      });
    } else if (sortOrder === "negatif_dulu") {
      items.sort((a, b) => {
        const valA = a.sentiment === "negative" ? 3 : a.sentiment === "neutral" ? 2 : 1;
        const valB = b.sentiment === "negative" ? 3 : b.sentiment === "neutral" ? 2 : 1;
        return valB - valA;
      });
    }
    return items;
  }, [reviewsPayload?.items, sortOrder]);
  
  const totalPages = reviewsPayload?.total_pages ?? 1;
  const sentimentCounts = useMemo(() => {
    return reviews.reduce<Record<string, number>>((acc, review) => {
      const key = review.sentiment ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [reviews]);

  const resetFilters = () => {
    setKeyword("");
    setLocationId("");
    setSentiment("all");
    setRating("all");
    setDatePreset("all");
    setUrgency("all");
    setIssueCategory("all");
    setIsPatientSafety("all");
    setSortOrder("terbaru");
    setPage(1);
  };

  const handleSaveReview = () => {
    if (!selectedReview) return;
    
    // Mock save by updating the reviewsPayload locally
    if (reviewsPayload) {
      const updatedItems = reviewsPayload.items.map(r => {
        if (r.id === selectedReview.id) {
          return {
            ...r,
            sentiment: editSentiment,
            urgency: editUrgency
          };
        }
        return r;
      });
      setReviewsPayload({ ...reviewsPayload, items: updatedItems });
      
      // Update selectedReview so modal reflects immediately
      setSelectedReview({
        ...selectedReview,
        sentiment: editSentiment,
        urgency: editUrgency
      });
    }
    
    setIsEditing(false);
  };

  const reviewColumns: Array<DataTableColumn<Review>> = [
    {
      id: "review",
      header: "Nama Pasien",
      accessor: (review) => review.reviewer_name,
      render: (review) => (
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => {
          setSelectedReview(review);
          setIsEditing(false);
          setEditSentiment(review.sentiment ?? "unknown");
          setEditUrgency(review.urgency ?? "unknown");
        }}>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 border border-slate-200">
            {review.reviewer_name ? review.reviewer_name.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-slate-800 group-hover:text-emerald-600 transition-colors">
              {review.reviewer_name || "Anonymous"}
            </span>
            <span className="text-xs text-slate-500 font-medium">{review.location}</span>
          </div>
        </div>
      ),
      width: "35%",
    },
    {
      id: "date",
      header: "Tanggal & Rating",
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
      header: "Sentimen",
      render: (review) => (
        <Badge tone={toneForSentiment(review.sentiment)}>{sentimentLabel(review.sentiment)}</Badge>
      ),
    },
    {
      id: "urgency",
      header: "Urgensi",
      render: (review) => (
        <Badge tone={toneForUrgency(review.urgency)}>{urgencyLabel(review.urgency)}</Badge>
      ),
    },
    {
      id: "action",
      header: "Aksi",
      align: "center",
      render: (review) => (
        <div className="flex items-center justify-center">
          <button 
            type="button" 
            title="Lihat Detail & Edit"
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200" 
            onClick={() => {
              setSelectedReview(review);
              setIsEditing(true);
              setEditSentiment(review.sentiment ?? "unknown");
              setEditUrgency(review.urgency ?? "unknown");
            }}
          >
            <Pen className="w-4 h-4" />
          </button>
        </div>
      ),
      width: "90px",
    }
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reviews"
        title="Review Intelligence Feed"
        helper="Cari, filter, dan audit review mentah beserta hasil analisis AI dari sistem secara realtime."
        action={
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh Data
          </button>
        }
      />

      {error ? <BackendWarning error={error} /> : null}

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        {/* Main Content Column */}
        <article className="xl:col-span-8 2xl:col-span-9 flex flex-col gap-4">
          
          {/* Filter Bar Simple */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-center gap-4 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                className="w-full h-10 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                placeholder="Cari nama, keyword review..."
                value={keyword}
                onChange={(e) => { setPage(1); setKeyword(e.target.value); }}
              />
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                type="button" 
                onClick={() => setIsFilterOpen(true)}
                className="text-sm font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl h-10 px-3 flex items-center gap-1.5 transition-colors mr-2"
              >
                <Filter className="w-4 h-4 text-emerald-600" /> Extended Filters
              </button>
              
              <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={locationId} onChange={(e) => { setPage(1); setLocationId(Number(e.target.value) || ""); }}>
                <option value="">Semua Lokasi</option>
                {locations.map((loc) => <option value={loc.id} key={loc.id}>{loc.branch_name}</option>)}
              </select>
              
              <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={sentiment} onChange={(e) => { setPage(1); setSentiment(e.target.value); }}>
                <option value="all">Semua Sentimen</option>
                <option value="positive">Positif</option>
                <option value="neutral">Netral</option>
                <option value="negative">Negatif</option>
              </select>
              
              <select className="text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="terbaru">Terbaru</option>
                <option value="terlama">Terlama</option>
                <option value="positif_dulu">Positif First</option>
                <option value="negatif_dulu">Negatif First</option>
              </select>
              
              <button 
                type="button" 
                onClick={resetFilters}
                className="text-sm font-bold text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl h-10 flex items-center gap-1.5 transition-colors px-3 ml-1"
              >
                <XCircle className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
             <DataTable
              data={reviews}
              columns={reviewColumns}
              getRowKey={(review) => review.id}
              isLoading={isLoading}
              emptyTitle="Tidak ada review"
              emptyDetail="Coba ubah filter atau jalankan fetch baru."
              hideToolbar={true}
              page={page}
              pageSize={reviewsPayload?.page_size ?? 20}
              totalItems={reviewsPayload?.total ?? 0}
              onPageChange={setPage}
              manualPagination
            />
          </div>
        </article>

        {/* Sidebar Dashboard Column */}
        <aside className="xl:col-span-4 2xl:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-extrabold text-slate-800 text-lg mb-1">Customer Activity</h3>
            <p className="text-xs font-medium text-slate-500 mb-8">Distribusi tren analisis pada halaman ini.</p>
            
            {/* Donut/Circle visualizer placeholder */}
            <div className="flex justify-center mb-8">
              <div className="w-36 h-36 rounded-full border-[14px] border-slate-50 relative flex items-center justify-center shadow-inner">
                <div className="absolute inset-0 rounded-full border-[14px] border-emerald-500" style={{ clipPath: 'polygon(50% 50%, 50% 0, 100% 0, 100% 50%)' }}></div>
                <div className="absolute inset-0 rounded-full border-[14px] border-red-500" style={{ clipPath: 'polygon(50% 50%, 100% 50%, 100% 100%, 0 100%)' }}></div>
                <div className="absolute inset-0 rounded-full border-[14px] border-slate-300" style={{ clipPath: 'polygon(50% 50%, 0 100%, 0 0, 50% 0)' }}></div>
                <div className="text-center z-10 bg-white w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-sm border border-slate-100">
                  <span className="block text-xl font-black text-slate-800">{formatNumber(reviewsPayload?.total ?? 0)}</span>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Reviews</span>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* Positive Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1.5 items-center">
                  <span className="font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div> Positif
                  </span>
                  <div className="flex items-center gap-2">
                     <span className="font-black text-slate-900">{formatNumber(sentimentCounts.positive ?? 0)}</span>
                     <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">{Math.round(((sentimentCounts.positive || 0) / (reviews.length || 1)) * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(sentimentCounts.positive || 0) / (reviews.length || 1) * 100}%` }}></div>
                </div>
              </div>
              
              {/* Negative Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1.5 items-center">
                  <span className="font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-red-500"></div> Negatif
                  </span>
                  <div className="flex items-center gap-2">
                     <span className="font-black text-slate-900">{formatNumber(sentimentCounts.negative ?? 0)}</span>
                     <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{Math.round(((sentimentCounts.negative || 0) / (reviews.length || 1)) * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-red-500 rounded-full" style={{ width: `${(sentimentCounts.negative || 0) / (reviews.length || 1) * 100}%` }}></div>
                </div>
              </div>

              {/* Neutral Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1.5 items-center">
                  <span className="font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm bg-slate-400"></div> Netral/Mix
                  </span>
                  <div className="flex items-center gap-2">
                     <span className="font-black text-slate-900">{formatNumber((sentimentCounts.neutral ?? 0) + (sentimentCounts.mixed ?? 0))}</span>
                     <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">{Math.round((((sentimentCounts.neutral || 0) + (sentimentCounts.mixed || 0)) / (reviews.length || 1)) * 100)}%</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-slate-400 rounded-full" style={{ width: `${((sentimentCounts.neutral || 0) + (sentimentCounts.mixed || 0)) / (reviews.length || 1) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-md text-white border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full mix-blend-screen filter blur-2xl -translate-y-10 translate-x-10"></div>
            <h3 className="font-extrabold mb-2 text-lg relative z-10">AI Review Audit</h3>
            <p className="text-slate-300 text-sm mb-5 leading-relaxed font-medium relative z-10">
              Data tabel dienkstraksi otomatis menggunakan AI Engine untuk mendeteksi urgency dan kategori.
            </p>
            <button className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 transition-colors rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/30 relative z-10">
              Konfigurasi AI
            </button>
          </div>
        </aside>
      </section>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xl border border-emerald-200 shadow-sm">
                  {selectedReview.reviewer_name ? selectedReview.reviewer_name.charAt(0).toUpperCase() : "A"}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-lg leading-tight mb-0.5">{selectedReview.reviewer_name || "Anonymous"}</h3>
                  <p className="text-xs font-medium text-slate-500">{selectedReview.location} • Diposting pada {formatDate(selectedReview.review_time)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors" title="Edit Analisis">
                    <Pen className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setSelectedReview(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex gap-2 mb-5 flex-wrap">
                <div className="px-3 py-1 rounded-full bg-amber-100 text-xs font-extrabold text-amber-800 flex items-center gap-1.5 border border-amber-200 h-8">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> {selectedReview.rating}/5 Rating
                </div>
                {isEditing ? (
                  <>
                    <select className="text-xs font-bold text-slate-700 border-slate-200 rounded-full h-8 px-3 bg-slate-50 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={editSentiment} onChange={(e) => setEditSentiment(e.target.value)}>
                      <option value="positive">Positif</option>
                      <option value="neutral">Netral</option>
                      <option value="negative">Negatif</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <select className="text-xs font-bold text-slate-700 border-slate-200 rounded-full h-8 px-3 bg-slate-50 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={editUrgency} onChange={(e) => setEditUrgency(e.target.value)}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </>
                ) : (
                  <>
                    <Badge tone={toneForSentiment(selectedReview.sentiment)}>{sentimentLabel(selectedReview.sentiment)}</Badge>
                    <Badge tone={toneForUrgency(selectedReview.urgency)}>{urgencyLabel(selectedReview.urgency)}</Badge>
                  </>
                )}
                {selectedReview.issue_category && <Badge tone="neutral">{issueLabel(selectedReview.issue_category)}</Badge>}
                {selectedReview.is_patient_safety_issue && <Badge tone="critical">Patient Safety Issue</Badge>}
              </div>
              
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 relative">
                <div className="absolute top-4 left-4 text-slate-300">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.714 4.02-6.695 8.18-7.234l1.803.738c-3.136 1.401-4.821 3.518-4.821 6.388h4.821v7.5h-10.003zm-14.017 0v-7.391c0-5.714 4.02-6.695 8.18-7.234l1.804.738c-3.137 1.401-4.822 3.518-4.822 6.388h4.822v7.5h-10.004z"/></svg>
                </div>
                <p className="text-slate-700 leading-relaxed font-medium pl-10 text-sm whitespace-pre-wrap">
                  {selectedReview.review_text || "Review ini tidak memiliki teks penjelasan."}
                </p>
              </div>

              {selectedReview.recommended_action && (
                <div>
                  <h4 className="text-xs uppercase tracking-widest font-extrabold text-slate-400 mb-2">AI Recommended Action</h4>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium leading-relaxed">
                    {selectedReview.recommended_action}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-3">
               {isEditing ? (
                 <>
                   <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm">
                     Batal
                   </button>
                   <button onClick={handleSaveReview} className="px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md">
                     Simpan
                   </button>
                 </>
               ) : (
                 <>
                   <button onClick={() => setSelectedReview(null)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm">
                     Tutup
                   </button>
                   <button className="px-5 py-2.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-md">
                     Buat Action Item
                   </button>
                 </>
               )}
            </div>
          </div>
        </div>
      )}
      {/* Filter Sidebar Drawer */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Overlay background */}
          <div 
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" 
            onClick={() => setIsFilterOpen(false)}
          />
          
          {/* Drawer Panel */}
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
                  value={keyword}
                  onChange={(e) => { setPage(1); setKeyword(e.target.value); }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Lokasi</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={locationId} onChange={(e) => setLocationId(Number(e.target.value) || "")}>
                  <option value="">Semua Lokasi</option>
                  {locations.map((loc) => <option value={loc.id} key={loc.id}>{loc.branch_name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Sentimen</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
                  <option value="all">Semua Sentimen</option>
                  <option value="positive">Positif</option>
                  <option value="neutral">Netral</option>
                  <option value="negative">Negatif</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tingkat Urgensi</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                  <option value="all">Semua Urgensi</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rating Bintang</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={rating} onChange={(e) => setRating(e.target.value)}>
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
                  <input type="date" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors" />
                  <input type="date" className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Urutkan Berdasarkan</label>
                <select className="w-full text-sm font-bold text-slate-700 border-slate-200 rounded-xl h-10 px-3 bg-slate-50 focus:bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
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
                  value={issueCategory === "all" ? "" : issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value || "all")}
                />
              </div>

              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  checked={isPatientSafety === "true"}
                  onChange={(e) => setIsPatientSafety(e.target.checked ? "true" : "all")}
                />
                <span className="text-sm font-bold text-slate-700">Patient Safety Issue</span>
              </label>

            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button 
                type="button" 
                onClick={resetFilters}
                className="flex-1 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-100 hover:text-red-600 transition-colors"
              >
                Reset
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setPage(1);
                  setIsFilterOpen(false);
                }}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm"
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
