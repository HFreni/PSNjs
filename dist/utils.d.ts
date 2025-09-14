import { Buffer } from 'buffer';
/**
 * PSN pch32 header helpers and shared types.
 *
 * The 32-bit pch32 header is two little-endian 16-bit words:
 *   - word A: (hasSub << 15) | id (15 bits)
 *   - word B: length (bytes)
 * Some implementations set the hasSub bit in word B instead; the reader is
 * tolerant and normalizes both variants.
 */
export interface ChunkHeader {
    hasSub: boolean;
    id: number;
    len: number;
}
/**
 * Read a PSN “pch32” chunk header at offset:
 *   - first 16 bits (LE):     (hasSub<<15) | chunkID
 *   - second 16 bits (LE):    payload length
 */
/**
 * Read a pch32 header at offset and return its fields.
 */
export declare function readChunkHeader(buf: Buffer, off: number): {
    hasSub: boolean;
    id: number;
    len: number;
};
/**
 * PSN chunk IDs (root + subtrees for INFO/DATA).
 */
export declare const CHUNK: {
    INFO_PACKET: number;
    DATA_PACKET: number;
    INFO: {
        HEADER: number;
        SYSTEM_NAME: number;
        TRACKER_LIST: number;
        TRACKER_NAME: number;
    };
    DATA: {
        HEADER: number;
        TRACKER_LIST: number;
        POS: number;
        SPEED: number;
        ORI: number;
        STATUS: number;
        ACCEL: number;
        TRGTPOS: number;
        TIMESTAMP: number;
    };
};
/**
 * Build a pch32 chunk buffer.
 * If payload is an array, it is treated as sub-chunks and the hasSub bit is set.
 */
export declare function buildChunk(id: number, payload: Buffer | Buffer[]): Buffer;
/** Packet header decoded from PSN INFO/DATA header subchunk. */
export interface PSNHeader {
    timestamp: bigint;
    version: {
        high: number;
        low: number;
    };
    frameId: number;
    packets: number;
}
export interface TrackerInfo {
    name: string;
}
/** Per-tracker data as emitted by the PSN DATA packet. */
export interface TrackerData {
    pos?: {
        x: number;
        y: number;
        z: number;
    };
    speed?: {
        x: number;
        y: number;
        z: number;
    };
    orientation?: {
        x: number;
        y: number;
        z: number;
    };
    validity?: number;
    accel?: {
        x: number;
        y: number;
        z: number;
    };
    targetPos?: {
        x: number;
        y: number;
        z: number;
    };
    trackerTimestamp?: bigint;
}
export interface InfoPayload {
    header: PSNHeader;
    systemName: string;
    trackers: Record<number, TrackerInfo>;
}
export interface DataPayload {
    header: PSNHeader;
    trackers: Record<number, TrackerData>;
}
