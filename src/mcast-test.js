// mcast-test.js
const dgram = require('dgram');

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
const GROUP = '236.10.10.10';
const PORT  = 56565;
// iface can be provided via env IFACE or first CLI arg; if omitted, OS default is used
const IFACE = process.env.IFACE || process.argv[2] || undefined;

const sock = dgram.createSocket({ type:'udp4', reuseAddr: true });

sock.on('listening', () => {
  if (IFACE) sock.addMembership(GROUP, IFACE);
  else sock.addMembership(GROUP);
  console.log(`✅ Listening on ${GROUP}:${PORT}${IFACE ? ` via ${IFACE}` : ''}`);
});

sock.on('message', (msg, rinfo) => {
  console.log(`🔊 Got ${msg.length} bytes from ${rinfo.address}:${rinfo.port}:`, msg.toString());
});

sock.bind(PORT);
