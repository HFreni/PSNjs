# PSNjs — PSN Client and Server

![npm](https://img.shields.io/npm/v/@harrisonfreni/psnjs?logo=npm&color=cb3837)
![downloads](https://img.shields.io/npm/dm/@harrisonfreni/psnjs?logo=npm)
![node](https://img.shields.io/node/v/@harrisonfreni/psnjs)
![license](https://img.shields.io/badge/license-MIT-blue.svg)
![code style: prettier](https://img.shields.io/badge/code_style-Prettier-ff69b4.svg?logo=prettier)
![ci](https://github.com/hfreni/psnjs/actions/workflows/ci.yml/badge.svg)

<p align="center">
  <img src="./PSNjs.png" alt="PSNjs Logo" width="280" />
  <br/>
</p>

PSNjs is a small TypeScript toolkit for PosiStageNet (PSN):
- PSN Client: capture and parse INFO/DATA from the PSN multicast group.
- PSN Server: simulate a PSN source and transmit INFO/DATA.

## Install / Build

- From source for local development:

```bash
npm install
npm run build
```

### Install from npm (recommended)

```bash
npm install @harrisonfreni/psnjs
```

### Native dependency note (PSN capture only)

- If you plan to use PSNClient (packet capture), the optional native module `cap` requires libpcap/WinPcap/Npcap and a compiler toolchain for your OS.
- If you only use OSC routing and not PSN capture, you can ignore the native dependency.

## Quick start

- Listen to PSN on an interface (auto if omitted):

```bash
npm run listen -- [IFACE]
```

- Main listener:

```bash
npm run dev -- [IFACE] [TTL]
```

- Simulate PSN (sender) programmatically: see `src/psnServer.ts` or the example in DEVELOPERS.md.

## Send PSN (simulation)

- Start a simple PSN sender that advertises one tracker (ID=1, name "SimTracker") and animates X from 0→1000 mm over ~30s:

```bash
npm run send:sim -- [IFACE] [TTL]
# or
npx ts-node src/psnTx.ts 192.168.1.223 1
```

- The sender multicasts to `236.10.10.10:56565` and logs each DATA frame.
- CI-safe: set `PSN_DRYRUN=1` or pass `--dry-run` to avoid binding sockets (logs only).

## Notes

- `PSN_DEBUG=1` logs chunk IDs/lengths and tracker parsing.
- `PSN_FLATTEN=1` treats DATA tracker list as a linear stream (each POS starts a tracker).

<!-- OSC integration tests removed -->

## Multicast test helpers

- Receive PSN multicast and print raw payloads:

```bash
node src/mcast-test.js [IFACE]
# or
IFACE=192.168.1.223 node src/mcast-test.js
```

- Send a test message to the PSN multicast group:

```bash
node src/mcast-send.js [IFACE] [TTL]
# or
IFACE=192.168.1.223 TTL=1 node src/mcast-send.js
```

Notes:
- `IFACE` is optional; when omitted, the OS default route is used.
- The PSN multicast address `236.10.10.10` and port `56565` are per PSN spec.

## Architecture

- PSNClient: Captures PSN multicast and parses INFO/DATA into typed payloads.
- PSNServer: Sends PSN INFO/DATA over multicast.
- Index apps:
  - `src/index.ts`: Main listener
  - `src/index-listener.ts`: Minimal console listener (debugging)

See DEVELOPERS.md for deeper protocol notes and parser details.

## Configuration

- JSON config (optional): create `psn.config.json` in your project and pass `--config` to the CLI.

Example `psn.config.json`:

```json
{
  "iface": "192.168.1.223",
  "ttl": 1,
  "parser": { "debug": false, "flatten": false },
  "parser": { "debug": true }
}
```

## CLI (minimal)

Install (local dev): build and run via ts-node or use the CLI entry after building.

```bash
npm run build
npx node dist/cli.js listen --config psn.config.json

# or, after linking/publishing
psnjs listen --config psn.config.json
psnjs send-sim --iface 192.168.1.223 --ttl 1
```

## Library usage (integrate into another Node project)

Add this repo as a dependency (e.g., file:../psnjs or git URL). Then:

```ts
import { PSNClient } from '@harrisonfreni/psnjs';

const client = new PSNClient();
client.on('info', (i) => console.log('INFO', i.systemName, Object.keys(i.trackers)));
client.on('data', (d) => console.log('DATA trackers', Object.keys(d.trackers)));
client.start(process.env.IFACE);
```

## Publish / Link

- Local link for development:

```bash
npm run build
npm link   # in this repo

# in your consuming project
npm link @harrisonfreni/psnjs
```

- Pack and install from a tarball:

```bash
npm run build
npm pack                                     # produces harrisonfreni-psnjs-<version>.tgz
npm install ./harrisonfreni-psnjs-*.tgz      # in your consuming project
```

- Exports and types:
  - `main` points to `dist/lib.js` (CommonJS)
  - `types` points to `dist/lib.d.ts`
- Dual exports:
  - `require` → `dist/lib.js` (CJS)
  - `import` → `dist/esm/lib.mjs` (ESM)
  - `types` → `dist/lib.d.ts`

## Release to npm

1) Update version: `npm version <patch|minor|major>`
2) Ensure README/DEVELOPERS are up to date
3) Publish: `npm publish` (add `--access public` if using a scoped public package)
4) Tag and push your release commit

### Publish via GitHub Actions

- Create an npm token and add it as a repository secret named `NPM_TOKEN`.
  - https://www.npmjs.com/settings/<your-username>/tokens
  - GitHub: Settings → Secrets and variables → Actions → New repository secret
- Push a tag like `v1.2.3` or create a GitHub Release — the workflow will build and publish.
- You can also trigger manually via the “Publish” workflow’s “Run workflow” button.

## Project links
 
Project links

- Repository: https://github.com/hfreni/psnjs
- Issues: https://github.com/hfreni/psnjs/issues
- npm package: https://www.npmjs.com/package/@harrisonfreni/psnjs

Note: Replace `REPLACE_ME_ORG/REPLACE_ME_REPO` with your GitHub org/repo once finalized.

## Install from GitHub Packages (optional)

GitHub Packages for npm requires an authenticated registry. Ensure your package scope matches the repository owner (e.g., `@OWNER/psnjs`). Then configure an `.npmrc`:

```
@OWNER:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

- Replace `OWNER` with your GitHub username or org.
- Use a GitHub Personal Access Token with `read:packages` (classic) or a Fine-grained PAT with Package read permission.

Install:

```bash
npm install @OWNER/psnjs
```

CI/CD (publish): use the provided `publish-gh-packages` workflow. It uses `GITHUB_TOKEN` and enforces that `package.json` name starts with `@${{ github.repository_owner }}/`.

**Data Flow**

- UDP multicast → PSNClient → Info/Data events → console logs (or your app logic)

**Key Env Vars**

- PSN_DEBUG=1: Verbose chunk/parse logging
- PSN_FLATTEN=1: Linear DATA parsing (each POS starts a tracker)
