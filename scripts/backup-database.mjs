#!/usr/bin/env node
/**
 * Backup harian database Presensiku.
 *
 * Plan gratis Supabase TIDAK menyediakan backup otomatis. Skrip ini membuat
 * salinan sendiri: setiap tabel di schema public + tabel auth.users (akun
 * login) diekspor sebagai JSON, lalu dibungkus menjadi satu file .json.gz.
 *
 * Kenapa lewat `supabase db query` dan bukan pg_dump?
 *   pg_dump butuh Docker/pg_dump terpasang. CLI `db query` memakai koneksi
 *   langsung ke project yang sudah di-link, jadi jalan tanpa perkakas
 *   tambahan dan tanpa menyimpan password di file.
 *
 * Hasil disimpan di %USERPROFILE%\Presensiku-Backup, dengan rotasi agar
 * disk tidak penuh. (Folder Documents sengaja tidak dipakai: pada sebagian
 * mesin folder itu diteruskan ke OneDrive/cloud dan penulisan bisa macet.)
 *
 * Pakai:
 *   node scripts/backup-database.mjs
 *   node scripts/backup-database.mjs --keep 30 --out "D:\Backup"
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const KEEP = Number(argValue('--keep', '14'));
const OUT_DIR = resolve(argValue('--out', join(homedir(), 'Presensiku-Backup')));
// scripts/backup-database.mjs → root repo
const PROJECT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Cari executable Supabase CLI (PATH dulu, lalu lokasi npm global Windows). */
function resolveCli() {
  const candidates = [
    'supabase',
    join(homedir(), 'AppData', 'Roaming', 'npm', 'supabase.cmd'),
  ];
  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" --version`, { stdio: 'ignore', timeout: 30000 });
      return candidate;
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  throw new Error('Supabase CLI tidak ditemukan. Jalankan: npm i -g supabase');
}

/**
 * Jalankan query dan kembalikan array hasil (output JSON dari CLI).
 *
 * SQL dikirim lewat file sementara (`--file`), bukan sebagai argumen CLI.
 * Query backup berisi banyak tanda kutip; pada Windows argumen seperti itu
 * rusak saat melewati cmd.exe sehingga query tidak pernah sampai utuh.
 */
