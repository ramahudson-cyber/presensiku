# Hadir.Kuy — Style Reference (Light Mode)
> clean, premium, violet-accented — no glassmorphism, no gradients on cards, no dark mode

**Theme:** light — The app uses a solid white card surface system on a soft violet-tinted page background. Every card is `#FFFFFF` with a 24px (3xl) radius and a soft hairline border. No glassmorphism, no backdrop-blur on cards, no radial gradient orbs. Depth comes from subtle shadows (`0 4px 16px rgba(15,23,42,0.06)`) — never colored glows. Brand violet `#BF00FF` is the single chromatic accent, used for CTAs, icons, donut chart gradients, and divider bars. Typography remains clean: Inter/system sans, weight 400 for body, 600–800 for headlines.

## 🚨 CRITICAL RULE — REAL DATA ONLY
- **ALL pages MUST fetch data from Supabase** — NO hardcoded dummy data, NO placeholder text for real content
- Use existing services: `supabase.from("...").select(...)`, `getAttendanceHistory(user.id)`, `getServerTime()`, etc.
- Loading states: spinner with "Memuat..." text (in Indonesian)
- Error states: red icon + descriptive message + "Coba Lagi" retry button (in Indonesian)
- Empty states: descriptive Indonesian text ("Belum ada riwayat absensi.", "Tidak ada pengumuman.")
- The `fetchData` function pattern from `EmployeeDashboard.jsx` is the reference — parallel Supabase queries with `withTimeout` (20s)

## Tokens — Colors

| Name | Value | Role |
|------|-------|------|
| **Violet Brand** | `#BF00FF` | Primary CTA, brand accent — filled buttons, icon strokes, donut gradient start, status badges, active states, section accent bars |
| **Hero Violet** | `#C44DFF` | Hero gradient top — starts here, ends at deep indigo |
| **Deep Indigo** | `#8A00CC` / `#4A0099` | Hero gradient mid-to-bottom — creates depth in the hero only |
| **Donut End** | `#7066ed` | Donut chart gradient end, paired with violet brand |
| **Secondary Blue** | `#3B82F6` | Divider bar gradient bottom, status colors (e.g., "Belum") |
| **Page Background** | `#F4F2FB` | Page canvas — the soft violet-tinted backdrop for the entire page. Sits slightly above pure white |
| **Surface White** | `#FFFFFF` | Card surfaces — stats card, history card, announcements card, inputs, elevated containers |
| **Surface Hover/Row** | `rgba(15,23,42,0.02)` | Table rows, announcement items, stat rows — subtle contrast within white cards |
| **Surface Icon BG** | `#F5F3FF` | Icon container backgrounds (e.g., stat card icon boxes) — very subtle violet tint |
| **Border** | `rgba(31,41,55,0.08)` | Card borders — soft hairline on white surfaces |
| **Divider** | `#F1F5F9` | Horizontal dividers inside cards (e.g., between donut and stat rows) |
| **Text Primary** | `#0F172A` | Headings, bold labels, primary content — weight 600–800 |
| **Text Secondary** | `#475569` | Body text, table cells (e.g., time values), descriptions |
| **Text Muted** | `#94A3B8` | Eyebrow labels, table headers, helper text, empty state text |
| **Text Sub** | `#6B7280` | Metadata, footer text, table sub-labels, date ranges |
| **Donut Track** | `rgba(0,0,0,0.06)` | Background ring of donut chart — faint gray on white |
| **Status Late** | `#F59E0B` (amber) | "Terlambat" text, late row left-border accent |
| **Status On-Time** | `#10B981` (emerald) | "Tepat Waktu" text |
| **Status Alpha** | `#EF4444` (red) | "Alpha" text, error icons, alpha row left-border |
| **Status Blue** | `#3B82F6` (blue) | "Belum" text, belum row left-border |
| **Stat Hadir** | `#ADFF2F` | Hadir stat row gradient accent |
| **Stat Izin** | `#fbbf24` | Izin stat row gradient accent |
| **Stat Sakit** | `#fb923c` | Sakit stat row gradient accent |
| **Stat Alpha** | `#f87171` | Alpha stat row gradient accent |
| **Green-Yellow** | `#fbbf24` → `#85c600` | PULANG (clock-out) status card gradient |
| **Button White** | `#FFFFFF` | Hero CTA button (Absen) — on violet hero |
| **Button White Text** | `#8A00CC` | Text on white CTA button |

