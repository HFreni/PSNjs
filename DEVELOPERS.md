# PSNjs Developer Notes

## Overview

This codebase listens for PosiStageNet (PSN) multicast and can also transmit PSN.

## Modules at a glance

- src/utils.ts — PSN pch32 helpers, chunk IDs, and shared types
- src/psnClient.ts — Packet capture + PSN INFO/DATA parsers, emits events
- src/psnServer.ts — Minimal PSN multicast sender (INFO/DATA)
- src/index.ts — Main entry listener
- src/index-listener.ts — Minimal console listener
- src/mcast-*.js — Multicast test helpers (receive/send)

## CLI (src/cli.ts)

- Subcommands:
- `listen` (default): start PSN listener
  - `send-sim`: start a simple PSN sender simulation
- Flags: `--config`, `--iface`, `--ttl`, `--debug`, `--flatten`
- Config is merged: CLI > JSON (if provided) > env defaults

## Config (src/config.ts)

- Types and utilities to load/merge a JSON config and CLI/env into a single AppConfig.
- JSON shape mirrors the fields used by the listener.

## PSN packet format (pch32)

- Each packet is a tree of “pch32” chunks. A chunk header is 4 bytes (two little‑endian 16‑bit words):
  - word A: (hasSub << 15) | id (15 bits)
  - word B: length (bytes)
- Some implementations set hasSub on word B instead. Our `readChunkHeader()` is tolerant and normalizes this.
- Root chunk ids:
  - 0x6756 → INFO_PACKET
  - 0x6755 → DATA_PACKET

### INFO packet structure

- Root: 0x6756 (INFO_PACKET)
- Subchunks of root:
  - 0x0000 → INFO.HEADER (12 bytes, see “Header layout” below)
  - 0x0001 → INFO.SYSTEM_NAME (UTF‑8 string)
  - 0x0002 → INFO.TRACKER_LIST (container)
    - Contains one wrapper per tracker:
      - Wrapper id lower 15 bits = tracker id
      - Wrapper may be flat (no subchunks) with an ASCII name payload
      - Or include subchunks:
        - 0x0000 → INFO.TRACKER_NAME (UTF‑8 string)

### DATA packet structure

- Root: 0x6755 (DATA_PACKET)
- Subchunks of root:
  - 0x0000 → DATA.HEADER (12 bytes, see “Header layout” below)
  - 0x0001 → DATA.TRACKER_LIST (container)
    - Contains one wrapper per tracker:
      - Wrapper id lower 15 bits = tracker id
      - Subchunks (LE):
        - 0x0000 → POS        → float32 x3 (x,y,z)
        - 0x0001 → SPEED      → float32 x3 (x,y,z)
        - 0x0002 → ORI        → float32 x3 (x,y,z)
        - 0x0003 → STATUS     → float32 (validity)
        - 0x0004 → ACCEL      → float32 x3 (x,y,z)
        - 0x0005 → TRGTPOS    → float32 x3 (x,y,z)
        - 0x0006 → TIMESTAMP  → uint64 (tracker timestamp)

### Header layout (INFO.HEADER / DATA.HEADER payload)

- 0..7   → uint64 LE timestamp
- 8      → uint8  version.high
- 9      → uint8  version.low
- 10     → uint8  frameId
- 11     → uint8  packets

### Parsing resilience

- Endianness: All chunk headers are read with LE 16‑bit words; we accommodate hasSub on either word.
- Bounds checks: All loops guard against truncated or oversized chunks.
- Flattened mode: Some emitters do not provide per‑tracker wrappers. Set `PSN_FLATTEN=1` to parse a linear subchunk stream, where each POS starts a tracker.

<!-- OSC routing removed: v1.0.4 -->

## Debugging

- `PSN_DEBUG=1` → logs root/subchunk ids and lengths as they parse
- `PSN_FLATTEN=1` → enables flattened DATA mode
- `npm run mcast:listen` / `npm run mcast:send` → quick multicast checks

## Code organization notes

- `src/utils.ts`: pch32 helpers, chunk ids, and typed interfaces
- `src/psnClient.ts`: capture and parsing logic with INFO/DATA walkers
- `src/psnServer.ts`: PSN multicast sender (INFO/DATA)
- `src/oscRouter.ts`: address template merge / per‑axis routing
- `src/osc.ts`: length‑prefixed OSC/TCP client and encoder
- `src/index.ts`: main entrypoint with optional OSC routing
- `src/index-listener.ts`: minimal listener for debugging

## PSN client API (src/psnClient.ts)

- Class: `PSNClient extends EventEmitter`
  - Events:
    - `ready`: `{ device: string }`
    - `info`: `InfoPayload`
    - `data`: `DataPayload`
    - `error`: `Error`
  - Methods:
    - `start(ifaceIp?: string, ttl?: number)`: open capture on interface (auto‑select if omitted)
    - `stop()`: close capture

Example:

```ts
import { PSNClient } from 'psnjs';

const client = new PSNClient();

client.on('ready', ({ device }) => {
  console.log(`✅ Listening on ${device}`);
});

client.on('error', (e) => console.error('❌', e));

client.on('info', (info) => {
  console.log('System:', info.systemName);
  for (const [id, trk] of Object.entries(info.trackers)) {
    console.log(`  [${id}] ${trk.name}`);
  }
});

client.on('data', (data) => {
  for (const [id, trk] of Object.entries(data.trackers)) {
    if (trk.pos) {
      const { x, y, z } = trk.pos;
      console.log(`T${id} pos=(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
    }
  }
});

// Bind to a specific interface IP or leave undefined to auto-select
client.start(process.env.IFACE);
```

## PSN server API (src/psnServer.ts)

- Class: `PSNServer extends EventEmitter`
  - Methods:
    - `start(ifaceIp?: string, ttl = 1)`: bind UDP socket, set multicast TTL/interface
    - `stop()`: close socket
    - `sendInfo(systemName: string, trackers: Record<number,string>)`: send INFO
    - `sendData(data: Record<number,TrackerData>)`: send DATA for provided trackers
  - Usage example:

    ```ts
    import { PSNServer } from './src/psnServer';
    const server = new PSNServer();
    server.on('ready', () => {
      server.sendInfo('MySystem', { 1: 'TrackerA', 2: 'TrackerB' });
      server.sendData({ 1: { pos: { x: 100, y: 0, z: 0 } } });
    });
    server.start(/* ifaceIp? */ undefined, /* ttl? */ 1);
    ```

<!-- OSC routing removed in v1.0.4 -->

## Type definitions (src/utils.ts)

- `PSNHeader`, `TrackerInfo`, `TrackerData`, `InfoPayload`, `DataPayload`
- `CHUNK` constants for root/INFO/DATA IDs

## Entrypoints

- `src/index.ts`: lists NICs, starts PSNClient, logs INFO/DATA
- `src/index-listener.ts`: lean listener printing tracker names + fields

## Test helpers

- `src/mcast-test.js`: join PSN multicast and print payloads
- `src/mcast-send.js`: send a test UDP packet to the PSN group

## Contributing

- Keep parsing changes bounded with strict length checks.
- When encountering a new variant, prefer additive tolerance in the reader (e.g., accept flat name payloads) and document it inline.
