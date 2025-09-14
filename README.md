PSNjs — PSN Client and Server (with optional OSC routing)

PSNjs is a small TypeScript toolkit for PosiStageNet (PSN):
- PSN Client: capture and parse INFO/DATA from the PSN multicast group.
- PSN Server: simulate a PSN source and transmit INFO/DATA.
- Optional OSC Routing: forward PSN axes to user‑defined OSC/TCP addresses.

Install / Build

- From source for local development:

  npm install
  npm run build

Install from npm (recommended)

```
npm install @harrisonfreni/psnjs
```

Native dependency note (PSN capture only):

- If you plan to use PSNClient (packet capture), the optional native module `cap` requires libpcap/WinPcap/Npcap and a compiler toolchain for your OS.
- If you only use OSC routing and not PSN capture, you can ignore the native dependency.

Quick start

- Listen to PSN on an interface (auto if omitted):

  npm run listen -- [IFACE]

- Main listener with optional OSC (see below for flags/env):

  npm run dev -- [IFACE] [TTL]

- Simulate PSN (sender) programmatically: see `src/psnServer.ts` or the example in DEVELOPERS.md.

Send PSN (simulation)

- Start a simple PSN sender that advertises one tracker (ID=1, name "SimTracker") and animates X from 0→1000 mm over ~30s:

```
npm run send:sim -- [IFACE] [TTL]
# or
npx ts-node src/psnTx.ts 192.168.1.223 1
```

- The sender multicasts to `236.10.10.10:56565` and logs each DATA frame.
- CI-safe: set `PSN_DRYRUN=1` or pass `--dry-run` to avoid binding sockets (logs only).

OSC routing (optional)

Enable routing via environment variables or CLI flags when running `src/index.ts`:

- `OSC_ENABLE_TCP=1` to enable routing
- `OSC_HOST` TCP host (default `127.0.0.1`)
- `OSC_PORT` TCP port (default `9000`)
- `OSC_ADDR_X` OSC address for X axis (default `/psn/{id}/x`)
- `OSC_ADDR_Y` OSC address for Y axis (default `/psn/{id}/y`)
- `OSC_ADDR_Z` OSC address for Z axis (default `/psn/{id}/z`)

Optional additional mappings (send only if set):

- `OSC_ADDR_SPEED_X`, `OSC_ADDR_SPEED_Y`, `OSC_ADDR_SPEED_Z`
- `OSC_ADDR_ORI_X`, `OSC_ADDR_ORI_Y`, `OSC_ADDR_ORI_Z`
- `OSC_ADDR_ACCEL_X`, `OSC_ADDR_ACCEL_Y`, `OSC_ADDR_ACCEL_Z`

Placeholders supported in addresses:

- `{id}` → PSN tracker numeric ID
- `{name}` → Tracker name (from PSN INFO), falls back to `{id}` when unknown

Example usage (ts-node):

```
OSC_ENABLE_TCP=1 \
OSC_HOST=127.0.0.1 \
OSC_PORT=9000 \
OSC_ADDR_X=/rig/{name}/x \
OSC_ADDR_Y=/rig/{name}/y \
OSC_ADDR_Z=/rig/{name}/z \
OSC_ADDR_SPEED_X=/rig/{name}/speed/x \
OSC_ADDR_ORI_X=/rig/{name}/ori/x \
OSC_ADDR_ACCEL_X=/rig/{name}/accel/x \
npx ts-node src/index.ts 192.168.1.223
```

NPM script example:

```
npm run osc -- [IFACE] [TTL]
```

Notes

- OSC transport uses TCP with a 32-bit big-endian length prefix per packet.
- Router sends separate messages per axis with a single float argument.
- Debugging and parsing modes:
  - `PSN_DEBUG=1` logs chunk IDs/lengths and tracker parsing.
  - `PSN_FLATTEN=1` treats DATA tracker list as a linear stream (each POS starts a tracker).
  - `OSC_ONLY_POS=1` disables speed/orientation/accel OSC messages.

CLI flags (override env)

- `--osc` enable OSC routing
- `--osc-host <host>`
- `--osc-port <port>`
- `--osc-addr-x|y|z <addr>` position addresses
- `--osc-addr-speed-x|y|z <addr>` speed addresses
- `--osc-addr-ori-x|y|z <addr>` orientation addresses
- `--osc-addr-accel-x|y|z <addr>` acceleration addresses

Example:

```
npx ts-node src/index.ts 192.168.1.223 --osc --osc-host 127.0.0.1 --osc-port 9000 --osc-addr-x /rig/{id}/x
```

