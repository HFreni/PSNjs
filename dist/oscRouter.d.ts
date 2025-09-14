import { DataPayload, InfoPayload } from './utils';
/** Map axis keys to OSC address templates. */
export type AxisMappings = {
    x?: string;
    y?: string;
    z?: string;
};
export type OscRouterConfig = {
    host: string;
    port: number;
    addresses: {
        pos: AxisMappings;
        speed?: AxisMappings;
        ori?: AxisMappings;
        accel?: AxisMappings;
    };
};
export declare class OSCRouter {
    private readonly client;
    private readonly addresses;
    private trackerNames;
    /**
     * Create a router that maps PSN tracker axes to OSC messages over TCP.
     */
    constructor(cfg: OscRouterConfig);
    /** Update tracker name cache based on INFO packets. */
    updateInfo(info: InfoPayload): void;
    /** Route positions/speed/orientation/acceleration to configured OSC addresses. */
    routeData(data: DataPayload): Promise<void>;
}
export declare function loadOscRouterConfigFromEnv(): OscRouterConfig | null;
export type OscCliOverrides = Partial<{
    host: string;
    port: number;
    pos: AxisMappings;
    speed: AxisMappings;
    ori: AxisMappings;
    accel: AxisMappings;
    enabled: boolean;
    onlyPos: boolean;
}>;
export declare function loadOscRouterConfigFromEnvAndCli(cli?: OscCliOverrides): OscRouterConfig | null;
