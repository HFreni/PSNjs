export type ParserConfig = {
    debug?: boolean;
    flatten?: boolean;
};
export type AppConfig = {
    iface?: string;
    ttl?: number;
    parser?: ParserConfig;
    dryRun?: boolean;
};
export declare function loadJsonConfig(configPath?: string): Partial<AppConfig>;
export declare function loadAppConfigFromCliAndEnv(argv: string[], json?: Partial<AppConfig>): AppConfig;
