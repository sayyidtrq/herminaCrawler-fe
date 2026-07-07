"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCcw, FileText, FileSpreadsheet, Search, Filter, XCircle } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { DataTable, type DataTableColumn } from "../components/data-table";
import { BackendWarning, Badge, SectionHeader } from "../components/ui";
import { fetchJson } from "../lib/api";
import { formatDate, formatNumber } from "../lib/format";
import type { Location, Review } from "../lib/types";

type ReviewsPayload = {
  items: Review[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

type ExportHistory = {
  id: string;
  type: string;
  date: string;
  status: "completed" | "processing" | "failed";
  format: "csv" | "pdf";
  size: string;
};

const MOCK_EXPORT_HISTORY: ExportHistory[] = [
  { id: "EXP-101", type: "Executive Summary", date: new Date().toISOString(), status: "completed", format: "csv", size: "1.2 MB" },
  { id: "EXP-100", type: "Raw Reviews", date: new Date(Date.now() - 86400000).toISOString(), status: "completed", format: "pdf", size: "4.5 MB" },
  { id: "EXP-099", type: "Competitor Report", date: new Date(Date.now() - 172800000).toISOString(), status: "failed", format: "csv", size: "--" },
];

export default function ReportsClient() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [reviewsPayload, setReviewsPayload] = useState<ReviewsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Export Form State
  const [reportType, setReportType] = useState("executive_summary");
  const [exportFormat, setExportFormat] = useState("csv");
  const [locationId, setLocationId] = useState<number | "">("");
  
  // History Table State
  const [searchHistory, setSearchHistory] = useState("");
  const [filterReportType, setFilterReportType] = useState("all");
  const [filterFormat, setFilterFormat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const resetHistoryFilters = () => {
    setSearchHistory("");
    setFilterReportType("all");
    setFilterFormat("all");
    setFilterStatus("all");
  };
  
  const filteredHistory = MOCK_EXPORT_HISTORY.filter(item => {
    if (filterReportType !== "all" && item.type !== filterReportType) return false;
    if (filterFormat !== "all" && item.format !== filterFormat) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [locationPayload, reviewPayload] = await Promise.all([
        fetchJson<{ items: Location[]; total: number }>("/api/locations"),
        fetchJson<ReviewsPayload>("/api/reviews?page_size=200&latest_first=true"),
      ]);
      setLocations(locationPayload.items);
      setReviewsPayload(reviewPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backend tidak merespons.");
      setReviewsPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Calculate export metrics from history
  const totalReports = MOCK_EXPORT_HISTORY.length;
  let completedReports = 0;
  let failedReports = 0;
  let pdfReports = 0;
  let csvReports = 0;

  for (const h of MOCK_EXPORT_HISTORY) {
    if (h.status === "completed") completedReports++;
    if (h.status === "failed") failedReports++;
    if (h.format === "pdf") pdfReports++;
    if (h.format === "csv") csvReports++;
  }

  const historyColumns: Array<DataTableColumn<ExportHistory>> = [
    {
      id: "id",
      header: "Export ID",
      accessor: (r) => r.id,
      render: (r) => <strong className="text-sm font-bold text-slate-800">{r.id}</strong>,
      width: "15%",
    },
    {
      id: "type",
      header: "Report Type",
      accessor: (r) => r.type,
      render: (r) => <span className="text-sm font-medium text-slate-700">{r.type}</span>,
    },
    {
      id: "date",
      header: "Generated At",
      render: (r) => (
        <span className="text-xs text-slate-500 font-medium">{formatDate(r.date)}</span>
      ),
    },
    {
      id: "format",
      header: "Format",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.format === "csv" ? <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-rose-600" />}
          <span className="text-sm font-bold text-slate-600 uppercase">{r.format}</span>
        </div>
      ),
    },
    {
      id: "size",
      header: "Size",
      accessor: (r) => r.size,
      render: (r) => <span className="text-xs text-slate-500">{r.size}</span>,
    },
    {
      id: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={r.status === "completed" ? "positive" : r.status === "failed" ? "danger" : "warning"}>
          {r.status}
        </Badge>
      ),
    },
    {
      id: "action",
      header: "",
      align: "center",
      render: (r) => (
        <button
          type="button"
          disabled={r.status !== "completed"}
          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-transparent disabled:hover:text-slate-500"
          title="Download File"
        >
          <Download className="w-4 h-4" />
        </button>
      ),
      width: "80px",
    }
  ];

  return (
    <AppShell>
      <header className="page-header dashboard-hero-header">
        <div>
          <p className="kicker">Reports</p>
          <h1>Stakeholder Reports</h1>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="ghost-action" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCcw aria-hidden="true" size={15} /> Refresh Data
          </button>
        </div>
      </header>

      {error ? <BackendWarning error={error} /> : null}

      <section className="locations-page-stack">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#172e25] text-white rounded-2xl p-4 flex flex-col justify-between shadow-sm border border-[#2c5340]">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 mb-2">Total Reports</span>
            <div>
              <strong className="text-2xl font-bold block">{formatNumber(totalReports)}</strong>
              <span className="text-[10px] text-emerald-400/60">Semua riwayat laporan</span>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Completed</span>
            <div>
              <strong className="text-2xl font-bold block text-emerald-800">{formatNumber(completedReports)}</strong>
              <span className="text-[10px] text-emerald-600/70">Laporan berhasil</span>
            </div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2">Failed</span>
            <div>
              <strong className="text-2xl font-bold block text-red-800">{formatNumber(failedReports)}</strong>
              <span className="text-[10px] text-red-600/70">Laporan gagal</span>
            </div>
          </div>
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-600 mb-2">Format CSV</span>
            <div>
              <strong className="text-2xl font-bold block text-sky-800">{formatNumber(csvReports)}</strong>
              <span className="text-[10px] text-sky-600/70">Data tabular</span>
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2">Format PDF</span>
            <div>
              <strong className="text-2xl font-bold block text-rose-800">{formatNumber(pdfReports)}</strong>
              <span className="text-[10px] text-rose-600/70">Dokumen visual</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
          <div className="xl:col-span-4 flex flex-col">
            <article className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                <SectionHeader kicker="Generate" title="Export Configuration" helper="Konfigurasi parameter laporan baru." />
              </div>
              <div className="p-6 flex flex-col gap-5 flex-1">
                
                <div className="flex flex-col gap-2">
                  <label htmlFor="reportType" className="text-sm font-bold text-slate-700">Report Type</label>
                  <select
                    id="reportType"
                    className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 p-3 h-11 font-medium transition-colors hover:border-emerald-300"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="executive_summary">Executive Summary</option>
                    <option value="raw_reviews">Raw Reviews</option>
                    <option value="analysis_summary">Analysis Summary</option>
                    <option value="location_report">Location Report</option>
                    <option value="competitor_report">Competitor Report</option>
                    <option value="action_tracker">Action Tracker Report</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="locationId" className="text-sm font-bold text-slate-700">Filter Location</label>
                  <select
                    id="locationId"
                    className="w-full bg-white border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-emerald-500 focus:border-emerald-500 p-3 h-11 font-medium transition-colors hover:border-emerald-300"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">All Locations</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.hospital_name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-sm font-bold text-slate-700">Export Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button" 
                      onClick={() => setExportFormat("csv")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all ${exportFormat === "csv" ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500/20" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                    >
                      <FileSpreadsheet className={`w-4 h-4 ${exportFormat === "csv" ? "text-emerald-600" : "text-slate-400"}`} /> CSV
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setExportFormat("pdf")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all ${exportFormat === "pdf" ? "bg-rose-50 border-rose-500 text-rose-700 ring-1 ring-rose-500/20" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                    >
                      <FileText className={`w-4 h-4 ${exportFormat === "pdf" ? "text-rose-600" : "text-slate-400"}`} /> PDF
                    </button>
                  </div>
                </div>

              </div>
              <div className="p-6 pt-4 border-t border-slate-100 bg-slate-50 mt-auto">
                <button type="button" className="w-full bg-[#172e25] hover:bg-[#2c5340] text-white font-bold rounded-xl py-3.5 px-4 shadow-sm transition-colors flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" /> Generate Report
                </button>
              </div>
            </article>
          </div>

          <div className="xl:col-span-8 flex flex-col">
            <article className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-6 pb-4">
                 <SectionHeader kicker="History" title="Export History" helper="Riwayat laporan yang telah di-generate." />
                 
                 <div className="mt-6 flex flex-col 2xl:flex-row 2xl:items-center gap-3 justify-between bg-slate-50 border border-slate-200 p-2 rounded-xl overflow-x-auto">
                    <div className="relative flex-1 min-w-[150px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                      <input
                        type="text"
                        className="w-full h-8 pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                        placeholder="Cari ID laporan, type report..."
                        value={searchHistory}
                        onChange={(e) => setSearchHistory(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-nowrap">
                      <button 
                        type="button" 
                        onClick={() => setIsFilterOpen(true)}
                        className="bg-white hover:bg-slate-50 border border-slate-200 rounded-lg h-8 w-8 flex items-center justify-center transition-colors shadow-sm shrink-0"
                        title="Extended Filters"
                      >
                        <Filter className="w-3.5 h-3.5 text-emerald-600" />
                      </button>
                      
                      <select 
                        className="text-xs font-bold text-slate-700 border-slate-200 rounded-lg h-8 px-2 py-0 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm w-fit" 
                        value={filterReportType} 
                        onChange={(e) => setFilterReportType(e.target.value)}
                      >
                        <option value="all">Semua Type</option>
                        <option value="Executive Summary">Executive Summary</option>
                        <option value="Raw Reviews">Raw Reviews</option>
                        <option value="Competitor Report">Competitor Report</option>
                      </select>
                      
                      <select 
                        className="text-xs font-bold text-slate-700 border-slate-200 rounded-lg h-8 px-2 py-0 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm w-fit" 
                        value={filterFormat} 
                        onChange={(e) => setFilterFormat(e.target.value)}
                      >
                        <option value="all">Semua Format</option>
                        <option value="csv">CSV</option>
                        <option value="pdf">PDF</option>
                      </select>
                      
                      <select 
                        className="text-xs font-bold text-slate-700 border-slate-200 rounded-lg h-8 px-2 py-0 bg-white focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-sm w-fit" 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                      >
                        <option value="all">Semua Status</option>
                        <option value="completed">Completed</option>
                        <option value="processing">Processing</option>
                        <option value="failed">Failed</option>
                      </select>
                      
                      <button 
                        type="button" 
                        onClick={resetHistoryFilters}
                        className="text-xs font-bold text-slate-500 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg h-8 flex items-center gap-1 transition-colors px-2 shadow-sm whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reset
                      </button>
                    </div>
                 </div>
              </div>
              
              <div className="border-t border-slate-200 flex-1 overflow-x-auto">
                <DataTable
                  columns={historyColumns}
                  data={filteredHistory}
                  getRowKey={(row) => row.id}
                  hideToolbar={true}
                  searchValue={searchHistory}
                />
              </div>
            </article>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
