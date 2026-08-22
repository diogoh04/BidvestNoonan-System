// Semana da folha de ponto sempre começa numa segunda-feira, guardada como
// data real (substitui o campo de texto livre "WEEK" da tela de impressão).

export function getMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatWeekRange(weekStartISO: string): string {
  const start = new Date(weekStartISO + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4); // segunda a sexta

  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  return `${fmt(start)} — ${fmt(end)}`;
}

// Uma quinzena que começa em `fortnightStartISO` cobre 14 dias (a 2ª semana
// não tem `weekStart` próprio no banco — ver Timesheet.periodType). Usado
// pra descobrir se uma data escolhida pelo Team Leader já cai dentro de uma
// quinzena existente, mesmo sem bater exatamente com o weekStart dela.
export function isWithinFortnight(fortnightStartISO: string, dateISO: string): boolean {
  const start = new Date(fortnightStartISO + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);
  const date = new Date(dateISO + "T00:00:00Z");
  return date >= start && date <= end;
}

// Mesma ideia do formatWeekRange, mas pra folha quinzenal: cobre da segunda
// da primeira semana até a sexta da segunda semana (+13 dias em vez de +4).
export function formatFortnightRange(weekStartISO: string): string {
  const start = new Date(weekStartISO + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);

  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  return `${fmt(start)} — ${fmt(end)}`;
}

// Índice (0-4 semanal, 0-9 quinzenal, ver getTimesheetDayKeys) → quantos dias
// depois do weekStart cai aquele dia. 0-4 = segunda a sexta da 1ª semana;
// 5-9 = segunda a sexta da 2ª semana, pulando o fim de semana entre elas
// (por isso +2 a mais que o índice bruto).
export function timesheetDayOffset(dayIndex: number): number {
  return dayIndex < 5 ? dayIndex : dayIndex + 2;
}

// Data real (DD/MM) de um dia da folha, pra mostrar em cima do nome do dia
// no cabeçalho da tabela — só faz sentido pra folha que já tem weekStart de
// verdade (Team Leader/Supervisor); o molde em branco do Master não usa isso.
export function formatShortDate(weekStartISO: string, offsetDays: number): string {
  const d = new Date(weekStartISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// --- Helpers de mês, usados pelo filtro mensal de /hours-control ---

export function getMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Primeiro e último dia (YYYY-MM-DD) do mês "YYYY-MM" — usado pra buscar
// todos os lançamentos (BuildingHoursLog) cujo weekStart cai dentro do mês.
export function getMonthRange(monthKey: string): { startISO: string; endISO: string } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // dia 0 do mês seguinte = último dia deste mês
  return { startISO: toISODate(start), endISO: toISODate(end) };
}

// Quantas segundas-feiras (semanas lançáveis) caem dentro do mês — usado pra
// escalar o orçamento semanal (UCD Hours) pro total do mês (weekly * essa
// contagem), já que não guardamos um orçamento mensal separado.
export function countMondaysInMonth(monthKey: string): number {
  const { startISO, endISO } = getMonthRange(monthKey);
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 1) count++;
  }
  return count;
}

// Lista (YYYY-MM-DD) de cada segunda-feira dentro do mês — usado pra somar
// o UCD Hours semana a semana no mês (cada semana pode ter um valor
// congelado diferente, ver BuildingHoursLog.ucdHours no schema.prisma), em
// vez de multiplicar o valor ao vivo pela quantidade de semanas.
export function getMondaysInMonth(monthKey: string): string[] {
  const { startISO, endISO } = getMonthRange(monthKey);
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  const mondays: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 1) mondays.push(toISODate(d));
  }
  return mondays;
}

function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return getMonthKey(d);
}

export function prevMonth(monthKey: string): string {
  return addMonths(monthKey, -1);
}

export function nextMonth(monthKey: string): string {
  return addMonths(monthKey, 1);
}

// Primeira segunda-feira dentro do mês — ponto de entrada ao abrir um time
// a partir da visão mensal (edição continua sendo sempre semana a semana).
export function firstMondayOfMonth(monthKey: string): string {
  const { startISO, endISO } = getMonthRange(monthKey);
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 1) return toISODate(d);
  }
  return startISO;
}
