import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type Row,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from './EmptyState'
import { FileX2 } from 'lucide-react'

// Re-export ColumnDef for consumers
export type { ColumnDef } from '@tanstack/react-table'

// ── Column definition helpers ──────────────────────────────────────────

export function createColumnHelper<T>() {
  return {
    accessor: <TKey extends keyof T & string>(
      key: TKey,
      column: Omit<ColumnDef<T, T[TKey]>, 'accessorKey'>
    ): ColumnDef<T, T[TKey]> => ({
      accessorKey: key,
      ...column,
    }),
    display: (column: ColumnDef<T, unknown>): ColumnDef<T, unknown> => column,
  }
}

// ── Props ──────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, any>[]
  loading?: boolean
  searchPlaceholder?: string
  searchable?: boolean
  pageSize?: number
  pageSizeOptions?: number[]
  onRowClick?: (row: T) => void
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}

// ── Loading skeleton ───────────────────────────────────────────────────

function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-100">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <Skeleton height={16} className="w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Sort icon ──────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="w-3.5 h-3.5" />
  if (direction === 'desc') return <ArrowDown className="w-3.5 h-3.5" />
  return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
}

// ── Main component ─────────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  loading = false,
  searchPlaceholder = 'Rechercher...',
  searchable = true,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  onRowClick,
  emptyTitle = 'Aucune donnee',
  emptyDescription = 'Aucun element ne correspond a vos criteres.',
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  })

  const { pageIndex } = table.getState().pagination
  const pageCount = table.getPageCount()
  const totalRows = table.getFilteredRowModel().rows.length

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {/* Toolbar */}
      {searchable && (
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="block w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-slate-200">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-slate-700'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <SortIcon direction={header.column.getIsSorted()} />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={columns.length} />
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    icon={FileX2}
                    title={emptyTitle}
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row: Row<T>) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    'border-b border-slate-100 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-slate-50'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalRows > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Lignes par page :</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="ml-2">
              {pageIndex * table.getState().pagination.pageSize + 1}
              {' - '}
              {Math.min(
                (pageIndex + 1) * table.getState().pagination.pageSize,
                totalRows
              )}
              {' sur '}
              {totalRows}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Page precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm text-slate-600">
              {pageIndex + 1} / {pageCount || 1}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
