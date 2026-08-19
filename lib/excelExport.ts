import type { P45BuildingSlice, P45Slice } from "./p45Report";

// Export em .xlsx de verdade (não CSV) — usado pelo botão "Export list" em
// app/outros/[status]/OutrosStatusClient.tsx. `exceljs` só é carregado sob
// demanda (dynamic import), pra não inflar o bundle inicial da página com
// uma lib que só roda quando alguém clica em exportar.
//
// Por que .xlsx em vez de CSV: (1) é o único jeito de ter algo visual (a
// "Data Bar" nativa do Excel, ver abaixo) sobrevivendo à abertura do
// arquivo — CSV é texto puro, não carrega nenhuma formatação; (2) resolve
// de vez o problema de CSV "bagunçado" no Excel (separador `,`/`;`
// ambíguo conforme a configuração regional do Windows) — .xlsx é um
// formato binário estruturado, sem essa ambiguidade.
//
// Cor petrol (#0d4f5c) usada na Data Bar/cabeçalhos é a mesma do resto do
// app (components/DashboardView.tsx, components/P45ReportChart.tsx).
const PETROL_ARGB = "FF0D4F5C";
const WHITE_ARGB = "FFFFFFFF";
const BORDER_ARGB = "FFDDE3E3"; // = tailwind.config "line"
const ZEBRA_ARGB = "FFF2F6F6"; // tom bem claro de petrol, só pra separar linhas
const INK = "#12202b";
const INK_MUTED = "#6b7676";

const THIN_BORDER = { style: "thin" as const, color: { argb: BORDER_ARGB } };
const ALL_BORDERS = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

function styleHeaderCell(cell: import("exceljs").Cell) {
  cell.font = { bold: true, color: { argb: WHITE_ARGB } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PETROL_ARGB } };
  cell.border = ALL_BORDERS;
  cell.alignment = { vertical: "middle" };
}

function styleBodyCell(cell: import("exceljs").Cell, zebra: boolean) {
  cell.border = ALL_BORDERS;
  cell.alignment = { vertical: "middle" };
  if (zebra) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_ARGB } };
}

function columnWidths(header: string[], rows: string[][]): number[] {
  return header.map((h, i) => {
    const maxCell = rows.reduce((max, r) => Math.max(max, (r[i] ?? "").length), 0);
    return Math.min(Math.max(h.length, maxCell) + 3, 60);
  });
}

