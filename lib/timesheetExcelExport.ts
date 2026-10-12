import { STATUS_DAY_CODES, STATUS_DAY_HEX, STATUS_DAY_LABEL, type StatusDayCode } from "./timesheetStatusColors";

// Export em .xlsx da "Sign In & Sign Out Book", seguindo o modelo que o time
// já usava manualmente: tudo numa aba só (tabela principal e depois, mais
// embaixo na MESMA aba, a tabela "Building Covers" — não em abas separadas,
// senão quem abre só vê a primeira e acha que faltou o resto), com logos de
// verdade no cabeçalho, legenda em grade, dia do mês + dia da semana por
// cima de IN/OUT, colunas estreitas "s" pro fim de semana, e semana inteira
// do mesmo código HP/AA/... mesclada numa célula só. `exceljs` carregado sob
// demanda, só quando alguém clica em exportar.
//
// Diferença proposital em relação à folha impressa: aqui Building/WO/Hours
// saem repetidos em TODA linha (não mesclados verticalmente) — célula
// mesclada verticalmente é ótima pro papel, péssima pra quem vai ordenar/
// filtrar a planilha no Excel depois. A mesclagem horizontal de dias com o
// mesmo código continua, porque isso é só legibilidade, não atrapalha
// ordenar linhas.
const PETROL_ARGB = "FF0D4F5C";
const WHITE_ARGB = "FFFFFFFF";
const BORDER_ARGB = "FFDDE3E3";
const SPACER_ARGB = "FFF2F6F6";
const MUTED_ARGB = "FF6B7676";

const THIN_BORDER = { style: "thin" as const, color: { argb: BORDER_ARGB } };
const ALL_BORDERS = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

function styleHeaderCell(cell: import("exceljs").Cell) {
  cell.font = { bold: true, color: { argb: WHITE_ARGB } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PETROL_ARGB } };
  cell.border = ALL_BORDERS;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

function argbFromHex(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

function matchCode(value: string | null | undefined): StatusDayCode | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  return (STATUS_DAY_CODES as readonly string[]).includes(v) ? (v as StatusDayCode) : null;
}

function codeOfDay(day: ExcelDayCell | undefined): StatusDayCode | null {
  if (!day) return null;
  return matchCode(day.in) ?? matchCode(day.out);
}

const WEEKDAY_FULL = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function weekdayFullFromISO(iso: string): string {
  return WEEKDAY_FULL[new Date(iso + "T00:00:00Z").getUTCDay()];
}

