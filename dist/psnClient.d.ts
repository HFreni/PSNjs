import { EventEmitter } from 'events';
export declare class PSNClient extends EventEmitter {
    /**
     * Listens to PSN UDP multicast and emits high-level events:
     *  - 'ready' { device }
     *  - 'info'  InfoPayload
     *  - 'data'  DataPayload
     *  - 'error' Error
     */
    private cap;
    private linkType;
    private readonly GROUP;
    private readonly PORT;
    private readonly DEBUG;
    private readonly FLATTEN;
    /**
     * Open a capture on the interface associated with `ifaceIp`.
     * If omitted, auto-select the first non-loopback device.
     * Note: `TTL` is ignored in capture mode and kept for API symmetry.
     */
    start(ifaceIp?: string, TTL?: number): void;
    stop(): void;
    /** Resolve the pcap device name for a given IPv4 address (or pick a fallback). */
    private findDeviceByIp;
    /** Decode a single PSN UDP payload into INFO or DATA high-level payload. */
    private decodePSN;
    /** Parse the INFO.TRACKER_LIST payload into id->name map. */
    private parseInfoTrackers;
    /** Parse the DATA.TRACKER_LIST payload into id->TrackerData map. */
    private parseDataTrackers;
}
