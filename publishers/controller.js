/**
 * Publisher 3: Controller / Sistem Pusat
 * Fitur: QoS 1 (F1), Message Expiry Interval (F6),
 *        Request-Response initiator (F8)
 *
 * Role: Mengirim permintaan data suhu real-time ke setiap sensor
 *       menggunakan pola Request-Response (mirip HTTP di atas MQTT).
 *       Pesan request diberi expiry agar tidak diproses jika terlambat.
 */

const { createClient } = require('../common/mqttClient');

const CONTROLLER_ID    = 'controller-pusat';
const RESPONSE_TOPIC   = `suhu/response/${CONTROLLER_ID}`;
const REQUEST_EXPIRY   = 5; // detik — request kedaluwarsa setelah 5 detik

const pendingRequests = new Map(); // correlationId → { resolve, timer }

const client = createClient(CONTROLLER_ID);

client.on('connect', () => {
    console.log(`[${CONTROLLER_ID}] Terhubung ke broker.`);

    // Subscribe ke topic response untuk menangkap balasan dari sensor
    client.subscribe(RESPONSE_TOPIC, { qos: 1 });
    console.log(`[${CONTROLLER_ID}] Menunggu response di: ${RESPONSE_TOPIC}`);

    // Kirim request ke masing-masing sensor setiap 10 detik
    setInterval(() => {
        sendRequest('suhu/kelas/request', 'kelas');
        sendRequest('suhu/lab/request',   'lab');
    }, 10000);

    // Request pertama langsung setelah connect
    setTimeout(() => {
        sendRequest('suhu/kelas/request', 'kelas');
        sendRequest('suhu/lab/request',   'lab');
    }, 2000);
});

function sendRequest(requestTopic, targetLabel) {
    // Feature 8: Correlation Data — ID unik untuk mencocokkan request ↔ response
    const correlationId   = `req-${targetLabel}-${Date.now()}`;
    const correlationData = Buffer.from(correlationId);

    const payload = JSON.stringify({
        from:      CONTROLLER_ID,
        target:    targetLabel,
        requestId: correlationId,
        timestamp: new Date().toISOString()
    });

    // Feature 1: QoS 1 — request harus sampai minimal sekali
    // Feature 6: Message Expiry — request otomatis dihapus broker jika expired
    // Feature 8: Response Topic & Correlation Data — inti request-response
    client.publish(requestTopic, payload, {
        qos: 1,
        properties: {
            messageExpiryInterval: REQUEST_EXPIRY, // Feature 6
            responseTopic:  RESPONSE_TOPIC,         // Feature 8
            correlationData                          // Feature 8
        }
    });

    console.log(`\n[${CONTROLLER_ID}] [REQUEST KIRIM] → ${requestTopic} | ID: ${correlationId} | Expiry: ${REQUEST_EXPIRY}s`);

    // Timeout lokal: jika response tidak datang dalam 5 detik
    const timer = setTimeout(() => {
        if (pendingRequests.has(correlationId)) {
            pendingRequests.delete(correlationId);
            console.log(`[${CONTROLLER_ID}] [TIMEOUT] Tidak ada response dari ${targetLabel} (${correlationId})`);
        }
    }, REQUEST_EXPIRY * 1000);

    pendingRequests.set(correlationId, { timer, target: targetLabel });
}

// Terima response dari sensor
client.on('message', (topic, message, packet) => {
    if (topic !== RESPONSE_TOPIC) return;

    const data         = JSON.parse(message.toString());
    const correlationData = packet.properties?.correlationData;
    const correlationId   = correlationData ? correlationData.toString() : null;

    if (correlationId && pendingRequests.has(correlationId)) {
        const { timer, target } = pendingRequests.get(correlationId);
        clearTimeout(timer);
        pendingRequests.delete(correlationId);

        console.log(`[${CONTROLLER_ID}] [RESPONSE DITERIMA] dari ${data.sensorId} | Suhu: ${data.suhu}°C | ID: ${correlationId}`);
    } else {
        console.log(`[${CONTROLLER_ID}] [RESPONSE DITERIMA] (no correlation)`, data);
    }
});
