export default function DataTable({ columns, rows, onRowClick, loading, emptyText = 'Žádné záznamy' }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-theme-muted">
        Načítání...
      </div>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-theme-muted">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-600">
            {columns.map((col, i) => (
              <th
                key={i}
                className="text-left py-2 px-3 text-xs font-semibold text-theme-muted uppercase tracking-wider"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.id || ri}
              className={`border-b border-navy-700/50 hover:bg-navy-700/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, ci) => (
                <td key={ci} className="py-2.5 px-3 text-theme-primary">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-theme-muted">
      <span>Celkem: {total}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-theme-primary"
        >
          &larr;
        </button>
        <span className="text-theme-primary">{page} / {totalPages}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 rounded bg-navy-700 hover:bg-navy-600 disabled:opacity-40 disabled:cursor-not-allowed text-theme-primary"
        >
          &rarr;
        </button>
      </div>
    </div>
  )
}
