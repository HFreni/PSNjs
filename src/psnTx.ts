// src/psnTx.ts
// Simple PSN sender simulation.
// Usage: ts-node src/psnTx.ts [iface] [ttl]
//   - iface: optional IPv4 address to bind (e.g., "192.168.1.42").
//   - ttl: multicast TTL (default 1).

import os from 'os';
import { PSNServer } from './psnServer';
import { TrackerData } from './utils';

// -------------------------------------------------------------
// CLI args: [iface] [ttl]
// -------------------------------------------------------------
const [, , IFACE_ARG, TTL_ARG] = process.argv;
const IFACE = IFACE_ARG || undefined;               // e.g. '192.168.1.42'
const TTL   = TTL_ARG ? parseInt(TTL_ARG, 10) : 1;  // default TTL = 1

// -------------------------------------------------------------
// Show available network interfaces
// -------------------------------------------------------------
console.log('Available network interfaces:');
Object.entries(os.networkInterfaces()).forEach(([name, addrs]) => {
  if (!addrs) return;
  addrs.forEach(addr => {
    console.log(
      `  ${name} → ${addr.address} ${addr.family}${addr.internal ? ' (internal)' : ''}`
    );
  });
});
console.log();

// -------------------------------------------------------------
// Instantiate PSNServer
// -------------------------------------------------------------
const server = new PSNServer();

server.on('ready', info => {
  console.log(
    `🚀 PSN server ready on ${info.addr}:${info.port} (iface=${info.iface}, ttl=${info.ttl})`
  );

  // 1) Advertise one tracker with ID = 1
  server.sendInfo('SimServer', { 1: 'SimTracker' });

  // 2) Simulate movement: 0 → 1000 mm on X over 30 seconds
  const durationMs = 30_000;
  const startTime  = Date.now();
  const trackerId  = 1;
  const intervalMs = 100; // send every 100 ms

  const timer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed, durationMs);
    const x = (t / durationMs) * 1000;

    const data: Record<number, TrackerData> = {
      [trackerId]: { pos: { x, y: 0, z: 0 } }
    };

    server.sendData(data);
    console.log(`Sent DATA → tracker ${trackerId} x=${x.toFixed(2)} mm`);

    if (t >= durationMs) {
      clearInterval(timer);
      console.log('✅ Simulation complete');
    }
  }, intervalMs);
});

server.on('error', err => {
  console.error('❌ PSN server error:', err);
});

// Bind and start multicasting
server.start(IFACE, TTL);