function dayOfMonthFromISO(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

export type ExcelDayHeader = { isoDate: string | null; fallbackLabel: string };
export type ExcelDayCell = { in: string | null; out: string | null; color?: string | null };
export type ExcelRow = {
  building: string;
  hours: number | string | null;
  wo: string | null;
  name: string | null;
  staffNumber: string | null;
  days: ExcelDayCell[]; // mesmo tamanho/ordem de `dayHeaders`
  // Nota de semana inteira (ver TimesheetRow.weekNotes) — chave = índice do
  // segmento/semana (mesmo cálculo de `daySegments` abaixo). Quando
  // presente, vence a mesclagem automática por código pra aquela semana.
  weekNotes?: Record<number, string>;
};

export type TimesheetExcelOptions = {
  filename: string; // sem extensão
  title: string; // "Sign In & Sign Out Book"
  subtitle: string; // lista de prédios
  fortnightLabel: string; // "FORTNIGHT 21/09 — 04/10"
  teamLeaderNome: string | null;
  totalHours: number; // vai no topo da coluna "Hours", acima do rótulo
  dayHeaders: ExcelDayHeader[];
  // Índice (em dayHeaders) depois do qual insere uma coluna estreita "s" de
  // respiro (fim de semana/feriado no meio do período) — ver `spacerAfter`
  // em CombinedTimesheetEditor.
  spacerAfterIndexes: number[];
  frontRows: ExcelRow[];
  coverRows: ExcelRow[];
};

const FIXED_HEADERS = ["WO", "Name", "Staff Number"]; // Building e Hours são tratados à parte (rótulo/cabeçalho partido)
const BUILDING_COL = 1;
const WO_COL = 2;
const HOURS_COL = 3;
const NAME_COL = 4;
const STAFF_COL = 5;

type Layout = { dayColStart: number[]; spacerColOf: Map<number, number>; totalCols: number };

function computeLayout(dayCount: number, spacerAfterIndexes: Set<number>): Layout {
  const dayColStart: number[] = [];
  const spacerColOf = new Map<number, number>();
  let col = 6; // 1 Building, 2 WO, 3 Hours, 4 Name, 5 Staff Number
  for (let i = 0; i < dayCount; i++) {
    dayColStart.push(col);
    col += 2;
    if (spacerAfterIndexes.has(i)) {
      spacerColOf.set(i, col);
      col += 1;
    }
  }
  return { dayColStart, spacerColOf, totalCols: col - 1 };
}

// Segmentos de dias consecutivos sem corte de spacer no meio (cada um é uma
// "semana" visual) — usado pra decidir se mescla a semana inteira quando
// todo mundo tem o mesmo código (HP/AA/...) ou tem uma nota manual.
function daySegments(dayCount: number, spacerAfterIndexes: Set<number>): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < dayCount; i++) {
    current.push(i);
    if (spacerAfterIndexes.has(i)) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

// exceljs no navegador: `buffer` espera um Buffer de Node (não existe no
// browser); `base64` é o caminho suportado aqui (mesmo padrão já usado em
// lib/excelExport.ts pro donut do P45) — aceita tanto uma data URL quanto
// base64 puro, exceljs só corta tudo antes da primeira vírgula (se não tiver
// vírgula, usa a string inteira).
async function loadLogoBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

function buildHeader(
  sheet: import("exceljs").Worksheet,
  workbook: import("exceljs").Workbook,
  opts: TimesheetExcelOptions,
  totalCols: number,
  logos: { bidvest: string | null; ucd: string | null }
): number {
  if (logos.bidvest) {
    const id = workbook.addImage({ base64: logos.bidvest, extension: "jpeg" });
    sheet.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 130, height: 42 } });
  }
  if (logos.ucd) {
    const id = workbook.addImage({ base64: logos.ucd, extension: "png" });
    sheet.addImage(id, { tl: { col: totalCols - 1 + 0.5, row: 0.1 }, ext: { width: 46, height: 46 } });
  }

  sheet.mergeCells(1, 3, 1, Math.max(3, totalCols - 2));
  const titleCell = sheet.getCell(1, 3);
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 15, color: { argb: PETROL_ARGB } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 3, 2, Math.max(3, totalCols - 2));
  const subtitleCell = sheet.getCell(2, 3);
  subtitleCell.value = opts.subtitle;
  subtitleCell.font = { bold: true, size: 11, color: { argb: "FF12202B" } };
  subtitleCell.alignment = { horizontal: "center" };

  sheet.mergeCells(3, 1, 3, Math.max(4, Math.floor(totalCols / 2)));
  sheet.getCell(3, 1).value = opts.fortnightLabel;
  sheet.getCell(3, 1).font = { bold: true, color: { argb: MUTED_ARGB } };

  sheet.mergeCells(4, 1, 4, Math.max(4, Math.floor(totalCols / 2)));
  sheet.getCell(4, 1).value = `Team Leader: ${opts.teamLeaderNome ?? "—"}`;
  sheet.getCell(4, 1).font = { italic: true, color: { argb: MUTED_ARGB } };

  // Legenda em grade 3 colunas x 2 linhas, igual o molde manual — mais fácil
  // de ler que uma linha só de texto corrido.
  const legend: [string, string][] = [
    ["HP", "Holiday Paid"],
    ["AA", "Absent Authorized"],
    ["S", "Sick"],
    ["HU", "Holiday Unpaid"],
    ["AU", "Absent Unauthorized"],
    ["BH", "Bank Holiday"],
    ["P45", "Leaving"],
  ];
  const legendStartCol = Math.max(5, Math.floor(totalCols / 2) + 1);
  const legendColWidth = Math.max(1, Math.floor((totalCols - legendStartCol + 1) / 3));
  legend.forEach(([code, label], i) => {
    const row = 3 + Math.floor(i / 3);
    const col = legendStartCol + (i % 3) * legendColWidth;
    sheet.mergeCells(row, col, row, Math.min(totalCols, col + legendColWidth - 1));
    const cell = sheet.getCell(row, col);
    cell.value = `${code} - ${label}`;
    cell.font = { size: 9, color: { argb: MUTED_ARGB } };
    cell.alignment = { horizontal: "left" };
  });

  return 6; // próxima linha livre
}

