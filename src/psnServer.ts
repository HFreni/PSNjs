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
import dgram from 'dgram';
import { EventEmitter } from 'events';
import { buildChunk, CHUNK, TrackerData } from './utils';

/**
 * Minimal PSN multicast sender for INFO/DATA packets.
 * Useful for simulating a PSN source during development.
 */

type ReadyInfo = { addr: string; port: number; iface?: string; ttl: number };

export class PSNServer extends EventEmitter {
  private socket!: dgram.Socket;
  private readonly addr = '236.10.10.10';
  private readonly port = 56565;
  private iface?: string;
  private ttl = 1;
  private dryRun = process.env.PSN_DRYRUN === '1';
  // PSN header fields
  private frameId = 0;
  private readonly versionHigh = 2;
  private readonly versionLow = 0;

  /**
   * Bind a UDP socket for PSN multicast and configure TTL/interface if provided.
   */
  start(ifaceIp?: string, ttl = 1, opts?: { dryRun?: boolean }) {
    this.iface = ifaceIp;
    this.ttl = ttl;
    this.dryRun = opts?.dryRun ?? this.dryRun;
    if (this.dryRun) {
      const info: ReadyInfo = { addr: this.addr, port: this.port, iface: this.iface, ttl: this.ttl };
      // Emit ready without binding any sockets
      this.emit('ready', info);
      return;
    }
    this.socket = dgram.createSocket('udp4');
    this.socket.once('error', (e) => this.emit('error', e));
    this.socket.bind(0, ifaceIp, () => {
      try {
        this.socket.setMulticastTTL(ttl);
        if (ifaceIp) this.socket.setMulticastInterface(ifaceIp);
      } catch (e) {
        // non-fatal on some platforms
      }
      const info: ReadyInfo = { addr: this.addr, port: this.port, iface: this.iface, ttl: this.ttl };
      this.emit('ready', info);
    });
  }

  stop() {
    this.socket?.close();
    this.removeAllListeners();
  }

  /** Send INFO (systemName + tracker names). */
  sendInfo(systemName: string, trackers: Record<number, string>) {
    if (this.dryRun) {
      const trackerCount = Object.keys(trackers).length;
      console.log(`[PSN TX INFO DRY-RUN] system=${systemName} trackers=${trackerCount}`);
      return;
    }
    const chunks: Buffer[] = [];

    // header
    const hdr = this.makeHeader();
    chunks.push(buildChunk(CHUNK.INFO.HEADER, hdr));

    // system name
    chunks.push(buildChunk(CHUNK.INFO.SYSTEM_NAME, Buffer.from(systemName)));

    // tracker list
    const trk = Object.entries(trackers).map(([id, name]) => {
      const nm = buildChunk(CHUNK.INFO.TRACKER_NAME, Buffer.from(name));
      return buildChunk(Number(id), [nm]);
    });
    chunks.push(buildChunk(CHUNK.INFO.TRACKER_LIST, trk));

    const packet = buildChunk(CHUNK.INFO_PACKET, chunks);
    this.socket.send(packet, this.port, this.addr);
  }

  /** Send DATA (per‑tracker floats). */
  sendData(data: Record<number, TrackerData>) {
    if (this.dryRun) {
      const ids = Object.keys(data).join(',');
      console.log(`[PSN TX DATA DRY-RUN] ids=[${ids}]`);
      return;
    }
    const chunks: Buffer[] = [];

    // header
    const hdr = this.makeHeader();
    chunks.push(buildChunk(CHUNK.DATA.HEADER, hdr));

    // each tracker
    const trk = Object.entries(data).map(([id, d]) => {
      const sub: Buffer[] = [];
      if (d.pos) {
        const b = Buffer.alloc(12);
        b.writeFloatLE(d.pos.x, 0);
        b.writeFloatLE(d.pos.y, 4);
        b.writeFloatLE(d.pos.z, 8);
        sub.push(buildChunk(CHUNK.DATA.POS, b));
      }
      if (d.speed) {
        const b = Buffer.alloc(12);
        b.writeFloatLE(d.speed.x, 0);
        b.writeFloatLE(d.speed.y, 4);
        b.writeFloatLE(d.speed.z, 8);
        sub.push(buildChunk(CHUNK.DATA.SPEED, b));
      }
      if (d.orientation) {
        const b = Buffer.alloc(12);
        b.writeFloatLE(d.orientation.x, 0);
        b.writeFloatLE(d.orientation.y, 4);
        b.writeFloatLE(d.orientation.z, 8);
        sub.push(buildChunk(CHUNK.DATA.ORI, b));
      }
      if (d.accel) {
        const b = Buffer.alloc(12);
        b.writeFloatLE(d.accel.x, 0);
        b.writeFloatLE(d.accel.y, 4);
        b.writeFloatLE(d.accel.z, 8);
        sub.push(buildChunk(CHUNK.DATA.ACCEL, b));
      }
      if (d.targetPos) {
        const b = Buffer.alloc(12);
        b.writeFloatLE(d.targetPos.x, 0);
        b.writeFloatLE(d.targetPos.y, 4);
        b.writeFloatLE(d.targetPos.z, 8);
        sub.push(buildChunk(CHUNK.DATA.TRGTPOS, b));
      }
      if (d.validity != null) {
        const b = Buffer.alloc(4);
        b.writeFloatLE(d.validity, 0);
        sub.push(buildChunk(CHUNK.DATA.STATUS, b));
      }
      if (d.trackerTimestamp != null) {
        const b = Buffer.alloc(8);
        b.writeBigUInt64LE(d.trackerTimestamp, 0);
        sub.push(buildChunk(CHUNK.DATA.TIMESTAMP, b));
      }
      return buildChunk(Number(id), sub);
    });
    chunks.push(buildChunk(CHUNK.DATA.TRACKER_LIST, trk));

    const packet = buildChunk(CHUNK.DATA_PACKET, chunks);
    this.socket.send(packet, this.port, this.addr);
  }

  /**
   * Build a 12-byte PSN header payload:
   *  - 0..7  uint64 LE: timestamp in microseconds
   *  - 8     uint8:     version.high (default 2)
   *  - 9     uint8:     version.low  (default 0)
   *  - 10    uint8:     frameId (increments per packet)
   *  - 11    uint8:     packets (always 1 here)
   */
  private makeHeader(): Buffer {
    const b = Buffer.alloc(12);
    // Use a monotonic clock in microseconds for timestamp
    const ns = process.hrtime.bigint();
    const us = ns / 1000n;
    b.writeBigUInt64LE(us, 0);
    b.writeUInt8(this.versionHigh & 0xff, 8);
    b.writeUInt8(this.versionLow & 0xff, 9);
    b.writeUInt8(this.frameId & 0xff, 10);
    b.writeUInt8(1, 11);
    this.frameId = (this.frameId + 1) & 0xff;
    return b;
  }
}
