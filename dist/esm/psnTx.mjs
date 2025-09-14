/*
MIT License

Copyright (c) 2025 PSNjs contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// src/psnTx.ts
// Simple PSN sender simulation.
// Usage: ts-node src/psnTx.ts [iface] [ttl]
//   - iface: optional IPv4 address to bind (e.g., "192.168.1.42").
//   - ttl: multicast TTL (default 1).
import os from 'os';
import { PSNServer } from './psnServer.mjs';
// -------------------------------------------------------------
// CLI args: [iface] [ttl]
// -------------------------------------------------------------
const [, , IFACE_ARG, TTL_ARG] = process.argv;
const IFACE = IFACE_ARG || undefined; // e.g. '192.168.1.42'
const TTL = TTL_ARG ? parseInt(TTL_ARG, 10) : 1; // default TTL = 1
// -------------------------------------------------------------
// Show available network interfaces
// -------------------------------------------------------------
console.log('Available network interfaces:');
Object.entries(os.networkInterfaces()).forEach(([name, addrs]) => {
    if (!addrs)
        return;
    addrs.forEach(addr => {
        console.log(`  ${name} → ${addr.address} ${addr.family}${addr.internal ? ' (internal)' : ''}`);
    });
});
console.log();
// -------------------------------------------------------------
// Instantiate PSNServer
// -------------------------------------------------------------
const server = new PSNServer();
server.on('ready', info => {
    console.log(`🚀 PSN server ready on ${info.addr}:${info.port} (iface=${info.iface}, ttl=${info.ttl})`);
    // 1) Advertise one tracker with ID = 1
    server.sendInfo('SimServer', { 1: 'SimTracker' });
    // 2) Simulate movement: 0 → 1000 mm on X over 30 seconds
    const durationMs = 30000;
    const startTime = Date.now();
    const trackerId = 1;
    const intervalMs = 100; // send every 100 ms
    const timer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed, durationMs);
        const x = (t / durationMs) * 1000;
        const data = {
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
