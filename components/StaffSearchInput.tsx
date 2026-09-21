"use client";

import { useEffect, useRef, useState } from "react";

type StaffResult = { id: string; nome: string | null; staffNumber: string | null };

export default function StaffSearchInput({
  onSelect,
  placeholder = "Search staff...",
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Fecha ao tocar/clicar fora — não usa onBlur do input: no Safari/iOS o
  // blur do input dispara ANTES do clique na sugestão (touchend -> blur ->
  // mousedown/click), então um timeout de blur podia fechar a lista antes do
  // toque na opção chegar a registrar (o "clique não fica salvo" no celular).
  // Checar se o alvo do toque está fora do container evita essa corrida.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  function pick(staff: StaffResult) {
    if (!staff.nome) return;
    onSelect({ id: staff.id, nome: staff.nome, staffNumber: staff.staffNumber });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={
          className ??
          "rounded-md border border-line px-2 py-2 text-base outline-none focus:border-petrol sm:py-1.5 sm:text-sm"
        }
      />
      {open && query.trim() !== "" && (
        // Fica no fluxo normal (não "absolute") de propósito: no Safari/iOS,
        // o teclado desloca a área visível sem redimensionar o layout, e uma
        // lista "position: absolute" podia acabar posicionada atrás do
        // teclado — o toque parecia acertar o nome, mas caía fora da lista
        // de verdade. Em vez de flutuar por cima, empurra o resto do
        // formulário pra baixo, que sempre fica visível.
        <div className="z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-line bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-ink/40">Searching...</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-ink/40">No staff found.</div>
          )}
          {!loading &&
            results.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => pick(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
              >
                <div className="font-medium text-ink">{s.nome}</div>
                <div className="font-mono text-xs text-ink/50">#{s.staffNumber || "n/a"}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
