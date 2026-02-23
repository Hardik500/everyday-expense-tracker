import { ReactNode, useState } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  className?: string;
  emptyMessage?: string;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  className = "",
  emptyMessage = "No data available",
  loading = false,
  onRowClick,
  onSort,
  sortKey,
  sortDirection = "asc",
}: TableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState<string | undefined>(undefined);
  const [internalSortDirection, setInternalSortDirection] = useState<"asc" | "desc">("asc");

  const activeSortKey = sortKey ?? internalSortKey;
  const activeSortDirection = sortDirection ?? internalSortDirection;

  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable) return;

    const newDirection = activeSortKey === column.key && activeSortDirection === "asc" ? "desc" : "asc";
    
    if (!sortKey) {
      setInternalSortKey(column.key);
      setInternalSortDirection(newDirection);
    }
    
    onSort?.(column.key, newDirection);
  };

  if (loading) {
    return (
      <div className="w-full">
        <div className="animate-pulse space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-bg-input rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse ${className}`}>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`
                  bg-bg-secondary py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted text-left
                  border-b border-border
                  ${column.sortable ? "cursor-pointer hover:text-text-primary transition-colors" : ""}
                  ${column.className || ""}
                `}
                style={column.width ? { width: column.width } : undefined}
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && (
                    <SortIcon
                      active={activeSortKey === column.key}
                      direction={activeSortDirection}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={keyExtractor(row)}
              className={`
                transition-colors duration-fast border-b border-border
                hover:bg-bg-card-hover
                ${onRowClick ? "cursor-pointer" : ""}
              `}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td
                  key={`${keyExtractor(row)}-${column.key}`}
                  className={`
                    py-3.5 px-4 text-sm text-text-secondary
                    ${column.className || ""}
                  `}
                >
                  {column.render
                    ? column.render(row, index)
                    : (row as Record<string, unknown>)[column.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: "asc" | "desc";
}) {
  return (
    <svg
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      className={`transition-transform ${active ? "text-accent" : "text-text-muted opacity-50"} ${
        active && direction === "desc" ? "rotate-180" : ""
      }`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    </svg>
  );
}

// DataTable component with pagination and search
interface DataTableProps<T> extends Omit<TableProps<T>, "loading"> {
  searchable?: boolean;
  searchPlaceholder?: string;
  pagination?: boolean;
  pageSize?: number;
  actions?: ReactNode;
}

export function DataTable<T>({
  searchable = true,
  searchPlaceholder = "Search...",
  pagination = true,
  pageSize = 10,
  actions,
  ...tableProps
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data based on search
  const filteredData = searchable && searchQuery
    ? tableProps.data.filter((row) =>
        Object.values(row as Record<string, unknown>)
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    : tableProps.data;

  // Paginate
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = pagination
    ? filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredData;

  return (
    <div className="space-y-4">
      {(searchable || actions) && (
        <div className="flex items-center justify-between gap-4">
          {searchable && (
            <div className="relative flex-1 max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-2 bg-bg-input border border-border rounded-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <Table {...tableProps} data={paginatedData} />
      </div>

      {pagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-muted">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-md bg-bg-card border border-border text-sm text-text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:border-accent transition-colors"
        >
          Previous
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              currentPage === page
                ? "bg-accent text-white"
                : "bg-bg-card border border-border text-text-primary hover:border-accent"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-md bg-bg-card border border-border text-sm text-primary disabled:opacity-50 disabled:cursor-not-allowed hover:border-accent transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Table;
