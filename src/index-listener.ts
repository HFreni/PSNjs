// src/index-listener.ts
import { PSNClient } from './psnClient';
import { InfoPayload, DataPayload } from './utils';

// Usage: ts-node src/index-listener.ts [iface]
// - iface: optional IPv4 address to bind capture (e.g., "192.168.1.42").
//          When omitted, the first non-loopback interface is used.

console.log('🔊 PSN listener starting…');
const client = new PSNClient();
const [, , IFACE_ARG] = process.argv;
let trackerNames: Record<number, string> = {};

client.on('ready', ({ device }) => console.log(`✅ Listening on ${device}`));

client.on('info', (info: InfoPayload) => {
  console.log('❄️ INFO');
  console.log(`  System: ${info.systemName}`);
  console.log('  Trackers:');
  trackerNames = {};
  for (const [id, trk] of Object.entries(info.trackers)) {
    const nid = Number(id);
    trackerNames[nid] = trk.name;
    console.log(`    • [${id}] ${trk.name}`);
  }
});

client.on('data', (data: DataPayload) => {
  console.log('📐 DATA');
  console.log(`  Timestamp: ${data.header.timestamp} µs`);
  for (const [id, tk] of Object.entries(data.trackers)) {
    const nid = Number(id);
    const name = trackerNames[nid];
    console.log(`  Tracker ${id}${name ? ` (${name})` : ''}:`);
    if (tk.pos) {
      console.log(`    Pos: (${tk.pos.x.toFixed(3)}, ${tk.pos.y.toFixed(3)}, ${tk.pos.z.toFixed(3)})`);
    }
    if (tk.speed) {
      console.log(`    Speed: (${tk.speed.x.toFixed(3)}, ${tk.speed.y.toFixed(3)}, ${tk.speed.z.toFixed(3)})`);
    }
    if (tk.orientation) {
      console.log(`    Ori: (${tk.orientation.x.toFixed(3)}, ${tk.orientation.y.toFixed(3)}, ${tk.orientation.z.toFixed(3)})`);
    }
    if (tk.accel) {
      console.log(`    Accel: (${tk.accel.x.toFixed(3)}, ${tk.accel.y.toFixed(3)}, ${tk.accel.z.toFixed(3)})`);
    }
    if (tk.validity != null) {
      console.log(`    Valid: ${tk.validity}`);
    }
  }
});

client.on('error', e => console.error('❌', e));

client.start(IFACE_ARG || undefined);
