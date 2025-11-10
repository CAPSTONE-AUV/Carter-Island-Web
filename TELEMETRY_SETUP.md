# Real-Time Telemetry Dashboard Setup

Dokumentasi lengkap untuk fitur real-time telemetry dashboard pada Carter Island Web.

## 📋 Fitur

Dashboard sekarang menampilkan data telemetry real-time dari Raspberry Pi AUV dengan fitur:

- ✅ **Auto-refresh data** setiap 2-3 detik menggunakan SWR
- ✅ **Real-time telemetry display**: Compass, Battery, dan Health status
- ✅ **AUV Status monitoring**: Online/Offline berdasarkan RTSP stream connection
- ✅ **Connection strength indicator**: Strong/Moderate/Weak
- ✅ **Uptime tracking**: Berdasarkan livestream aktif
- ✅ **Database storage**: Semua data disimpan di MySQL untuk historical analysis
- ✅ **Background polling**: Automatic fetch dari Raspberry Pi setiap 5 detik

## 🗄️ Database Schema

Dua tabel baru ditambahkan ke database:

### 1. Telemetry Table
Menyimpan data telemetry dari AUV:
- `yaw_deg`: Heading compass dalam derajat
- `voltage_v`: Battery voltage (Volt)
- `current_a`: Battery current (Ampere)
- `remaining_percent`: Battery level (%)
- `gyro_ok`: Status gyroscope (boolean)
- `accel_ok`: Status accelerometer (boolean)
- `mag_ok`: Status magnetometer (boolean)
- `timestamp`: Waktu data diterima

### 2. AUV Status Table
Menyimpan status koneksi AUV:
- `is_online`: Status online (boolean)
- `connection_strength`: Kekuatan koneksi (Strong/Moderate/Weak)
- `uptime_seconds`: Uptime dalam detik
- `location_status`: Status lokasi (default: "Active")
- `last_stream_time`: Waktu terakhir stream aktif
- `timestamp`: Waktu data diterima

## 🚀 Setup & Installation

### 1. Database Migration

Jalankan migration untuk membuat tabel baru:

```bash
# Pastikan MySQL sudah running
# Update DATABASE_URL di .env jika perlu

# Push schema ke database
npx prisma db push

# Atau jalankan migration
npx prisma migrate dev --name add_telemetry_and_auv_status
```

### 2. Environment Variables

File `.env` sudah dikonfigurasi dengan:

```env
DATABASE_URL="mysql://root:password@localhost:3306/carter_island"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BACKEND_URL="http://localhost:8000"
```

### 3. Install Dependencies

```bash
npm install
```

Package baru yang ditambahkan:
- `swr`: Library untuk data fetching dengan auto-refresh

### 4. Run Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) dan login ke dashboard.

## 🔌 API Endpoints

### Telemetry Endpoints

#### GET /api/telemetry/latest
Mendapatkan data telemetry terbaru.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "yawDeg": -0.48,
    "voltageV": 0.02,
    "currentA": 0.05,
    "remainingPercent": 97.0,
    "gyroOk": true,
    "accelOk": true,
    "magOk": true,
    "timestamp": "2025-11-10T12:34:56.789Z"
  }
}
```

#### GET /api/telemetry/fetch
Fetch telemetry dari Raspberry Pi dan simpan ke database.

**Raspberry Pi Endpoint:** `http://192.168.2.2:14552/telemetry`

**Expected Response dari Raspi:**
```json
{
  "compass": {"yaw_deg": -0.48},
  "battery": {
    "voltage_v": 0.02,
    "current_a": 0.05,
    "remaining_percent": 97.0
  },
  "health": {
    "gyro_ok": true,
    "accel_ok": true,
    "mag_ok": true
  }
}
```

#### POST /api/telemetry
Simpan telemetry data secara manual.

**Request Body:**
```json
{
  "compass": {"yaw_deg": -0.48},
  "battery": {
    "voltage_v": 0.02,
    "current_a": 0.05,
    "remaining_percent": 97.0
  },
  "health": {
    "gyro_ok": true,
    "accel_ok": true,
    "mag_ok": true
  }
}
```

### AUV Status Endpoints

#### GET /api/auv-status/latest
Mendapatkan status AUV terbaru.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "isOnline": true,
    "connectionStrength": "Strong",
    "uptimeSeconds": 8100,
    "locationStatus": "Active",
    "lastStreamTime": "2025-11-10T12:34:56.789Z",
    "timestamp": "2025-11-10T12:34:56.789Z"
  }
}
```

#### POST /api/auv-status
Simpan AUV status data.

**Request Body:**
```json
{
  "isOnline": true,
  "connectionStrength": "Strong",
  "uptimeSeconds": 8100,
  "locationStatus": "Active",
  "lastStreamTime": "2025-11-10T12:34:56.789Z"
}
```

## ⚙️ Konfigurasi Real-Time Updates

Dashboard menggunakan **SWR (Stale-While-Revalidate)** untuk real-time updates:

### Auto-Refresh Intervals

```typescript
// Telemetry data - refresh setiap 2 detik
useSWR('/api/telemetry/latest', fetcher, {
  refreshInterval: 2000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
})

