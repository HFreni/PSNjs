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
import { Buffer } from 'buffer';
/**
 * Read a PSN “pch32” chunk header at offset:
 *   - first 16 bits (LE):     (hasSub<<15) | chunkID
 *   - second 16 bits (LE):    payload length
 */
/**
 * Read a pch32 header at offset and return its fields.
 */
export function readChunkHeader(buf, off) {
    const wordA = buf.readUInt16LE(off);
    const wordB = buf.readUInt16LE(off + 2);
    // Tolerant decoding: some implementations set the hasSub bit on the id word (A),
    // others set it on the length word (B). Detect and normalize.
    const aHas = (wordA & 0x8000) !== 0;
    const bHas = (wordB & 0x8000) !== 0;
    if (aHas && !bHas) {
        return { hasSub: true, id: wordA & 0x7fff, len: wordB };
    }
    if (bHas && !aHas) {
        return { hasSub: true, id: wordA, len: wordB & 0x7fff };
    }
    // Fallback: assume spec variant (hasSub on A)
    return { hasSub: aHas, id: wordA & 0x7fff, len: wordB };
}
/**
 * PSN chunk IDs (root + subtrees for INFO/DATA).
 */
export const CHUNK = {
    INFO_PACKET: 0x6756,
    DATA_PACKET: 0x6755,
    INFO: {
        HEADER: 0x0000,
        SYSTEM_NAME: 0x0001,
        TRACKER_LIST: 0x0002,
        TRACKER_NAME: 0x0000,
    },
    DATA: {
        HEADER: 0x0000,
        TRACKER_LIST: 0x0001,
        POS: 0x0000,
        SPEED: 0x0001,
        ORI: 0x0002,
        STATUS: 0x0003,
        ACCEL: 0x0004,
        TRGTPOS: 0x0005,
        TIMESTAMP: 0x0006, // ← add this
    }
};
/**
 * Build a pch32 chunk buffer.
 * If payload is an array, it is treated as sub-chunks and the hasSub bit is set.
 */
export function buildChunk(id, payload) {
    let body;
    let hasSub = false;
    if (Array.isArray(payload)) {
        hasSub = true;
        body = Buffer.concat(payload);
    }
    else {
        body = payload;
    }
    const len = body.length & 0xffff;
    const header = Buffer.alloc(4);
    const first16 = ((hasSub ? 1 : 0) << 15) | (id & 0x7fff);
    header.writeUInt16LE(first16, 0);
    header.writeUInt16LE(len, 2);
    return Buffer.concat([header, body]);
}
