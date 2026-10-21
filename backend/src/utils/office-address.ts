import os from 'os';

/** IPv4 address of this PC on the office LAN. The attendance machine connects here. */
export function officeLanAddress(): string {
  const found: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) found.push(entry.address);
    }
  }
  return (
    found.find((address) => address.startsWith('172.16.')) ??
    found.find((address) => address.startsWith('192.168.')) ??
    found.find((address) => address.startsWith('10.')) ??
    found[0] ??
    '127.0.0.1'
  );
}
