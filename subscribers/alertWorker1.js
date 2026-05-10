/**
 * Subscriber 2: Alert Worker 1
 * Fitur: Shared Subscription (F9) — load balancing bersama alertWorker2
 *
 * Jalankan BERSAMAAN dengan alertWorker2.js di terminal berbeda.
 * Setiap pesan hanya diterima oleh SALAH SATU worker (tidak duplikat).
 * Ini mencegah overload pada satu subscriber saat banyak pesan masuk.
 */

const { createClient } = require('../common/mqttClient');

const WORKER_ID = 'alert-worker-1';

// Feature 10: Flow Control — lambatkan processing agar load balancing terlihat jelas
const client = createClient(WORKER_ID, {
    properties: {
        receiveMaximum: 3
    }
});

client.on('connect', () => {
    console.log(`[${WORKER_ID}] Terhubung ke broker.`);

    // Feature 9: Shared Subscription — format: $share/<groupName>/<topic>
    // Pesan suhu dibagi antara worker-1 dan worker-2 (tidak keduanya menerima sekaligus)
    client.subscribe('$share/alertGroup/suhu/+', { qos: 1 });

    console.log(`[${WORKER_ID}] Shared subscription: $share/alertGroup/suhu/+`);
    console.log(`[${WORKER_ID}] Siap menerima pesan (berbagi dengan alertWorker2)\n`);
});

client.on('message', (topic, message) => {
    let data;
    try {
        data = JSON.parse(message.toString());
    } catch {
        return; // abaikan non-JSON
    }

    if (!data.suhu) return; // hanya proses pesan yang ada data suhu

    const now  = new Date().toLocaleTimeString('id-ID');
    const suhu = data.suhu;

    // Simulasi pemrosesan (sedikit lambat agar load balancing terlihat)
    const start = Date.now();
    while (Date.now() - start < 200) {} // simulasi 200ms processing

    if (suhu >= 28) {
        console.log(`[${now}] ⚠️  [${WORKER_ID}] PERINGATAN SUHU TINGGI! ${data.lokasi ?? topic}: ${suhu}°C`);
    } else {
        console.log(`[${now}] ✅ [${WORKER_ID}] Normal: ${data.lokasi ?? topic}: ${suhu}°C`);
    }
});
