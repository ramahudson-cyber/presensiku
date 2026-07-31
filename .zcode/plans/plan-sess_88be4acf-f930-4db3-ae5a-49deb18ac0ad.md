## Fix: "type" column not found in leave_requests schema cache

### Root Cause
Kolom `type` di tabel `leave_requests` adalah **reserved keyword** di PostgreSQL. Supabase tidak bisa mencach-nya di schema introspection, menyebabkan error:
> Could not find the 'type' column of 'leave_requests' in the schema cache

### Changes

1. **Migration DB** — `supabase/migrations/20260731000000_create_leave_requests.sql`
   - Rename kolom `type VARCHAR` → `request_type VARCHAR`
   - Update `CHECK` constraint: `CHECK (request_type IN ('izin', 'sakit'))`

2. **Frontend** — `src/services/leaveService.js`
   - `createLeaveRequest`: `.insert({ request_type: type, ... })`
   - `getMyLeaveRequests`: `.select("*")` → tetap `*` (tidak perlu change)
   - `getLeaveRequests`: `.select("*, profiles!...")` → tetap `*`

3. **Frontend** — `src/pages/employee/LeaveRequestPage.jsx`
   - Line 67: `createLeaveRequest({ ..., type: formType, ... })` — tetap `type: formType` karena service layer yang map ke `request_type`
   - Line 199: `r.type` → `r.request_type`
   - Line 193: `r.type` → `r.request_type`

4. **Frontend** — `src/pages/admin/LeaveManagementPage.jsx`
   - Line 138: `item.type` → `item.request_type`
   - Line 121: style lookup berdasarkan `item.status` — OK (tidak berubah)

5. **Frontend** — `src/components\Sidebar.jsx` line 35: label "Cuti & Izin" — OK, tidak berubah

### Notable: DB Migration Note for User
Karena tabel `leave_requests` sudah ada (berdasarkan screenshot user sudah bisa fill form), migration rename kolom harus menggunakan:
```sql
ALTER TABLE leave_requests RENAME COLUMN type TO request_type;
```
Dan constraint check perlu di-drop & re-create.
