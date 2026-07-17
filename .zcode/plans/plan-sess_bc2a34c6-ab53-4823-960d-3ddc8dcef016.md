Edit EmployeeDashboard.jsx lines 117-120: Replace the status badge in the MASUK card with conditional rendering:
- If `todayAttendance.is_late` → show "Terlambat" with `todayAttendance.late_minutes` below in red tones
- Else → show "Tepat Waktu" with green dot (current style)