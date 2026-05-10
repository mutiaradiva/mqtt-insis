/**
 * Publisher 2: Sensor Suhu Ruang Lab
 * Fitur: QoS 2 (F1), User Properties (F4), Retain (F5),
 *        Message Expiry Interval (F6), Last Will & Testament (F7),
 *        Request-Response responder (F8)
 */

const { createClient } = require('../common/mqttClient');

const SENSOR_ID    = 'sensor-lab-01';
const TOPIC_SUHU   = 'suhu/lab';
const TOPIC_STATUS = 'suhu/lab/status';
const TOPIC_REQ    = 'suhu/lab/request';
const EXPIRY_DETIK = 10; // pesan suhu kedaluwarsa dalam 10 detik jika tidak diterima

// --- Feature 7: Last Will & Testament ---
const client = createClient(SENSOR_ID, {
    will: {
        topic: TOPIC_STATUS,
        payload: JSON.stringify({ sensorId: SENSOR_ID, status: 'offline', reason: 'unexpected disconnect' }),
        qos: 1,
        retain: true
    }
});

client.on('connect', () => {
    console.log(`[${SENSOR_ID}] Terhubung ke broker.`);

    // Feature 5: Retain — publish status online
    client.publish(TOPIC_STATUS, JSON.stringify({ sensorId: SENSOR_ID, status: 'online' }), {
        qos: 1,
        retain: true
    });
    console.log(`[${SENSOR_ID}] Status ONLINE dipublish (retained).`);

    // Feature 8: Subscribe ke topic request
    client.subscribe(TOPIC_REQ, { qos: 1 });

    // Kirim data suhu setiap 4 detik
    setInterval(() => {
        const suhu = parseFloat((Math.random() * 8 + 20).toFixed(2)); // 20–28 °C (lab lebih dingin)
        const payload = JSON.stringify({
            sensorId: SENSOR_ID,
            lokasi: 'Ruang Lab Komputer',
            suhu,
            unit: 'Celsius',
            timestamp: new Date().toISOString()
        });

        // Feature 1: QoS 2 (Exactly Once) — penting agar data lab tidak duplikat
        // Feature 5: Retain — subscriber baru langsung dapat data terakhir
        // Feature 6: Message Expiry Interval — data stale dihapus broker otomatis
        client.publish(TOPIC_SUHU, payload, {
            qos: 2,
            retain: true,
            properties: {
                messageExpiryInterval: EXPIRY_DETIK, // Feature 6
                // Feature 4: User Properties
                userProperties: {
                    'sensor-type': 'temperature',
                    'location':    'Lab Komputer Lantai 3',
                    'firmware':    'v2.1.0',
                    'unit':        'Celsius'
                }
            }
        });

        console.log(`[${SENSOR_ID}] [QoS 2] Publish suhu lab: ${suhu}°C | Expiry: ${EXPIRY_DETIK}s`);
    }, 4000);
});

// Feature 8: Request-Response — merespons permintaan data dari controller
client.on('message', (topic, message, packet) => {
    if (topic !== TOPIC_REQ) return;

    const req = JSON.parse(message.toString());
    const responseTopic   = packet.properties?.responseTopic;
    const correlationData = packet.properties?.correlationData;

    console.log(`\n[${SENSOR_ID}] [REQUEST DITERIMA] dari ${responseTopic}`, req);

    if (!responseTopic) return;

    const suhu = parseFloat((Math.random() * 8 + 20).toFixed(2));
    client.publish(responseTopic, JSON.stringify({
        sensorId:  SENSOR_ID,
        lokasi:    'Ruang Lab Komputer',
        suhu,
        unit:      'Celsius',
        type:      'response',
        timestamp: new Date().toISOString()
    }), {
        qos: 1,
        properties: { correlationData }
    });

    console.log(`[${SENSOR_ID}] [RESPONSE DIKIRIM] Suhu: ${suhu}°C → ${responseTopic}`);
});
