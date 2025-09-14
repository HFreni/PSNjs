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
import net from 'net';
import { OSCTcpClient } from './osc.mjs';
function readCString(buf, off) {
    let end = off;
    while (end < buf.length && buf[end] !== 0)
        end++;
    const str = buf.toString('utf8', off, end);
    let len = end - off + 1;
    len += (4 - (len % 4)) % 4; // pad to 4
    return { str, next: off + len };
}
function decodeOSC(buf) {
    let off = 0;
    const { str: address, next: off1 } = readCString(buf, off);
    off = off1;
    const { str: types, next: off2 } = readCString(buf, off);
    off = off2;
    const args = [];
    for (let i = 1; i < types.length; i++) {
        const t = types[i];
        if (t === 'f') {
            args.push(buf.readFloatBE(off));
            off += 4;
        }
        else if (t === 'i') {
            args.push(buf.readInt32BE(off));
            off += 4;
        }
        else if (t === 's') {
            const r = readCString(buf, off);
            args.push(r.str);
            off = r.next;
        }
        else {
            // unsupported tag, bail
            break;
        }
    }
    return { address, args };
}
async function main() {
    const port = 9000;
    const host = '127.0.0.1';
    // Simple OSC TCP server
    const server = net.createServer((sock) => {
        let buf = Buffer.alloc(0);
        sock.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            while (buf.length >= 4) {
                const len = buf.readUInt32BE(0);
                if (buf.length < 4 + len)
                    break;
                const frame = buf.slice(4, 4 + len);
                const msg = decodeOSC(frame);
                console.log(`[OSC SERVER] ${msg.address} ${JSON.stringify(msg.args)}`);
                buf = buf.slice(4 + len);
            }
        });
    });
    await new Promise((resolve) => server.listen(port, host, resolve));
    console.log(`[OSC SERVER] listening on ${host}:${port}`);
    // Client sends a few messages
    const client = new OSCTcpClient(host, port);
    await client.send('/test/x', [1.23]);
    await client.send('/test/y', [4.56]);
    await client.send('/test/z', [7.89]);
    setTimeout(() => {
        server.close();
        console.log('[OSC SERVER] closed');
    }, 300);
}
main().catch(err => {
    console.error('integration test failed', err);
    process.exitCode = 1;
});