## Tokens — Typography

- **Font family:** Inter, system-ui, sans-serif (no Urbanist — use system geometric sans)
- **Weights:** 400 (body), 500 (subtle), 600 (heading/label), 700 (bold), 800 (headline/extrabold)
- **Sizes:** 7px, 8px, 9px, 10px, 11px, 13px, 14px, 16px, 20px, 22px, 28px, 32px
- **Letter spacing:** `tracking-[0.2em]` for uppercase eyebrows/labels, `tracking-tight` for headlines, normal for body

## Tokens — Spacing & Shapes

**Base unit:** 8px
**Density:** spacious but compact for mobile

### Border Radius
| Element | Value |
|---------|-------|
| cards | 3xl = `24px` (use `rounded-3xl`) |
| inner items / rows | `12px`–`14px` (`rounded-xl`) |
| buttons (hero CTA) | `16px` (`rounded-2xl`) |
| pills / badges | `9999px` (`rounded-full`) |
| hero bottom corners | `32px` (`rounded-b-[32px]`) |
| avatar | `16px` (`rounded-2xl`) |

### Shadows
| Name | Value | Usage |
|------|-------|-------|
| **card** | `0 4px 16px rgba(15,23,42,0.06)` | Default card elevation (stats, history, announcements) |
| **card-lg** | `0 8px 24px rgba(15,23,42,0.08)` | Hero section |
| **row** | `0 1px 3px rgba(0,0,0,0.06)` | Table rows, announcement items |
| **status-masuk** | `0 6px 20px rgba(191,0,255,0.25)` | MASUK status card (colored shadow) |
| **status-pulang** | `0 6px 20px rgba(133,198,0,0.20)` | PULANG status card (colored shadow) |
| **button-hover** | `shadow-xl` | CTA hover state |

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Page BG | `#F4F2FB` | Base page background — everything floats on this soft violet-tinted canvas |
| 1 | White Card | `#FFFFFF` | Card surfaces — stats, history, announcements, inputs. Border `rgba(31,41,55,0.08)` |
| 2 | Inner Row | `rgba(15,23,42,0.02)` | Table rows, announcement items inside white cards |
| 3 | Hero Gradient | `linear-gradient(160deg, #C44DFF 0%, #BF00FF 30%, #8A00CC 60%, #4A0099 100%)` | Hero section ONLY — full-bleed top, rounded-bottom 32px |
| 4 | Status Cards | `linear-gradient(135deg, #BF00FF 0%, #8A00CC 100%)` (MASUK) / `linear-gradient(135deg, #fbbf24 0%, #85c600 100%)` (PULANG) | MASUK & PULANG status cards — colorful, no border |

## Components

### Hero Section
**Role:** Top of employee dashboard — identity + time + shift + CTA

Full-bleed top section with `linear-gradient(160deg, #C44DFF 0%, #BF00FF 30%, #8A00CC 60%, #4A0099 100%)`. Bottom corners rounded 32px. Max-width 380px centered. Padding 32px top (pt-12), 32px sides (p-8).

**Content (two rows):**
- **Row 1:** Avatar (56px, `rounded-2xl`, `border border-white/30`, `shadow-md` if image; if no image use `bg-white/15` with letter initial) + greeting label (uppercase 11px, tracking 0.2em, `text-white` at 80%) + name (24px font-bold white) + role (12px, white at 75%)
- **Row 2:** Time (36px font-bold white, `toLocaleTimeString`) + date line (12px, white at 70%) + SHIFT pill (`bg-white/20 backdrop-blur-sm`, 10px font-semibold white, `border 1px solid rgba(255,255,255,0.25)`, `rounded-full`, "SHIFT: PAGI") — stacked on left; **Absen CTA** on right (`bg-white`, text `#8A00CC`, `rounded-2xl`, px-8 py-3, font-bold, shadow-lg, hover shadow-xl) with `ArrowRight` 16px icon

### Section Title
**Role:** Label above card sections

16px rounded-full bg-purple-50 (`#F5F3FF`) icon container (32px) with violet SVG icon stroke (`#BF00FF`, 2px stroke), alongside heading (18px font-extrabold `tracking-tight`, `#0F172A`) and subtext (10px, `#94A3B8`). Padding left 16px, margin-bottom 16px.

### MASUK Status Card
**Role:** Check-in time card

