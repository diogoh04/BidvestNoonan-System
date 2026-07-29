export type Slot = { id: string; horas: number };

// Casa cada staff com uma vaga de mesma quantidade de horas (não por posição/índice),
// já que vagas de horas diferentes não são intercambiáveis. Staff sem match de horas
// ainda consome uma vaga qualquer, só para manter a contagem total correta.
export function computeOpenSlots(slots: Slot[], staffList: { horasSemana?: number | null }[]): Slot[] {
  const remaining = [...slots];
  const unmatched: typeof staffList = [];

  for (const s of staffList) {
    const idx = s.horasSemana != null ? remaining.findIndex((slot) => slot.horas === s.horasSemana) : -1;
    if (idx !== -1) {
      remaining.splice(idx, 1);
    } else {
      unmatched.push(s);
    }
  }

  for (const _ of unmatched) {
    if (remaining.length === 0) break;
    remaining.shift();
  }

  return remaining;
}
