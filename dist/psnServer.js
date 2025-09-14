"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PSNServer = void 0;
const dgram_1 = __importDefault(require("dgram"));
const events_1 = require("events");
const utils_1 = require("./utils");
class PSNServer extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.addr = '236.10.10.10';
        this.port = 56565;
        this.ttl = 1;
        // PSN header fields
        this.frameId = 0;
        this.versionHigh = 2;
        this.versionLow = 0;
    }
    /**
     * Bind a UDP socket for PSN multicast and configure TTL/interface if provided.
     */
    start(ifaceIp, ttl = 1) {
        this.iface = ifaceIp;
        this.ttl = ttl;
        this.socket = dgram_1.default.createSocket('udp4');
        this.socket.once('error', (e) => this.emit('error', e));
        this.socket.bind(0, ifaceIp, () => {
            try {
                this.socket.setMulticastTTL(ttl);
                if (ifaceIp)
                    this.socket.setMulticastInterface(ifaceIp);
            }
            catch (e) {
                // non-fatal on some platforms
            }
            const info = { addr: this.addr, port: this.port, iface: this.iface, ttl: this.ttl };
            this.emit('ready', info);
        });
    }
    stop() {
        this.socket?.close();
        this.removeAllListeners();
    }
    /** Send INFO (systemName + tracker names). */
    sendInfo(systemName, trackers) {
        const chunks = [];
        // header
        const hdr = this.makeHeader();
        chunks.push((0, utils_1.buildChunk)(utils_1.CHUNK.INFO.HEADER, hdr));
        // system name
        chunks.push((0, utils_1.buildChunk)(utils_1.CHUNK.INFO.SYSTEM_NAME, Buffer.from(systemName)));
        // tracker list
        const trk = Object.entries(trackers).map(([id, name]) => {
            const nm = (0, utils_1.buildChunk)(utils_1.CHUNK.INFO.TRACKER_NAME, Buffer.from(name));
            return (0, utils_1.buildChunk)(Number(id), [nm]);
        });
        chunks.push((0, utils_1.buildChunk)(utils_1.CHUNK.INFO.TRACKER_LIST, trk));
        const packet = (0, utils_1.buildChunk)(utils_1.CHUNK.INFO_PACKET, chunks);
        this.socket.send(packet, this.port, this.addr);
    }
    /** Send DATA (per‑tracker floats). */
    sendData(data) {
        const chunks = [];
        // header
        const hdr = this.makeHeader();
        chunks.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.HEADER, hdr));
        // each tracker
        const trk = Object.entries(data).map(([id, d]) => {
            const sub = [];
            if (d.pos) {
                const b = Buffer.alloc(12);
                b.writeFloatLE(d.pos.x, 0);
                b.writeFloatLE(d.pos.y, 4);
                b.writeFloatLE(d.pos.z, 8);
                sub.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.POS, b));
            }
            if (d.speed) {
                const b = Buffer.alloc(12);
                b.writeFloatLE(d.speed.x, 0);
                b.writeFloatLE(d.speed.y, 4);
                b.writeFloatLE(d.speed.z, 8);
                sub.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.SPEED, b));
            }
            if (d.orientation) {
                const b = Buffer.alloc(12);
                b.writeFloatLE(d.orientation.x, 0);
                b.writeFloatLE(d.orientation.y, 4);
                b.writeFloatLE(d.orientation.z, 8);
                sub.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.ORI, b));
            }
            if (d.accel) {
                const b = Buffer.alloc(12);
                b.writeFloatLE(d.accel.x, 0);
                b.writeFloatLE(d.accel.y, 4);
                b.writeFloatLE(d.accel.z, 8);
                sub.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.ACCEL, b));
            }
            if (d.targetPos) {
                const b = Buffer.alloc(12);
                b.writeFloatLE(d.targetPos.x, 0);
                b.writeFloatLE(d.targetPos.y, 4);
                b.writeFloatLE(d.targetPos.z, 8);
                sub.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.TRGTPOS, b));
            }
            if (d.validity != null) {
                const b = Buffer.alloc(4);
                b.writeFloatLE(d.validity, 0);
                sub.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.STATUS, b));
            }
            if (d.trackerTimestamp != null) {
                const b = Buffer.alloc(8);
                b.writeBigUInt64LE(d.trackerTimestamp, 0);
                sub.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.TIMESTAMP, b));
            }
            return (0, utils_1.buildChunk)(Number(id), sub);
        });
        chunks.push((0, utils_1.buildChunk)(utils_1.CHUNK.DATA.TRACKER_LIST, trk));
        const packet = (0, utils_1.buildChunk)(utils_1.CHUNK.DATA_PACKET, chunks);
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
    makeHeader() {
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
exports.PSNServer = PSNServer;
