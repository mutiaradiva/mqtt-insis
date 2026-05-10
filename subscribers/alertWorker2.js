/**
 * Subscriber 3: Alert Worker 2
 * Fitur: Shared Subscription (F9) — load balancing bersama alertWorker1
 *
 * Jalankan BERSAMAAN dengan alertWorker1.js di terminal berbeda.
 * Broker akan mendistribusikan pesan secara round-robin ke salah satu worker.
 */

const { createClient } = require('../common/mqttClient');

const WORKER_ID = 'alert-worker-2';

const client = createClient(WORKER_ID, {
    properties: {
        receiveMaximum: 3
    }
});

client.on('connect', () => {
    console.log(`[${WORKER_ID}] Terhubung ke broker.`);

    // Feature 9: Shared Subscription — group yang sama dengan worker-1
    client.subscribe('$share/alertGroup/suhu/+', { qos: 1 });

    console.log(`[${WORKER_ID}] Shared subscription: $share/alertGroup/suhu/+`);
    console.log(`[${WORKER_ID}] Siap menerima pesan (berbagi dengan alertWorker1)\n`);
});

client.on('message', (topic, message) => {
    let data;
    try {
        data = JSON.parse(message.toString());
    } catch {
        return;
    }

    if (!data.suhu) return;

    const now  = new Date().toLocaleTimeString('id-ID');
    const suhu = data.suhu;

    // Simulasi processing sedikit berbeda (250ms) agar terlihat pergantian worker
    const start = Date.now();
    while (Date.now() - start < 250) {}

    if (suhu >= 28) {
        console.log(`[${now}] ⚠️  [${WORKER_ID}] PERINGATAN SUHU TINGGI! ${data.lokasi ?? topic}: ${suhu}°C`);
    } else {
        console.log(`[${now}] ✅ [${WORKER_ID}] Normal: ${data.lokasi ?? topic}: ${suhu}°C`);
    }
});
