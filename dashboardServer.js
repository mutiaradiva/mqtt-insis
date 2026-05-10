/**
 * Dashboard Server
 * Menjembatani data MQTT → HTTP + Server-Sent Events (SSE)
 * Buka browser ke http://localhost:3000 setelah menjalankan file ini.
 * Tidak memerlukan package tambahan selain yang sudah ada (mqtt + http bawaan Node.js).
 */

const http          = require('http');
const fs            = require('fs');
const path          = require('path');
const { createClient } = require('./common/mqttClient');

const HTTP_PORT = 3000;

// ---- SSE: Simpan semua koneksi klien browser ----
const sseClients = new Set();

function broadcast(eventType, data) {
    const msg = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(res => res.write(msg));
}

// ---- HTTP Server ----
const server = http.createServer((req, res) => {
    if (req.url === '/events') {
        // Server-Sent Events endpoint
        res.writeHead(200, {
            'Content-Type':  'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection':    'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        res.write('retry: 3000\n\n'); // auto-reconnect browser
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));

    } else {
        // Serve dashboard HTML
        const filePath = path.join(__dirname, 'dashboard', 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    }
});

server.listen(HTTP_PORT, () => {
    console.log(`[DASHBOARD] Server berjalan di http://localhost:${HTTP_PORT}`);
});

// ---- MQTT Subscriber ----
const mqttClient = createClient('dashboard-server', {
    properties: { receiveMaximum: 10 }
});

mqttClient.on('connect', () => {
    console.log('[DASHBOARD] Terhubung ke MQTT broker.');
    mqttClient.subscribe('suhu/#', { qos: 1 });
    console.log('[DASHBOARD] Subscribe wildcard: suhu/#');
});

mqttClient.on('message', (topic, message, packet) => {
    let data;
    try {
        data = JSON.parse(message.toString());
    } catch {
        return;
    }

    const meta = packet.properties?.userProperties ?? {};

    // Klasifikasi pesan dan broadcast ke browser via SSE
    if (topic.endsWith('/status')) {
        broadcast('status', { topic, ...data, timestamp: data.timestamp ?? new Date().toISOString() });
    } else if (data.suhu !== undefined) {
        broadcast('suhu', {
            topic,
            sensorId:  data.sensorId,
            lokasi:    data.lokasi,
            suhu:      data.suhu,
            unit:      data.unit ?? 'Celsius',
            firmware:  meta.firmware,
            timestamp: data.timestamp ?? new Date().toISOString()
        });
    } else if (data.type === 'response') {
        broadcast('response', { topic, ...data });
    }
});
