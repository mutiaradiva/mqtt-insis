/**
 * Publisher 1: Sensor Suhu Ruang Kelas
 * Fitur: QoS 1, Topic Alias (F3), User Properties (F4),
 *        Retain (F5), Last Will & Testament (F7), Request-Response responder (F8)
 */

const { createClient } = require('../common/mqttClient');

const SENSOR_ID  = 'sensor-kelas-01';
const TOPIC_SUHU   = 'suhu/kelas';
const TOPIC_STATUS = 'suhu/kelas/status';
const TOPIC_REQ    = 'suhu/kelas/request';

// --- Feature 7: Last Will & Testament ---
const client = createClient(SENSOR_ID, {
    will: {
        topic: TOPIC_STATUS,
        payload: JSON.stringify({ sensorId: SENSOR_ID, status: 'offline', reason: 'unexpected disconnect' }),
        qos: 1,
        retain: true
    }
});

let aliasRegistered = false;

client.on('connect', () => {
    console.log(`[${SENSOR_ID}] Terhubung ke broker.`);

    // Feature 5: Retain — publish status online agar subscriber baru langsung tahu
    client.publish(TOPIC_STATUS, JSON.stringify({ sensorId: SENSOR_ID, status: 'online' }), {
        qos: 1,
        retain: true
    });
    console.log(`[${SENSOR_ID}] Status ONLINE dipublish (retained).`);

    // Feature 8: Subscribe ke topic request untuk menjawab permintaan controller
    client.subscribe(TOPIC_REQ, { qos: 1 });

    // Kirim data suhu setiap 3 detik
    setInterval(() => {
        const suhu = parseFloat((Math.random() * 5 + 24).toFixed(2)); // 24–29 °C
        const payload = JSON.stringify({
            sensorId: SENSOR_ID,
            lokasi: 'Ruang Kelas A',
            suhu,
            unit: 'Celsius',
            timestamp: new Date().toISOString()
        });

        if (!aliasRegistered) {
            // Feature 3: Topic Alias — iterasi pertama: daftarkan alias 1 untuk topic suhu/kelas
            client.publish(TOPIC_SUHU, payload, {
                qos: 1,
                retain: true, // Feature 5: Retain
                properties: {
                    topicAlias: 1, // Registrasi alias
                    // Feature 4: User Properties
                    userProperties: {
                        'sensor-type': 'temperature',
                        'location':    'Kelas A Gedung B',
                        'firmware':    'v1.0.2',
                        'unit':        'Celsius'
                    }
                }
            });
            console.log(`[${SENSOR_ID}] [ALIAS REGISTER] Alias 1 → suhu/kelas | Suhu: ${suhu}°C`);
            aliasRegistered = true;
        } else {
            // Feature 3: Iterasi berikutnya: kirim topic kosong + alias (hemat bandwidth)
            client.publish('', payload, {
                qos: 1,
                retain: true,
                properties: {
                    topicAlias: 1,
                    userProperties: {
                        'sensor-type': 'temperature',
                        'location':    'Kelas A Gedung B',
                        'firmware':    'v1.0.2',
                        'unit':        'Celsius'
                    }
                }
            });
            console.log(`[${SENSOR_ID}] [ALIAS] Publish via alias 1 | Suhu: ${suhu}°C`);
        }
    }, 3000);
});

// Feature 8: Request-Response — merespons permintaan data dari controller
client.on('message', (topic, message, packet) => {
    if (topic !== TOPIC_REQ) return;

    const req = JSON.parse(message.toString());
    const responseTopic  = packet.properties?.responseTopic;
    const correlationData = packet.properties?.correlationData;

    console.log(`\n[${SENSOR_ID}] [REQUEST DITERIMA] dari ${responseTopic}`, req);

    if (!responseTopic) return;

    const suhu = parseFloat((Math.random() * 5 + 24).toFixed(2));
    client.publish(responseTopic, JSON.stringify({
        sensorId:  SENSOR_ID,
        lokasi:    'Ruang Kelas A',
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