function buildTable(
  sheet: import("exceljs").Worksheet,
  opts: TimesheetExcelOptions,
  rows: ExcelRow[],
  startRow: number,
  buildingColumnLabel: string,
  showTotalHours: boolean,
  layout: Layout,
  segments: number[][]
): number {
  const { dayColStart, spacerColOf } = layout;

  const r1 = startRow;
  const r2 = startRow + 1;
  const r3 = startRow + 2;

  sheet.mergeCells(r1, BUILDING_COL, r3, BUILDING_COL);
  const buildingHeader = sheet.getCell(r1, BUILDING_COL);
  buildingHeader.value = buildingColumnLabel;
  styleHeaderCell(buildingHeader);
  styleHeaderCell(sheet.getCell(r2, BUILDING_COL));
  styleHeaderCell(sheet.getCell(r3, BUILDING_COL));

  FIXED_HEADERS.forEach((h, i) => {
    const col = i === 0 ? WO_COL : i === 1 ? NAME_COL : STAFF_COL;
    sheet.mergeCells(r1, col, r3, col);
    const cell = sheet.getCell(r1, col);
    cell.value = h;
    styleHeaderCell(cell);
    styleHeaderCell(sheet.getCell(r2, col));
    styleHeaderCell(sheet.getCell(r3, col));
  });

  if (showTotalHours) {
    const totalCell = sheet.getCell(r1, HOURS_COL);
    totalCell.value = opts.totalHours;
    styleHeaderCell(totalCell);
    sheet.mergeCells(r2, HOURS_COL, r3, HOURS_COL);
    styleHeaderCell(sheet.getCell(r2, HOURS_COL));
    sheet.getCell(r2, HOURS_COL).value = "Hours";
    styleHeaderCell(sheet.getCell(r3, HOURS_COL));
  } else {
    sheet.mergeCells(r1, HOURS_COL, r3, HOURS_COL);
    const cell = sheet.getCell(r1, HOURS_COL);
    cell.value = "Hours";
    styleHeaderCell(cell);
    styleHeaderCell(sheet.getCell(r2, HOURS_COL));
    styleHeaderCell(sheet.getCell(r3, HOURS_COL));
  }

  opts.dayHeaders.forEach((d, i) => {
    const col = dayColStart[i];
    sheet.mergeCells(r1, col, r1, col + 1);
    const dayNumCell = sheet.getCell(r1, col);
    dayNumCell.value = d.isoDate ? dayOfMonthFromISO(d.isoDate) : d.fallbackLabel;
    styleHeaderCell(dayNumCell);
    styleHeaderCell(sheet.getCell(r1, col + 1));

    sheet.mergeCells(r2, col, r2, col + 1);
    const weekdayCell = sheet.getCell(r2, col);
    weekdayCell.value = d.isoDate ? weekdayFullFromISO(d.isoDate) : "";
    styleHeaderCell(weekdayCell);
    styleHeaderCell(sheet.getCell(r2, col + 1));

    const inCell = sheet.getCell(r3, col);
    inCell.value = "IN";
    styleHeaderCell(inCell);
    const outCell = sheet.getCell(r3, col + 1);
    outCell.value = "OUT";
    styleHeaderCell(outCell);

    const spacerCol = spacerColOf.get(i);
    if (spacerCol) {
      sheet.mergeCells(r1, spacerCol, r3, spacerCol);
      const spacerCell = sheet.getCell(r1, spacerCol);
      spacerCell.value = "s";
      spacerCell.font = { bold: true, color: { argb: WHITE_ARGB }, size: 8 };
      spacerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PETROL_ARGB } };
      spacerCell.alignment = { vertical: "middle", horizontal: "center" };
    }
  });
  sheet.getRow(r1).height = 16;
  sheet.getRow(r2).height = 16;
  sheet.getRow(r3).height = 16;

  rows.forEach((r, ri) => {
    const rowIdx = r3 + 1 + ri;
    const row = sheet.getRow(rowIdx);
    const fixedValues: [number, unknown][] = [
      [BUILDING_COL, r.building],
      [WO_COL, r.wo ?? ""],
      [HOURS_COL, r.hours ?? ""],
      [NAME_COL, r.name ?? ""],
      [STAFF_COL, r.staffNumber ?? ""],
    ];
    fixedValues.forEach(([col, v]) => {
      const cell = row.getCell(col);
      cell.value = v as any;
      cell.border = ALL_BORDERS;
      cell.alignment = { vertical: "middle", horizontal: col === NAME_COL ? "left" : "center" };
      cell.font = { bold: col !== NAME_COL };
      if (col === STAFF_COL) cell.numFmt = "@"; // Staff Number como texto (não perde zero à esquerda)
    });

    segments.forEach((seg, segIndex) => {
      const note = r.weekNotes?.[segIndex];
      const codes = seg.map((i) => codeOfDay(r.days[i]));
      const sameCode = seg.length > 1 && codes.every((c) => c !== null && c === codes[0]) ? codes[0] : null;
      if (note || sameCode) {
        const startCol = dayColStart[seg[0]];
        const endCol = dayColStart[seg[seg.length - 1]] + 1;
        sheet.mergeCells(rowIdx, startCol, rowIdx, endCol);
        const cell = sheet.getCell(rowIdx, startCol);
        cell.value = note || `${sameCode} - ${STATUS_DAY_LABEL[sameCode!]}`;
        cell.border = ALL_BORDERS;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: !!note };
        cell.font = { bold: true, italic: !!note };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: note ? "FFFFFBEB" : `FF${STATUS_DAY_HEX[sameCode!]}` },
        };
        for (let c = startCol + 1; c <= endCol; c++) row.getCell(c).border = ALL_BORDERS;
      } else {
        seg.forEach((i) => {
          const day = r.days[i] ?? { in: null, out: null };
          const col = dayColStart[i];
          const code = codeOfDay(day);
          const fillArgb = day.color ? argbFromHex(day.color) : code ? `FF${STATUS_DAY_HEX[code]}` : null;
          [day.in, day.out].forEach((v, half) => {
            const cell = row.getCell(col + half);
            cell.value = v ?? "";
            cell.border = ALL_BORDERS;
            cell.alignment = { vertical: "middle", horizontal: "center" };
            if (fillArgb) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
          });
        });
      }
      const spacerCol = spacerColOf.get(seg[seg.length - 1]);
      if (spacerCol) {
        const cell = row.getCell(spacerCol);
        cell.border = ALL_BORDERS;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SPACER_ARGB } };
      }
    });
  });

  return r3 + 1 + rows.length;
}

