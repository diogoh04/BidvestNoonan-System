type CleanerLine = { horasSemana?: number | null };
type Slot = { id: string };

export default function BuildingStatsBadge({
  horasDisponiveis,
  cleaners,
  slots,
}: {
  horasDisponiveis: number | null;
  cleaners: CleanerLine[];
  slots: Slot[];
}) {
  const horasGastas = cleaners.reduce((sum, c) => sum + (c.horasSemana ?? 0), 0);
  const hoursDelta = horasDisponiveis != null ? horasDisponiveis - horasGastas : null;

  const staffCount = cleaners.length;
  const vagaCount = slots.length;
  const vagaDelta = vagaCount - staffCount;

  if (hoursDelta === null && vagaCount === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      {hoursDelta !== null && (
        <span className={`text-xs font-medium ${hoursDelta < 0 ? "text-danger" : "text-success"}`}>
          {hoursDelta < 0
            ? `Short ${Math.abs(hoursDelta)}h`
            : hoursDelta > 0
            ? `Surplus ${hoursDelta}h`
            : "Hours OK"}
        </span>
      )}

      {vagaCount > 0 && (
        <div className="text-xs">
          <span className="text-ink/50">
            {staffCount} staff{staffCount !== 1 ? "s" : ""} of {vagaCount} slot{vagaCount !== 1 ? "s" : ""}
          </span>
          <div className={`font-medium ${vagaDelta > 0 ? "text-danger" : "text-success"}`}>
            {vagaDelta > 0 ? `${vagaDelta} slot${vagaDelta !== 1 ? "s" : ""} available` : "Slots/Staff OK"}
          </div>
        </div>
      )}
    </div>
  );
}
