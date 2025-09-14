// mcast-test.js
const dgram = require('dgram');

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
