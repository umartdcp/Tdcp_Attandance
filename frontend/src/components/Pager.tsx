interface PagerProps {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}

export default function Pager({ page, total, pageSize, onPage }: PagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = pageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-tdcp-border px-4 py-3">
      <p className="text-sm text-slate-500">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-lg border border-tdcp-border px-3 py-1.5 text-sm font-semibold text-tdcp-navy disabled:opacity-40"
        >
          Previous
        </button>
        {pages.map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className="px-1 text-slate-400">…</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              className={
                item === page
                  ? 'h-8 min-w-8 rounded-lg bg-tdcp-green px-2 text-sm font-semibold text-white'
                  : 'h-8 min-w-8 rounded-lg border border-tdcp-border px-2 text-sm font-semibold text-tdcp-navy'
              }
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-lg border border-tdcp-border px-3 py-1.5 text-sm font-semibold text-tdcp-navy disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function pageNumbers(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items: Array<number | 'gap'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push('gap');
  for (let number = start; number <= end; number += 1) items.push(number);
  if (end < totalPages - 1) items.push('gap');
  items.push(totalPages);
  return items;
}
