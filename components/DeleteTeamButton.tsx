"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, Check } from "lucide-react";

// Apaga o time — prédios só ficam sem time (não são apagados). Usado pra
// limpar, um a um, os times que vieram automaticamente do backfill da
// migration e que você não vai usar. `compact` troca o botão + texto de
// confirmação por só ícones, pra caber numa linha de lista (ver /teams).
export default function DeleteTeamButton({
  teamId,
  compact = false,
  redirectAfterDelete = true,
}: {
  teamId: string;
  compact?: boolean;
  redirectAfterDelete?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  async function remove(e?: React.MouseEvent) {
    e?.stopPropagation();
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (redirectAfterDelete) {
        router.push("/teams");
      }
      router.refresh();
    } catch {
      setSaving(false);
      setConfirming(false);
    }
  }

  function open(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(true);
  }

  function cancel(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(false);
  }

  if (compact) {
    if (confirming) {
      return (
        <span className="flex items-center gap-1 rounded-md border border-danger bg-white px-1.5 py-1">
          <button onClick={remove} disabled={saving} title="Confirm delete" className="text-danger hover:opacity-80">
            <Check size={15} />
          </button>
          <button onClick={cancel} className="text-ink/40 hover:text-ink">
            <X size={15} />
          </button>
        </span>
      );
    }
    return (
      <button
        onClick={open}
        title="Delete team"
        className="rounded-md p-1.5 text-ink/30 transition hover:bg-red-50 hover:text-danger"
      >
        <Trash2 size={16} />
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-danger bg-white px-2.5 py-1.5 text-sm">
        <span className="text-ink/60">Delete this team? Buildings stay, just unlinked.</span>
        <button onClick={remove} disabled={saving} className="font-medium text-danger hover:opacity-80">
          Confirm
        </button>
        <button onClick={cancel} className="text-ink/40 hover:text-ink">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={open}
      className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink/60 transition hover:border-danger hover:text-danger"
    >
      <Trash2 size={14} />
      Delete team
    </button>
  );
}
