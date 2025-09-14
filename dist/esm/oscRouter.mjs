import { OSCTcpClient } from './osc.mjs';
/**
 * Replace supported placeholders in address with tracker-specific data
 * Supported: {id}, {name}
 */
/** Replace {id}/{name} placeholders in an OSC address template. */
function formatAddress(tpl, ctx) {
    return tpl
        .replace(/\{id\}/g, String(ctx.id))
        .replace(/\{name\}/g, ctx.name ?? String(ctx.id));
}
export class OSCRouter {
    /**
     * Create a router that maps PSN tracker axes to OSC messages over TCP.
     */
    constructor(cfg) {
        this.trackerNames = {};
        this.client = new OSCTcpClient(cfg.host, cfg.port);
        this.addresses = cfg.addresses;
    }
    /** Update tracker name cache based on INFO packets. */
    updateInfo(info) {
        // cache tracker id -> name
        const map = {};
        for (const [id, trk] of Object.entries(info.trackers)) {
            map[Number(id)] = trk.name;
        }
        this.trackerNames = map;
    }
    /** Route positions/speed/orientation/acceleration to configured OSC addresses. */
    async routeData(data) {
        const promises = [];
        for (const [idStr, trk] of Object.entries(data.trackers)) {
            const id = Number(idStr);
            const ctx = { id, name: this.trackerNames[id] };
            // position
            if (trk.pos) {
                const a = this.addresses.pos;
                if (a.x)
                    promises.push(this.client.send(formatAddress(a.x, ctx), [trk.pos.x]));
                if (a.y)
                    promises.push(this.client.send(formatAddress(a.y, ctx), [trk.pos.y]));
                if (a.z)
                    promises.push(this.client.send(formatAddress(a.z, ctx), [trk.pos.z]));
            }
            // speed
            if (trk.speed && this.addresses.speed) {
                const a = this.addresses.speed;
                if (a?.x)
                    promises.push(this.client.send(formatAddress(a.x, ctx), [trk.speed.x]));
                if (a?.y)
                    promises.push(this.client.send(formatAddress(a.y, ctx), [trk.speed.y]));
                if (a?.z)
                    promises.push(this.client.send(formatAddress(a.z, ctx), [trk.speed.z]));
            }
            // orientation
            if (trk.orientation && this.addresses.ori) {
                const a = this.addresses.ori;
                if (a?.x)
                    promises.push(this.client.send(formatAddress(a.x, ctx), [trk.orientation.x]));
                if (a?.y)
                    promises.push(this.client.send(formatAddress(a.y, ctx), [trk.orientation.y]));
                if (a?.z)
                    promises.push(this.client.send(formatAddress(a.z, ctx), [trk.orientation.z]));
            }
            // acceleration
            if (trk.accel && this.addresses.accel) {
                const a = this.addresses.accel;
                if (a?.x)
                    promises.push(this.client.send(formatAddress(a.x, ctx), [trk.accel.x]));
                if (a?.y)
                    promises.push(this.client.send(formatAddress(a.y, ctx), [trk.accel.y]));
                if (a?.z)
                    promises.push(this.client.send(formatAddress(a.z, ctx), [trk.accel.z]));
            }
        }
        // do not throw early – attempt all and surface first error
        let firstErr;
        for (const p of promises) {
            try {
                await p;
            }
            catch (e) {
                if (!firstErr)
                    firstErr = e;
            }
        }
        if (firstErr)
            throw firstErr;
    }
}
export function loadOscRouterConfigFromEnv() {
    const host = process.env.OSC_HOST || '';
    const portStr = process.env.OSC_PORT || '';
    const enabled = process.env.OSC_ENABLE_TCP === '1' || (!!host && !!portStr);
    if (!enabled)
        return null;
    const port = Number(portStr || 9000);
    const pos = {
        x: process.env.OSC_ADDR_X || '/psn/{id}/x',
        y: process.env.OSC_ADDR_Y || '/psn/{id}/y',
        z: process.env.OSC_ADDR_Z || '/psn/{id}/z',
    };
    const onlyPos = process.env.OSC_ONLY_POS === '1';
    const speed = onlyPos ? {} : {
        x: process.env.OSC_ADDR_SPEED_X || '/psn/{id}/speed/x',
        y: process.env.OSC_ADDR_SPEED_Y || '/psn/{id}/speed/y',
        z: process.env.OSC_ADDR_SPEED_Z || '/psn/{id}/speed/z',
    };
    const ori = onlyPos ? {} : {
        x: process.env.OSC_ADDR_ORI_X || '/psn/{id}/ori/x',
        y: process.env.OSC_ADDR_ORI_Y || '/psn/{id}/ori/y',
        z: process.env.OSC_ADDR_ORI_Z || '/psn/{id}/ori/z',
    };
    const accel = onlyPos ? {} : {
        x: process.env.OSC_ADDR_ACCEL_X || '/psn/{id}/accel/x',
        y: process.env.OSC_ADDR_ACCEL_Y || '/psn/{id}/accel/y',
        z: process.env.OSC_ADDR_ACCEL_Z || '/psn/{id}/accel/z',
    };
    const addresses = { pos, speed, ori, accel };
    return { host: host || '127.0.0.1', port, addresses };
}
export function loadOscRouterConfigFromEnvAndCli(cli) {
    const envCfg = loadOscRouterConfigFromEnv();
    const enabled = cli?.enabled ?? !!envCfg;
    if (!enabled)
        return null;
    const host = cli?.host ?? envCfg?.host ?? '127.0.0.1';
    const port = cli?.port ?? envCfg?.port ?? 9000;
    const onlyPos = cli?.onlyPos ?? (process.env.OSC_ONLY_POS === '1');
    const addresses = {
        pos: { ...(envCfg?.addresses.pos || {}), ...(cli?.pos || {}) },
        speed: onlyPos ? {} : { ...(envCfg?.addresses.speed || {}), ...(cli?.speed || {}) },
        ori: onlyPos ? {} : { ...(envCfg?.addresses.ori || {}), ...(cli?.ori || {}) },
        accel: onlyPos ? {} : { ...(envCfg?.addresses.accel || {}), ...(cli?.accel || {}) },
    };
    return { host, port, addresses };
}