Integration test

- Run a local OSC TCP integration test that spins a server and sends three messages:

```
npm run test-osc
```

If a port permission error appears, try a different port via `OSC_PORT` or run outside restricted environments.

Multicast test helpers

- Receive PSN multicast and print raw payloads:

```
node src/mcast-test.js [IFACE]
# or
IFACE=192.168.1.223 node src/mcast-test.js
```

- Send a test message to the PSN multicast group:

```
node src/mcast-send.js [IFACE] [TTL]
# or
IFACE=192.168.1.223 TTL=1 node src/mcast-send.js
```

Notes:
- `IFACE` is optional; when omitted, the OS default route is used.
- The PSN multicast address `236.10.10.10` and port `56565` are per PSN spec.

Architecture

- PSNClient: Captures PSN multicast and parses INFO/DATA into typed payloads.
- OSCRouter: Maps tracker axes to OSC addresses with `{id}`/`{name}` placeholders.
- OSCTcpClient: Encodes OSC messages and sends over TCP with length-prefix framing.
- Index apps:
  - `src/index.ts`: Main listener with optional OSC routing
  - `src/index-listener.ts`: Minimal console listener (debugging)

See DEVELOPERS.md for deeper protocol notes and parser details.

Configuration

- JSON config (optional): create `psn.config.json` in your project and pass `--config` to the CLI.

Example `psn.config.json`:

```
{
  "iface": "192.168.1.223",
  "ttl": 1,
  "parser": { "debug": false, "flatten": false },
  "osc": {
    "host": "127.0.0.1",
    "port": 9000,
    "addresses": {
      "pos": { "x": "/psn/{name}/x", "y": "/psn/{name}/y", "z": "/psn/{name}/z" },
      "speed": { "x": "/psn/{id}/speed/x" }
    }
  }
}
```

CLI (minimal)

Install (local dev): build and run via ts-node or use the CLI entry after building.

```
npm run build
npx node dist/cli.js listen --config psn.config.json

# or, after linking/publishing
psnjs listen --config psn.config.json
psnjs send-sim --iface 192.168.1.223 --ttl 1
```

Library usage (integrate into another Node project)

Add this repo as a dependency (e.g., file:../psnjs or git URL). Then:

```
import { PSNClient, OSCRouter } from 'psnjs';

const client = new PSNClient();
const router = new OSCRouter({
  host: '127.0.0.1',
  port: 9000,
  addresses: { pos: { x: '/psn/{name}/x', y: '/psn/{name}/y', z: '/psn/{name}/z' } }
});

client.on('info', i => router.updateInfo(i));
client.on('data', d => router.routeData(d));
client.start(process.env.IFACE);
```

Publish / Link

- Local link for development:

```
npm run build
npm link   # in this repo

# in your consuming project
npm link psnjs
```

- Pack and install from a tarball:

```
npm run build
npm pack                   # produces psnjs-<version>.tgz
npm install ./psnjs-*.tgz  # in your consuming project
```

- Exports and types:
  - `main` points to `dist/lib.js` (CommonJS)
  - `types` points to `dist/lib.d.ts`
- Dual exports:
  - `require` → `dist/lib.js` (CJS)
  - `import` → `dist/esm/lib.mjs` (ESM)
  - `types` → `dist/lib.d.ts`

Release to npm

- Update version: `npm version <patch|minor|major>`
- Ensure README/DEVELOPERS are up to date
- Publish: `npm publish` (add `--access public` if using a scoped public package)
- Tag and push your release commit

**Data Flow**

- UDP multicast → PSNClient → Info/Data events →
  - Console logs with tracker IDs and names
  - Optional: OSCRouter formats addresses → OSCTcpClient sends OSC/TCP

**Key Env Vars**

- OSC_ENABLE_TCP=1: Enable OSC routing
- OSC_HOST/OSC_PORT: OSC TCP destination (default 127.0.0.1:9000)
- OSC_ADDR_X/Y/Z: Position OSC addresses (default `/psn/{id}/x|y|z`)
- OSC_ADDR_SPEED_X/Y/Z: Speed addresses (optional)
- OSC_ADDR_ORI_X/Y/Z: Orientation addresses (optional)
- OSC_ADDR_ACCEL_X/Y/Z: Acceleration addresses (optional)
- OSC_ONLY_POS=1: Suppress non-position OSC messages
- PSN_DEBUG=1: Verbose chunk/parse logging
- PSN_FLATTEN=1: Linear DATA parsing (each POS starts a tracker)

CLI flags mirror most of these (see “CLI flags” above).
