# Deployment checklist

1. Provision MySQL 8 with automated backups  
2. Set production secrets in a secrets manager (not files in git)  
3. Run migrations from CI/CD or a locked-down migrator job  
4. Deploy API behind HTTPS reverse proxy  
5. Deploy frontend static build (or container) with API proxy  
6. Place biometric connectors on the private network / VPN only  
7. Change default admin password and disable seed credentials  
8. Confirm `MOBILE_ATTENDANCE_ENABLED=false` unless HR authorizes  
9. Smoke-test: login, location list, employee create, CSV import path, consolidated report  
10. Verify each resort’s tables exist in `resort_table_registry`  

## Docker Compose

```bash
cp .env.example .env
docker compose up -d mysql
# run migrate/seed against the published MySQL port, then:
docker compose up -d --build
```
