# Antrian Gambar Estimator — Aplikasi Mobile (Android & iOS) & Desktop Windows

Repositori branch `apps` berisi source code aplikasi **Mobile (Android & iOS)** dan **Desktop Windows** untuk **Antrian Gambar Estimator & Admin Kontrak** berbasis bundle **Offline-First + Auto-Sync** dari `index.html` (`index_(29)_(3).html`) lengkap dengan URL Google Apps Script aktif, ikon **A Estimator**, dan suara notifikasi `notif_sound.mp3`.

## Fitur Unggulan Aplikasi Native

### 1. Aplikasi Desktop Windows (`windows-app/`)
- **Dua format siap pakai**:
  - **Windows Installer (`Setup.exe`)**: Membuat shortcut di Desktop & Start Menu, mendukung Uninstaller resmi.
  - **Windows Portable (`.exe`)**: Bisa langsung dijalankan tanpa instalasi (cukup klik 2x).
- **System Tray & Notifikasi Background Real-Time**: Menutup jendela (`X`) akan menyembunyikan aplikasi ke System Tray sehingga pemantauan antrian, chat proyek, suara MP3 chime, dan pop-up Windows Toast tetap berjalan di latar belakang.
- **Auto-Start Windows**: Dapat diaktifkan/nonaktifkan langsung dari klik kanan ikon System Tray (*Jalankan Otomatis Saat Windows Menyala*).
- **Unduhan & Google Drive/Sheets Otomatis**: Ekspor CSV dan unduh PDF/gambar otomatis tersimpan ke folder `Downloads`, sementara link Google Drive / Spreadsheet terbuka di browser default dengan akun Google yang sudah login.

### 2. Aplikasi Mobile Android & iOS (`mobile-app/`)
- **Android `.apk` Siap Pasang + Project Xcode iOS**: Dibangun dengan Capacitor 8 dengan skema origin aman (`https://localhost/`).
- **Notifikasi Native Android + Suara MP3 + WorkManager Background**:
  - Menggunakan channel notifikasi prioritas tinggi lengkap dengan suara `notif_sound.mp3` dan getaran.
  - Didukung `WorkManager` (`NotificationPollWorker`) untuk mengecek notifikasi baru secara berkala di latar belakang.
- **Pemilih Berkas Lengkap (`.pdf`, `.dwg`, `.dxf`, `.zip`, `.rar`, `.doc`, `.docx`, Foto Kamera/Galeri)**: Dioptimalkan di `MainActivity.java` agar file gambar teknik CAD tidak terfilter oleh file picker Android.
- **Unduhan `blob:` / CSV / PDF Langsung ke Memori HP**: Tersimpan otomatis di `Downloads/AntrianEstimator/` dengan notifikasi selesai unduh.
- **Navigasi Tombol Back Android Cerdas**: Menutup modal/sidebar terlebih dahulu sebelum kembali ke Dashboard atau keluar aplikasi.

---

## Struktur Folder

- `shared-web/` — Bridge native lintas platform (`native-bridge.js`) & skrip sinkronisasi aset (`sync-assets.js`).
- `mobile-app/` — Project Capacitor (`android/` dan `ios/`).
- `windows-app/` — Project Electron (`main.js`, `preload.js`, `assets/icon.ico`, konfigurasi `electron-builder`).
- `.github/workflows/build-apps.yml` — Workflow GitHub Actions untuk build otomatis Android APK, Windows `.exe`, dan verifikasi build iOS.

---

## Cara Build Ulang Secara Lokal

### Prasyarat
- Node.js 20+ (`node -v`)
- Untuk Android: JDK 21 + Android SDK (`ANDROID_HOME`)
- Untuk Windows di Linux: Wine (`wine` + `wine32`) + NSIS (`nsis`), atau jalankan langsung di Windows
- Untuk iOS (`.ipa`): macOS dengan Xcode + CocoaPods

### Build Aplikasi Windows (`.exe` Installer & Portable)
```bash
cd windows-app
npm install
npm run dist:win
```
Hasil build tersimpan di `windows-app/dist/`.

### Build Aplikasi Android (`.apk`)
```bash
cd mobile-app
npm install
npm run build:apk
```
Hasil APK tersimpan di `mobile-app/android/app/build/outputs/apk/release/`.

### Build / Buka Project iOS (di macOS / Xcode)
```bash
cd mobile-app
npm install
npm run sync:ios
npx cap open ios
```
Atur **Signing & Capabilities** (Team Apple Developer Anda) di Xcode lalu pilih **Product > Archive** atau **Run** ke iPhone/iPad.
