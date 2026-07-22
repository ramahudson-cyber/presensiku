# Announcement Card — Pengumuman

Design specification untuk card pengumuman di Employee Dashboard.

---

## 1. Card Container (Glassmorphism)

### Structure
```
┌──────────────────────────────────────────┐
│  ═  Pengumuman              [Megaphone]  │  ← Header
│                                          │
│  ┌────────────────────────────────┐      │
│  │ Judul Pengumuman               │      │
│  │ Isi pengumuman...              │      │  ← Announcement Item
│  └────────────────────────────────┘      │
│  ┌────────────────────────────────┐      │
│  │ Judul Pengumuman 2             │      │
│  │ Isi pengumuman 2...            │      │  ← Announcement Item
│  └────────────────────────────────┘      │
│                                          │
│  Tidak ada pengumuman.                   │  ← Empty State
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
- Icon Megaphone di kanan

### Elements

| Element | Style | Dark Mode | Light Mode |
|---------|-------|-----------|------------|
| **Indicator Bar** | `w-1 h-4 rounded-full` | `linear-gradient(180deg, #BF00FF, #3B82F6)` (sama keduanya) | Sama |
| **Title** | `text-xs font-bold tracking-wide` | `text-white` | `text-gray-900` |
| **Icon** | `size={16}` | `text-white/30` | `text-gray-400` |

### Content
- **Title:** `"Pengumuman"` (static)
- **Icon:** `<Megaphone size={16} />` (Lucide icon)

---

## 3. Announcement Items

### Data Structure
```js
const announcements = [
  { id: 1, title: 'Judul Pengumuman', content: 'Isi pengumuman...' },
  { id: 2, title: 'Judul Pengumuman 2', content: 'Isi pengumuman 2...' },
];
```

### Item Container Styles

| Property | Value |
|----------|-------|
| **Border Radius** | `rounded-xl` (12px) |
| **Padding** | `px-4 py-3` (16px horizontal, 12px vertical) |
| **Gap Between Items** | `space-y-2` (8px vertical gap) |
| **Hover** | `translateX-1` (4px translate right) |

### Item Background

| Property | Value |
|----------|-------|
| **Background Dark** | `rgba(255, 255, 255, 0.03)` |
| **Background Light** | `rgba(0, 0, 0, 0.02)` |
| **Box Shadow Dark** | `0 1px 3px rgba(0,0,0,0.3)` |
| **Box Shadow Light** | `0 1px 3px rgba(0,0,0,0.06)` |

### Text Labels

| Element | Style | Dark Mode | Light Mode |
|---------|-------|-----------|------------|
| **Title** (Judul Pengumuman) | `text-xs font-semibold` | `text-white` | `text-gray-900` |
| **Content** (Isi) | `text-[10px] mt-0.5` | `text-white/70` | `text-gray-700` |

---

## 4. Empty State

### Layout
- Centered, padding-top-bottom 24px (`py-6`)

### Elements

| Element | Style | Dark Mode | Light Mode |
|---------|-------|-----------|------------|
| **Text** | `text-xs text-center` | `text-white/30` | `text-gray-400` |

### Content
- **Text:** `"Tidak ada pengumuman."` (static)

---

## 5. Color Palette Reference

| Asset | Hex | Usage |
|-------|-----|-------|
| **Brand Purple** | `#BF00FF` | Gradient bar (top) |
| **Brand Blue** | `#3B82F6` | Gradient bar (bottom) |
| **Hadir Green** | `#ADFF2F` | — |
| **Dark Indigo** | `#1E1E32` | Card container dark bg base |
| **Gradient** | `#BF00FF → #3B82F6` | Indicator bar (vertical) |

---

## 6. Dark vs Light Mode Summary

| Element | Dark Mode | Light Mode |
|---------|-----------|------------|
| **Card Background** | `rgba(30, 30, 50, 0.6)` | `rgba(255, 255, 255, 0.05)` |
| **Card Shadow** | `0 8px 32px rgba(0,0,0,0.4)` | `0 8px 32px rgba(0,0,0,0.08)` |
| **Header Title** | `text-white` | `text-gray-900` |
| **Header Icon** | `text-white/30` | `text-gray-400` |
| **Item Background** | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.02)` |
| **Item Shadow** | `0 1px 3px rgba(0,0,0,0.3)` | `0 1px 3px rgba(0,0,0,0.06)` |
| **Item Title** | `text-white` | `text-gray-900` |
| **Item Content** | `text-white/70` | `text-gray-700` |
| **Empty State** | `text-white/30` | `text-gray-400` |

---

## 7. Implementation Notes

### Key Differences from Statistics Card
- **Item structure**: Pengumuman menggunakan text (title + content), bukan icon + label + value
- **Icon**: Megaphone (Lucide), bukan check/info/heart/x
- **Font size**: `text-xs` untuk title, `text-[10px]` untuk content (lebih kecil dari stat row)
- **No footer**: Tidak ada footer summary seperti Statistics Card

### Key Similarities with Statistics Card
- **Container**: Glassmorphism dark — sama persis (background, border, shadow, blur)
- **Header**: Gradient indicator bar — sama (`#BF00FF → #3B82F6`)
- **Border radius**: `rounded-3xl` (card) + `rounded-xl` (item)
- **Dark/Light color tokens**: Pola yang sama (`text-white` vs `text-gray-900`)

---

## 8. File Reference

| File | Line | Purpose |
|------|------|---------|
| `EmployeeDashboard.jsx` | ~425-454 | Announcement card render |
| `EmployeeDashboard.jsx` | ~428 | Announcements data mapping |
