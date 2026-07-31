## Fix: Menu "Menu Lainnya" tidak terlihat di dark mode

### Root Cause
`BottomSheet` selalu punya `bg-white` (background putih), dan menu items di dalamnya pakai `bg-white/5` (5% opacity white) yang **invisible** di atas background putih. Komponen tidak响应 theme.

### Perubahan

**1. `src/components/BottomSheet.jsx`** — Ikut dark/light mode
- Import `useTheme()`
- Background: `darkMode ? "bg-[#161320]" : "bg-white"`
- Border: `darkMode ? "border-white/10" : "border-gray-100"`
- Title text: `darkMode ? "text-pure-white" : "text-gray-900"`
- Close button: `darkMode ? "bg-white/10 hover:bg-white/20" : "bg-gray-100 hover:bg-gray-200"`
- Handle bar: `darkMode ? "bg-white/10" : "bg-black/10"`

**2. `src/components/BottomNav.jsx`** — Menu items ikut theme
- Dark mode: `bg-white/5 hover:bg-white/[0.07]` + `text-gray-300` (existing approach)
- Light mode: `bg-gray-100 hover:bg-gray-200` + `text-gray-700`

### File yang diubah
1. `src/components/BottomSheet.jsx`
2. `src/components/BottomNav.jsx`
