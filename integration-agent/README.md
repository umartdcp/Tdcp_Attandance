# TDCP Local Integration Agent

Secure on-premises connector for biometric devices that must not be exposed to the public internet.

## Responsibilities

- Reach devices on the local LAN / VPN
- Pull or receive punch logs using registered adapters
- Push normalized batches to the central API (`POST /api/v1/devices/:id/import-csv` or a dedicated sync endpoint)
- Persist a local checkpoint for offline retry
- Never store fingerprint/face biometric templates

## Status

Scaffold only in Phase 1–4 foundation. Run on a hardened host colocated with devices. Configure API base URL and device credentials via environment variables — never hardcode secrets.

```bash
cd integration-agent
npm install
npm run start
```

See `src/agent.ts` for the polling loop skeleton.
