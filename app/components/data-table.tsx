"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Filter, Search, X, XCircle } from "lucide-react";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  accessor?: (row: T) => string | number | null | undefined;
  render?: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
};

export type DataTableProps<T> = {
  title?: string;
  description?: string;
  data: T[];
  columns: Array<DataTableColumn<T>>;
  getRowKey: (row: T, index: number) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: ReactNode;
  extendedFilters?: ReactNode;
  extendedFilterTitle?: string;
  onResetFilters?: () => void;
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  manualPagination?: boolean;
  searchableText?: (row: T) => string;
  hideToolbar?: boolean;
};

const DEFAULT_PAGE_SIZE = 10;

export function DataTable<T>({
  title,
  description,
  data,
  columns,
  getRowKey,
  isLoading = false,
  emptyTitle = "Tidak ada data",
  emptyDetail = "Data belum tersedia atau filter tidak menemukan hasil.",
  searchPlaceholder = "Search data...",
  searchValue,
  onSearchChange,
  filters,
  extendedFilters,
  extendedFilterTitle = "Extended Filters",
  onResetFilters,
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  totalItems,
  onPageChange,
  manualPagination = false,
  searchableText,
  hideToolbar = false,
}: DataTableProps<T>) {
  const [internalSearch, setInternalSearch] = useState("");
  const [internalPage, setInternalPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeSearch = searchValue ?? internalSearch;
  const activePage = page ?? internalPage;
  const setSearch = (value: string) => {
    if (onSearchChange) onSearchChange(value);
    else setInternalSearch(value);
    if (!onPageChange) setInternalPage(1);
  };
  const setPage = (nextPage: number) => {
    if (onPageChange) onPageChange(nextPage);
    else setInternalPage(nextPage);
  };

  const filteredData = useMemo(() => {
    if (manualPagination) return data;
    const query = activeSearch.trim().toLowerCase();
    if (!query) return data;
    return data.filter((row) => {
      const text = searchableText
        ? searchableText(row)
        : columns
            .map((column) => column.accessor?.(row))
            .filter((value) => value !== null && value !== undefined)
            .join(" ");
      return text.toLowerCase().includes(query);
    });
  }, [activeSearch, columns, data, manualPagination, searchableText]);

  const itemCount = totalItems ?? filteredData.length;
  const totalPages = Math.max(1, Math.ceil(itemCount / pageSize));
  const hasTitleBlock = Boolean(title || description);
  const visibleRows = useMemo(() => {
    if (manualPagination) return filteredData;
    const start = (activePage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [activePage, filteredData, manualPagination, pageSize]);

  const filterDrawer =
    extendedFilters && isFilterOpen ? (
      <div className="extended-filter-backdrop" role="presentation" onMouseDown={() => setIsFilterOpen(false)}>
        <aside
          className="extended-filter-panel"
          role="dialog"
          aria-modal="true"
          aria-label={extendedFilterTitle}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="extended-filter-header">
            <div>
              <Filter aria-hidden="true" size={22} />
              <strong>{extendedFilterTitle}</strong>
            </div>
            <button type="button" aria-label="Tutup filter" onClick={() => setIsFilterOpen(false)}>
              <X aria-hidden="true" size={22} />
            </button>
          </div>
          <div className="extended-filter-body">
            <label>
              <span>Pencarian spesifik</span>
              <div className="extended-filter-search">
                <Search aria-hidden="true" size={16} />
                <input
                  value={activeSearch}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={searchPlaceholder}
                />
              </div>
            </label>
            {extendedFilters}
          </div>
          <div className="extended-filter-footer">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                onResetFilters?.();
              }}
            >
              Reset
            </button>
            <button type="button" className="primary" onClick={() => setIsFilterOpen(false)}>
              Terapkan Filter
            </button>
          </div>
        </aside>
      </div>
    ) : null;

  return (
    <div className={`data-table-shell${hasTitleBlock ? "" : " data-table-shell-filter-only"}`}>
      {!hideToolbar && (
        <div className="data-table-toolbar">
          {hasTitleBlock ? (
            <div className="data-table-titleblock">
              {title ? <strong className="data-table-title">{title}</strong> : null}
              {description ? <span className="data-table-description">{description}</span> : null}
            </div>
          ) : null}
          <div className="data-table-controls">
            <label className="data-table-search">
              <Search aria-hidden="true" size={15} />
              <input
                value={activeSearch}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
            {extendedFilters ? (
              <button
                type="button"
                className="extended-filter-trigger"
                onClick={() => setIsFilterOpen(true)}
                aria-label="Buka extended filters"
                title="Extended Filters"
              >
                <Filter aria-hidden="true" size={17} />
              </button>
            ) : null}
            {filters ? <div className="data-table-filters">{filters}</div> : null}
            {onResetFilters ? (
              <button
                type="button"
                className="data-table-reset"
                onClick={() => {
                  setSearch("");
                  onResetFilters();
                }}
              >
                <XCircle aria-hidden="true" size={15} /> Reset
              </button>
            ) : null}
          </div>
        </div>
      )}

      {filterDrawer && typeof document !== "undefined" ? createPortal(filterDrawer, document.body) : null}

      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  style={{ width: column.width }}
                  className={column.align ? `align-${column.align}` : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <td key={column.id} className={column.align ? `align-${column.align}` : undefined}>
                    {column.render ? column.render(row, index) : column.accessor?.(row) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading ? (
        <div className="data-table-empty">
          <strong>Memuat data</strong>
          <span>Mengambil data dari backend...</span>
        </div>
      ) : null}
      {!isLoading && visibleRows.length === 0 ? (
        <div className="data-table-empty">
          <strong>{emptyTitle}</strong>
          <span>{emptyDetail}</span>
        </div>
      ) : null}

      <div className="data-table-footer">
        <span className="data-table-range">
          Menampilkan {visibleRows.length ? (activePage - 1) * pageSize + 1 : 0}-
          {Math.min(activePage * pageSize, itemCount)} dari {itemCount}
        </span>
        <div className="data-table-pagination">
          <button type="button" disabled={activePage <= 1 || isLoading} onClick={() => setPage(Math.max(1, activePage - 1))}>
            <ChevronLeft aria-hidden="true" size={15} /> Sebelumnya
          </button>
          <span>Halaman {activePage} / {totalPages}</span>
          <button type="button" disabled={activePage >= totalPages || isLoading} onClick={() => setPage(Math.min(totalPages, activePage + 1))}>
            Berikutnya <ChevronRight aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