`linear-gradient(135deg, #BF00FF 0%, #8A00CC 100%)` background, 24px radius, shadow `0 6px 20px rgba(191,0,255,0.25)`. White text. "MASUK" label (9px uppercase tracking 0.2em, opacity 75%, Sun icon 13px). Large time (28px font-extrabold) or "Belum Absen" (16px font-bold) with "--:--" placeholder (20px, opacity 50%). Status badge: `bg-white/20 backdrop-blur-sm` rounded-full with emerald (on-time) or amber (late) dot.

### PULANG Status Card
**Role:** Clock-out time card

`linear-gradient(135deg, #fbbf24 0%, #85c600 100%)` background, 24px radius, shadow `0 6px 20px rgba(133,198,0,0.20)`. Black text. "PULANG" label (9px uppercase tracking 0.2em, opacity 65%, Sunset icon 13px). Same structure as MASUK. "Selesai" badge: `bg-black/10`, emerald-500 dot.

### Stats Card (Donut + Ringkasan)
**Role:** Monthly attendance summary with donut chart + stat rows

White card (`#FFFFFF`), 24px radius, border `rgba(31,41,55,0.08)`, shadow `0 4px 16px rgba(15,23,42,0.06)`. Padding 20px.

**Header:** vertical gradient bar (1x16px, `linear-gradient(180deg, #BF00FF, #3B82F6)`) + "Ringkasan Kehadiran" (12px font-bold, `#0F172A`) on left; month label (10px, `#6B7280`) on right.

**Donut chart:** 100x100 SVG, track `rgba(0,0,0,0.06)`, stroke 8, gradient `#BF00FF`→`#7066ed`, rounded linecap. Center: percentage (22px font-extrabold, `#111827`, Urbanist font if available) + "HADIR" label (7px uppercase, `#475563`). Beside donut: "Kehadiran Bulan Ini" (11px font-semibold, `#0F172A`), "{hadir} hari hadir dari {jadwalCount} hari kerja" (9px, `#6B7280`). Legend: violet gradient dot (Hadir) + gray dot (Alpha).

**Stat rows:** divider (`#F1F5F9`, 1px) then 4 rows: Hadir / Izin / Sakit / Alpha. Each row: icon container (36x36, `#F5F3FF` bg, violet SVG icon), label (14px font-semibold, `#0F172A`), description (9px, `#6B7280`), value (20px font-medium tabular, `#0F172A`), subtext (9px, `#6B7280`). Active rows: `linear-gradient(90deg, {color}12, transparent)` background, no left-border, opacity 1. Inactive rows: left-border `2px solid {color}33`, opacity 0.5. Shadow `0 1px 3px rgba(0,0,0,0.06)`.

**Footer:** top-border `#F1F5F9`, "Periode: 1 — {days} {month year}" (9px, `#6B7280`) left, "{hadir} dari {jadwalCount} hari kerja" (9px tabular) right.

### History Card
**Role:** Recent 7-day attendance history table

White card (same base as stats). Header: gradient bar + "Riwayat Absensi" (14px font-bold, `#0F172A`) left; "Lihat Semua" + History icon (10px font-semibold, `#BF00FF`, Link) right.

**Table:** grid-cols `[1fr_44px_44px_70px]` gap 12px. Header labels: TANGGAL / MASUK / PULANG / STATUS (9px uppercase tracking 0.15em font-bold, `#94A3B8`). Each row: 12px vertical padding, `rgba(15,23,42,0.02)` bg, 14px radius. Left-border: amber (late), red (alpha), blue (belum), transparent (on-time). Date label (11px font-bold, `#0F172A`), day (9px uppercase tracking wider, `#94A3B8`). Time cells (11px font-semibold tabular, `#475569`). Status text (10px font-bold): #10B981 (on-time), #F59E0B (late), #EF4444 (alpha), #3B82F6 (belum). Late: extra line showing minutes (9px, `#94A3B8`).

Empty state: "Belum ada riwayat absensi." (12px, `#94A3B8`, centered, py-6).

### Announcements Card
**Role:** Active announcements display

White card (same base). Header: gradient bar + "Pengumuman" (12px font-bold, `#0F172A`) left; Megaphone icon (16px, `#94A3B8`) right. Each item: 12px radius, `rgba(15,23,42,0.02)` bg, shadow `0 1px 3px rgba(0,0,0,0.06)`, 16px horizontal padding, 12px vertical padding, 12px gap. Title (12px font-semibold, `#0F172A`), content (10px, `#475569`).

