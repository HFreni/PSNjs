// src/index.ts
// Entrypoint: PSN listener with optional OSC routing.
// Usage: ts-node src/index.ts [iface] [ttl] [--osc ...flags]
//   - iface: optional IPv4 address to bind capture (auto-select if omitted)
//   - ttl: unused in capture mode; reserved for symmetry with sender
//   - --osc/--osc-host/--osc-port/--osc-addr-* flags override OSC env config
import os from 'os';
import arg from 'arg';
import { PSNClient } from './psnClient';
import { TrackerData, InfoPayload, DataPayload } from './utils';
import { OSCRouter, loadOscRouterConfigFromEnvAndCli } from './oscRouter';

// -------------------------------------------------------------
// CLI args: [iface] [ttl]
// -------------------------------------------------------------
const [, , IFACE_ARG, TTL_ARG] = process.argv;
const IFACE = IFACE_ARG || undefined;               // e.g. "192.168.1.42"
const TTL   = TTL_ARG ? parseInt(TTL_ARG, 10) : 1;  // default TTL = 1

// -------------------------------------------------------------
// CLI flags for OSC config (optional)
//   Use --osc to enable and override host/port/addresses as needed.
//   Env vars can also be used; see README.
// -------------------------------------------------------------
let oscRouter = null as OSCRouter | null;
try {
  const a = arg({
    '--osc': Boolean,
    '--osc-host': String,
    '--osc-port': Number,
    '--osc-only-pos': Boolean,
    '--osc-addr-x': String,
    '--osc-addr-y': String,
    '--osc-addr-z': String,
    '--osc-addr-speed-x': String,
    '--osc-addr-speed-y': String,
    '--osc-addr-speed-z': String,
    '--osc-addr-ori-x': String,
    '--osc-addr-ori-y': String,
    '--osc-addr-ori-z': String,
    '--osc-addr-accel-x': String,
    '--osc-addr-accel-y': String,
    '--osc-addr-accel-z': String,
  });

  const oscCfg = loadOscRouterConfigFromEnvAndCli({
    enabled: a['--osc'],
    host: a['--osc-host'],
    port: a['--osc-port'],
    onlyPos: a['--osc-only-pos'],
    pos: { x: a['--osc-addr-x'], y: a['--osc-addr-y'], z: a['--osc-addr-z'] },
    speed: { x: a['--osc-addr-speed-x'], y: a['--osc-addr-speed-y'], z: a['--osc-addr-speed-z'] },
    ori: { x: a['--osc-addr-ori-x'], y: a['--osc-addr-ori-y'], z: a['--osc-addr-ori-z'] },
    accel: { x: a['--osc-addr-accel-x'], y: a['--osc-addr-accel-y'], z: a['--osc-addr-accel-z'] },
  });
  oscRouter = oscCfg ? new OSCRouter(oscCfg) : null;
} catch {
  // ignore CLI parse errors to keep backwards compatibility
}

// -------------------------------------------------------------
// Show available NICs to pick from (for convenience when choosing iface)
// -------------------------------------------------------------
console.log('Available network interfaces:');
Object.entries(os.networkInterfaces()).forEach(([name, addrs]) => {
  if (!addrs) return;
  addrs.forEach(a => {
    console.log(`  ${name} → ${a.address} ${a.family}${a.internal ? ' (internal)' : ''}`);
  });
});
console.log();

// -------------------------------------------------------------
// 1) Start the PSN client (listener)
// -------------------------------------------------------------
const client = new PSNClient();
// Cache PSN INFO names to annotate DATA logs and fill OSC {name}
let trackerNames: Record<number, string> = {};

client.on('ready', info => {
  console.log(`🎧 Client listening on ${info.addr}:${info.port} (iface=${info.iface}, ttl=${info.ttl})\n`);
});

// raw UDP debug (comes from PSNClient)
client.on('error', e => console.error('Client error:', e));

// high‑level INFO
client.on('info', (info: InfoPayload) => {
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
  oscRouter?.updateInfo(info);
});

// high‑level DATA
client.on('data', (data: DataPayload) => {
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
  if (oscRouter) {
    oscRouter.routeData(data).catch(err => {
      console.error('OSC route error:', err?.message || err);
    });
  }
});

// bind it
client.start(IFACE, TTL);
