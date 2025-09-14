# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

- Add badges and project links to README
- Add CHANGELOG and release guidance

## 1.0.0 — 2025-09-14

### Added

- PSN client parsing (INFO/DATA), robust bounds checks, endian-tolerant pch32 reader
- Tracker name extraction from INFO and naming in DATA logs
- Optional OSC/TCP routing with per-axis address templates and `{id}`/`{name}` placeholders
- PSN multicast server (INFO/DATA) with proper timestamps + frame IDs; dry-run mode
- Minimal CLI (`psnjs`): listen (optional OSC) and send-sim
- JSON config loader with merge (CLI > JSON > env)
- Dual CJS/ESM build with exports map, types, and CLI bin
- GitHub Actions CI: build/test/package across Node 18/20/22 and artifact upload
- MIT license and headers

### Changed

- Simplified npm scripts; added clean listen/osc/send helpers
