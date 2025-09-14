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
import fs from 'fs';
import path from 'path';
import arg from 'arg';
export function loadJsonConfig(configPath) {
    if (!configPath)
        return {};
    const abs = path.resolve(process.cwd(), configPath);
    if (!fs.existsSync(abs))
        throw new Error(`Config file not found: ${abs}`);
    const raw = fs.readFileSync(abs, 'utf8');
    try {
        const json = JSON.parse(raw);
        return json;
    }
    catch (e) {
        throw new Error(`Failed to parse JSON config at ${abs}: ${String(e)}`);
    }
}
export function loadAppConfigFromCliAndEnv(argv, json) {
    const a = arg({
        '--config': String,
        '--iface': String,
        '--ttl': Number,
        '--debug': Boolean,
        '--flatten': Boolean,
        '--dry-run': Boolean,
    }, { argv });
    const fromFile = json || (a['--config'] ? loadJsonConfig(a['--config']) : {});
    const iface = a['--iface'] ?? fromFile?.iface ?? undefined;
    const ttl = a['--ttl'] ?? fromFile?.ttl ?? undefined;
    const parser = {
        debug: a['--debug'] ?? fromFile?.parser?.debug ?? (process.env.PSN_DEBUG === '1'),
        flatten: a['--flatten'] ?? fromFile?.parser?.flatten ?? (process.env.PSN_FLATTEN === '1'),
    };
    const dryRun = a['--dry-run'] ?? fromFile?.dryRun ?? (process.env.PSN_DRYRUN === '1');
    return { iface, ttl, parser, dryRun };
}
