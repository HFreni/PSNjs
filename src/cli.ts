#!/usr/bin/env node
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
import { PSNClient } from './psnClient';
import { OSCRouter } from './oscRouter';
import { loadAppConfigFromCliAndEnv, loadJsonConfig } from './config';
import { PSNServer } from './psnServer';

function printHelp() {
  console.log(`psnjs CLI

Usage:
  psnjs listen [--config psn.config.json] [--iface <ip>] [--ttl <n>] [--osc ...flags]
  psnjs send-sim [--iface <ip>] [--ttl <n>] [--dry-run]

Flags:
  --config <file>          JSON config path
  --iface <ip>             Interface IP to bind capture/sender
  --ttl <n>                Multicast TTL (sender only; accepted for symmetry)
  --dry-run                Do not bind sockets; log what would be sent
  --osc                    Enable OSC routing
  --osc-host <host>        OSC TCP host
  --osc-port <port>        OSC TCP port
  --osc-only-pos           Route only position
  --osc-addr-*:            Override address templates (see README)
  --debug                  Verbose PSN parsing
  --flatten                Flattened DATA parse mode
`);
}

async function cmdListen(argv: string[]) {
  const cfg = loadAppConfigFromCliAndEnv(argv);
  if (cfg.parser?.debug) process.env.PSN_DEBUG = '1';
  if (cfg.parser?.flatten) process.env.PSN_FLATTEN = '1';

  const client = new PSNClient();
  const router = cfg.osc ? new OSCRouter(cfg.osc) : null;
  let trackerNames: Record<number,string> = {};

  client.on('ready', ({ device }) => console.log(`✅ Listening on ${device}`));
  client.on('error', e => console.error('❌', e));
  client.on('info', info => {
    trackerNames = {};
    for (const [id, trk] of Object.entries(info.trackers) as [string, { name: string }][]) {
      trackerNames[+id] = trk.name;
    }
    router?.updateInfo(info);
    console.log(`INFO system=${info.systemName} trackers=${Object.keys(info.trackers).length}`);
  });
  client.on('data', data => {
    const ids = Object.keys(data.trackers).map(Number).sort((a,b)=>a-b);
    const label = ids.map(id => `${id}${trackerNames[id] ? `(${trackerNames[id]})` : ''}`).join(',');
    console.log(`DATA ts=${data.header.timestamp} ids=[${label}]`);
    if (router) router.routeData(data).catch(e => console.error('OSC route error:', e?.message || e));
  });

  client.start(cfg.iface, cfg.ttl);
}

async function cmdSendSim(argv: string[]) {
  const cfg = loadAppConfigFromCliAndEnv(argv);
  // Simple passthrough of dry-run flag via env for server convenience
  if (argv.includes('--dry-run')) process.env.PSN_DRYRUN = '1';
  const server = new PSNServer();
  server.on('ready', info => {
    console.log(`🚀 PSN server ${info.addr}:${info.port} iface=${info.iface ?? 'auto'} ttl=${info.ttl}`);
    server.sendInfo('psnjs-sim', { 1: 'SimTracker' });
    let t0 = Date.now();
    const dur = 30_000; const id = 1; const dt = 100;
    const timer = setInterval(() => {
      const t = Math.min(Date.now() - t0, dur);
      const x = (t / dur) * 1000;
      server.sendData({ [id]: { pos: { x, y: 0, z: 0 } } });
      if (t >= dur) { clearInterval(timer); console.log('✅ Simulation complete'); }
    }, dt);
  });
  server.on('error', e => console.error('❌', e));
  const dryRun = process.env.PSN_DRYRUN === '1';
  server.start(cfg.iface, cfg.ttl || 1, { dryRun });
}

async function main() {
  const [,, subcmd, ...rest] = process.argv;
  if (!subcmd || subcmd === 'listen') return cmdListen(rest);
  if (subcmd === 'send-sim') return cmdSendSim(rest);
  printHelp();
}

main().catch(e => { console.error(e); process.exit(1); });
