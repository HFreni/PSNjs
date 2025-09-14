export declare function encodeOSCMessage(address: string, args?: any[]): Buffer;
/**
 * Minimal OSC-over-TCP client using 32-bit BE length prefix framing
 */
export declare class OSCTcpClient {
    private socket;
    private connecting;
    private readonly host;
    private readonly port;
    constructor(host: string, port: number);
    private ensureConnected;
    send(address: string, args?: any[]): Promise<void>;
    close(): void;
}
