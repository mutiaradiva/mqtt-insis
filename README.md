# Sistem Monitoring Suhu Ruangan — MQTT v5
Tugas Project Integrasi Sistem Minggu 10

# Team
| No  | Nama                | NRP        |
| --- | ------------------- | ---------- |
| 1   | Kanafira Vanesha P. | 5027241010 |
| 2   | Clarissa Aydin R.   | 5027241014 |
| 3   | Mutiara Diva J.     | 5027241083 |

## Skenario
Sistem monitoring suhu multi-ruangan (Kelas A & Lab Komputer) yang menggunakan
semua 10 fitur MQTT v5 secara nyata, bukan sekadar demo.

## Struktur File

```
suhu_monitor/
├── common/
│   └── mqttClient.js         # Factory MQTT client (shared)
├── publishers/
│   ├── sensorKelas.js        # Publisher 1: Sensor ruang kelas
│   ├── sensorLab.js          # Publisher 2: Sensor ruang lab
│   └── controller.js         # Publisher 3: Controller / sistem pusat
├── subscribers/
│   ├── monitor.js            # Subscriber 1: Monitor utama (wildcard)
│   ├── alertWorker1.js       # Subscriber 2: Alert worker (shared sub)
│   └── alertWorker2.js       # Subscriber 3: Alert worker (shared sub)
├── dashboard/
│   └── index.html            # Web dashboard (SSE-based)
├── dashboardServer.js        # Server bridge MQTT → HTTP + SSE
├── mosquitto.conf            # Konfigurasi broker
└── package.json
```

## Peta Fitur MQTT

| Fitur | Keterangan | Lokasi Implementasi |
|---|---|---|
| F1: Pub/Sub & QoS | QoS 1 (kelas), QoS 2 (lab), QoS 1 (controller) | Semua publisher |
| F2: Wildcard | `suhu/#` — tangkap semua topic sekaligus | `monitor.js`, `dashboardServer.js` |
| F3: Topic Alias | Alias 1 → `suhu/kelas` (hemat bandwidth) | `sensorKelas.js` |
| F4: User Properties | Metadata firmware, lokasi, unit | `sensorKelas.js`, `sensorLab.js` |
| F5: Retain | Retain status online/offline & data suhu terakhir | `sensorKelas.js`, `sensorLab.js` |
| F6: Expiry | Data lab expire 10s · Request controller expire 5s | `sensorLab.js`, `controller.js` |
| F7: Last Will & Testament | Broker auto-publish "offline" jika sensor mati | `sensorKelas.js`, `sensorLab.js` |
| F8: Request-Response | Controller minta data → sensor respons dengan Correlation Data | `controller.js` ↔ `sensorKelas.js` / `sensorLab.js` |
| F9: Shared Subscription | `$share/alertGroup/suhu/+` dibagi 2 worker | `alertWorker1.js`, `alertWorker2.js` |
| F10: Flow Control | `receiveMaximum: 5` di monitor & dashboard | `monitor.js`, `dashboardServer.js` |

## Topic Tree

```
suhu/
├── kelas          ← data suhu kelas (publisher 1)
├── kelas/status   ← status online/offline kelas (LWT + retain)
├── kelas/request  ← request dari controller ke sensor kelas
├── lab            ← data suhu lab (publisher 2)
├── lab/status     ← status online/offline lab
├── lab/request    ← request dari controller ke sensor lab
└── response/controller-pusat  ← response balik ke controller
```

## Cara Menjalankan

### 1. Install dependencies
```bash
npm install
```

### 2. Jalankan MQTT Broker (Mosquitto)
```bash
mosquitto -c mosquitto.conf
```

### 3. Buka terminal terpisah untuk setiap komponen

```bash
# Terminal 1 — Dashboard server + subscriber
node dashboardServer.js
# Buka http://localhost:3000 di browser

# Terminal 2 — Monitor utama (wildcard + flow control)
node subscribers/monitor.js

# Terminal 3 — Alert Worker 1 (shared subscription)
node subscribers/alertWorker1.js

# Terminal 4 — Alert Worker 2 (shared subscription)
node subscribers/alertWorker2.js

# Terminal 5 — Publisher: Sensor Kelas
node publishers/sensorKelas.js

# Terminal 6 — Publisher: Sensor Lab
node publishers/sensorLab.js

# Terminal 7 — Publisher: Controller
node publishers/controller.js
```

Atau gunakan npm scripts:
```bash
npm run dashboard
npm run monitor
npm run alert1
npm run alert2
npm run sensor-kelas
npm run sensor-lab
npm run controller
```

## Cara Membuktikan Setiap Fitur saat Demo

- **F3 Topic Alias**: Lihat log `sensorKelas.js` — baris pertama `[ALIAS REGISTER]`, berikutnya `[ALIAS]`
- **F5 Retain**: Hentikan semua subscriber, jalankan ulang `monitor.js` — langsung terima data tanpa harus tunggu publish baru
- **F6 Expiry**: Hentikan subscriber lab, tunggu >10 detik, jalankan lagi — pesan lama tidak muncul
- **F7 LWT**: Matikan paksa `sensorKelas.js` (Ctrl+C) — monitor langsung menerima status `offline`
- **F8 Req-Response**: Lihat log `controller.js` — setiap 10 detik kirim request, terima response dengan Correlation Data
- **F9 Shared Sub**: Jalankan `alertWorker1` dan `alertWorker2` bersamaan — perhatikan pesan dibagi, tidak keduanya menerima pesan yang sama
- **F10 Flow Control**: Lihat log `monitor.js` — broker membatasi in-flight messages sesuai `receiveMaximum`
