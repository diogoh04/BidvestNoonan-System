"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function MarkAdjustmentDoneButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markDone() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/adjustment-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) throw new Error("Could not mark as done");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={markDone}
        disabled={saving}
        className="flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        <CheckCircle2 size={16} />
        {saving ? "Saving..." : "Mark as done"}
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
