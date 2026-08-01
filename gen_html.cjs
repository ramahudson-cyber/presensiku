const fs = require('fs');
const p = 'C:/Users/user/ZCodeProject/preview-leave-premium.html';
const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Premium — Cuti & Izin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:16px;background:#060311}
.c{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:4px 0;flex-wrap:wrap;gap:10px}
.hdr-title{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px}
.hdr-sub{font-size:11px;color:#9ba1ae;margin-top:2px}
.tabs{display:flex;gap:6px}
.tab{padding:8px 18px;border-radius:9999px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s}
.tab.on{background:#5800fd;color:#fff;box-shadow:0 4px 15px rgba(88,0,253,.35)}
.tab.off{background:rgba(255,255,255,.06);color:#9ba1ae}
.tab.off:hover{background:rgba(255,255,255,.1)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.col{display:flex;flex-direction:column;gap:14px}
.card{background:#161320;border-radius:20px;padding:18px;border:1px solid rgba(255,255,255,.06);position:relative;overflow:hidden}
.card-hdr{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.card-ico{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.card-title{font-size:14px;font-weight:700;color:#fff}
.card-desc{font-size:11px;color:#9ba1ae;margin-top:1px}
.fg{margin-bottom:12px}
.fg:last-child{margin-bottom:0}
.fl{font-size:10px;font-weight:700;color:#9ba1ae;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.fi,.fs,.ft{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:11px 14px;color:#fff;font-size:14px;outline:none;transition:all .2s}
.fi:focus,.fs:focus,.ft:focus{border-color:#5800fd;box-shadow:0 0 0 3px rgba(88,0,253,.15)}
.fs{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ba1ae' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
.fs option{background:#161320;color:#fff}
.ft{resize:none}
.fh{font-size:10px;color:#7066ed;margin-top:5px;font-weight:600}
.btn{width:100%;padding:13px;background:linear-gradient(135deg,#5800fd,#2415c6);color:#fff;border:none;border-radius:9999px;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;box-shadow:0 4px 20px rgba(88,0,253,.3)}
.btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
.li{background:rgba(255,255,255,.03);border-radius:16px;padding:14px;border:1px solid rgba(255,255,255,.06);margin-bottom:10px}
.li:last-child{margin-bottom:0}
.lr1{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.lt{display:flex;align-items:center;gap:8px}
.ltd{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.ltx{font-size:13px;font-weight:600;color:#fff}
.ld{font-size:11px;color:#9ba1ae;margin-bottom:4px}
.ldur{font-size:10px;color:#7066ed;font-weight:600}
.lr{font-size:12px;color:#c5c5d2;line-height:1.5}
.lrej{font-size:11px;color:#ff6b6b;margin-top:6px;padding:8px 12px;background:rgba(255,107,107,.1);border-radius:10px;border:1px solid rgba(255,107,107,.2)}
.badge{padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:700;white-space:nowrap}
.bp{background:rgba(255,193,7,.15);color:#ffc107;border:1px solid rgba(255,193,7,.3)}
.ba{background:rgba(173,255,47,.12);color:#adff2f;border:1px solid rgba(173,255,47,.25)}
.br{background:rgba(255,107,107,.12);color:#ff6b6b;border:1px solid rgba(255,107,107,.25)}
.stat-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sc{text-align:center;padding:14px;background:#161320;border-radius:16px;border:1px solid rgba(255,255,255,.06)}
.si{font-size:22px;margin-bottom:6px}
.sv{font-size:24px;font-weight:700;color:#fff}
.sl{font-size:10px;color:#9ba1ae;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
.empty{text-align:center;padding:20px}
.empty-i{font-size:28px;margin-bottom:8px;opacity:.4}
.empty-t{font-size:12px;color:#9ba1ae}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;z-index:100;backdrop-filter:blur(8px)}
.modal-box{background:#1a1528;border-radius:24px;padding:24px;width:100%;max-width:420px;border:1px solid rgba(255,255,255,.12);box-shadow:0 25px 50px rgba(0,0,0,.5)}
.modal-t{font-size:18px;font-weight:700;color:#fff;margin-bottom:4px}
.modal-d{font-size:12px;color:#9ba1ae;margin-bottom:14px}
.modal-acts{display:flex;gap:8px;margin-top:14px}
.modal-btn{flex:1;padding:12px;border-radius:14px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .2s}
.modal-cancel{background:rgba(255,255,255,.06);color:#9ba1ae}
.modal-cancel:hover{background:rgba(255,255,255,.1)}
.modal-confirm{background:#ff6b6b;color:#fff}
.modal-confirm:hover{background:#ff5252}
.btn-sm{padding:6px 14px;border-radius:9999px;font-size:11px;font-weight:600;border:none;cursor:pointer;transition:all .2s}
.btn-a{background:rgba(173,255,47,.12);color:#adff2f;border:1px solid rgba(173,255,47,.25)}
.btn-a:hover{background:rgba(173,255,47,.2)}
.btn-r{background:rgba(255,107,107,.12);color:#ff6b6b;border:1px solid rgba(255,107,107,.25)}
.btn-r:hover{background:rgba(255,107,107,.2)}
.avatar{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#5800fd,#2415c6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700;flex-shrink:0;border:1px solid rgba(255,255,255,.15)}
.sec-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:2px}
.sec-sub{font-size:11px;color:#9ba1ae;margin-bottom:12px}
.divider{height:1px;background:rgba(255,255,255,.06);margin:4px 0}
@media(max-width:768px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="c">
  <div class="hdr">
    <div>
      <div class="hdr-title">Cuti & Izin</div>
      <div class="hdr-sub">Kelola permohonan cuti, izin, dan sakit</div>
    </div>
    <div class="tabs">
      <button class="tab on">Menunggu <span style="background:rgba(255,255,255,.2);padding:1px 8px;border-radius:9999px;font-size:11px;margin-left:4px">1</span></button>
      <button class="tab off">Semua</button>
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <!-- FORM -->
      <div class="card">
        <div class="card-hdr">
          <div class="card-ico" style="background:rgba(88,0,253,.15);color:#7066ed">📝</div>
          <div>
            <div class="card-title">Ajukan Permohonan</div>
            <div class="card-desc">Izin, sakit, atau cuti</div>
          </div>
        </div>
        <form>
          <div class="fg">
            <div class="fl">Jenis Permohonan</div>
            <select class="fs">
              <option>Izin</option>
              <option>Sakit</option>
              <option>Cuti</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="fg">
              <div class="fl">Tanggal Mulai</div>
              <input type="date" class="fi" value="2026-07-31">
            </div>
            <div class="fg">
              <div class="fl">Tanggal Selesai</div>
              <input type="date" class="fi" value="2026-07-31">
            </div>
          </div>
          <div class="fh">Total: 1 hari</div>
          <div class="fg">
            <d