Empty state: "Tidak ada pengumuman." (12px, `#94A3B8`, centered, py-6).

### Loading State
**Role:** Initial data fetch overlay

`fixed inset-0` on `#F4F2FB` bg. Spinner: 40px circle, 4px border, `#BF00FF` border, transparent top (animate-spin). Text: "MEMUAT..." (12px, tracking-widest uppercase, `#94A3B8`).

### Error State
**Role:** Failed data fetch

56x56 `rounded-full` container, `bg-red-50` (`#FEF2F2`), red warning SVG icon (24px, `#EF4444`). Message (12px font-medium, `#DC2626`, max-width 200px, centered). "Coba Lagi" button: `bg-[#BF00FF]` hover `bg-[#a000e6]`, white text, 12px font-semibold, `rounded-full`, px-6 py-2, `shadow-md`.

### Donut Chart Gradient (SVG defs)
```svg
<linearGradient id="dgd" x1="0%" y1="0%" x2="100%" y2="100%">
  <stop offset="0%" stopColor="#BF00FF"/>
  <stop offset="100%" stopColor="#7066ed"/>
</linearGradient>
```

### Color Tokens (light mode object pattern)
Use this object pattern in components for consistent colors:
```js
const T = {
  bg: '#F4F2FB',
  surface: '#FFFFFF',
  border: 'rgba(31,41,55,0.08)',
  div: '#F1F5F9',
  text: '#0F172A',
  textSec: '#475569',
  textMuted: '#94A3B8',
  sub: '#6B7280',
  shadow: '0 4px 16px rgba(15,23,42,0.06)',
  shadowLg: '0 8px 24px rgba(15,23,42,0.08)',
  rowBg: 'rgba(15,23,42,0.02)',
  iconBg: '#F5F3FF',
  donutTrack: 'rgba(0,0,0,0.06)',
  donutText: '#111827',
  donutSub: '#475563',
};
```

## Do's and Don'ts

### Do
- **Always fetch real data from Supabase** — never hardcode dummy data, never use placeholder text for real content
- Use `#F4F2FB` as page background, `#FFFFFF` for all card surfaces
- Use `#BF00FF` as the single brand accent — CTAs, icons, gradient bars, donut chart
- All cards: 24px (`rounded-3xl`) radius, 1px border `rgba(31,41,55,0.08)`, shadow `0 4px 16px rgba(15,23,42,0.06)`
- Hero: full-bleed violet gradient, rounded-bottom 32px, max-width 380px centered
- Status cards (MASUK/PULANG): colorful gradients, no border, colored shadows
- Use the `T` color token object for consistent light mode colors across components
- All UI text in **Bahasa Indonesia**
- Status color coding: emerald (Tepat Waktu), amber (Terlambat), red (Alpha), blue (Belum)
- Active stat rows: color-tinted gradient bg + no left border. Inactive: left color border + 0.5 opacity

### Don't
- **Don't use `darkMode` / `useTheme` in any new component** — the app is light mode only now
- Don't use `rgba(255,255,255,...)` borders, glassmorphism, or backdrop-blur on cards — those were dark mode patterns
- Don't use radial gradient orbs or glow effects
- Don't use white text on light surfaces — use `#0F172A` / `#475569`
- Don't use `rgba(0,0,0,0.4)` shadows — use `rgba(15,23,42,0.06)` for cards
- Don't introduce new colors outside the defined palette — stick to violet + status colors + neutral grays
- Don't use font weights above 800 — keep type balanced

## Quick Reference

```
Page BG:        #F4F2FB
Card surface:   #FFFFFF
Card border:    rgba(31,41,55,0.08)
Card shadow:    0 4px 16px rgba(15,23,42,0.06)
Text primary:   #0F172A
Text secondary: #475569
Text muted:     #94A3B8
Brand violet:   #BF00FF
Hero gradient:  #C44DFF → #BF00FF → #8A00CC → #4A0099
Donut gradient: #BF00FF → #7066ed
MASUK gradient: #BF00FF → #8A00CC
PULANG gradient:#fbbf24 → #85c600
Status on-time: #10B981
Status late:    #F59E0B
Status alpha:   #EF4444
Status belum:   #3B82F6
Button text:    #8A00CC (on white)
```
