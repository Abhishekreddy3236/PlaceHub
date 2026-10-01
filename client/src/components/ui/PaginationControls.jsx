export default function PaginationControls({ pagination, onPageChange, disabled = false, itemLabel = 'Jobs' }) {
  if (!pagination) {
    return null;
  }

  const currentPage = pagination.page || pagination.currentPage || 1;
  const limit = pagination.limit || 12;
  const total = Number.isFinite(Number(pagination.total)) ? Number(pagination.total) : 0;
  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const hasPreviousPage = pagination.hasPreviousPage ?? currentPage > 1;
  const hasNextPage = pagination.hasNextPage ?? currentPage < totalPages;

  const startItem = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, total);

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      {total > 0 ? (
        <span className="text-sm font-medium text-slate-700">
          Showing <strong className="font-semibold text-slate-900">{startItem}</strong>–<strong className="font-semibold text-slate-900">{endItem}</strong> of <strong className="font-semibold text-slate-900">{total}</strong> {itemLabel}
        </span>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={disabled || !hasPreviousPage}
          className="btn-secondary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="text-sm font-medium text-slate-700">
          Page <strong className="font-semibold text-slate-900">{currentPage}</strong> of <strong className="font-semibold text-slate-900">{totalPages}</strong>
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={disabled || !hasNextPage}
          className="btn-secondary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
