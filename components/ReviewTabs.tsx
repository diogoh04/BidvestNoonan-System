import Link from "next/link";

// Faixa de navegação entre as duas partes da conta do supervisor:
// Timesheets (quinzenais enviadas) e Adjustments (log de ajustes).
export default function ReviewTabs({ active }: { active: "timesheets" | "adjustments" }) {
  const tabs = [
    { key: "timesheets", label: "Timesheets", href: "/review" },
    { key: "adjustments", label: "Adjustments", href: "/review/adjustments" },
  ] as const;

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
            active === t.key
              ? "border-petrol bg-petrol text-white"
              : "border-line bg-white text-ink hover:border-petrol"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