function argbFromHex(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

// Desenha o mesmo donut do relatório em tela (components/P45ReportChart.tsx
// → BuildingDonut) num <canvas> offscreen e devolve um PNG — exceljs não
// tem API de gráfico nativo do Excel, então a forma de ter algo visual
// (como na foto de referência) é embutir uma imagem já renderizada.
// Ângulo inicial e proporção do anel (innerR/outerR ≈ 0.62) casam com o
// gráfico recharts da tela, pra ficar igual em export e no app.
function renderBuildingDonutPng(slices: P45BuildingSlice[], total: number, size = 240): string {
  const scale = 2; // desenha em 2x e reduz na hora de embutir — evita ficar borrado
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.62;
  const gap = slices.length > 1 ? 0.03 : 0;

  let angle = -Math.PI / 2; // 12h, mesmo ponto de partida do PieChart em tela
  for (const s of slices) {
    const frac = total > 0 ? s.count / total : 0;
    const sweep = frac * Math.PI * 2;
    const start = angle + gap / 2;
    const end = angle + sweep - gap / 2;
    if (end > start) {
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, start, end);
      ctx.arc(cx, cy, innerR, end, start, true);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
    }
    angle += sweep;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.font = "700 26px Arial, Helvetica, sans-serif";
  ctx.fillText(String(total), cx, cy - 8);
  ctx.font = "400 12px Arial, Helvetica, sans-serif";
  ctx.fillStyle = INK_MUTED;
  ctx.fillText("staff", cx, cy + 14);

  return canvas.toDataURL("image/png");
}

export async function downloadStaffListXlsx(opts: {
  filename: string; // sem extensão, ex. "p45"
  header: string[];
  rows: string[][];
  reportTitle?: string; // presente só quando há relatório (hoje, só P45)
  reportSlices?: P45Slice[];
  // Breakdown por último prédio antes da saída — mutuamente exclusivo
  // (soma das % ≈ 100%), por isso ganha o donut; reportSlices (motivos)
  // continua só tabela+databar porque um staff pode ter mais de um motivo.
  buildingReport?: { total: number; slices: P45BuildingSlice[] };
}) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  // ---------- Aba "Data": a lista crua, com cara de tabela de verdade
  // (cabeçalho colorido, bordas, zebra) em vez de texto solto. ----------
  const dataSheet = workbook.addWorksheet("Data");
  dataSheet.views = [{ state: "frozen", ySplit: 1 }];
  dataSheet.columns = opts.header.map((h, i) => ({
    header: h,
    width: columnWidths(opts.header, opts.rows)[i],
  }));

  const headerRow = dataSheet.getRow(1);
  headerRow.height = 20;
  opts.header.forEach((_, i) => styleHeaderCell(headerRow.getCell(i + 1)));

  // Colunas 2 e 3 são sempre "Staff Number" e "Phone" (ver header em
  // OutrosStatusClient.tsx) — números de telefone/matrícula guardados como
  // texto (pra preservar zeros à esquerda e o "+" do DDI), mas o Excel os
  // vê parecidos com número e marca com aquele triângulo verde de aviso
  // ("Number Stored as Text"). numFmt "@" (texto) avisa o Excel que é
  // proposital, e o aviso some.
  opts.rows.forEach((rowValues, i) => {
    const row = dataSheet.addRow(rowValues);
    const zebra = i % 2 === 1;
    rowValues.forEach((_, c) => {
      const cell = row.getCell(c + 1);
      styleBodyCell(cell, zebra);
      if (c === 1 || c === 2) cell.numFmt = "@";
    });
  });

  const hasReasonReport = opts.reportSlices && opts.reportSlices.length > 0;
  const hasBuildingReport = opts.buildingReport && opts.buildingReport.slices.length > 0;

  if (hasReasonReport || hasBuildingReport) {
    const reportSheet = workbook.addWorksheet("Report");

    // Título no topo, como o cabeçalho "Leaving reasons report" da tela
    // (components/P45ReportChart.tsx) — as tabelas ficam abaixo dele.
    reportSheet.getCell("A1").value = "P45 — leaving reasons report";
    reportSheet.getCell("A1").font = { bold: true, size: 14, color: { argb: PETROL_ARGB } };
    reportSheet.getRow(1).height = 24;

    const tableStartRow = 3;

    // ---------- Tabela: por motivo (barras, não donut — ver comentário
    // acima de renderBuildingDonutPng) ----------
    if (hasReasonReport) {
      const slices = opts.reportSlices!;
      reportSheet.getColumn(1).width = 28;
      reportSheet.getColumn(2).width = 14;
      reportSheet.getColumn(3).width = 14;

      const tableHeaderRow = reportSheet.getRow(tableStartRow);
      tableHeaderRow.getCell(1).value = opts.reportTitle ?? "Reason";
      tableHeaderRow.getCell(2).value = "Staff count";
      tableHeaderRow.getCell(3).value = "% of P45";
      [1, 2, 3].forEach((c) => styleHeaderCell(tableHeaderRow.getCell(c)));
      tableHeaderRow.height = 20;

      slices.forEach((s, i) => {
        const row = reportSheet.getRow(tableStartRow + 1 + i);
        const zebra = i % 2 === 1;
        row.getCell(1).value = s.label;
        row.getCell(2).value = s.count;
        const pctCell = row.getCell(3);
        pctCell.value = s.pct;
        // Célula numérica de verdade (não texto) — a Data Bar compara o
        // valor da célula, e o numFmt só cuida de mostrar o "%" ao lado.
        pctCell.numFmt = '0"%"';
        [1, 2, 3].forEach((c) => styleBodyCell(row.getCell(c), zebra));
      });

      const lastRow = tableStartRow + slices.length;
      reportSheet.addConditionalFormatting({
        ref: `C${tableStartRow + 1}:C${lastRow}`,
        rules: [
          // `color` é documentado no README do exceljs pra dataBar, mas os
          // typings publicados (DataBarRuleType) ainda não o incluem — daí o
          // `as any` aqui; sem ele o Excel usa a cor padrão (azul).
          {
            type: "dataBar",
            cfvo: [
              { type: "num", value: 0 },
              { type: "num", value: 100 },
            ],
            color: { argb: PETROL_ARGB },
            gradient: false,
            border: false,
          } as any,
        ],
      });
    }

    // ---------- Tabela: por último prédio (donut ao lado) ----------
    // Colunas D e E ficam em branco como respiro entre as duas tabelas; a F
    // é o "swatch" de cor — a mesma cor da fatia do donut — pra identidade
    // não depender só de cor (o nome do prédio ao lado já cumpre isso, o
    // quadradinho é só o elo visual com o gráfico).
    if (hasBuildingReport) {
      const { total, slices } = opts.buildingReport!;
      const swatchCol = 6;
      const labelCol = 7;
      const countCol = 8;
      const pctCol = 9;

      reportSheet.getColumn(swatchCol).width = 3;
      reportSheet.getColumn(labelCol).width = 28;
      reportSheet.getColumn(countCol).width = 14;
      reportSheet.getColumn(pctCol).width = 14;

      const tableHeaderRow = reportSheet.getRow(tableStartRow);
      tableHeaderRow.getCell(swatchCol).value = "";
      tableHeaderRow.getCell(labelCol).value = "Last building";
      tableHeaderRow.getCell(countCol).value = "Staff count";
      tableHeaderRow.getCell(pctCol).value = "% of P45";
      [swatchCol, labelCol, countCol, pctCol].forEach((c) => styleHeaderCell(tableHeaderRow.getCell(c)));
      tableHeaderRow.height = 20;

      slices.forEach((s, i) => {
        const row = reportSheet.getRow(tableStartRow + 1 + i);
        const zebra = i % 2 === 1;
        row.getCell(labelCol).value = s.label;
        row.getCell(countCol).value = s.count;
        const pctCell = row.getCell(pctCol);
        pctCell.value = s.pct;
        pctCell.numFmt = '0"%"';
        [labelCol, countCol, pctCol].forEach((c) => styleBodyCell(row.getCell(c), zebra));
        // Swatch: cor da fatia sempre vence a zebra, senão perde o sentido.
        const swatch = row.getCell(swatchCol);
        swatch.border = ALL_BORDERS;
        swatch.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argbFromHex(s.color) } };
      });

      const lastRow = tableStartRow + slices.length;
      const pctColLetter = reportSheet.getColumn(pctCol).letter;
      reportSheet.addConditionalFormatting({
        ref: `${pctColLetter}${tableStartRow + 1}:${pctColLetter}${lastRow}`,
        rules: [
          {
            type: "dataBar",
            cfvo: [
              { type: "num", value: 0 },
              { type: "num", value: 100 },
            ],
            color: { argb: PETROL_ARGB },
            gradient: false,
            border: false,
          } as any,
        ],
      });

      // Donut à direita das duas tabelas, alinhado ao topo delas — mesmo
      // dado, mesmas cores (P45BuildingSlice.color) do gráfico em tela.
      // `tl.col`/`tl.row` do exceljs são 0-indexados (0 = coluna A), então
      // `pctCol` (1-indexado, "I") já aponta pra logo depois dela ("J").
      const png = renderBuildingDonutPng(slices, total, 220);
      const imageId = workbook.addImage({ base64: png, extension: "png" });
      reportSheet.addImage(imageId, {
        tl: { col: pctCol, row: tableStartRow - 1 },
        ext: { width: 220, height: 220 },
      });
    }

    reportSheet.views = [{ state: "frozen", ySplit: tableStartRow }];
  }

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