// AUV status - refresh setiap 3 detik
useSWR('/api/auv-status/latest', fetcher, {
  refreshInterval: 3000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
})

// Background polling dari Raspberry Pi - setiap 5 detik
useEffect(() => {
  const interval = setInterval(() => {
    fetch('/api/telemetry/fetch')
  }, 5000)
  return () => clearInterval(interval)
}, [])
```

### Mengubah Refresh Rate

Untuk mengubah kecepatan refresh, edit file `/src/components/dashboard/DashboardContent.tsx`:

```typescript
// Line 31-36: Telemetry refresh
refreshInterval: 2000, // Ubah nilai ini (dalam milliseconds)

// Line 41-46: AUV status refresh
refreshInterval: 3000, // Ubah nilai ini (dalam milliseconds)

// Line 53-62: Background polling interval
setInterval(pollTelemetry, 5000) // Ubah nilai ini (dalam milliseconds)
```

## 🎨 UI Components

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard Header                                            │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ AUV Status   │ Connection   │ Uptime       │ Location       │
│ Online       │ Strong       │ 2h 15m       │ Active         │
├──────────────┴──────────────┴──────────────┴────────────────┤
│ Live Telemetry                              │ AUV Location  │
│ ┌───────────┬───────────┬──────────┐        │ ┌───────────┐ │
│ │ Compass   │ Battery   │ Health   │        │ │ Google    │ │
│ │ 045°      │ 97%       │ All OK   │        │ │ Maps      │ │
│ └───────────┴───────────┴──────────┘        │ └───────────┘ │
│                                              │               │
│ Quick Actions                                │ Details       │
│ [Start] [Stream] [Logs] [Nav] [System]      │ Depth: 15.2m  │
└──────────────────────────────────────────────┴───────────────┘
```

### Color Coding

- **Battery Level**:
  - 🟢 Green (>50%): Healthy
  - 🟡 Yellow (20-50%): Warning
  - 🔴 Red (<20%): Critical

- **Connection Strength**:
  - 🟢 Green: Strong
  - 🟡 Yellow: Moderate
  - 🔴 Red: Weak

- **Health Status**:
  - 🟢 Green "OK": Sensor berfungsi normal
  - 🔴 Red "Error": Sensor bermasalah

## 🔧 Troubleshooting

### Database Connection Error

```bash
Error: P1001: Can't reach database server at localhost:3306
```

**Solusi:**
1. Pastikan MySQL service running
2. Verify DATABASE_URL di `.env` sudah benar
3. Test koneksi: `npx prisma db pull`

### Telemetry Not Updating

**Penyebab:**
- Raspberry Pi endpoint tidak bisa diakses
- Network issue

**Debugging:**
1. Check browser console untuk error messages
2. Test Raspberry Pi endpoint: `curl http://192.168.2.2:14552/telemetry`
3. Verify network connectivity ke Raspberry Pi

### SWR Not Auto-Refreshing

**Penyebab:**
- Tab browser tidak aktif
- Browser throttling

**Solusi:**
1. Set `revalidateOnFocus: true` untuk refresh saat tab aktif kembali
2. Use `refreshInterval` untuk force refresh

## 📊 Data Flow

```
┌─────────────────┐
│  Raspberry Pi   │
│  (Telemetry)    │
└────────┬────────┘
         │ HTTP GET (every 5s)
         ▼
┌─────────────────────────────┐
│  Next.js API Route          │
│  /api/telemetry/fetch       │
└────────┬────────────────────┘
         │ Save to DB
         ▼
┌─────────────────────────────┐
│  MySQL Database             │
│  - telemetry table          │
│  - auv_status table         │
└────────┬────────────────────┘
         │ Query (every 2-3s)
         ▼
┌─────────────────────────────┐
│  Dashboard (SWR)            │
│  Auto-refresh display       │
└─────────────────────────────┘
```

## 🚧 Future Enhancements

Fitur yang bisa ditambahkan di masa depan:

1. **WebSocket Support**: Untuk true real-time updates tanpa polling
2. **Historical Charts**: Grafik telemetry data over time
3. **Alert System**: Notifikasi saat battery low atau sensor error
4. **Data Export**: Download telemetry data sebagai CSV/JSON
5. **GPS Integration**: Tampilkan posisi AUV di map secara real-time
6. **Depth & Speed Display**: Dari data position (saat ini masih dummy)

## 📝 Notes

- GPS dan position data **tidak ditampilkan** sesuai requirement
- Location status **statis** "Active"
- AUV status dan connection **akan** based on RTSP stream (saat ini menggunakan data dari AUV Status API)
- Uptime **akan** berdasarkan livestream (saat ini menggunakan data dari AUV Status API)

## 📞 Support

Jika ada pertanyaan atau issue, silahkan buat GitHub issue atau hubungi development team.
