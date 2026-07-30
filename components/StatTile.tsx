import { LucideIcon } from "lucide-react";

export default function StatTile({
  icon: Icon,
  label,
  value,
  valueClassName,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  valueClassName?: string;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-white p-6">
      <Icon size={24} className="text-petrol" />
      <div>
        <div className={`font-display text-4xl font-bold ${valueClassName ?? "text-ink"}`}>{value}</div>
        <div className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-ink/40">{label}</div>
        {caption && <div className="mt-1 text-xs text-ink/50">{caption}</div>}
      </div>
    </div>
  );
}
