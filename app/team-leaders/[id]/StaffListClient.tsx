"use client";

import { useState } from "react";
import StaffRow from "@/components/StaffRow";
import StaffHoursCard from "@/components/StaffHoursCard";

type Cleaner = {
  id: string;
  nome: string | null;
  staffNumber: string | null;
  telefone: string | null;
  horasSemana?: number | null;
};

export default function StaffListClient({ staff }: { staff: Cleaner[] }) {
  const [list, setList] = useState(staff);

  if (list.length === 0) {
    return <p className="text-sm text-ink/40">Nenhum cleaner alocado neste prédio.</p>;
  }

  return (
    <div className="space-y-2">
      {list.map((s) => (
        <div key={s.id} className="flex items-start gap-2">
          <div className="flex-1">
            <StaffRow
              id={s.id}
              nome={s.nome}
              staffNumber={s.staffNumber}
              telefone={s.telefone}
              onDeleted={(id) => setList((prev) => prev.filter((p) => p.id !== id))}
            />
          </div>
          <StaffHoursCard staffId={s.id} initialHours={s.horasSemana ?? null} />
        </div>
      ))}
    </div>
  );
}
