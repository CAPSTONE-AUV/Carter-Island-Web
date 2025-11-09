# Recording Feature Documentation

## Overview
Fitur recording memungkinkan pengguna untuk merekam video livestream yang sudah diproses dengan YOLO. Video yang direkam akan disimpan beserta metadata-nya ke database.

## Perubahan yang Dilakukan

### 1. Backend Refactoring (Python)
Backend `main.py` telah dipecah menjadi struktur modular untuk memudahkan maintenance:

```
src/backend/
├── main.py                      # Entry point (lebih sederhana)
├── config.py                    # Semua konfigurasi
├── models/
│   └── yolo_detector.py        # YOLO model loader & inference
├── video/
│   ├── rtsp_player.py          # RTSP player utilities
│   ├── detection_track.py      # Video track dengan YOLO detection
│   └── recording.py            # Video recording functionality (NEW)
├── webrtc/
│   ├── peer_connection.py      # WebRTC handling
│   └── bitrate.py              # Bitrate control
├── database/
│   └── detections.py           # Database operations
└── api/
    └── routes.py               # FastAPI routes
```

**Keuntungan:**
- Code lebih terorganisir dan mudah di-maintain
- Setiap module punya tanggung jawab yang jelas
- Mudah untuk menambahkan fitur baru
- Lebih mudah untuk testing

### 2. Database Schema (Prisma)
Menambahkan model `Recording` untuk menyimpan metadata recording:

```prisma
model Recording {
  id          String   @id @default(cuid())
  sessionId   String   @map("session_id")
  filename    String
  filepath    String   @db.Text
  fileSize    BigInt   @map("file_size")
  duration    Float
  startTime   DateTime @map("start_time")
  endTime     DateTime @map("end_time")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 3. API Routes (Next.js)
Menambahkan endpoint API untuk recording:

- `POST /api/recordings` - Simpan metadata recording
- `GET /api/recordings` - List semua recordings dengan pagination
- `GET /api/recordings/[id]` - Get recording by ID
- `DELETE /api/recordings/[id]` - Delete recording

### 4. Backend API (Python)
Menambahkan endpoint untuk recording control:

- `POST /api/recording/start/{client_id}` - Mulai recording
- `POST /api/recording/stop/{client_id}` - Stop recording
- `GET /api/recording/status/{client_id}` - Check recording status

### 5. Frontend Updates

#### StreamComponent.tsx
- Menambahkan button "Record" yang muncul saat streaming aktif
- Button berubah menjadi "Stop Recording" dengan animasi pulse saat recording
- Integrasi dengan backend API untuk start/stop recording
- Menampilkan log recording di system logs

#### Recordings Page
- Menampilkan data real dari database (bukan mock data)
- Menampilkan: filename, duration, file size, date, session ID
- Action buttons: Play (disabled), Download, Delete
- Empty state jika belum ada recordings

## Cara Menggunakan

### Setup Database
1. Pastikan MySQL sudah running
2. Copy `.env.example` ke `.env` dan sesuaikan `DATABASE_URL`
3. Run migration:
   ```bash
   npx prisma migrate dev --name add_recording_model
   ```
4. Generate Prisma client (jika belum):
   ```bash
   npx prisma generate
   ```

### Setup Backend Python
1. Install dependencies (jika ada yang baru):
   ```bash
   cd src/backend
   pip install -r requirements.txt
   ```

2. Konfigurasi environment variables (opsional) di `src/backend/.env`:
   ```env
   RECORDINGS_DIR=/path/to/recordings  # Default: src/backend/recordings
   RECORDING_CODEC=mp4v                # Default: mp4v (atau 'avc1' untuk H.264)
   RECORDING_FPS=30                    # Default: 30
   ```

3. Run backend:
   ```bash
   python main.py
   ```

### Setup Frontend
1. Install dependencies (jika ada yang baru):
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

### Menggunakan Fitur Recording
1. Buka halaman **Dashboard > Livestream**
2. Klik "Start Stream" untuk memulai livestream
3. Setelah stream aktif, klik tombol **"Record"** untuk mulai merekam
4. Video yang direkam adalah video yang sudah diproses YOLO (dengan bounding boxes)
5. Klik **"Stop Recording"** untuk menghentikan recording
6. Recording akan tersimpan di `src/backend/recordings/` dan metadata-nya di database
7. Lihat hasil recording di halaman **Dashboard > Recordings**

## Lokasi File Recording
Video recording disimpan di:
```
src/backend/recordings/recording_<client_id>_<timestamp>.mp4
```

Contoh: `recording_abc123_20240115_143025.mp4`

## Database Migration
Untuk menjalankan migration di production:
```bash
npx prisma migrate deploy
```

## Notes
- Recording hanya bisa dilakukan saat streaming aktif
- File video akan tersimpan di server backend
- Pastikan disk space cukup untuk menyimpan recordings
- Fitur Play dan Download akan ditambahkan di update berikutnya
- Recording akan otomatis stop ketika stream dihentikan

## Troubleshooting

### Backend tidak bisa start
- Pastikan semua module dependencies terinstall
- Check import paths di `main.py`

### Recording tidak tersimpan
- Check permissions di folder `recordings/`
- Pastikan `RECORDINGS_DIR` accessible
- Check backend logs untuk error messages

### Database error
- Pastikan migration sudah dijalankan
- Check `DATABASE_URL` di `.env`
- Verify MySQL connection

## Future Improvements
- [ ] Video playback di browser
- [ ] Download endpoint untuk download recordings
- [ ] Thumbnail generation untuk preview
- [ ] Automatic cleanup untuk old recordings
- [ ] Recording quality settings
- [ ] Export to different formats
- [ ] Cloud storage integration (S3, etc.)
