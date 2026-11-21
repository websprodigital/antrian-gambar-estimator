# Antrian Gambar Estimator

Website manajemen antrian gambar Sales, Bagan Estimator, Bagan Admin Kontrak (SPH), Profil Karyawan, dan Riwayat Online Lintas Perangkat.

## Opsi 1: Hosting PHP / cPanel (100% Otomatis Lintas HP Android/iOS, Laptop & Komputer)
Unggah file `index.html` dan `api.php` ke folder website/hosting PHP Anda (`public_html/` atau subdomain):
- Website otomatis mendeteksi dan terhubung langsung ke `api.php` tanpa perlu konfigurasi manual di HP maupun komputer mana pun.
- Seluruh data proyek, profil karyawan, password login, foto, file PDF/gambar (`uploads_estimator/`), dan riwayat aktivitas (`db_estimator_store.json.php` berproteksi `<?php exit; ?>`) tersimpan terpusat dan tersinkron otomatis di seluruh perangkat.
- Pastikan folder hosting memiliki izin tulis (`chmod 755` atau `775`) agar `db_estimator_store.json.php` dan `uploads_estimator/` dapat dibuat otomatis.

## Opsi 2: GitHub Pages + Google Apps Script (Spreadsheet & Drive)
1. Buka Google Spreadsheet target (`1lUbqBjIcvOCMa7RTKvuWdlI_O7HQwZb5GPZYbIv4MhU`) → **Extensions > Apps Script**.
2. Tempel seluruh isi `GoogleAppsScript_Code.js`, **Save**, lalu **Deploy > New deployment > Web app** (*Execute as: Me*, *Who has access: Anyone*).
3. Masukkan URL `/exec` ke `GOOGLE_SCRIPT_WEB_APP_URL` di `index.html` atau lewat tombol **Link Akses Multi-Perangkat → Salin Link Online** (`?gas=...`).
