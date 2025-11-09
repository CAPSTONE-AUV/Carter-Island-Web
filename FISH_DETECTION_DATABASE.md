# Fish Detection Database Integration

Dokumentasi untuk fitur penyimpanan hasil deteksi ikan YOLO ke database menggunakan Prisma.

## 📋 Daftar Isi

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Setup](#setup)
- [Konfigurasi](#konfigurasi)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Fitur ini memungkinkan penyimpanan otomatis hasil deteksi ikan dari YOLO ke database MySQL melalui Prisma ORM. Setiap deteksi mencakup:

- **Informasi frame**: timestamp, session ID, jumlah ikan
- **Detail deteksi**: bounding box, confidence score, kelas ikan
- **Tracking**: pengelompokan berdasarkan sesi streaming

### Arsitektur

```
┌─────────────────┐
│  Python Backend │
│   (YOLO)        │
└────────┬────────┘
         │ HTTP POST
         │ (deteksi ikan)
         ↓
┌─────────────────┐
│  Next.js API    │
│  /api/detections│
└────────┬────────┘
         │ Prisma
         ↓
┌─────────────────┐
│  MySQL Database │
└─────────────────┘
```

## 🗄️ Database Schema

### FishDetection (fish_detections)

Tabel utama untuk menyimpan deteksi per frame.

| Field       | Type     | Description                    |
|-------------|----------|--------------------------------|
| id          | String   | Primary key (cuid)             |
| sessionId   | String?  | ID sesi streaming              |
| timestamp   | DateTime | Waktu deteksi                  |
| fishCount   | Int      | Jumlah ikan dalam frame        |
| frameNumber | Int?     | Nomor frame (opsional)         |
| imageUrl    | String?  | URL snapshot (opsional)        |
| createdAt   | DateTime | Timestamp pembuatan            |
| updatedAt   | DateTime | Timestamp update terakhir      |

### DetectionDetail (detection_details)

Tabel detail untuk setiap ikan yang terdeteksi dalam frame.

| Field         | Type   | Description                    |
|---------------|--------|--------------------------------|
| id            | String | Primary key (cuid)             |
| detectionId   | String | Foreign key ke FishDetection   |
| className     | String | Nama spesies/kelas ikan        |
| confidence    | Float  | Confidence score (0-1)         |
| boundingBoxX1 | Float  | Koordinat bounding box X1      |
| boundingBoxY1 | Float  | Koordinat bounding box Y1      |
| boundingBoxX2 | Float  | Koordinat bounding box X2      |
| boundingBoxY2 | Float  | Koordinat bounding box Y2      |
| createdAt     | DateTime | Timestamp pembuatan          |

## 🚀 Setup

### 1. Setup Database

Pastikan MySQL sudah terinstall dan berjalan.

```bash
# Buat database baru
mysql -u root -p
CREATE DATABASE carter_island;
```

### 2. Konfigurasi Environment

Copy `.env.example` ke `.env` dan sesuaikan konfigurasi:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="mysql://root:password@localhost:3306/carter_island"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Konfigurasi Python Backend

Copy `.env.example` di folder backend:

```bash
cp src/backend/.env.example src/backend/.env
```

Edit `src/backend/.env`:

```env
# Aktifkan penyimpanan deteksi
SAVE_DETECTIONS_ENABLED=true

# URL API Next.js
API_BASE_URL=http://localhost:3000

# Simpan setiap 5 detik
SAVE_INTERVAL_SECONDS=5.0

# Minimal 1 ikan terdeteksi untuk disimpan
MIN_DETECTIONS_TO_SAVE=1
```

### 4. Install Dependencies

**Next.js (Frontend):**

```bash
npm install
```

**Python Backend:**

```bash
cd src/backend
pip install -r requirements.txt
```

### 5. Run Prisma Migration

Buat tabel di database:

```bash
npx prisma migrate dev --name add_fish_detection_models
```

Generate Prisma Client:

```bash
npx prisma generate
```

### 6. Seed Database (Opsional)

Untuk data user awal:

```bash
npm run db:seed
```

## ⚙️ Konfigurasi

### Environment Variables

#### Next.js (.env)

| Variable       | Required | Default | Description                    |
|----------------|----------|---------|--------------------------------|
| DATABASE_URL   | ✅       | -       | MySQL connection string        |
| NEXTAUTH_SECRET| ✅       | -       | Secret key untuk NextAuth      |
| NEXTAUTH_URL   | ✅       | -       | URL aplikasi Next.js           |

#### Python Backend (src/backend/.env)

| Variable                | Required | Default              | Description                           |
|-------------------------|----------|----------------------|---------------------------------------|
| SAVE_DETECTIONS_ENABLED | ❌       | true                 | Enable/disable database saving        |
| API_BASE_URL            | ❌       | http://localhost:3000| URL Next.js API                       |
| SAVE_INTERVAL_SECONDS   | ❌       | 5.0                  | Interval penyimpanan (detik)          |
| MIN_DETECTIONS_TO_SAVE  | ❌       | 1                    | Min. ikan yang harus terdeteksi       |
| RTSP_URL                | ❌       | rtsp://192.168.2.2:8554/cam | URL stream RTSP            |
| TARGET_FPS              | ❌       | 30                   | Target FPS                            |
| RESIZE_WIDTH            | ❌       | 1280                 | Lebar frame output                    |
| RESIZE_HEIGHT           | ❌       | 720                  | Tinggi frame output                   |

### Cara Kerja Auto-Save

1. **Python backend** mendeteksi ikan menggunakan YOLO setiap frame
2. Setiap `SAVE_INTERVAL_SECONDS` detik, jika ada minimal `MIN_DETECTIONS_TO_SAVE` ikan:
   - Backend mengirim HTTP POST ke `/api/detections`
   - Data disimpan ke database via Prisma
3. Semua deteksi dalam satu sesi streaming memiliki `sessionId` yang sama

## 🔌 API Endpoints

### POST /api/detections

Simpan hasil deteksi ikan.

**Request Body:**

```json
{
  "sessionId": "uuid-v4",
  "timestamp": "2025-11-08T10:30:00.000Z",
  "fishCount": 3,
  "frameNumber": 1234,
  "imageUrl": null,
  "detections": [
    {
      "className": "Ikan Nemo",
      "confidence": 0.95,
      "boundingBox": {
        "x1": 100.5,
        "y1": 200.3,
        "x2": 300.7,
        "y2": 400.2
      }
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Deteksi berhasil disimpan",
  "data": {
    "id": "cm3k...",
    "sessionId": "uuid-v4",
    "timestamp": "2025-11-08T10:30:00.000Z",
    "fishCount": 3,
    "detectionDetails": [...]
  }
}
```

### GET /api/detections

Dapatkan daftar deteksi dengan pagination.

**Query Parameters:**

- `page` (number): Halaman (default: 1)
- `limit` (number): Jumlah per halaman (default: 20)
- `sessionId` (string): Filter berdasarkan session ID
- `className` (string): Filter berdasarkan kelas ikan

**Example:**

```bash
GET /api/detections?page=1&limit=20&sessionId=uuid-v4
```

**Response:**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /api/detections/stats

Dapatkan statistik deteksi ikan.

**Query Parameters:**

- `sessionId` (string): Filter berdasarkan session ID
- `startDate` (ISO string): Tanggal mulai
- `endDate` (ISO string): Tanggal akhir

**Example:**

```bash
GET /api/detections/stats?sessionId=uuid-v4
```

**Response:**

```json
{
  "success": true,
  "data": {
    "totalDetections": 150,
    "totalFishCount": 450,
    "averageConfidence": 0.87,
    "detectionsByClass": [
      {
        "className": "Ikan Nemo",
        "count": 200,
        "avgConfidence": 0.92
      }
    ],
    "recentDetections": [...]
  }
}
```

## 🧪 Testing

### 1. Jalankan Next.js

```bash
npm run dev
```

### 2. Jalankan Python Backend

```bash
cd src/backend
python main.py
```

### 3. Akses Stream

Buka browser ke `http://localhost:3000/dashboard/stream` dan mulai streaming.

### 4. Monitor Logs

**Python Backend:**
```
✓ Saved 3 detections to database (frame 1234)
```

### 5. Cek Database

```bash
npx prisma studio
```

Atau query manual:

```sql
SELECT
  fd.id,
  fd.timestamp,
  fd.fishCount,
  COUNT(dd.id) as detailCount
FROM fish_detections fd
LEFT JOIN detection_details dd ON dd.detection_id = fd.id
GROUP BY fd.id
ORDER BY fd.timestamp DESC
LIMIT 10;
```

## 🐛 Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"

**Solusi:** Pastikan file `.env` ada di root project dengan `DATABASE_URL` yang benar.

```bash
echo 'DATABASE_URL="mysql://root:password@localhost:3306/carter_island"' > .env
```

### Error: "Failed to save detections: HTTP 500"

**Kemungkinan Penyebab:**
1. Database tidak berjalan
2. Migration belum dijalankan
3. Prisma Client belum digenerate

**Solusi:**
```bash
# Cek MySQL
mysql -u root -p -e "SHOW DATABASES;"

# Run migration
npx prisma migrate dev

# Generate client
npx prisma generate
```

### Error: "Timeout while saving detections to database"

**Kemungkinan Penyebab:**
1. Next.js tidak berjalan
2. Port salah (API_BASE_URL)
3. Firewall blocking

**Solusi:**
```bash
# Cek Next.js berjalan
curl http://localhost:3000/api/detections

# Cek port di src/backend/.env
API_BASE_URL=http://localhost:3000  # Sesuaikan port Next.js
```

### Deteksi tidak tersimpan

**Debugging:**

1. Cek apakah `SAVE_DETECTIONS_ENABLED=true`
2. Cek log Python backend untuk error
3. Pastikan minimal `MIN_DETECTIONS_TO_SAVE` ikan terdeteksi
4. Tunggu minimal `SAVE_INTERVAL_SECONDS` detik

```bash
# Set log level ke DEBUG untuk detail lebih
# Di src/backend/main.py, ubah:
# logging.basicConfig(level=logging.DEBUG)
```

## 📊 Best Practices

### Performance

1. **Interval Penyimpanan**: Set `SAVE_INTERVAL_SECONDS` ke 5-10 detik untuk mengurangi beban database
2. **Batch Size**: Gunakan `MIN_DETECTIONS_TO_SAVE` untuk filter noise
3. **Indexes**: Schema sudah include indexes untuk query cepat
4. **Cleanup**: Buat cron job untuk hapus data lama:

```sql
DELETE FROM fish_detections
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Monitoring

Buat dashboard untuk:
- Total deteksi per hari
- Distribusi kelas ikan
- Confidence score trends
- Session duration

### Backup

```bash
# Backup database
mysqldump -u root -p carter_island > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p carter_island < backup_20251108.sql
```

## 🎉 Selesai!

Fitur penyimpanan deteksi ikan sudah siap digunakan. Setiap deteksi akan otomatis tersimpan ke database dan bisa di-query melalui API atau Prisma Studio.

Untuk pertanyaan lebih lanjut, lihat dokumentasi Prisma: https://www.prisma.io/docs
