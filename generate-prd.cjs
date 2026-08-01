const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, AlignmentType, HeadingLevel, WidthType, BorderStyle,
  ShadingType, NumberFormat, SectionType, TableLayoutType, Footer
} = require("docx");
const fs = require("fs");

// ============================================================
// PALETTE — GO-1 Graphite Orange (best for PRD / business plan)
// ============================================================
const P = {
  primary: "#1A2330",
  body: "#000000",
  secondary: "#909090",
  accent: "#D4875A",
  surface: "#F8F0EB",
};
const c = (hex) => hex.replace("#", "");

// ============================================================
// BORDER HELPERS
// ============================================================
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };
const horizontalLines = {
  top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) },
  left: NB, right: NB,
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" },
  insideVertical: NB,
};

// ============================================================
// COVER — R4 Top Color Block
// ============================================================
function buildCover() {
  const padL = 1200, padR = 800;
  const titleText = "PRODUK REKAMAN PRODUK";
  const titlePt = 36;
  const titleSize = titlePt * 2;
  const upperContentH = (titleText.length * titlePt * 11) + 800;
  const UPPER_CONTENT_H = Math.max(7500, upperContentH + 1500 + 800);
  const UPPER_H = UPPER_CONTENT_H;
  const DIVIDER_H = 60;

  const titleLines = splitTitleLines(titleText, Math.floor((11906 - padL - padR) / (titlePt * 16)) || 3);

  const upperBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: UPPER_H, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.primary },
        verticalAlign: "top",
        margins: { left: padL, right: padR },
        children: [
          new Paragraph({
            spacing: { before: 2800, after: 200, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: "Bale Sunat Lombok", size: titleSize, bold: true, color: c(P.accent), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: "Product Requirement Document", size: 24, color: c("FFFFFF"), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
          new Paragraph({
            spacing: { before: 1600 },
            children: [new TextRun({ text: "Versi 1.0", size: 20, color: c("C0C0C0"), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
          new Paragraph({
            spacing: { before: 60 },
            children: [new TextRun({ text: "Agustus 2026", size: 20, color: c("C0C0C0"), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
          }),
        ],
      })],
    })],
  });

  const divider = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: DIVIDER_H, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: P.accent }, children: [new Paragraph({})] }), ],
    })],
  });

  const metaLines = [
    "Dokumen ini berisi spesifikasi produk lengkap untuk platform",
    "Bale Sunat Lombok — layanan pemesanan sunat online di Lombok.",
    "",
    "Status:            Draft untuk Review",
    "Penulis:           Tim Produk",
    "Klasifikasi:       Rahasia Internal",
  ];

  const lowerContent = metaLines.map(line =>
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: line, size: 22, color: c(P.body), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
    })
  );

  return [
    upperBlock,
    divider,
    new Paragraph({ spacing: { before: 800 } }),
    ...lowerContent,
  ];
}

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([
    ...'，。、；：！？的与和及之在于为 \t',
  ]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.max(2, Math.floor(charsPerLine * 0.6)); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

// ============================================================
// HELPERS
// ============================================================
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.accent), font: { ascii: "Times New Roman", eastAsia: "SimHei" } })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
  });
}
function bullet(text) {
  return new Paragraph({
    spacing: { line: 312, before: 40, after: 40 },
    children: [
      new TextRun({ text: "\u2022 ", size: 24, color: c(P.accent), font: { ascii: "Times New Roman" } }),
      new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}
function tableRow(cells, isHeader) {
  return new TableRow({
    tableHeader: isHeader,
    cantSplit: true,
    children: cells.map(text => new TableCell({
      children: [new Paragraph({
        spacing: { line: 312 },
        children: [new TextRun({ text, size: 21, bold: isHeader, color: isHeader ? c("FFFFFF") : c(P.body), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
      })],
      shading: isHeader ? { type: ShadingType.CLEAR, fill: P.accent } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
    })),
  });
}
function makeTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: horizontalLines,
    rows: [tableRow(headers, true), ...rows.map(r => tableRow(r, false))],
  });
}

// ============================================================
// BODY CONTENT
// ============================================================
function buildBody() {
  const children = [];

  // ---- 1. Executive Summary ----
  children.push(h1("1. Ringkasan Eksekutif"));
  children.push(body("Bale Sunat Lombok adalah platform digital untuk klinik sunat di Lombok yang memudahkan pasien dalam mencari informasi layanan, membandingkan paket, melakukan pemesanan jadwal, dan berkomunikasi dengan admin secara online. Platform ini ditujukan untuk meningkatkan konversi pemesanan, mengurangi beban admin, dan memberikan pengalaman pasien yang lebih profesional."));
  children.push(body("Produk ini dikembangkan secara bertahap dalam 5 fase utama, dimulai dari website informasi (landing page) hingga sistem pemesanan online terintegrasi dengan pembayaran digital."));

  // ---- 2. Tujuan & Metrik Sukses ----
  children.push(h1("2. Tujuan & Metrik Sukses"));
  children.push(h2("2.1 Tujuan Produk"));
  children.push(bullet("Memudahkan masyarakat Lombok menemukan dan membandingkan layanan sunat secara online"));
  children.push(bullet("Mengurangi kesalahan booking dan komunikasi manual via WhatsApp"));
  children.push(bullet("Menyediakan sistem pembayaran online yang terintegrasi"));
  children.push(bullet("Membangun kepercayaan melalui testimoni dan transparansi harga"));
  children.push(h2("2.2 Metrik Sukses (KPI)"));
  children.push(makeTable(
    ["Metrik", "Target", "Ukuran"],
    [
      ["Pengunjung website / bulan", "5.000", "Fase 1-2"],
      ["Konversi booking online", "15%", "Fase 5"],
      ["Rating Google / testimoni", "4.8 / 5.0", "Fase 4"],
      ["Waktu respon chat admin", "< 5 menit", "Fase 4"],
      ["Success rate pembayaran", "98%", "Fase 5"],
      ["NPS (Net Promoter Score)", "> 60", "Fase 5"],
    ]
  ));

  // ---- 3. Profil Pengguna ----
  children.push(h1("3. Profil Pengguna"));
  children.push(h2("3.1 Segmentasi Pengguna"));
  children.push(makeTable(
    ["Persona", "Deskripsi", "Kebutuhan Utama"],
    [
      ["Orang Tua Muda", "Usia 25-40 tahun, orang tua yang mencari layanan sunat untuk anak", "Harga transparan, lokasi strategis, testimoni nyata, booking mudah"],
      ["Pasien Dewasa", "Remaja / dewasa yang ingin sunat mandiri", "Privasi, pilihan metode, konsultasi online"],
      ["Admin Klinik", "Staf operasional yang menangani booking & chat", "Dashboard manajemen booking, notifikasi, template respon cepat"],
      ["Dokter / Tenaga Medis", "Tenaga medis yang menjalankan prosesor sunat", "Jadwal terorganisir, catatan pasien, reminder pra-sunat"],
    ]
  ));

  // ---- 4. Ruang Lingkup Fitur ----
  children.push(h1("4. Ruang Lingkup Fitur"));
  children.push(body("Produk ini mencakup 7 fitur utama yang di-deliver bertahap selama 5 fase. Fitur-fitur dirancang dengan prinsip mobile-first karena 85%+ traffic target berasal dari perangkat mobile."));

  // 4.1 Phase 1
  children.push(h2("4.1 Fase 1 — Beranda (Homepage)"));
  children.push(body("Halaman utama yang berfungsi sebagai kartu nama digital Bale Sunat Lombok. Visitor dapat langsung mendapatkan informasi penting: harga, lokasi, dan testimoni."));
  children.push(h3("Fitur Sub-Beranda"));
  children.push(makeTable(
    ["Fitur", "Deskripsi", "Priority", "Fase"],
    [
      ["Hero Section", "Banner visual dengan headline, CTA 'Booking Sekarang', dan foto klinik", "P0", "1"],
      ["Sorotan Harga", "3 paket terpopuler ditampilkan dengan harga dan fitur ringkas", "P0", "1"],
      ["Peta Lokasi", "Embed Google Maps dengan pin lokasi klinik", "P0", "1"],
      ["Testimoni Pilihan", "3-5 testimoni terbaik yang ditampilkan secara curated", "P1", "1"],
      ["CTA Floating Button", "Tombol 'Booking' sticky di bottom mobile screen", "P0", "1"],
      ["Footer", "Informasi kontak, sosial media, link kebijakan", "P1", "1"],
    ]
  ));

  // 4.2 Phase 2
  children.push(h2("4.2 Fase 2 — Harga Paket"));
  children.push(body("Halaman detail semua paket layanan sunat dengan perbandingan fitur yang transparan."));
  children.push(h3("Fitur Sub-Harga Paket"));
  children.push(makeTable(
    ["Fitur", "Deskripsi", "Priority", "Fase"],
    [
      ["Daftar Paket", "Grid/kartu semua paket (Basic, Premium, VIP) dengan harga", "P0", "2"],
      ["Rincian Layanan", "Halaman detail per paket: apa saja yang termasuk", "P0", "2"],
      ["Perbandingan Paket", "Tabel side-by-side semua paket untuk memudahkan decision making", "P1", "2"],
      ["FAQ Harga", "Pertanyaan umum tentang harga, cicilan, diskon", "P2", "2"],
      ["Promo / Bundle", "Banner promo aktif (misal: diskon keluarga, early bird)", "P2", "2"],
    ]
  ));

  // 4.3 Phase 3
  children.push(h2("4.3 Fase 3 — Lokasi Klinik"));
  children.push(body("Halaman informasi lokasi clinic yang mencakup peta interaktif dan detail kontak."));
  children.push(h3("Fitur Sub-Lokasi"));
  children.push(makeTable(
    ["Fitur", "Deskripsi", "Priority", "Fase"],
    [
      ["Peta Interaktif", "Google Maps embed dengan marker klinik, bisa zoom & get directions", "P0", "3"],
      ["Alamat & Kontak", "Detail alamat, nomor telepon, WhatsApp, email per cabang", "P0", "3"],
      ["Jam Praktik", "Tabel jam buka-tutup per hari, termasuk hari libur nasional", "P0", "3"],
      ["Foto Klinik", "Gallery foto interior/eksterior klinik", "P1", "3"],
      ["Cara Menuju", "Panduan arah dari landmark terkenal", "P2", "3"],
    ]
  ));

  // 4.4 Phase 4
  children.push(h2("4.4 Fase 4 — Testimoni"));
  children.push(body("Platform untuk mengumpulkan, menampilkan, dan mengelola testimoni dari pasien dan orang tua."));
  children.push(h3("Fitur Sub-Testimoni"));
  children.push(makeTable(
    ["Fitur", "Deskripsi", "Priority", "Fase"],
    [
      ["Semua Testimoni", "List/grid semua testimoni dengan filter rating", "P0", "4"],
      ["Kirim Testimoni", "Formulir submission testimoni dengan upload foto (opsional)", "P0", "4"],
      ["Rating & Review", "Sistem bintang 1-5 dengan teks review", "P0", "4"],
      ["Verifikasi", "Badge 'Terverifikasi' untuk testimoni dari pasien yang sudah booking", "P1", "4"],
      ["Moderasi Admin", "Panel admin untuk approve/reject testimoni", "P1", "4"],
    ]
  ));

  // 4.5 Phase 5
  children.push(h2("4.5 Fase 5 — Pemesanan Jadwal"));
  children.push(body("Fitur inti yang mengizinkan user untuk melakukan booking jadwal sunat secara online lengkap dengan pembayaran."));
  children.push(h3("Fitur Sub-Pemesanan"));
  children.push(makeTable(
    ["Fitur", "Deskripsi", "Priority", "Fase"],
    [
      ["Formulir Pemesanan", "Form multi-step: nama, umur, kontak, keluhan/kondisi khusus", "P0", "5"],
      ["Pilih Tanggal & Jam", "Calendar picker dengan slot waktu tersedia (real-time)", "P0", "5"],
      ["Pembayaran Online", "Integrasi payment gateway (Midtrans/Xendit): QRIS, transfer, e-wallet", "P0", "5"],
      ["Konfirmasi Booking", "Halaman konfirmasi + notifikasi WhatsApp/email + QR ticket", "P0", "5"],
      ["Reschedule / Cancel", "Fitur ubah batal jadwal (dengan kebijakan refund)", "P1", "5"],
      ["Admin Dashboard", "Panel admin untuk manage booking, status, reminder", "P0", "5"],
      ["Pengingat Otomatis", "WhatsApp/SMS reminder H-1 dan H-0 jadwal sunat", "P1", "5"],
    ]
  ));

  // 4.6 Future
  children.push(h2("4.6 Fase Future — Konsultasi Chat & Tanya Jawab"));
  children.push(makeTable(
    ["Fitur", "Deskripsi", "Priority"],
    [
      ["Chat Admin Real-time", "Widget chat di website, bisa kirim foto & pesan cepat", "P1 (Future)"],
      ["FAQ Sunat", "Database FAQ yang bisa di-search, categorized by topic", "P1 (Future)"],
      ["Ajukan Pertanyaan", "User submit pertanyaan, dijawab oleh admin/dokter", "P2 (Future)"],
      ["Jawaban Publik", "Semua jawaban ditampilkan agar user lain bisa benefit", "P2 (Future)"],
    ]
  ));

  // ---- 5. User Flows ----
  children.push(h1("5. Alur Pengguna (User Flows)"));
  children.push(h2("5.1 Flow: Visitor -> Book -> Pay"));
  children.push(body("Langkah-langkah utama user dari kunjungan pertama hingga successful booking:"));
  children.push(makeTable(
    ["Langkah", "Aksi User", "Sistem Menampilkan"],
    [
      ["1", "Buka website dari Google/ referral", "Halaman Beranda dengan hero banner"],
      ["2", "Klik 'Lihat Paket' atau langsung 'Booking'", "Halaman Harga Paket atau Booking Form"],
      ["3", "Pilih paket dan baca rincian", "Detail paket dengan tombol 'Pilih Paket Ini'"],
      ["4", "Isi formulir booking (nama, umur, kontak)", "Form validasi real-time, step indicator"],
      ["5", "Pilih tanggal & jam tersedia", "Calendar + time slot yang sudah terisi"],
      ["6", "Review & konfirmasi", "Ringkasan booking + total biaya"],
      ["7", "Lakukan pembayaran", "Payment gateway dengan pilihan metode"],
      ["8", "Booking confirmed!", "Halaman sukses + QR ticket + notifikasi WA"],
    ]
  ));

  children.push(h2("5.2 Flow: Admin Manage Booking"));
  children.push(makeTable(
    ["Langkah", "Aksi Admin", "Sistem Menampilkan"],
    [
      ["1", "Login ke admin dashboard", "Login page"],
      ["2", "Lihat daftar booking hari ini", "List dengan filter: belum bayar, sudah bayar, selesai"],
      ["3", "Update status booking", "Dropdown: confirmed, completed, cancelled"],
      ["4", "Kirim reminder manual (opsional)", "Tombol 'Kirim Reminder' → trigger WA otomatis"],
    ]
  ));

  // ---- 6. Arsitektur Teknis ----
  children.push(h1("6. Arsitektur Teknis"));
  children.push(h2("6.1 Tech Stack"))
  children.push(makeTable(
    ["Layer", "Teknologi", "Keterangan"],
    [
      ["Frontend", "Next.js 14 (App Router) + Tailwind CSS", "SSR untuk SEO, mobile-first responsive"],
      ["Backend", "Node.js / NestJS", "REST API, terstruktur & scalable"],
      ["Database", "PostgreSQL (Supabase)", "Relational data, booking integrity"],
      ["Auth", "Supabase Auth / NextAuth", "Email + OTP login, admin role-based"],
      ["Payment", "Midtrans / Xendit", "QRIS, VA, GoPay, OVO, ShopeePay"],
      ["WA Notification", "Wablas / Fonnte / Twilio WA", "Reminder, konfirmasi, notifikasi"],
      ["Hosting", "Vercel (frontend) + Supabase (backend)", "Auto CI/CD, global edge network"],
      ["Maps", "Google Maps API", "Embed + Geocoding + Directions"],
    ]
  ));

  children.push(h2("6.2 Database Schema (Core Tables)"));
  children.push(makeTable(
    ["Tabel", "Kolom Utama", "Keterangan"],
    [
      ["users", "id, name, email, phone, role", "Pengguna: admin, dokter, patient"],
      ["packages", "id, name, price, features[], status", "Paket layanan sunat"],
      ["bookings", "id, user_id, package_id, date, time, status, payment_status", "Data booking"],
      ["payments", "id, booking_id, amount, method, status, proof_url", "Transaksi pembayaran"],
      ["testimonials", "id, user_id, rating, review, photo_url, is_verified, status", "Testimoni (pending/approved)"],
      ["faqs", "id, question, answer, category, is_public", "FAQ publik"],
    ]
  ));

  // ---- 7. Roadmap ----
  children.push(h1("7. Roadmap & Timeline"));
  children.push(h2("7.1 Phased Rollout Plan"));
  children.push(makeTable(
    ["Fase", "Fitur", "Estimasi", "Dependency"],
    [
      ["Fase 1", "Beranda (Hero, Sorotan Harga, Peta, Testimoni)", "2-3 minggu", "-"],
      ["Fase 2", "Harga Paket (Daftar, Rincian, Perbandingan)", "1-2 minggu", "Fase 1 selesai"],
      ["Fase 3", "Lokasi Klinik (Maps, Kontak, Jam)", "1 minggu", "Fase 1 selesai"],
      ["Fase 4", "Testimoni (List, Submit, Review, Moderasi)", "2 minggu", "Fase 1-3"],
      ["Fase 5", "Pemesanan Jadwal + Pembayaran Online", "4-6 minggu", "Fase 1-4, Payment Gateway approved"],
      ["Future", "Konsultasi Chat + Tanya Jawab Dokter", "3-4 minggu", "Fase 5 selesai"],
    ]
  ));

  children.push(h2("7.2 Milestone Checklist"));
  children.push(makeTable(
    ["Milestone", "Deliverable", "Target"],
    [
      ["M1 — Alpha", "Fase 1-3 live, bisa diakses publik", "Bulan 1-2"],
      ["M2 — Beta", "Fase 4-5 live, booking + payment berfungsi", "Bulan 3"],
      ["M3 — GA", "Semua fase complete, monitoring + analytics", "Bulan 4"],
      ["M4 — Scale", "Chat + FAQ, optimasi performa, SEO deep-dive", "Bulan 5-6"],
    ]
  ));

  // ---- 8. Analytics & Monitoring ----
  children.push(h1("8. Analitik & Monitoring"));
  children.push(h2("8.1 Event Tracking"));
  children.push(makeTable(
    ["Event", "Property", "Tujuan"],
    [
      ["page_view", "page_name, referrer", "Analyse traffic source"],
      ["package_view", "package_id, package_name", "Track paket terpopuler"],
      ["booking_start", "package_id", "Measure conversion funnel"],
      ["booking_complete", "booking_id, total_price", "Track successful booking"],
      ["payment_complete", "booking_id, method, amount", "Analyze payment preference"],
      ["testimonial_submit", "rating, review_length", "Monitor testimoni engagement"],
    ]
  ));

  children.push(h2("8.2 Tools"));
  children.push(bullet("Google Analytics 4: traffic, user behavior, funnel conversion"));
  children.push(bullet("Google Search Console: SEO performance, keyword ranking"));
  children.push(bullet("Vercel Analytics: Core Web Vitals, page speed"));
  children.push(bullet("Error Tracking: Sentry untuk capture frontend/backend errors"));

  // ---- 9. Risiko & Mitigasi ----
  children.push(h1("9. Risiko & Mitigasi"));
  children.push(makeTable(
    ["Risiko", "Dampak", "Likelihood", "Mitigasi"],
    [
      ["Payment gateway rejected", "Booking tidak bisa bayar", "Medium", "Siapkan fallback manual (transfer bank + upload bukti)"],
      ["Booking no-show", "Slot kosong, revenue hilang", "High", "DP deposit, reminder otomatis, kebijakan no-show"],
    ]
  ));

  // ---- 10. Lampiran ----
  children.push(h1("10. Lampiran"));
  children.push(h2("10.1 Glossary"));
  children.push(makeTable(
    ["Istilah", "Definisi"],
    [
      ["Sunat", "Prosedur Circumcision (pengangkatan kulup penis), layanan medis yang ditawarkan"],
      ["DP Deposit", "Pembayaran awal untuk memvalidasi booking (bukan full payment)"],
      ["Payment Gateway", "Layanan pihak ketiga yang memproses pembayaran online (Midtrans/Xendit)"],
      ["CTA", "Call-to-Action: tombol/link yang mendorong user melakukan sesuatu (misal 'Booking')"],
      ["QRIS", "Quick Response Code Indonesian Standard: standar QR payment di Indonesia"],
      ["NPS", "Net Promoter Score: metrik kepuasan pelanggan (0-100)"],
      ["KPI", "Key Performance Indicator: metrik kunci untuk mengukur kesuksesan produk"],
    ]
  ));

  children.push(h2("10.2 Referensi"));
  children.push(body("1. Competitive Analysis: Klinik sunat kompetitor di Lombok (harga, website, review Google)\n2. User Research: Survey/interview dengan 10+ orang tua yang pernah melakukan sunat\n3. Design Mockup: Figma file (link: \u3010Insert Figma URL\u3011)\n4. Payment Gateway Docs: Midtrans / Xendit API documentation"));

  return children;
}

// ============================================================
// ASSEMBLE DOCUMENT
// ============================================================
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.accent) },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCover(),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Bale Sunat Lombok \u2014 PRD v1.0", size: 16, color: c(P.secondary), font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })],
            })],
          }),
        },
      },
      children: buildBody(),
    },
  ],
});

// ============================================================
// EXPORT
// ============================================================
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("PRD-Bale-Sunat-Lombok.docx", buffer);
  console.log("Document generated: PRD-Bale-Sunat-Lombok.docx");
});
