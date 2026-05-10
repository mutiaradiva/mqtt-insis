/**
 * Subscriber 1: Monitor Utama
 * Fitur: Pub/Sub (F1), Wildcard # (F2), Flow Control / receiveMaximum (F10)
 *
 * Subscribe ke semua topic suhu sekaligus menggunakan wildcard multi-level (#).
 * Flow Control membatasi jumlah pesan in-flight agar tidak overwhelm.
 */

const { createClient } = require('../common/mqttClient');

// Feature 10: Flow Control — batasi in-flight messages (receiveMaximum)
const client = createClient('monitor-utama', {
    properties: {
        receiveMaximum: 5 // Broker tidak akan kirim lebih dari 5 QoS>0 message sebelum di-ACK
    }
});

client.on('connect', () => {
    console.log('[MONITOR] Terhubung ke broker (receiveMaximum=5).');

    // Feature 2: Wildcard multi-level (#) — terima SEMUA topic di bawah "suhu/"
    client.subscribe('suhu/#', { qos: 2 });
    console.log('[MONITOR] Subscribe wildcard: suhu/#\n');
});

client.on('message', (topic, message, packet) => {
    let data;
    try {
        data = JSON.parse(message.toString());
    } catch {
        data = message.toString();
    }

    // Tampilkan dengan warna berdasarkan jenis topic
    const now = new Date().toLocaleTimeString('id-ID');

    if (topic.endsWith('/status')) {
        // Status sensor online/offline
        const icon   = data.status === 'online' ? '🟢' : '🔴';
        const reason = data.reason ? ` (${data.reason})` : '';
        console.log(`[${now}] ${icon} STATUS  | ${topic} → ${data.sensorId}: ${data.status.toUpperCase()}${reason}`);

    } else if (topic.includes('/request') || topic.includes('/response')) {
        // Request-response traffic
        console.log(`[${now}] 🔁 REQ/RES | ${topic}`);

    } else if (topic.startsWith('suhu/')) {
        // Data suhu dari sensor
        const suhu   = data.suhu ?? '?';
        const lokasi = data.lokasi ?? topic;
        const meta   = packet.properties?.userProperties;
        const fw     = meta?.firmware ?? '-';

        let level = '🟦'; // normal
        if (suhu >= 28) level = '🟧'; // hangat
        if (suhu >= 30) level = '🟥'; // panas

        console.log(`[${now}] ${level} SUHU    | ${lokasi.padEnd(22)} | ${String(suhu).padStart(5)}°C | fw: ${fw}`);
    }
});
