# Statistics Card — Ringkasan Kehadiran

Design specification untuk card statistik kehadiran bulan ini di Employee Dashboard.

---

## 1. Card Container (Glassmorphism)

### Structure
```
┌──────────────────────────────────────────┐
│  ═  Ringkasan Kehadiran   Juli 2026      │  ← Header
│                                          │
│  [✓] Hadir ............... 1   1/29 hari │  ← Stat Row
│  [i] Izin ................ 0   0/29 hari │  ← Stat Row
│  [♥] Sakit ............... 0   0/29 hari │  ← Stat Row
│  [✕] Alpha ............... 0   0/29 hari │  ← Stat Row
│                                          │
│  ─────────────────────────────────       │
│  Periode: 1 — 21 Juli 2026   1/29 hari  │  ← Footer
└──────────────────────────────────────────┘
```

### Container Styles

| Property | Dark Mode | Light Mode |
|----------|-----------|------------|
| **Background** | `rgba(30, 30, 50, 0.6)` | `rgba(255, 255, 255, 0.05)` |
| **Border Color** | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.05)` |
| **Border Radius** | `rounded-3xl` (24px) | `rounded-3xl` (24px) |
| **Padding** | `p-5` (20px) | `p-5` (20px) |
| **Box Shadow** | `0 8px 32px rgba(0,0,0,0.4)` | `0 8px 32px rgba(0,0,0,0.08)` |
| **Backdrop Filter** | `blur(20px)` | `blur(20px)` |
| **Overflow** | `hidden` | `hidden` |

---

## 2. Card Header

### Layout
- Flex row, items centered, justify-between, margin-bottom 16px
- Width indicator bar + label di kiri
- Month label di kanan

### Elements

| Element | Style | Dark Mode | Light Mode |
|---------|-------|-----------|------------|
| **Indicator Bar** | `w-1 h-4 rounded-full` | `linear-gradient(180deg, #BF00FF, #3B82F6)` (sama keduanya) | Sama |
| **Title** | `text-xs font-bold tracking-wide` | `text-white` | `text-gray-900` |
| **Month Label** | `text-[10px] font-medium` | `text-white/30` | `text-gray-400` |

### Content
- **Title:** `"Ringkasan Kehadiran"` (static)
- **Month Label:** Dynamic → `toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })` → contoh: `"Juli 2026"`

---

## 3. Stat Items (4 Rows)

### Data Structure
```js
const items = [
  { k: 'hadir', v: stats.hadir, color: '#ADFF2F', glow: 'rgba(173,255,47,0.1)', icon: 'check',  label: 'Hadir',       desc: 'Kehadiran tepat waktu' },
  { k: 'izin',  v: stats.izin,  color: '#fbbf24', glow: 'rgba(251,191,36,0.1)',  icon: 'info',  label: 'Izin',          desc: 'Diluar tanggung jawab' },
  { k: 'sakit', v: stats.sakit, color: '#fb923c', glow: 'rgba(251,146,60,0.1)',  icon: 'heart', label: 'Sakit',         desc: 'Tidak hadir karena sakit' },
  { k: 'alpha', v: stats.alpha, color: '#f87171', glow: 'rgba(248,113,113,0.1)', icon: 'x',     label: 'Alpha',         desc: 'Tanpa keterangan' },
];
```

### Row Container Styles

| Property | When `item.v > 0` (Active) | When `item.v === 0` (Inactive) |
|----------|---------------------------|-------------------------------|
| **Background** | `linear-gradient(90deg, {color}08, transparent)` | `transparent` |
| **Border Left** | `2px solid transparent` | `2px solid {color}33` |
| **Opacity** | `1` (fully visible) | `0.5` (dimmed) |
| **Hover** | `translateX(4px)` (always) | `translateX(4px)` (always) |
| **Box Shadow** | `0 1px 3px rgba(0,0,0,0.3)` | `0 1px 3px rgba(0,0,0,0.06)` |

### Icon

| Stat | Icon Type | SVG Shape | Size | Color |
|------|-----------|-----------|------|-------|
| **Hadir** | `check` | `<polyline points="20 6 9 17 4 12"/>` | `w-5 h-5` | `#BF00FF` (purple) |
| **Izin** | `info` | `<circle cx="12" cy="12" r="10"/> + `<line x1="12" y1="8" x2="12" y2="12"/> + `<line x1="12" y1="16" x2="12.01" y2="16"/>` | `w-5 h-5` | `#BF00FF` (purple) |
| **Sakit** | `heart` | `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67..."/>` | `w-5 h-5` | `#BF00FF` (purple) |
| **Alpha** | `x` | `<circle cx="12" cy="12" r="10"/> + `<line x1="15" y1="9" x2="9" y2="15"/> + `<line x1="9" y1="9" x2="15" y2="15"/>` | `w-5 h-5` | `#BF00FF` (purple) |

**Icon container:** `w-9 h-9 rounded-xl flex items-center justify-center` — no background, no box-shadow.

> **Catatan:** Semua icon berwarna ungu `#BF00FF` (sama dengan accent brand), bukan mengikuti warna item.

### Text Labels

| Element | Style | Dark Mode | Light Mode |
|---------|-------|-----------|------------|
| **Label** (Hadir/Izin/Sakit/Alpha) | `text-sm font-semibold` | `text-white` | `text-gray-900` |
| **Description** | `text-[9px]` | `text-white/40` | `text-gray-500` |

### Value (Right Side)

| Element | Style | Dark Mode | Light Mode |
|---------|-------|-----------|------------|
| **Count** (angka) | `text-xl font-medium tabular-nums` | `text-white` | `text-gray-900` |
| **Sub-label** (X dari Y hari) | `text-[9px] font-medium` | `text-white/40` | `text-gray-400` |

**Sub-label format:** `{item.v} dari {stats.jadwalCount} hari`

- `item.v` = nilai stat saat ini (hadir/izin/sakit/alpha)
- `stats.jadwalCount` = total hari kerja di bulan tersebut (contoh: 29)

---

## 4. Footer

### Layout
- Flex row, justify-between, margin-top 16px, padding-top 16px, top border

### Elements

| Element | Style | Dark Mode | Light Mode |
|---------|-------|-----------|------------|
| **Border Top** | — | `border-white/5` | `border-gray-100` |
| **Periode Label** | `text-[9px] font-medium` | `text-white/25` | `text-gray-400` |
| **Summary** | `text-[9px] font-medium tabular-nums` | `text-white/25` | `text-gray-400` |

### Content
- **Periode:** `"Periode: 1 — {hariIni} {Bulan} {Tahun}"` → contoh: `"Periode: 1 — 21 Juli 2026"`
- **Summary:** `"{stats.hadir} dari {stats.jadwalCount} hari kerja"` → contoh: `"1 dari 29 hari kerja"`

---

## 5. Color Palette Reference

| Asset | Hex | Usage |
|-------|-----|-------|
| **Brand Purple** | `#BF00FF` | Icon color, hero gradient |
| **Deep Indigo** | `#6600CC` | Hero gradient |
| **Dark Indigo** | `#2B0066` | Hero gradient |
| **Hadir Green** | `#ADFF2F` | Stat color (active glow: `rgba(173,255,47,0.1)`) |
| **Izin Yellow** | `#fbbf24` | Stat color (active glow: `rgba(251,191,36,0.1)`) |
| **Sakit Orange** | `#fb923c` | Stat color (active glow: `rgba(251,146,60,0.1)`) |
| **Alpha Red** | `#f87171` | Stat color (active glow: `rgba(248,113,113,0.1)`) |
| **Gradient** | `#BF00FF → #3B82F6` | Indicator bar (verical) |

---

## 6. Active vs Inactive States

Sebuah stat row dianggap **active** jika `item.v > 0` (ada data).

### Visual Difference

```
ACTIVE (v > 0):                    INACTIVE (v === 0):
╔══════════════════════════╗       ╔══════════════════════════╗
║ [purple icon] Hadir  ═>  ║       ║ [purple icon] Izin  ---- ║
║              1  1/29 hari║       ║              0  0/29 hari║
║ (fully visible)          ║       ║ (dimmed, dashed border)   ║
╚══════════════════════════╝       ╚══════════════════════════╝
  Gradient bg faint                      Transparent bg
  No left border                         Colored left border
  Opacity 1                              Opacity 0.5
```

---

## 7. Implementation Notes

### Key Variables
```js
const total = stats.hadir + stats.izin + stats.sakit + stats.alpha;
const isActive = item.v > 0;
const pct = stats.jadwalCount > 0 ? Math.round((item.v / stats.jadwalCount) * 100) : 0;
```

### Important
- **`stats.jadwalCount`** dihitung dari `employee_schedules` + `shift_schedules` tables (bukan hardcoded)
- **Month date range** menggunakan `monthStartStr` s/d `monthEndStr` dari DB query
- Semua stat row menggunakan **ikon ungu brand** (`#BF00FF`), bukan warna masing-masing stat
- Sub-label harus menggunakan **`item.v`**, bukan `stats.hadir` (bug sebelumnya)
- Footer summary **selalu** menggunakan `stats.hadir` (bukan `item.v`) — karena ini ringkasan total kehadiran

---

## 8. File Reference

| File | Line | Purpose |
|------|------|---------|
| `EmployeeDashboard.jsx` | 228-330 | Main card render |
| `EmployeeDashboard.jsx` | 61-65 | Stats computation |
| `EmployeeDashboard.jsx` | 67-86 | JadwalCount computation |
| `EmployeeDashboard.jsx` | 234-239 | Items array definition |
| `EmployeeDashboard.jsx` | 242-255 | Icon SVG definitions |
