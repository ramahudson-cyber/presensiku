// src/services/excelExport.js
// Export .xlsx premium (kop Presensiku + nama instansi) via exceljs.
// exceljs di-import lazy — chunk hanya dimuat saat tombol export diklik.

const BRAND = {
  primary: "BF00FF",      // electric-violet (src/index.css)
  primaryLight: "F5F0FF", // fill baris TOTAL
  text900: "37352F",      // teks utama
  text600: "8C8A84",      // caption
  line: "E9E9E8",         // garis bawah header / atas total
  zebra: "F7F7F5",        // fill baris ganjil
  white: "FFFFFF",
};

export const RUPIAH = '"Rp"#,##0;-"Rp"#,##0;"-"'; // nol tampil "-" (nilai sel tetap 0)
export const DATE_FMT = "dd/mm/yyyy";

const colLetter = (n) => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const displayLen = (v) => (v == null ? 0 : v instanceof Date ? 10 : String(v).length);

/**
 * Bangun buffer .xlsx berkop. rows = array-of-arrays (angka sebagai number,
 * tanggal sebagai Date); columnMeta per kolom: { align, numFmt, wrap }.
 * totalRow (opsional) distyle sebagai baris ringkasan.
 */
export async function buildExcelBuffer({
  sheetName = "Data",
  orgName = "Presensiku",
  docTitle = "",
  header = [],
  rows = [],
  columnMeta = [],
  totalRow = null,
}) {
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Presensiku";
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: false, state: "frozen", ySplit: 6, xSplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const nCols = header.length;
  const lastCol = 1 + nCols; // data mulai kolom B (A = margin)
  const colAt = (c) => colLetter(2 + c);

  // Lebar kolom auto-fit: isi data, atau kata terpanjang header (anti patah mid-word)
  ws.getColumn(1).width = 3;
  for (let c = 0; c < nCols; c++) {
    const headerLongest = Math.max(...String(header[c]).split(" ").map((w) => w.length));
    let max = headerLongest;
    for (const r of rows) max = Math.max(max, displayLen(r[c]));
    if (totalRow) max = Math.max(max, displayLen(totalRow[c]) + 1);
    const fmtPad = columnMeta[c]?.numFmt === RUPIAH ? 4 : 0; // "Rp" + pemisah ribuan
    ws.getColumn(2 + c).width = Math.min(32, max + fmtPad + 3);
  }

  // ── Kop (baris 2-4, merged selebar tabel) ──
  const kop = [
    { text: (orgName || "Presensiku").toUpperCase(), size: 14, bold: true, color: BRAND.text900 },
    { text: `Presensiku — ${docTitle}`, size: 12, bold: true, color: BRAND.primary },
    {
      text: `Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`,
      size: 9,
      bold: false,
      color: BRAND.text600,
    },
  ];
  kop.forEach((k, i) => {
    const row = ws.getRow(2 + i);
    ws.mergeCells(2 + i, 2, 2 + i, lastCol);
    const cell = row.getCell(2);
    cell.value = k.text;
    cell.font = { name: "Calibri", size: k.size, bold: k.bold, color: { argb: "FF" + k.color } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    row.height = i === 0 ? 26 : i === 1 ? 22 : 16;
  });
  ws.getRow(5).height = 8; // spasi kop → tabel

  // ── Header tabel (baris 6): fill primary + teks putih ──
  const headerRow = ws.getRow(6);
  header.forEach((h, c) => {
    const cell = headerRow.getCell(2 + c);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF" + BRAND.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND.primary } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF" + BRAND.line } } };
  });
  headerRow.height = 30; // muat header wrap 2 baris pada batas kata

  // ── Data: zebra tanpa border ──
  rows.forEach((r, i) => {
    const row = ws.getRow(7 + i);
    const fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + (i % 2 ? BRAND.zebra : BRAND.white) },
    };
    r.forEach((v, c) => {
      const cell = row.getCell(2 + c);
      cell.value = v;
      const meta = columnMeta[c] ?? {};
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF" + BRAND.text900 } };
      cell.alignment = {
        horizontal: meta.align === "right" ? "right" : meta.align === "center" ? "center" : "left",
        vertical: "middle",
        wrapText: meta.wrap ?? false,
      };
      cell.numFmt = meta.numFmt;
      cell.fill = fill;
    });
    row.height = 20;
  });

  // ── Baris TOTAL (opsional) ──
  if (totalRow) {
    const row = ws.getRow(7 + rows.length);
    totalRow.forEach((v, c) => {
      const cell = row.getCell(2 + c);
      cell.value = v;
      const meta = columnMeta[c] ?? {};
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF" + BRAND.primary } };
      cell.alignment = {
        horizontal: meta.align === "right" ? "right" : meta.align === "center" ? "center" : "left",
        vertical: "middle",
      };
      cell.numFmt = meta.numFmt;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BRAND.primaryLight } };
      cell.border = { top: { style: "medium", color: { argb: "FF" + BRAND.line } } };
    });
    row.height = 24;
  }

  return wb.xlsx.writeBuffer();
}

/** Unduh .xlsx di browser (dipakai halaman admin). */
export async function exportExcelWorkbook(opts) {
  const buf = await buildExcelBuffer(opts);
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.filename;
  a.click();
  URL.revokeObjectURL(url);
}