function queryJson(cli, sql) {
  const sqlFile = join(tmpdir(), `presensiku-backup-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(sqlFile, sql);
  try {
    // spawnSync dengan argumen array (tanpa shell quoting manual) — execSync
    // pada Windows terbukti menggantung untuk query lanjutan.
    const res = spawnSync(cli, ['db', 'query', '--linked', '--file', sqlFile, '-o', 'json'], {
      cwd: PROJECT_DIR,
      maxBuffer: 512 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
      encoding: 'utf8',
      shell: true,
      windowsHide: true,
      input: '', // tutup stdin: CLI tidak boleh menunggu konfirmasi apa pun
    });
    if (res.error) throw new Error(res.error.message);
    if (res.status !== 0) {
      throw new Error((res.stderr || res.stdout || `exit ${res.status}`).trim().slice(0, 500));
    }
    const out = res.stdout || '';
    const start = out.indexOf('[');
    if (start < 0) throw new Error(`Output tidak dikenali: ${out.slice(0, 120)}`);
    return JSON.parse(out.slice(start));
  } finally {
    try { rmSync(sqlFile, { force: true }); } catch { /* abaikan */ }
  }
}

/** Ekspor satu tabel sebagai array of objects. Identifier dikutip ganda. */
function dumpTable(cli, schema, table) {
  const rows = queryJson(
    cli,
    `select coalesce(jsonb_agg(t), '[]'::jsonb)::text as data from ${schema}."${table}" t;`
  );
  return JSON.parse(rows[0]?.data || '[]');
}

/**
 * Ekspor SEMUA tabel dalam satu query.
 *
 * Satu panggilan CLI per tabel membuat backup butuh belasan menit (CLI
 * Supabase butuh beberapa detik untuk start setiap kali). Dengan satu
 * statement berisi banyak subselect, seluruh data terambil dalam sekali
 * koneksi — jauh lebih cepat dan tetap aman karena tiap tabel dibungkus
 * aggregate yang selalu mengembalikan array (tabel kosong → []).
 */
function dumpAll(cli, publicTables) {
  // Kunci objek JSON memakai kutip TUNGGAL (literal SQL). Kutip ganda akan
  // dibaca Postgres sebagai nama kolom → error 42703.
  const parts = [
    ...publicTables.map(
      (t) => `'public.${t}', (select coalesce(jsonb_agg(x), '[]'::jsonb) from public."${t}" x)`
    ),
    `'auth.users', (select coalesce(jsonb_agg(x), '[]'::jsonb) from auth.users x)`,
  ];
  const sql = `select jsonb_build_object(${parts.join(', ')})::text as data;`;
  const rows = queryJson(cli, sql);
  return JSON.parse(rows[0]?.data || '{}');
}

function main() {
  const cli = resolveCli();
  console.log('⏳ Menghubungi database…');
  const startedAt = new Date();
  const stamp = startedAt
    .toISOString()
    .slice(0, 19)
    .replace('T', '_')
    .replace(/:/g, '-');

  const tables = queryJson(
    cli,
    "select tablename from pg_tables where schemaname = 'public' order by tablename;"
  ).map((r) => r.tablename);
  console.log(`⏳ Mengekspor ${tables.length} tabel + akun login…`);

  const bundle = {};
  const counts = {};
  let totalRows = 0;

  try {
    // Jalur cepat: seluruh tabel dalam satu query.
    Object.assign(bundle, dumpAll(cli, tables));
    for (const [key, value] of Object.entries(bundle)) {
      counts[key] = Array.isArray(value) ? value.length : 'BUKAN ARRAY';
      if (Array.isArray(value)) totalRows += value.length;
    }
  } catch (e) {
    // Cadangan: satu tabel per query. Lebih lambat, tetapi satu tabel
    // bermasalah tidak menggagalkan seluruh backup.
    console.warn(`⚠️ Dump gabungan gagal (${String(e.message || e).slice(0, 120)}), memakai per tabel.`);
    for (const table of tables) {
      try {
        const rows = dumpTable(cli, 'public', table);
        bundle[`public.${table}`] = rows;
        counts[`public.${table}`] = rows.length;
        totalRows += rows.length;
      } catch (err) {
        counts[`public.${table}`] = `GAGAL: ${String(err.message || err).slice(0, 200)}`;
      }
    }
    // Akun login — tanpa ini database bisa dipulihkan tetapi semua user hilang.
    try {
      const users = dumpTable(cli, 'auth', 'users');
      bundle['auth.users'] = users;
      counts['auth.users'] = users.length;
      totalRows += users.length;
    } catch (err) {
      counts['auth.users'] = `GAGAL: ${String(err.message || err).slice(0, 200)}`;
    }
  }

  bundle.__manifest = {
    app: 'Presensiku',
    created_at: startedAt.toISOString(),
    project: 'muhxylbcgvwxjzrbkgdc',
    note: 'Backup data (JSON). Skema database ada di supabase/migrations pada repo.',
    total_rows: totalRows,
    tables: counts,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const outFile = join(OUT_DIR, `presensiku-backup-${stamp}.json.gz`);
  writeFileSync(outFile, gzipSync(Buffer.from(JSON.stringify(bundle))));

  // Rotasi: sisakan KEEP berkas terbaru.
  const backups = readdirSync(OUT_DIR)
    .filter((f) => f.startsWith('presensiku-backup-') && f.endsWith('.json.gz'))
    .map((f) => ({ f, t: statSync(join(OUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  const removed = backups.slice(KEEP).map((b) => b.f);
  for (const f of removed) rmSync(join(OUT_DIR, f), { force: true });

  const sizeKb = Math.round(statSync(outFile).size / 1024);
  console.log(`✅ Backup selesai: ${outFile} (${sizeKb} KB, ${totalRows} baris)`);
  console.log(`   Tabel diekspor: ${Object.keys(counts).length} · backup tersimpan: ${Math.min(backups.length, KEEP)}`);
  const failed = Object.entries(counts).filter(([, v]) => typeof v === 'string');
  if (failed.length) {
    console.log(`   ⚠️ ${failed.length} tabel gagal: ${failed.map(([k]) => k).join(', ')}`);
  }
  if (removed.length) console.log(`   Rotasi: ${removed.length} backup lama dihapus`);
}

try {
  main();
  process.exit(0);
} catch (e) {
  console.error('❌ Backup gagal:', e.message || e);
  process.exit(1);
}