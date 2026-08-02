"use client";

import { useEffect, useState } from "react";

type StaffResult = { id: string; nome: string | null; staffNumber: string | null };

export default function StaffSearchInput({
  onSelect,
  placeholder = "Buscar staff...",
  className,
}: {
  onSelect: (staff: { id: string; nome: string; staffNumber: string | null }) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StaffResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/staff?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  function pick(staff: StaffResult) {
    if (!staff.nome) return;
    onSelect({ id: staff.id, nome: staff.nome, staffNumber: staff.staffNumber });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={className ?? "rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-petrol"}
      />
      {open && query.trim() !== "" && (
        <div className="absolute z-10 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-line bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-ink/40">Buscando...</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-ink/40">Nenhum staff encontrado.</div>
          )}
          {!loading &&
            results.map((s) => (
              <button
                type="button"
                key={s.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
              >
                <div className="font-medium text-ink">{s.nome}</div>
                <div className="font-mono text-xs text-ink/50">#{s.staffNumber || "s/n"}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
