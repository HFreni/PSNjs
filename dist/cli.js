#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const psnClient_1 = require("./psnClient");
const oscRouter_1 = require("./oscRouter");
const config_1 = require("./config");
const psnServer_1 = require("./psnServer");
function printHelp() {
    console.log(`psnjs CLI

Usage:
  psnjs listen [--config psn.config.json] [--iface <ip>] [--ttl <n>] [--osc ...flags]
  psnjs send-sim [--iface <ip>] [--ttl <n>]

Flags:
  --config <file>          JSON config path
  --iface <ip>             Interface IP to bind capture/sender
  --ttl <n>                Multicast TTL (sender only; accepted for symmetry)
  --osc                    Enable OSC routing
  --osc-host <host>        OSC TCP host
  --osc-port <port>        OSC TCP port
  --osc-only-pos           Route only position
  --osc-addr-*:            Override address templates (see README)
  --debug                  Verbose PSN parsing
  --flatten                Flattened DATA parse mode
`);
}
async function cmdListen(argv) {
    const cfg = (0, config_1.loadAppConfigFromCliAndEnv)(argv);
    if (cfg.parser?.debug)
        process.env.PSN_DEBUG = '1';
    if (cfg.parser?.flatten)
        process.env.PSN_FLATTEN = '1';
    const client = new psnClient_1.PSNClient();
    const router = cfg.osc ? new oscRouter_1.OSCRouter(cfg.osc) : null;
    let trackerNames = {};
    client.on('ready', ({ device }) => console.log(`✅ Listening on ${device}`));
    client.on('error', e => console.error('❌', e));
    client.on('info', info => {
        trackerNames = {};
        for (const [id, trk] of Object.entries(info.trackers)) {
            trackerNames[+id] = trk.name;
        }
        router?.updateInfo(info);
        console.log(`INFO system=${info.systemName} trackers=${Object.keys(info.trackers).length}`);
    });
    client.on('data', data => {
        const ids = Object.keys(data.trackers).map(Number).sort((a, b) => a - b);
        const label = ids.map(id => `${id}${trackerNames[id] ? `(${trackerNames[id]})` : ''}`).join(',');
        console.log(`DATA ts=${data.header.timestamp} ids=[${label}]`);
        if (router)
            router.routeData(data).catch(e => console.error('OSC route error:', e?.message || e));
    });
    client.start(cfg.iface, cfg.ttl);
}
async function cmdSendSim(argv) {
    const cfg = (0, config_1.loadAppConfigFromCliAndEnv)(argv);
    const server = new psnServer_1.PSNServer();
    server.on('ready', info => {
        console.log(`🚀 PSN server ${info.addr}:${info.port} iface=${info.iface ?? 'auto'} ttl=${info.ttl}`);
        server.sendInfo('psnjs-sim', { 1: 'SimTracker' });
        let t0 = Date.now();
        const dur = 30000;
        const id = 1;
        const dt = 100;
        const timer = setInterval(() => {
            const t = Math.min(Date.now() - t0, dur);
            const x = (t / dur) * 1000;
            server.sendData({ [id]: { pos: { x, y: 0, z: 0 } } });
            if (t >= dur) {
                clearInterval(timer);
                console.log('✅ Simulation complete');
            }
        }, dt);
    });
    server.on('error', e => console.error('❌', e));
    server.start(cfg.iface, cfg.ttl || 1);
}
async function main() {
    const [, , subcmd, ...rest] = process.argv;
    if (!subcmd || subcmd === 'listen')
        return cmdListen(rest);
    if (subcmd === 'send-sim')
        return cmdSendSim(rest);
    printHelp();
}
main().catch(e => { console.error(e); process.exit(1); });
