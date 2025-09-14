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
// src/psnClient.ts
import { EventEmitter } from 'events';
import { readChunkHeader, CHUNK } from './utils.mjs';
// Note: "cap" (native addon) is lazy-required inside start() so that simply
// importing this module does not require native binaries. This keeps CI and
// packaging environments happy when libpcap is not available.
export class PSNClient extends EventEmitter {
    constructor() {
        super(...arguments);
        this.GROUP = '236.10.10.10';
        this.PORT = 56565;
        this.DEBUG = process.env.PSN_DEBUG === '1';
        this.FLATTEN = process.env.PSN_FLATTEN === '1';
    }
    /**
     * Open a capture on the interface associated with `ifaceIp`.
     * If omitted, auto-select the first non-loopback device.
     * Note: `TTL` is ignored in capture mode and kept for API symmetry.
     */
    start(ifaceIp, TTL) {
        // Lazy-load native module
        const CapModule = require('cap');
        this.capModule = CapModule;
        this.cap = new CapModule.Cap();
        this.decoders = CapModule.decoders;
        this.PROTOCOL = this.decoders.PROTOCOL;
        const dev = this.findDeviceByIp(ifaceIp);
        if (!dev)
            throw new Error(`No capture device for IP ${ifaceIp}`);
        const filter = `udp dst port ${this.PORT} and dst host ${this.GROUP}`;
        const buffer = Buffer.alloc(65535);
        this.linkType = this.cap.open(dev, filter, 10 * 1024 * 1024, buffer);
        this.cap.setMinBytes?.(0);
        console.log(`✔︎ Listening on ${dev} for ${filter}`);
        this.cap.on('packet', (nbytes) => {
            let off = 0;
            if (this.linkType === 'ETHERNET') {
                const eth = this.decoders.Ethernet(buffer);
                if (eth.info.type !== this.PROTOCOL.ETHERNET.IPV4)
                    return;
                off = eth.offset;
            }
            const ip = this.decoders.IPV4(buffer, off);
            if (ip.info.protocol !== this.PROTOCOL.IP.UDP)
                return;
            off = ip.offset;
            const udp = this.decoders.UDP(buffer, off);
            off = udp.offset;
            const psnBuf = buffer.slice(off, nbytes);
            try {
                const { type, payload } = this.decodePSN(psnBuf);
                this.emit(type.toLowerCase(), payload);
            }
            catch (err) {
                this.emit('error', err);
            }
        });
        this.emit('ready', { device: dev });
    }
    stop() {
        this.cap?.close();
        this.emit('stopped');
    }
    /** Resolve the pcap device name for a given IPv4 address (or pick a fallback). */
    findDeviceByIp(ip) {
        const devs = this.capModule?.deviceList?.() ?? [];
        for (const d of devs) {
            if (d.addresses.some((a) => a.addr === ip))
                return d.name;
        }
        const fb = devs.find(d => d.addresses.some((a) => a.addr !== '127.0.0.1'));
        return fb?.name || null;
    }
    /** Decode a single PSN UDP payload into INFO or DATA high-level payload. */
    decodePSN(buf) {
        // Each PSN packet is a pch32 tree with a root (INFO_PACKET/DATA_PACKET)
        // containing a header subchunk and a list of trackers.
        let off = 0;
        const root = readChunkHeader(buf, off);
        off += 4;
        if (root.id !== CHUNK.INFO_PACKET && root.id !== CHUNK.DATA_PACKET) {
            throw new Error(`Unknown root chunk id 0x${root.id.toString(16)}`);
        }
        const isInfo = root.id === CHUNK.INFO_PACKET;
        const endRoot = Math.min(off + root.len, buf.length);
        // packet header
        if (off + 4 > endRoot)
            throw new Error('Truncated PSN header');
        const hdrCh = readChunkHeader(buf, off);
        off += 4;
        if (off + hdrCh.len > endRoot)
            throw new Error('Truncated PSN header payload');
        const header = {
            timestamp: buf.readBigUInt64LE(off),
            version: { high: buf.readUInt8(off + 8), low: buf.readUInt8(off + 9) },
            frameId: buf.readUInt8(off + 10),
            packets: buf.readUInt8(off + 11),
        };
        off += hdrCh.len;
        if (isInfo) {
            const payload = { header, systemName: '', trackers: {} };
            while (off + 4 <= endRoot) {
                const ch = readChunkHeader(buf, off);
                off += 4;
                if (this.DEBUG)
                    console.log(`[PSN INFO] sub id=0x${ch.id.toString(16)} len=${ch.len}`);
                if (off + ch.len > endRoot)
                    break;
                if (ch.id === CHUNK.INFO.SYSTEM_NAME) {
                    payload.systemName = buf.toString('utf8', off, off + ch.len);
                }
                else if (ch.id === CHUNK.INFO.TRACKER_LIST) {
                    if (this.DEBUG)
                        console.log(`[PSN INFO] parsing tracker list len=${ch.len}`);
                    payload.trackers = this.parseInfoTrackers(buf.slice(off, off + ch.len));
                }
                off += ch.len;
            }
            return { type: 'INFO', payload };
        }
        else {
            const payload = { header, trackers: {} };
            while (off + 4 <= endRoot) {
                const ch = readChunkHeader(buf, off);
                off += 4;
                if (this.DEBUG)
                    console.log(`[PSN DATA] sub id=0x${ch.id.toString(16)} len=${ch.len}`);
                if (off + ch.len > endRoot)
                    break;
                if (ch.id === CHUNK.DATA.TRACKER_LIST) {
                    if (this.DEBUG)
                        console.log(`[PSN DATA] parsing tracker list len=${ch.len}`);
                    payload.trackers = this.parseDataTrackers(buf.slice(off, off + ch.len));
                }
                off += ch.len;
            }
            return { type: 'DATA', payload };
        }
    }
    /** Parse the INFO.TRACKER_LIST payload into id->name map. */
    parseInfoTrackers(buf) {
        // Preferred: wrapper-based structure (tracker wrapper -> TRACKER_NAME or ASCII payload)
        const out = {};
        let off = 0;
        const extractAscii = (b) => {
            // Trim at first NUL, drop trailing NULs, ensure it looks printable
            const nul = b.indexOf(0);
            const slice = b.slice(0, nul >= 0 ? nul : b.length);
            const s = slice.toString('utf8').trim();
            if (!s)
                return '';
            // basic printable check
            const nonPrintable = s.replace(/[\x20-\x7e]/g, '');
            if (nonPrintable.length > 0)
                return '';
            return s;
        };
        while (off + 4 <= buf.length) {
            const wrapper = readChunkHeader(buf, off);
            off += 4;
            if (this.DEBUG)
                console.log(`[PSN INFO] tracker wrapper id=0x${wrapper.id.toString(16)} len=${wrapper.len} hasSub=${wrapper.hasSub}`);
            const trackerId = wrapper.id & 0x7fff; // PSN uses 15-bit id
            let end = Math.min(off + wrapper.len, buf.length);
            if (!wrapper.hasSub) {
                const name = extractAscii(buf.slice(off, end));
                if (name) {
                    out[trackerId] = { name };
                    if (this.DEBUG)
                        console.log(`  [PSN INFO] inferred name (flat): "${name}"`);
                }
                off = end;
                continue;
            }
            let nameSet = false;
            while (off + 4 <= end) {
                const sub = readChunkHeader(buf, off);
                off += 4;
                if (this.DEBUG)
                    console.log(`  [PSN INFO] sub id=0x${sub.id.toString(16)} len=${sub.len}`);
                if (off + sub.len > end) {
                    off = end;
                    break;
                }
                if (sub.id === CHUNK.INFO.TRACKER_NAME) {
                    const nameBuf = buf.slice(off, off + sub.len);
                    const name = extractAscii(nameBuf);
                    if (name) {
                        out[trackerId] = { name };
                        nameSet = true;
                    }
                }
                else if (!nameSet) {
                    // Some implementations might put the name in an unnamed subchunk
                    const guess = extractAscii(buf.slice(off, off + sub.len));
                    if (guess) {
                        out[trackerId] = { name: guess };
                        nameSet = true;
                    }
                }
                off += sub.len;
            }
            if (off < end)
                off = end;
        }
        if (Object.keys(out).length)
            return out;
        // Fallback: extract ASCII names from the whole buffer and index 1..N
        const raw = buf.toString('utf8');
        const names = Array.from(raw.matchAll(/[A-Za-z0-9 _.-]{2,}/g), m => m[0].trim()).filter(Boolean);
        const fallback = {};
        names.forEach((name, idx) => { fallback[idx + 1] = { name }; });
        return fallback;
    }
    /** Parse the DATA.TRACKER_LIST payload into id->TrackerData map. */
    parseDataTrackers(buf) {
        if (this.FLATTEN) {
            // Flattened mode: treat payload as linear subchunk stream, each POS starts a new tracker
            const grouped = {};
            let off = 0;
            let idx = 0;
            let current = null;
            while (off + 4 <= buf.length) {
                const h = readChunkHeader(buf, off);
                off += 4;
                if (off + h.len > buf.length)
                    break;
                const data = buf.slice(off, off + h.len);
                off += h.len;
                const id = h.id;
                if (id === CHUNK.DATA.POS) {
                    idx += 1;
                    current = {};
                    grouped[idx] = current;
                    if (data.length >= 12)
                        current.pos = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                    continue;
                }
                if (!current)
                    continue;
                // Subchunk schema (LE):
                //   0x0000 POS        → float32 x3  (x,y,z)
                //   0x0001 SPEED      → float32 x3  (x,y,z)
                //   0x0002 ORI        → float32 x3  (x,y,z)
                //   0x0003 STATUS     → float32     (validity)
                //   0x0004 ACCEL      → float32 x3  (x,y,z)
                //   0x0005 TRGTPOS    → float32 x3  (x,y,z)
                //   0x0006 TIMESTAMP  → uint64      (tracker timestamp)
                switch (id) {
                    case CHUNK.DATA.SPEED:
                        if (data.length >= 12)
                            current.speed = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.ORI:
                        if (data.length >= 12)
                            current.orientation = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.STATUS:
                        if (data.length >= 4)
                            current.validity = data.readFloatLE(0);
                        break;
                    case CHUNK.DATA.ACCEL:
                        if (data.length >= 12)
                            current.accel = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.TRGTPOS:
                        if (data.length >= 12)
                            current.targetPos = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.TIMESTAMP:
                        if (data.length >= 8)
                            current.trackerTimestamp = data.readBigUInt64LE(0);
                        break;
                }
            }
            return grouped;
        }
        // Preferred: wrapper-based tracker list
        const out = {};
        let off = 0;
        while (off + 4 <= buf.length) {
            const wrapper = readChunkHeader(buf, off);
            off += 4;
            if (this.DEBUG)
                console.log(`[PSN DATA] tracker wrapper id=0x${wrapper.id.toString(16)} len=${wrapper.len}`);
            const trackerId = wrapper.id & 0x7fff;
            const trk = {};
            let end = Math.min(off + wrapper.len, buf.length);
            while (off + 4 <= end) {
                const sub = readChunkHeader(buf, off);
                off += 4;
                if (this.DEBUG)
                    console.log(`  [PSN DATA] sub id=0x${sub.id.toString(16)} len=${sub.len}`);
                if (off + sub.len > end) {
                    off = end;
                    break;
                }
                const data = buf.slice(off, off + sub.len);
                // Subchunk schema (LE):
                //   0x0000 POS        → float32 x3  (x,y,z)
                //   0x0001 SPEED      → float32 x3  (x,y,z)
                //   0x0002 ORI        → float32 x3  (x,y,z)
                //   0x0003 STATUS     → float32     (validity)
                //   0x0004 ACCEL      → float32 x3  (x,y,z)
                //   0x0005 TRGTPOS    → float32 x3  (x,y,z)
                //   0x0006 TIMESTAMP  → uint64      (tracker timestamp)
                switch (sub.id) {
                    case CHUNK.DATA.POS:
                        if (data.length >= 12)
                            trk.pos = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.SPEED:
                        if (data.length >= 12)
                            trk.speed = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.ORI:
                        if (data.length >= 12)
                            trk.orientation = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.STATUS:
                        if (data.length >= 4)
                            trk.validity = data.readFloatLE(0);
                        break;
                    case CHUNK.DATA.ACCEL:
                        if (data.length >= 12)
                            trk.accel = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.TRGTPOS:
                        if (data.length >= 12)
                            trk.targetPos = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                        break;
                    case CHUNK.DATA.TIMESTAMP:
                        if (data.length >= 8)
                            trk.trackerTimestamp = data.readBigUInt64LE(0);
                        break;
                }
                off += sub.len;
            }
            if (Object.keys(trk).length)
                out[trackerId] = trk;
            if (off < end)
                off = end;
        }
        if (Object.keys(out).length)
            return out;
        // Fallback: flattened subchunk stream (no wrappers). Start a new tracker on each POS.
        const grouped = {};
        let idx = 0;
        off = 0;
        let current = null;
        while (off + 4 <= buf.length) {
            const h = readChunkHeader(buf, off);
            off += 4;
            if (off + h.len > buf.length)
                break;
            const data = buf.slice(off, off + h.len);
            off += h.len;
            const id = h.id;
            if (id === CHUNK.DATA.POS) {
                idx += 1;
                current = {};
                grouped[idx] = current;
                if (data.length >= 12)
                    current.pos = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                continue;
            }
            if (!current)
                continue;
            switch (id) {
                case CHUNK.DATA.SPEED:
                    if (data.length >= 12)
                        current.speed = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                    break;
                case CHUNK.DATA.ORI:
                    if (data.length >= 12)
                        current.orientation = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                    break;
                case CHUNK.DATA.STATUS:
                    if (data.length >= 4)
                        current.validity = data.readFloatLE(0);
                    break;
                case CHUNK.DATA.ACCEL:
                    if (data.length >= 12)
                        current.accel = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                    break;
                case CHUNK.DATA.TRGTPOS:
                    if (data.length >= 12)
                        current.targetPos = { x: data.readFloatLE(0), y: data.readFloatLE(4), z: data.readFloatLE(8) };
                    break;
                case CHUNK.DATA.TIMESTAMP:
                    if (data.length >= 8)
                        current.trackerTimestamp = data.readBigUInt64LE(0);
                    break;
            }
        }
        return grouped;
    }
}
