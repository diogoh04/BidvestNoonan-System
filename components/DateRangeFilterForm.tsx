// Filtro de período (data início/fim) reaproveitado nas 3 telas de review
// (folhas quinzenais, ajustes, lixeira). De propósito um <form> comum sem
// "use client" — método GET por padrão manda pra própria URL da página com
// ?dateFrom=&dateTo=, então o filtro funciona só com HTML, sem JS nenhum
// (a página inteira é um Server Component que já lê `searchParams`).
export default function DateRangeFilterForm({
  clearHref,
  dateFrom,
  dateTo,
}: {
  clearHref: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return (
    <form className="mt-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-ink/50">
        From
        <input
          type="date"
          name="dateFrom"
          defaultValue={dateFrom ?? ""}
          className="rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink/50">
        To
        <input
          type="date"
          name="dateTo"
          defaultValue={dateTo ?? ""}
          min={dateFrom || undefined}
          className="rounded-md border border-line px-2 py-1.5 text-sm text-ink outline-none focus:border-petrol"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-petrol px-3 py-1.5 text-sm font-medium text-white hover:bg-petrolDark"
      >
        Filter
      </button>
      {(dateFrom || dateTo) && (
        <a href={clearHref} className="text-xs text-ink/40 underline hover:text-petrol">
          Clear
        </a>
      )}
    </form>
  );
}
