# Architecture

## Multi-resort attendance tables

Global master data (employees, users, devices, shifts, policies) lives in shared tables.  
Operational attendance data is stored in **per-resort physical tables** registered in `resort_table_registry`.

When Super Admin creates a location:

1. Validate input  
2. Generate a safe `table_prefix` via the prefix registry  
3. Create the six standard tables in a transaction  
4. Register mapping in `resort_table_registry`  
5. Mark resort `active` (or roll back / mark `failed` on error)

Reporting and the attendance engine resolve table names **only** through this registry. Clients never pass raw table names.

## Employee transfers

`employees.employee_code` is permanent. Postings are effective-dated in `employee_postings`. Historical punches remain in the resort tables where they were recorded. Profiles aggregate history via posting ranges + consolidated reporting.

## Device adapters

```text
AttendanceDeviceAdapter
  testConnection()
  getDeviceInfo()
  fetchAttendanceLogs(cursor?)
  normalizeRecord(raw)
  getCapabilities()
```

Adapters convert device-specific payloads into `NormalizedAttendanceRecord`, which the attendance engine persists into the correct resort `*_attendance_logs` table (idempotent on source identity). Daily rows are derived; originals are never silently altered.

## Security

- bcrypt password hashes  
- JWT access + rotating refresh tokens  
- Role permissions + `user_location_access`  
- Rate limiting, helmet, zod validation  
- Audit log for sensitive actions  
