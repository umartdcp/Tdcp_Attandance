# Setup guide

## Database user (manual MySQL)

```sql
CREATE DATABASE IF NOT EXISTS tdcp_attendance_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'tdcp_app'@'%' IDENTIFIED BY 'change_me_strong_password';
GRANT ALL PRIVILEGES ON tdcp_attendance_db.* TO 'tdcp_app'@'%';
FLUSH PRIVILEGES;
```

For production, narrow grants (avoid DROP/CREATE for the runtime app user if a separate migrator role is used).

## Migrations

```bash
cd backend
npm run migrate          # apply
npm run migrate:rollback # roll back last migration (dev only)
npm run seed             # initial locations, roles, superadmin
```

## Development scripts

From repo root:

```bash
npm run dev:backend
npm run dev:frontend
npm run test:backend
```

## Frontend env

Create `frontend/.env` if you need an absolute API URL:

```
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Vite also proxies `/api` to the backend in development.
