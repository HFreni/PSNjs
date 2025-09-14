import { EventEmitter } from 'events';
import { TrackerData } from './utils';
export declare class PSNServer extends EventEmitter {
    private socket;
    private readonly addr;
    private readonly port;
    private iface?;
    private ttl;
    private dryRun;
    private frameId;
    private readonly versionHigh;
    private readonly versionLow;
    /**
     * Bind a UDP socket for PSN multicast and configure TTL/interface if provided.
     */
    start(ifaceIp?: string, ttl?: number, opts?: {
        dryRun?: boolean;
    }): void;
    stop(): void;
    /** Send INFO (systemName + tracker names). */
    sendInfo(systemName: string, trackers: Record<number, string>): void;
    /** Send DATA (per‑tracker floats). */
    sendData(data: Record<number, TrackerData>): void;
    /**
     * Build a 12-byte PSN header payload:
     *  - 0..7  uint64 LE: timestamp in microseconds
     *  - 8     uint8:     version.high (default 2)
     *  - 9     uint8:     version.low  (default 0)
     *  - 10    uint8:     frameId (increments per packet)
     *  - 11    uint8:     packets (always 1 here)
     */
    private makeHeader;
}
