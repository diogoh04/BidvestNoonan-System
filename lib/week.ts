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

// Uma quinzena que começa em `fortnightStartISO` cobre até 14 dias corridos
// (10 dias úteis; a 2ª semana não tem `weekStart` próprio no banco — ver
// Timesheet.periodType). Usado pra descobrir se uma data escolhida pelo Team
// Leader já cai dentro de uma quinzena existente, mesmo sem bater exatamente
// com o weekStart dela. +13 é o limite (início numa sexta).
export function isWithinFortnight(fortnightStartISO: string, dateISO: string): boolean {
  const start = new Date(fortnightStartISO + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);
  const date = new Date(dateISO + "T00:00:00Z");
  return date >= start && date <= end;
}

// DD/MM de uma data ISO.
export function formatDDMM(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// "DD/MM" se as datas forem iguais, senão "DD/MM to DD/MM" — usado nos itens
// do relatório de ajuste.
export function formatDateRange(fromISO: string, toISO: string): string {
  return fromISO === toISO ? formatDDMM(fromISO) : `${formatDDMM(fromISO)} to ${formatDDMM(toISO)}`;
}

const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// "MON".."FRI" a partir de uma data ISO — usado no cabeçalho da folha, onde
// o nome do dia agora vem da data real (a quinzena pode começar em qualquer
// dia útil, não só na segunda).
export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[new Date(iso + "T00:00:00Z").getUTCDay()] ?? "";
}

// Se `iso` cai num fim de semana, empurra pra segunda seguinte; senão
// devolve igual. O início da quinzena tem que ser um dia útil.
export function snapToWorkingDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2);
  else if (dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  return toISODate(d);
}

// As 10 datas (ISO) da quinzena: dias úteis consecutivos a partir de
// `startISO` (segunda a sexta, pulando o fim de semana). O índice bate com
// getTimesheetDayKeys("biweekly") (W1_MONDAY = [0] ... W2_FRIDAY = [9]) —
// mas o rótulo de cada coluna passa a vir da data, não da chave.
export function fortnightWorkingDays(startISO: string): string[] {
  const out: string[] = [];
  const d = new Date(startISO + "T00:00:00Z");
  while (out.length < 10) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(toISODate(new Date(d)));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Último dia útil da quinzena (a 10ª coluna).
export function fortnightEndISO(startISO: string): string {
  const days = fortnightWorkingDays(startISO);
  return days[days.length - 1];
}

// Intervalo da quinzena pra exibição: 1º ao 10º dia útil a partir do início.
export function formatFortnightRange(weekStartISO: string): string {
  const days = fortnightWorkingDays(weekStartISO);
  return `${formatDDMM(days[0])} — ${formatDDMM(days[days.length - 1])}`;
}

// Dias úteis (seg-sex) entre startISO e endISO, inclusive nas duas pontas —
// generalização de fortnightWorkingDays pra uma duração QUALQUER (não mais
// travada em 10 dias úteis). Usado pelas folhas novas, que guardam
// Timesheet.weekEnd de verdade (ver getTimesheetDates em lib/types.ts). Se
// endISO vier antes de startISO, devolve lista vazia (chamador decide como
// tratar — ver validação em lib/validation.ts).
export function workingDaysInRange(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const d = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(toISODate(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Generalização de isWithinFortnight pra período de duração real (endISO
// vem do Timesheet.weekEnd da folha já existente) em vez do +13 fixo.
export function isWithinRange(startISO: string, endISO: string, dateISO: string): boolean {
  const start = new Date(startISO + "T00:00:00Z");
  const end = new Date(endISO + "T00:00:00Z");
  const date = new Date(dateISO + "T00:00:00Z");
  return date >= start && date <= end;
}

// Rótulo de período unificado: usa o weekEnd real quando existir (folhas
// novas, duração livre); cai no cálculo legado fixo (+4 semanal / 10 dias
// úteis quinzenal) pras folhas antigas, que nunca tiveram weekEnd gravado.
export function formatPeriodRange(startISO: string, endISO: string | null, periodType: "weekly" | "biweekly"): string {
  if (endISO) return `${formatDDMM(startISO)} — ${formatDDMM(endISO)}`;
  return periodType === "biweekly" ? formatFortnightRange(startISO) : formatWeekRange(startISO);
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
