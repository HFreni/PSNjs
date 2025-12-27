/*
 * Test script that outputs 10 trackers with animated sine wave patterns.
 * Each tracker follows a different mathematical curve.
 *
 * Usage: npx ts-node src/test-10-axes.ts
 */

import { PSNServer } from './psnServer';
import { TrackerData } from './utils';

// Create server for real PSN multicast transmission
const server = new PSNServer();

server.on('ready', (info) => {
  console.log(`PSN Server ready`);
  console.log(`Sending to ${info.addr}:${info.port}\n`);

  // Define 10 trackers
  const trackers: Record<number, string> = {};
  for (let i = 0; i < 10; i++) {
    trackers[i] = `Tracker_${i}`;
  }

  // Send INFO packet with tracker names
  server.sendInfo('SineWaveTest', trackers);
  console.log();

  let frame = 0;
  const fps = 30;

  console.log('=== 10 Trackers with Sine Wave Curves ===\n');
  console.log('Tracker patterns:');
  console.log('  0: Simple sine wave (X)');
  console.log('  1: Cosine wave (X)');
  console.log('  2: Circle motion (X, Y)');
  console.log('  3: Figure-8 / Lissajous (X, Y)');
  console.log('  4: Spiral (X, Y, Z)');
  console.log('  5: Bouncing (Z with decay)');
  console.log('  6: Double frequency sine');
  console.log('  7: Phase-shifted sine');
  console.log('  8: Sawtooth-ish wave');
  console.log('  9: Square-ish wave (smoothed)');
  console.log();

  const interval = setInterval(() => {
    const t = frame / fps; // time in seconds
    const data: Record<number, TrackerData> = {};

    // Tracker 0: Simple sine wave (X oscillates)
    data[0] = {
      pos: {
        x: Math.sin(t * 2 * Math.PI) * 100,
        y: 0,
        z: 0,
      },
    };

    // Tracker 1: Cosine wave (X oscillates, 90° phase shift)
    data[1] = {
      pos: {
        x: Math.cos(t * 2 * Math.PI) * 100,
        y: 0,
        z: 0,
      },
    };

    // Tracker 2: Circle motion in XY plane
    data[2] = {
      pos: {
        x: Math.cos(t * 2 * Math.PI) * 50,
        y: Math.sin(t * 2 * Math.PI) * 50,
        z: 0,
      },
    };

    // Tracker 3: Figure-8 / Lissajous curve
    data[3] = {
      pos: {
        x: Math.sin(t * 2 * Math.PI) * 75,
        y: Math.sin(t * 4 * Math.PI) * 40,
        z: 0,
      },
    };

    // Tracker 4: Spiral (circle + rising Z)
    data[4] = {
      pos: {
        x: Math.cos(t * 2 * Math.PI) * 50,
        y: Math.sin(t * 2 * Math.PI) * 50,
        z: t * 30,
      },
    };

    // Tracker 5: Bouncing (absolute sine for Z)
    data[5] = {
      pos: {
        x: 0,
        y: 0,
        z: Math.abs(Math.sin(t * 3 * Math.PI)) * 100,
      },
    };

    // Tracker 6: Double frequency sine
    data[6] = {
      pos: {
        x: Math.sin(t * 4 * Math.PI) * 80,
        y: 0,
        z: 0,
      },
    };

    // Tracker 7: Phase-shifted sine (offset by 120°)
    data[7] = {
      pos: {
        x: Math.sin(t * 2 * Math.PI + (2 * Math.PI) / 3) * 100,
        y: 0,
        z: 0,
      },
    };

    // Tracker 8: Sawtooth-ish wave (using modulo approximation)
    const sawPhase = (t % 1) * 2 - 1; // -1 to 1 sawtooth
    data[8] = {
      pos: {
        x: sawPhase * 100,
        y: 0,
        z: 0,
      },
    };

    // Tracker 9: Square-ish wave (smoothed with tanh)
    data[9] = {
      pos: {
        x: Math.tanh(Math.sin(t * 2 * Math.PI) * 5) * 100,
        y: 0,
        z: 0,
      },
    };

    // Output current frame data
    console.log(`\n--- Frame ${frame} (t=${t.toFixed(3)}s) ---`);
    for (const [id, d] of Object.entries(data)) {
      const name = trackers[Number(id)];
      const x = d.pos?.x?.toFixed(2).padStart(8) ?? '       0';
      const y = d.pos?.y?.toFixed(2).padStart(8) ?? '       0';
      const z = d.pos?.z?.toFixed(2).padStart(8) ?? '       0';
      console.log(`  ${name.padEnd(12)}: X=${x}, Y=${y}, Z=${z}`);
    }

    // Send the data
    server.sendData(data);

    frame++;
  }, 1000 / fps);

  // Handle Ctrl+C to stop gracefully
  process.on('SIGINT', () => {
    console.log('\n=== Stopped ===');
    server.stop();
    process.exit(0);
  });
});

// Start the server (sends real PSN multicast packets)
server.start();
