# Antrian Gambar Estimator

Website manajemen antrian gambar Sales, Bagan Estimator, Bagan Admin Kontrak (SPH), Profil Karyawan, dan Riwayat Online Lintas Perangkat.

## Akses Online Multi-Perangkat
- Buka website langsung melalui domain GitHub Pages repository ini dari HP, tablet, laptop, maupun komputer mana pun.
- Login dengan username yang sama dari perangkat berbeda otomatis menarik seluruh data antrian aktif, histori proyek (`Sheet1`), profil karyawan & password (`Users_Profiles`), serta riwayat aktivitas (`History_Data`).

## Konfigurasi Backend Google Apps Script (2-Arah Penuh)
1. Buka Google Spreadsheet target (`1lUbqBjIcvOCMa7RTKvuWdlI_O7HQwZb5GPZYbIv4MhU`) → **Extensions > Apps Script**.
2. Tempel seluruh isi file `GoogleAppsScript_Code.js` lalu **Save**.
3. Pilih **Deploy > New deployment > Web app** (*Execute as: Me*, *Who has access: Anyone*), lalu salin URL `/exec`.
4. Tempel URL `/exec` ke konstanta `GOOGLE_SCRIPT_WEB_APP_URL` di `index.html` atau gunakan tombol **Link Akses Multi-Perangkat → Salin Link Online** (`?gas=...`) di aplikasi.
