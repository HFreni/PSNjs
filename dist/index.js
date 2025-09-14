"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
// src/index.ts
// Entrypoint: PSN listener with optional OSC routing.
// Usage: ts-node src/index.ts [iface] [ttl] [--osc ...flags]
//   - iface: optional IPv4 address to bind capture (auto-select if omitted)
//   - ttl: unused in capture mode; reserved for symmetry with sender
//   - --osc/--osc-host/--osc-port/--osc-addr-* flags override OSC env config
const os_1 = __importDefault(require("os"));
const psnClient_1 = require("./psnClient");
// -------------------------------------------------------------
// CLI args: [iface] [ttl]
// -------------------------------------------------------------
const [, , IFACE_ARG, TTL_ARG] = process.argv;
const IFACE = IFACE_ARG || undefined; // e.g. "192.168.1.42"
const TTL = TTL_ARG ? parseInt(TTL_ARG, 10) : 1; // default TTL = 1
// -------------------------------------------------------------
// Show available NICs to pick from (for convenience when choosing iface)
// -------------------------------------------------------------
console.log('Available network interfaces:');
Object.entries(os_1.default.networkInterfaces()).forEach(([name, addrs]) => {
    if (!addrs)
        return;
    addrs.forEach(a => {
        console.log(`  ${name} → ${a.address} ${a.family}${a.internal ? ' (internal)' : ''}`);
    });
});
console.log();
// -------------------------------------------------------------
// 1) Start the PSN client (listener)
// -------------------------------------------------------------
const client = new psnClient_1.PSNClient();
// Cache PSN INFO names to annotate DATA logs and fill OSC {name}
let trackerNames = {};
client.on('ready', info => {
    console.log(`🎧 Client listening on ${info.addr}:${info.port} (iface=${info.iface}, ttl=${info.ttl})\n`);
});
// raw UDP debug (comes from PSNClient)
client.on('error', e => console.error('Client error:', e));
// high‑level INFO
client.on('info', (info) => {
    console.log('❄️  [INFO]');
    console.log(`   System: ${info.systemName}`);
    console.log('   Trackers:');
    for (const [id, trk] of Object.entries(info.trackers)) {
        console.log(`     • [${id}] ${trk.name}`);
    }
    console.log();
    // cache names for pretty DATA logs
    trackerNames = {};
    for (const [id, trk] of Object.entries(info.trackers)) {
        trackerNames[Number(id)] = trk.name;
    }
    // names cached for pretty logging
});
// high‑level DATA
client.on('data', (data) => {
    console.log('📐 [DATA]');
    console.log(`   Timestamp: ${data.header.timestamp} µs`);
    for (const [id, tk] of Object.entries(data.trackers)) {
        const name = trackerNames[Number(id)];
        console.log(`   Tracker ${id}${name ? ` (${name})` : ''}:`);
        if (tk.pos) {
            console.log(`     Pos:   (${tk.pos.x.toFixed(1)}, ${tk.pos.y.toFixed(1)}, ${tk.pos.z.toFixed(1)})`);
        }
    }
    console.log();
    // No OSC routing
});
// bind it
client.start(IFACE, TTL);
