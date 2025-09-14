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

/**
 * Minimal OSC encoder and TCP client with size-prefixed framing.
 * This supports string and float arguments and maps booleans to 0/1 int32.
 */

function pad4(buf: Buffer): Buffer {
  const pad = (4 - (buf.length % 4)) % 4;
  if (pad === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(pad, 0)]);
}

function oscString(s: string): Buffer {
  return pad4(Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]))
}

function oscTypeTags(args: any[]): Buffer {
  let tags = ',';
  for (const a of args) {
    if (typeof a === 'number') tags += 'f';
    else if (typeof a === 'string') tags += 's';
    else if (typeof a === 'boolean') tags += 'i'; // as 0/1 int
    else tags += 's';
  }
  return oscString(tags);
}

function oscArg(a: any): Buffer {
  if (typeof a === 'number') {
    const b = Buffer.alloc(4);
    b.writeFloatBE(a, 0);
    return b;
  }
  if (typeof a === 'boolean') {
    const b = Buffer.alloc(4);
    b.writeInt32BE(a ? 1 : 0, 0);
    return b;
  }
  // string fallback
  return oscString(String(a));
}

export function encodeOSCMessage(address: string, args: any[] = []): Buffer {
  const addr = oscString(address);
  const types = oscTypeTags(args);
  const argBufs = args.map(oscArg);
  return Buffer.concat([addr, types, ...argBufs]);
}

/**
 * Minimal OSC-over-TCP client using 32-bit BE length prefix framing
 */
export class OSCTcpClient {
  private socket: net.Socket | null = null;
  private connecting = false;
  private readonly host: string;
  private readonly port: number;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  private async ensureConnected(): Promise<void> {
    // Reuse the connection; on error/close we recreate it lazily.
    if (this.socket && !this.socket.destroyed) return;
    if (this.connecting) {
      // wait until existing attempt finishes
      await new Promise(resolve => setTimeout(resolve, 50));
      return this.ensureConnected();
    }
    this.connecting = true;
    await new Promise<void>((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port }, () => {
        this.socket = sock;
        this.connecting = false;
        resolve();
      });
      sock.on('error', (err) => {
        this.connecting = false;
        // keep state clean
        this.socket = null;
        reject(err);
      });
      sock.on('close', () => {
        this.socket = null;
      });
    });
  }

  async send(address: string, args: any[] = []): Promise<void> {
    const msg = encodeOSCMessage(address, args);
    const frame = Buffer.alloc(4 + msg.length);
    frame.writeUInt32BE(msg.length, 0);
    msg.copy(frame, 4);
    await this.ensureConnected();
    await new Promise<void>((resolve, reject) => {
      this.socket!.write(frame, (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close() {
    this.socket?.end();
    this.socket = null;
  }
}