export async function downloadTimesheetXlsx(opts: TimesheetExcelOptions) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Timesheet");

  const spacerAfterIndexes = new Set(opts.spacerAfterIndexes);
  const layout = computeLayout(opts.dayHeaders.length, spacerAfterIndexes);
  const segments = daySegments(opts.dayHeaders.length, spacerAfterIndexes);

  const [bidvest, ucd] = await Promise.all([loadLogoBase64("/logo.jpg"), loadLogoBase64("/logoUCD.png")]);

  let nextRow = buildHeader(sheet, workbook, opts, layout.totalCols, { bidvest, ucd });
  nextRow = buildTable(sheet, opts, opts.frontRows, nextRow, "Building", true, layout, segments);

  if (opts.coverRows.length > 0) {
    nextRow += 2;
    nextRow = buildTable(sheet, opts, opts.coverRows, nextRow, "Building Covers", false, layout, segments);
  }

  sheet.getColumn(BUILDING_COL).width = 16;
  sheet.getColumn(WO_COL).width = 10;
  sheet.getColumn(HOURS_COL).width = 9;
  sheet.getColumn(NAME_COL).width = 26;
  sheet.getColumn(STAFF_COL).width = 14;
  for (let i = 0; i < opts.dayHeaders.length; i++) {
    sheet.getColumn(layout.dayColStart[i]).width = 7;
    sheet.getColumn(layout.dayColStart[i] + 1).width = 7;
    const spacerCol = layout.spacerColOf.get(i);
    if (spacerCol) sheet.getColumn(spacerCol).width = 3;
  }

  sheet.views = [{ state: "frozen", xSplit: 5, ySplit: 8 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
