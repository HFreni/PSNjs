// mcast-send.js
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
