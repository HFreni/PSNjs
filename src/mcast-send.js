// mcast-send.js
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
const dgram = require('dgram');
const IFACE = process.env.IFACE || process.argv[2] || undefined; // optional source interface IP
const GROUP = '236.10.10.10';
const PORT  = 56565;
const TTL   = Number(process.env.TTL || process.argv[3] || 1);

const sock = dgram.createSocket('udp4');
const onBound = () => {
  try {
    sock.setMulticastTTL(TTL);
    if (IFACE) sock.setMulticastInterface(IFACE);
  } catch {}
  const msg = Buffer.from('hello world');
  sock.send(msg, 0, msg.length, PORT, GROUP, err => {
    if (err) console.error('send error', err);
    else console.log(`sent "${msg}"${IFACE ? ` from ${IFACE}` : ''} → ${GROUP}:${PORT} (ttl=${TTL})`);
    sock.close();
  });
};

if (IFACE) sock.bind(0, IFACE, onBound);
else sock.bind(0, onBound);
