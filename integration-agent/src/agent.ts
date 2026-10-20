/**
 * Local integration agent skeleton.
 * Deploy on a private network near biometric devices.
 * Full adapter pulls should be verified per device model before production use.
 */
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.TDCP_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const POLL_MS = Number(process.env.AGENT_POLL_MS ?? 60000);

async function tick(): Promise<void> {
  // Placeholder health check against central API
  try {
    const res = await fetch(`${API_BASE}/health`);
    const body = await res.json();
    console.log(new Date().toISOString(), 'API health:', body?.data?.status ?? res.status);
  } catch (error) {
    console.error(new Date().toISOString(), 'API unreachable', error);
  }
}

console.log('TDCP integration agent starting');
console.log('API:', API_BASE);
void tick();
setInterval(() => void tick(), POLL_MS);
