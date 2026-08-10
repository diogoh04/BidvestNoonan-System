import type { P45Slice } from "./p45Report";

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
// Cor petrol (#0d4f5c) usada na Data Bar é a mesma do resto do app
// (components/DashboardView.tsx, components/P45ReportChart.tsx).
const PETROL_ARGB = "FF0D4F5C";

function columnWidths(header: string[], rows: string[][]): number[] {
  return header.map((h, i) => {
    const maxCell = rows.reduce((max, r) => Math.max(max, (r[i] ?? "").length), 0);
    return Math.min(Math.max(h.length, maxCell) + 2, 60);
  });
}

export async function downloadStaffListXlsx(opts: {
  filename: string; // sem extensão, ex. "p45"
  header: string[];
  rows: string[][];
  reportTitle?: string; // presente só quando há relatório (hoje, só P45)
  reportSlices?: P45Slice[];
}) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  const dataSheet = workbook.addWorksheet("Data");
  dataSheet.views = [{ state: "frozen", ySplit: 1 }];
  dataSheet.columns = opts.header.map((h, i) => ({
    header: h,
    width: columnWidths(opts.header, opts.rows)[i],
  }));
  dataSheet.getRow(1).font = { bold: true };
  for (const row of opts.rows) dataSheet.addRow(row);

  if (opts.reportSlices && opts.reportSlices.length > 0) {
    const reportSheet = workbook.addWorksheet("Report");
    reportSheet.columns = [
      { header: opts.reportTitle ?? "Reason", key: "label", width: 28 },
      { header: "Staff count", key: "count", width: 14 },
      { header: "% of P45", key: "pct", width: 14 },
    ];
    reportSheet.getRow(1).font = { bold: true };

    for (const s of opts.reportSlices) {
      const row = reportSheet.addRow({ label: s.label, count: s.count, pct: s.pct });
      // Célula numérica de verdade (não texto) — a Data Bar compara o
      // valor da célula, e o numFmt só cuida de mostrar o "%" ao lado.
      row.getCell("pct").numFmt = '0"%"';
    }

    const lastRow = opts.reportSlices.length + 1;
    reportSheet.addConditionalFormatting({
      ref: `C2:C${lastRow}`,
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
