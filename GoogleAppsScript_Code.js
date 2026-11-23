/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI ONLINE MULTI-PERANGKAT WEB ESTIMATOR,
 * AKUN PROFIL PER USERNAME, HISTORY DATA ONLINE, SPREADSHEET & GOOGLE DRIVE
 * ==============================================================================
 * 
 * Target Google Spreadsheet:
 * https://docs.google.com/spreadsheets/d/1lUbqBjIcvOCMa7RTKvuWdlI_O7HQwZb5GPZYbIv4MhU/edit?gid=0#gid=0
 * 
 * Sheet Tabs yang dikelola otomatis:
 * 1. Sheet1         : Data antrian & progres proyek aktif (Sales, Estimator, Admin Kontrak)
 * 2. Users_Profiles : Profil karyawan per username, Foto Profil (Thumbnail & Drive URL),
 *                     PasswordHash (untuk login di HP & komputer mana saja), Login & Perangkat terakhir
 * 3. History_Data   : Riwayat aktivitas login, perubahan profil, pembuatan/perubahan/penghapusan data,
 *                     dan snapshot arsip history data lama agar tetap tersimpan online permanen
 * 
 * Target Folder Google Drive per Sales:
 * 1. Samuel:
 *    https://drive.google.com/drive/u/0/folders/1as43AZ9wp0Fi3RkjGHTUz7Tsn5M7Jmvf (ID: 1as43AZ9wp0Fi3RkjGHTUz7Tsn5M7Jmvf)
 * 2. Priyo Utomo / Priyo Utomo Samuel:
 *    https://drive.google.com/drive/u/0/folders/1lS5O70gI_duX74xhvf6GpWPdWrCCywEv (ID: 1lS5O70gI_duX74xhvf6GpWPdWrCCywEv)
 * 3. Rini Eldiarty / Rini Eldiarty Samuel:
 *    https://drive.google.com/drive/u/0/folders/1pW6wz3N1L4jZBGr1aYEM2MfUoduq-JT4 (ID: 1pW6wz3N1L4jZBGr1aYEM2MfUoduq-JT4)
 * 
 * CARA PEMASANGAN & DEPLOY GOOGLE APPS SCRIPT:
 * 1. Buka spreadsheet target di browser:
 *    https://docs.google.com/spreadsheets/d/1lUbqBjIcvOCMa7RTKvuWdlI_O7HQwZb5GPZYbIv4MhU/edit?gid=0#gid=0
 * 2. Klik menu "Ekstensi" (Extensions) > pilih "Apps Script".
 * 3. Hapus seluruh isi kode bawaan, lalu tempelkan (Paste) seluruh kode ini.
 * 4. Klik ikon "Simpan" (Ctrl + S).
 * 5. Klik tombol biru "Terapkan" (Deploy) > pilih "Penerapan baru" (New deployment).
 *    (Jika sudah pernah deploy sebelumnya: Deploy > Kelola penerapan / Manage deployments > Edit > Versi baru / New version).
 * 6. Pilih jenis "Aplikasi web" (Web app):
 *    - Jalankan sebagai (Execute as): Saya (Me)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone) -> WAJIB AGAR HP & KOMPUTER BISA LOGIN & SINKRON ONLINE!
 * 7. Klik "Terapkan" (Deploy), berikan izin akses Google, lalu salin URL Aplikasi Web (/exec).
 * 8. Tempel URL (/exec) tersebut ke konstanta GOOGLE_SCRIPT_WEB_APP_URL di file index.html
 *    atau lewat tombol "Atur URL Server Online" di halaman Login / menu Pengaturan.
 * ==============================================================================
 */

// Konfigurasi Utama Target Spreadsheet dan Folder Google Drive
var CONFIG = {
  SPREADSHEET_ID: "1lUbqBjIcvOCMa7RTKvuWdlI_O7HQwZb5GPZYbIv4MhU",
  SHEET_NAME: "Sheet1",
  USERS_SHEET_NAME: "Users_Profiles",
  HISTORY_SHEET_NAME: "History_Data",
  NOTIFICATIONS_SHEET_NAME: "Notifications_Feed",
  PROFILE_PHOTO_FOLDER_NAME: "_Foto_Profil_Karyawan",
  TIMEZONE: "GMT+7",
  ROOT_FOLDER_ID: "",
  SALES_FOLDERS: {
    "samuel": "1as43AZ9wp0Fi3RkjGHTUz7Tsn5M7Jmvf",
    "priyo": "1lS5O70gI_duX74xhvf6GpWPdWrCCywEv",
    "rini": "1pW6wz3N1L4jZBGr1aYEM2MfUoduq-JT4"
  }
};

// Header Baris 1 Kolom Spreadsheet Data Proyek (Sheet1)
var HEADERS = [
  "Timestamp (Waktu & Tanggal)",
  "No Antrian",
  "Tanggal Upload",
  "Nama Sales",
  "Nama Customer / Klien",
  "Nama Proyek",
  "Skop Pengerjaan Material",
  "Project Material",
  "Target Selesai",
  "Keterangan Sumber Gambar",
  "Folder Drive Customer",
  "Dokumen / Gambar (Drive)",
  "Dokumen Tambahan 1",
  "Dokumen Tambahan 2",
  "Dokumen Tambahan 3",
  "Dokumen Tambahan 4",
  "Dokumen Tambahan 5",
  "Dokumen Tambahan 6",
  "Dokumen Tambahan 7",
  "Dokumen Tambahan 8",
  "Status Pengerjaan Desain",
  "Pilih Estimator",
  "Tgl Estimasi Pengerjaan",
  "Tgl Selesai Pengerjaan",
  "Revisi Desain 1",
  "Revisi Desain 2",
  "Revisi Desain 3",
  "Revisi Desain 4",
  "Revisi Desain 5",
  "Revisi Desain 6",
  "Revisi Desain 7",
  "Revisi Desain 8",
  "Catatan Desain Estimator",
  "Nomor Penawaran (SPH)",
  "Status Admin Kontrak",
  "Catatan SPH",
  "Nomor Penawaran",
  "Revisi Penawaran 1",
  "Revisi Penawaran 2",
  "Revisi Penawaran 3",
  "Revisi Penawaran 4",
  "Revisi Penawaran 5",
  "Revisi Penawaran 6",
  "Revisi Penawaran 7",
  "Revisi Penawaran 8",
  "Penawaran Final/Selesai",
  "Catatan Dari Sales",
  "History Catatan Sales",
  "History Catatan Estimator",
  "History Chat Terhubung"
];

// Header Sheet Akun & Profil Karyawan Per Username (Users_Profiles)
var USERS_HEADERS = [
  "UserKey",
  "Username",
  "Role",
  "PasswordHash",
  "ID Karyawan",
  "Email",
  "Nomor Whatsapp",
  "Divisi/Jabatan",
  "Foto Drive URL",
  "Foto Thumbnail",
  "Nama File Foto",
  "Ukuran File Foto",
  "Login Terakhir",
  "Perangkat Terakhir",
  "Diperbarui Pada"
];

// Header Sheet Riwayat Aktivitas & Arsip History Data Online (History_Data)
var HISTORY_HEADERS = [
  "Timestamp",
  "Username",
  "UserKey",
  "Perangkat",
  "Jenis Aktivitas",
  "Kode Antrian",
  "Customer / Proyek",
  "Status",
  "Detail / Snapshot Data"
];

// Header Sheet Notifikasi Real-time Lintas Perangkat (Notifications_Feed)
var NOTIFICATIONS_HEADERS = [
  "EventId",
  "CreatedAtMs",
  "Timestamp",
  "EventType",
  "Title",
  "Message",
  "Actor",
  "QueueCode",
  "CustomerName",
  "ProjectName",
  "Status"
];

/**
 * Hitung SHA-256 Hex String (UTF-8) konsisten dengan klien web
 */
function computeSha256Hex(rawStr) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(rawStr || ""), Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    if (h.length === 1) hex += "0";
    hex += h;
  }
  return hex;
}

/**
 * Hash password akun per username (konsisten antara browser & Apps Script)
 */
function computeAccountPasswordHash(userKey, plainPassword) {
  var normKey = (userKey || "").toString().trim().toLowerCase();
  return computeSha256Hex("AGRA_ESTIMATOR_2026:" + normKey + ":" + (plainPassword || ""));
}

/**
 * Format tanggal ke DD/MM/YYYY (contoh: 21/11/2026)
 */
function formatGasDateDMY(val) {
  if (!val && val !== 0) return "";
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, CONFIG.TIMEZONE, "dd/MM/yyyy");
  }
  var s = val.toString().trim();
  if (!s || s === "-") return s;
  var dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    return ("0" + dmyMatch[1]).slice(-2) + "/" + ("0" + dmyMatch[2]).slice(-2) + "/" + dmyMatch[3];
  }
  var ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    return ("0" + ymdMatch[3]).slice(-2) + "/" + ("0" + ymdMatch[2]).slice(-2) + "/" + ymdMatch[1];
  }
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, CONFIG.TIMEZONE, "dd/MM/yyyy");
  }
  return s;
}

/**
 * Format tanggal & waktu ke DD/MM/YYYY HH:mm (contoh: 21/11/2026 03:05)
 */
function formatGasDateTimeDMY(val) {
  if (!val && val !== 0) return "";
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");
  }
  var s = val.toString().trim();
  if (!s || s === "-") return s;
  var dmyTimeMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[T\s]+(\d{1,2}):(\d{1,2})/);
  if (dmyTimeMatch) {
    return ("0" + dmyTimeMatch[1]).slice(-2) + "/" + ("0" + dmyTimeMatch[2]).slice(-2) + "/" + dmyTimeMatch[3] +
      " " + ("0" + dmyTimeMatch[4]).slice(-2) + ":" + ("0" + dmyTimeMatch[5]).slice(-2);
  }
  var ymdTimeMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[T\s]+(\d{1,2}):(\d{1,2})/);
  if (ymdTimeMatch) {
    return ("0" + ymdTimeMatch[3]).slice(-2) + "/" + ("0" + ymdTimeMatch[2]).slice(-2) + "/" + ymdTimeMatch[1] +
      " " + ("0" + ymdTimeMatch[4]).slice(-2) + ":" + ("0" + ymdTimeMatch[5]).slice(-2);
  }
  var dmyOnly = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyOnly) {
    return ("0" + dmyOnly[1]).slice(-2) + "/" + ("0" + dmyOnly[2]).slice(-2) + "/" + dmyOnly[3] + " 00:00";
  }
  var ymdOnly = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdOnly) {
    return ("0" + ymdOnly[3]).slice(-2) + "/" + ("0" + ymdOnly[2]).slice(-2) + "/" + ymdOnly[1] + " 00:00";
  }
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");
  }
  return s;
}

/**
 * Kunci format kolom tanggal/timestamp menjadi teks biasa (@) sebelum menulis nilai agar Google Sheets tidak mengubahnya ke objek Date
 */
function applyPlainTextDateFormat(sheet, rowIndex) {
  try {
    var dateCols = [1, 3, 9, 23, 24];
    for (var i = 0; i < dateCols.length; i++) {
      sheet.getRange(rowIndex, dateCols[i]).setNumberFormat("@");
    }
  } catch (e) {}
}

/**
 * Pastikan Sheet Users_Profiles tersedia
 */
function getOrCreateUsersSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.USERS_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(USERS_HEADERS);
    var hdr = sheet.getRange(1, 1, 1, USERS_HEADERS.length);
    hdr.setBackground("#20409a").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 140);
    sheet.setColumnWidth(2, 160);
    sheet.setColumnWidth(5, 130);
    sheet.setColumnWidth(6, 200);
    sheet.setColumnWidth(7, 150);
    sheet.setColumnWidth(8, 170);
    sheet.setColumnWidth(9, 220);
    sheet.setColumnWidth(13, 150);
    sheet.setColumnWidth(14, 160);
  }
  return sheet;
}

/**
 * Pastikan Sheet History_Data tersedia
 */
function getOrCreateHistorySheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.HISTORY_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.HISTORY_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HISTORY_HEADERS);
    var hdr = sheet.getRange(1, 1, 1, HISTORY_HEADERS.length);
    hdr.setBackground("#20409a").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 160);
    sheet.setColumnWidth(6, 120);
    sheet.setColumnWidth(7, 230);
    sheet.setColumnWidth(8, 130);
    sheet.setColumnWidth(9, 420);
  }
  return sheet;
}

/**
 * Catat aktivitas & snapshot history data ke sheet History_Data
 */
function appendOnlineHistory(ss, username, userKey, device, actionType, queueCode, titleText, statusText, detailText) {
  try {
    var hSheet = getOrCreateHistorySheet(ss);
    var nextRow = hSheet.getLastRow() + 1;
    var ts = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");
    try {
      hSheet.getRange(nextRow, 1).setNumberFormat("@");
      hSheet.getRange(nextRow, 6).setNumberFormat("@");
    } catch (fmtErr) {}
    var safeDetail = (detailText || "-").toString();
    if (safeDetail.length > 45000) {
      safeDetail = safeDetail.substring(0, 45000) + "...(truncated)";
    }
    hSheet.getRange(nextRow, 1, 1, HISTORY_HEADERS.length).setValues([[
      ts,
      (username || "-").toString(),
      (userKey || "").toString().trim().toLowerCase() || "-",
      (device || "-").toString(),
      (actionType || "AKTIVITAS").toString(),
      (queueCode || "-").toString(),
      (titleText || "-").toString(),
      (statusText || "-").toString(),
      safeDetail
    ]]);
  } catch (err) {
    Logger.log("Gagal catat History_Data: " + err);
  }
}

function isInitialQueueStatusGas(statusStr) {
  var s = (statusStr || "").toString().trim().toLowerCase();
  return (s === "" || s === "-" || s === "belum edit" || s === "masih antrian gambar" || s === "antrian gambar");
}

function parseNotesHistoryJsonGas(rawVal) {
  if (!rawVal) return [];
  if (Array.isArray(rawVal)) return rawVal;
  try {
    var parsed = JSON.parse(rawVal.toString());
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function mergeNotesHistoryGas(existingRaw, incomingRaw) {
  var listA = parseNotesHistoryJsonGas(existingRaw);
  var listB = parseNotesHistoryJsonGas(incomingRaw);
  var seenIds = {};
  var seenSigs = {};
  var merged = [];
  var combined = listA.concat(listB);
  for (var i = 0; i < combined.length; i++) {
    var item = combined[i];
    if (!item || typeof item !== "object") continue;
    var txt = (item.text || "").toString().trim();
    if (!txt || txt === "-") continue;
    var msgId = (item.id || "").toString().trim();
    var ts = (item.timestamp || "").toString().trim();
    var author = (item.author || "").toString().trim();
    var role = (item.role || "").toString().trim();
    var roleLabel = (item.roleLabel || "").toString().trim();
    var sourceMenu = (item.sourceMenu || "").toString().trim();
    var createdAtMs = Number(item.createdAtMs || 0);
    var sig = ts + "|" + author + "|" + txt;
    if ((msgId && seenIds[msgId]) || seenSigs[sig]) continue;
    if (msgId) seenIds[msgId] = true;
    seenSigs[sig] = true;
    var obj = {
      timestamp: ts || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH : mm : ss"),
      author: author || "-",
      text: txt
    };
    if (msgId) obj.id = msgId;
    if (role) obj.role = role;
    if (roleLabel) obj.roleLabel = roleLabel;
    if (sourceMenu) obj.sourceMenu = sourceMenu;
    if (createdAtMs > 0) obj.createdAtMs = createdAtMs;
    merged.push(obj);
  }
  merged.sort(function(a, b) {
    var ta = Number(a.createdAtMs || 0);
    var tb = Number(b.createdAtMs || 0);
    if (ta === tb) return 0;
    return ta < tb ? -1 : 1;
  });
  return merged.length > 150 ? merged.slice(-150) : merged;
}

function getOrCreateNotificationsSheet(ss) {
  var sheetName = CONFIG.NOTIFICATIONS_SHEET_NAME || "Notifications_Feed";
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(NOTIFICATIONS_HEADERS);
    var hdr = sheet.getRange(1, 1, 1, NOTIFICATIONS_HEADERS.length);
    hdr.setBackground("#20409a").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendRealtimeNotificationGas(ss, eventType, title, message, actor, queueCode, customerName, projectName, statusText, clientEventId) {
  try {
    var nSheet = getOrCreateNotificationsSheet(ss);
    var nowMs = Date.now();
    var ts = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm:ss");
    var evtId = (clientEventId || "").toString().replace(/[^a-zA-Z0-9_-]/g, "");
    if (!evtId) {
      evtId = "NTF-" + nowMs + "-" + Math.floor(Math.random() * 10000);
    }
    var lastRow = nSheet.getLastRow();
    if (lastRow >= 2) {
      var checkCount = Math.min(20, lastRow - 1);
      var existingIds = nSheet.getRange(lastRow - checkCount + 1, 1, checkCount, 1).getValues();
      for (var i = 0; i < existingIds.length; i++) {
        if ((existingIds[i][0] || "").toString().trim() === evtId) {
          return null;
        }
      }
    }
    var rowVals = [
      evtId,
      nowMs,
      ts,
      (eventType || "activity").toString(),
      (title || "Notifikasi Aktivitas Proyek").toString(),
      (message || "-").toString(),
      (actor || "Sistem").toString(),
      (queueCode || "-").toString(),
      (customerName || "-").toString(),
      (projectName || "-").toString(),
      (statusText || "-").toString()
    ];
    nSheet.appendRow(rowVals);
    return {
      id: evtId,
      createdAtMs: nowMs,
      timestamp: ts,
      eventType: rowVals[3],
      title: rowVals[4],
      message: rowVals[5],
      actor: rowVals[6],
      queueCode: rowVals[7],
      customerName: rowVals[8],
      projectName: rowVals[9],
      status: rowVals[10]
    };
  } catch (e) {
    Logger.log("Gagal catat Notifications_Feed: " + e);
    return null;
  }
}

function getRecentNotificationsGas(ss, sinceMs, limitCount) {
  try {
    var nSheet = getOrCreateNotificationsSheet(ss);
    var lastRow = nSheet.getLastRow();
    if (lastRow < 2) return [];
    var fetchCount = Math.min(limitCount || 40, lastRow - 1);
    var startRow = Math.max(2, lastRow - fetchCount + 1);
    var values = nSheet.getRange(startRow, 1, fetchCount, NOTIFICATIONS_HEADERS.length).getValues();
    var minMs = Number(sinceMs || 0);
    var out = [];
    for (var i = values.length - 1; i >= 0; i--) {
      var r = values[i];
      var createdAtMs = Number(r[1] || 0);
      if (minMs > 0 && createdAtMs < minMs) continue;
      out.push({
        id: (r[0] || "").toString(),
        createdAtMs: createdAtMs,
        timestamp: (r[2] || "-").toString(),
        eventType: (r[3] || "activity").toString(),
        title: (r[4] || "Notifikasi").toString(),
        message: (r[5] || "-").toString(),
        actor: (r[6] || "Sistem").toString(),
        queueCode: (r[7] || "-").toString(),
        customerName: (r[8] || "-").toString(),
        projectName: (r[9] || "-").toString(),
        status: (r[10] || "-").toString()
      });
    }
    return out;
  } catch (e) {
    return [];
  }
}

/**
 * Cari nomor baris di Users_Profiles berdasarkan userKey (case-insensitive)
 */
function findUserRowIndex(usersSheet, userKey) {
  var norm = (userKey || "").toString().trim().toLowerCase();
  if (!norm) return -1;
  var lastRow = usersSheet.getLastRow();
  if (lastRow < 2) return -1;
  var keys = usersSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (keys[i][0] && keys[i][0].toString().trim().toLowerCase() === norm) {
      return i + 2;
    }
  }
  return -1;
}

/**
 * Baca objek profil karyawan dari Users_Profiles
 */
function readUserProfileObj(usersSheet, rowIndex) {
  if (!rowIndex || rowIndex < 2) return null;
  var row = usersSheet.getRange(rowIndex, 1, 1, USERS_HEADERS.length).getValues()[0];
  return {
    userKey: (row[0] || "").toString().trim().toLowerCase(),
    username: (row[1] || "").toString().trim(),
    role: (row[2] || "").toString().trim(),
    passwordHash: (row[3] || "").toString().trim(),
    employeeId: (row[4] || "").toString().trim(),
    email: (row[5] || "").toString().trim(),
    whatsapp: (row[6] || "").toString().trim(),
    division: (row[7] || "").toString().trim(),
    photoDriveUrl: (row[8] || "").toString().trim(),
    photoThumbDataUrl: (row[9] || "").toString().trim(),
    photoFileName: (row[10] || "").toString().trim(),
    photoFileSize: Number(row[11] || 0) || 0,
    lastLoginAt: (row[12] || "").toString().trim(),
    lastDevice: (row[13] || "").toString().trim(),
    updatedAt: (row[14] || "").toString().trim()
  };
}

/**
 * Verifikasi hash password user terhadap sheet Users_Profiles (default: Agra123)
 */
function verifyUserAuthHash(usersSheet, userKey, providedHash) {
  var normKey = (userKey || "").toString().trim().toLowerCase();
  var cleanProvided = (providedHash || "").toString().trim().toLowerCase();
  if (!normKey || !cleanProvided) return false;

  var rowIdx = findUserRowIndex(usersSheet, normKey);
  var expectedHash = computeAccountPasswordHash(normKey, "Agra123");
  if (rowIdx > 0) {
    var storedHash = (usersSheet.getRange(rowIdx, 4).getValue() || "").toString().trim().toLowerCase();
    if (storedHash) {
      expectedHash = storedHash;
    }
  }
  return cleanProvided === expectedHash;
}

/**
 * Ambil daftar riwayat online terbaru (terbaru di atas) untuk user/role terkait
 */
function getRecentHistoryForUser(historySheet, userKey, role, maxRows) {
  var lastRow = historySheet.getLastRow();
  if (lastRow < 2) return [];
  var totalDataRows = lastRow - 1;
  var fetchCount = Math.min(totalDataRows, 300);
  var startRow = lastRow - fetchCount + 1;
  var values = historySheet.getRange(startRow, 1, fetchCount, HISTORY_HEADERS.length).getValues();
  var normUser = (userKey || "").toString().trim().toLowerCase();
  var normRole = (role || "").toString().trim().toLowerCase();
  var limit = maxRows || 80;
  var results = [];

  for (var i = values.length - 1; i >= 0; i--) {
    var r = values[i];
    var rowUserKey = (r[2] || "").toString().trim().toLowerCase();
    var rowUsername = (r[1] || "").toString().trim().toLowerCase();
    var rowDetail = (r[8] || "").toString().trim();

    if (normRole === "sales" && normUser) {
      var belongsToSales = (rowUserKey === normUser || rowUsername === normUser ||
        rowDetail.toLowerCase().indexOf(normUser) !== -1);
      if (!belongsToSales) continue;
    }

    results.push({
      timestamp: formatGasDateTimeDMY(r[0]) || (r[0] ? r[0].toString() : ""),
      username: r[1] ? r[1].toString() : "-",
      userKey: rowUserKey,
      device: r[3] ? r[3].toString() : "-",
      activity: r[4] ? r[4].toString() : "-",
      queueCode: r[5] ? r[5].toString() : "-",
      subject: r[6] ? r[6].toString() : "-",
      status: r[7] ? r[7].toString() : "-",
      detail: rowDetail
    });

    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Folder Drive untuk foto profil karyawan
 */
function getOrCreateProfilePhotoFolder() {
  var root = getFallbackRootFolder();
  try {
    var existing = root.getFoldersByName(CONFIG.PROFILE_PHOTO_FOLDER_NAME);
    if (existing.hasNext()) return existing.next();
    var created = root.createFolder(CONFIG.PROFILE_PHOTO_FOLDER_NAME);
    try {
      created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    return created;
  } catch (err) {
    return root;
  }
}

/**
 * Handle GET Request
 * - status                  : Status koneksi & jumlah baris
 * - get_rows / sync         : Ambil seluruh data baris proyek (Sheet1)
 * - login_sync              : Verifikasi login online per username lintas perangkat + tarik profil, Sheet1 & history
 * - get_profile_and_history : Tarik ulang profil online, Sheet1 & history untuk sesi aktif
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = (params.action || "status").toString().trim();

  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = getOrCreateSheet(ss);
    try { setupHeadersIfEmpty(sheet); } catch (hdrErr) {}

    // 1. Login Online & Sinkronisasi Profil + Data + History per Username
    if (action === "login_sync" || action === "verify_login") {
      var lockLogin = LockService.getScriptLock();
      lockLogin.tryLock(15000);
      try {
        var uKey = (params.userKey || "").toString().trim().toLowerCase();
        var uName = (params.username || uKey || "User").toString().trim();
        var uRole = (params.role || "").toString().trim();
        var authHash = (params.authHash || "").toString().trim().toLowerCase();
        var deviceName = (params.device || "Browser").toString().trim();

        var usersSheet = getOrCreateUsersSheet(ss);
        var isValid = verifyUserAuthHash(usersSheet, uKey, authHash);
        if (!isValid) {
          appendOnlineHistory(ss, uName, uKey, deviceName, "LOGIN_GAGAL", "-", "Akun: " + uName, "Ditolak", "Percobaan login password tidak sesuai dari " + deviceName);
          return createJsonResponse({
            status: "success",
            authenticated: false,
            message: "Login Gagal! Pastikan Username dan Password sesuai."
          });
        }

        // Update waktu login & perangkat terakhir pada Users_Profiles
        var nowFormatted = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");
        var nowIso = new Date().toISOString();
        var rowIdx = findUserRowIndex(usersSheet, uKey);
        if (rowIdx > 0) {
          usersSheet.getRange(rowIdx, 13).setNumberFormat("@").setValue(nowFormatted);
          usersSheet.getRange(rowIdx, 14).setValue(deviceName);
          usersSheet.getRange(rowIdx, 15).setValue(nowIso);
          if (uRole && !usersSheet.getRange(rowIdx, 3).getValue()) {
            usersSheet.getRange(rowIdx, 3).setValue(uRole);
          }
        } else {
          rowIdx = usersSheet.getLastRow() + 1;
          try {
            usersSheet.getRange(rowIdx, 5).setNumberFormat("@");
            usersSheet.getRange(rowIdx, 7).setNumberFormat("@");
            usersSheet.getRange(rowIdx, 13).setNumberFormat("@");
          } catch (fmtErr) {}
          usersSheet.getRange(rowIdx, 1, 1, USERS_HEADERS.length).setValues([[
            uKey,
            uName,
            uRole,
            computeAccountPasswordHash(uKey, "Agra123"),
            "", "", "", "", "", "", "", 0,
            nowFormatted,
            deviceName,
            nowIso
          ]]);
        }

        var profileObj = readUserProfileObj(usersSheet, rowIdx);
        if (profileObj) delete profileObj.passwordHash;

        appendOnlineHistory(ss, uName, uKey, deviceName, "LOGIN", "-", "Akun: " + uName, "Berhasil", "Login online berhasil dari perangkat " + deviceName);

        var rows = getAllRowsAsJSON(sheet);
        var historySheet = getOrCreateHistorySheet(ss);
        var historyList = getRecentHistoryForUser(historySheet, uKey, uRole || (profileObj ? profileObj.role : ""), 80);

        return createJsonResponse({
          status: "success",
          authenticated: true,
          profile: profileObj,
          records: rows,
          history: historyList,
          notifications: getRecentNotificationsGas(ss, 0, 30),
          total: rows.length,
          serverTimestamp: nowFormatted,
          spreadsheetUrl: ss.getUrl()
        });
      } finally {
        lockLogin.releaseLock();
      }
    }

    // 1B. Endpoint Ringan Notifikasi Real-time Lintas Perangkat / Tab Lain / Layar Login
    if (action === "get_notifications") {
      var sinceMsParam = Number(params.since || 0);
      var notifList = getRecentNotificationsGas(ss, sinceMsParam, 40);
      return createJsonResponse({
        status: "success",
        notifications: notifList,
        total: notifList.length,
        serverTimeMs: Date.now()
      });
    }

    // 2. Refresh Profil, Data Terbaru & History Online untuk Sesi Berjalan
    if (action === "get_profile_and_history" || action === "get_online_state") {
      var qUserKey = (params.userKey || "").toString().trim().toLowerCase();
      var qAuthHash = (params.authHash || "").toString().trim().toLowerCase();
      var qRole = (params.role || "").toString().trim();
      var uSheet = getOrCreateUsersSheet(ss);

      if (!qUserKey || !verifyUserAuthHash(uSheet, qUserKey, qAuthHash)) {
        return createJsonResponse({
          status: "success",
          authenticated: false,
          passwordChangedRemotely: true,
          records: [],
          history: []
        });
      }

      var rIdx = findUserRowIndex(uSheet, qUserKey);
      var pObj = (rIdx > 0) ? readUserProfileObj(uSheet, rIdx) : null;
      if (pObj) delete pObj.passwordHash;

      var allRows = getAllRowsAsJSON(sheet);
      var hSheet = getOrCreateHistorySheet(ss);
      var hist = getRecentHistoryForUser(hSheet, qUserKey, qRole || (pObj ? pObj.role : ""), 80);

      return createJsonResponse({
        status: "success",
        authenticated: true,
        profile: pObj,
        records: allRows,
        history: hist,
        notifications: getRecentNotificationsGas(ss, 0, 30),
        total: allRows.length,
        serverTimestamp: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm"),
        spreadsheetUrl: ss.getUrl()
      });
    }

    // 3. Tarik Data Proyek (Kompatibel dengan pemanggilan lama get_rows / sync)
    if (action === "get_rows" || action === "sync") {
      var rowsData = getAllRowsAsJSON(sheet);
      return createJsonResponse({
        status: "success",
        total: rowsData.length,
        records: rowsData,
        notifications: getRecentNotificationsGas(ss, 0, 30),
        serverTimestamp: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm"),
        spreadsheetUrl: ss.getUrl()
      });
    }

    var usersSheetStatus = getOrCreateUsersSheet(ss);
    var historySheetStatus = getOrCreateHistorySheet(ss);

    return createJsonResponse({
      status: "active",
      message: "Google Apps Script Sinkronisasi Online Multi-Perangkat AKTIF & TERHUBUNG",
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      totalRows: Math.max(0, sheet.getLastRow() - 1),
      totalUsers: Math.max(0, usersSheetStatus.getLastRow() - 1),
      totalHistory: Math.max(0, historySheetStatus.getLastRow() - 1),
      spreadsheetUrl: ss.getUrl(),
      timestamp: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm")
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

/**
 * Handle POST Request
 * Mendukung penyimpanan/perubahan profil user per username, balance update Sheet1,
 * upload dokumen & foto ke Google Drive, dan arsip history permanen di History_Data.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var action = (data.action || "save_row").toString().trim();
    var actorUsername = (data.actorUsername || data.username || data.salesName || "Sistem").toString().trim();
    var actorKey = (data.actorUserKey || data.userKey || actorUsername).toString().trim().toLowerCase();
    var deviceInfo = (data.device || "-").toString().trim();

    // 0. Aksi Simpan / Update Profil Karyawan & Password Per Username Online
    if (action === "save_user_profile") {
      return handleSaveUserProfile(data);
    }

    // 1. Aksi Clear All Rows (Arsipkan seluruh data ke History_Data terlebih dahulu lalu kosongkan Sheet1)
    if (action === "clear_all_rows" || action === "reset_zero") {
      var ssClear = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sheetClear = getOrCreateSheet(ssClear);
      var lastRowClear = sheetClear.getLastRow();
      var clearedRecords = [];
      if (lastRowClear >= 2) {
        clearedRecords = getAllRowsAsJSON(sheetClear);
        sheetClear.deleteRows(2, lastRowClear - 1);
      }
      appendOnlineHistory(
        ssClear,
        actorUsername,
        actorKey,
        deviceInfo,
        "RESET_SEMUA_DATA",
        "-",
        "Reset " + clearedRecords.length + " baris data aktif",
        "Terarsip Online",
        JSON.stringify({ clearedCount: clearedRecords.length, archive: clearedRecords.slice(0, 50) })
      );
      return createJsonResponse({
        status: "success",
        message: "Seluruh baris data aktif di Spreadsheet dikosongkan dan history tetap terarsip online."
      });
    }

    // 2. Aksi Hapus 1 Baris berdasarkan queueCode (Arsipkan snapshot ke History_Data sebelum hapus)
    if (action === "delete_row" && (data.queueCode || data.noAntrian)) {
      var ssDel = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sheetDel = getOrCreateSheet(ssDel);
      var delCode = normalizeQueueCodeTo2027Gas(data.queueCode || data.noAntrian);
      var delRowIdx = findRowIndexByQueue(sheetDel, delCode);
      if (delRowIdx > 0) {
        var oldRowVals = sheetDel.getRange(delRowIdx, 1, 1, HEADERS.length).getValues()[0];
        var snapSummary = {
          queueCode: delCode,
          salesName: oldRowVals[3] || "",
          customerName: oldRowVals[4] || "",
          projectName: oldRowVals[5] || "",
          status: oldRowVals[20] || "",
          estimatorName: oldRowVals[21] || "",
          quoteNumber: oldRowVals[33] || ""
        };
        sheetDel.deleteRow(delRowIdx);
        appendOnlineHistory(
          ssDel,
          actorUsername,
          actorKey,
          deviceInfo,
          "HAPUS_DATA",
          delCode,
          (snapSummary.customerName || "-") + " / " + (snapSummary.projectName || "-"),
          "Dihapus dari Aktif (Arsip History)",
          JSON.stringify(snapSummary)
        );
        return createJsonResponse({
          status: "success",
          message: "Data antrian " + delCode + " berhasil dihapus dari Sheet1 & diarsipkan di History_Data."
        });
      }
      return createJsonResponse({
        status: "not_found",
        message: "Kode antrian " + delCode + " tidak ditemukan di Spreadsheet."
      });
    }

    // 3. Aksi Simpan File CSV Langsung ke Drive
    if (action === "save_csv" && data.fileData) {
      return handleSaveCsvToDrive(data);
    }

    // 3B. Aksi Kirim Balasan Chat Terhubung Lintas Divisi
    if (action === "send_project_chat") {
      var ssChat = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      var sheetChat = getOrCreateSheet(ssChat);
      setupHeadersIfEmpty(sheetChat);
      var chatQ = normalizeQueueCodeTo2027Gas(data.queueCode || data.noAntrian || "", data.salesName || "");
      var chatRowIdx = findRowIndexByQueue(sheetChat, chatQ);
      var msgIn = (data.chatMessage && typeof data.chatMessage === "object") ? data.chatMessage : {};
      var chatTxt = (msgIn.text || data.text || "").toString().trim();
      if (!chatTxt) {
        return createJsonResponse({ status: "error", message: "Pesan chat kosong." });
      }
      var chatAuthor = (msgIn.author || actorUsername || "Tim Proyek").toString().trim();
      var chatRole = (msgIn.role || "").toString().trim();
      var chatRoleLabel = (msgIn.roleLabel || "Tim Proyek").toString().trim();
      var normalizedChatMsg = {
        id: (msgIn.id || ("MSG-" + new Date().getTime())).toString().trim(),
        createdAtMs: Number(msgIn.createdAtMs || new Date().getTime()),
        timestamp: (msgIn.timestamp || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH : mm : ss")).toString().trim(),
        author: chatAuthor,
        role: chatRole,
        roleLabel: chatRoleLabel,
        sourceMenu: (msgIn.sourceMenu || "").toString().trim(),
        text: chatTxt
      };
      var mergedChat = [normalizedChatMsg];
      var cCust = (data.customerName || "-").toString();
      var cProj = (data.projectName || "-").toString();
      var cStat = (data.status || "Masih Antrian Gambar").toString();
      if (chatRowIdx > 0) {
        var curVals = sheetChat.getRange(chatRowIdx, 1, 1, HEADERS.length).getValues()[0];
        mergedChat = mergeNotesHistoryGas(curVals[49], [normalizedChatMsg]);
        sheetChat.getRange(chatRowIdx, 50).setValue(JSON.stringify(mergedChat));
        if (chatRole === "sales") {
          sheetChat.getRange(chatRowIdx, 47).setValue(chatTxt);
          sheetChat.getRange(chatRowIdx, 48).setValue(JSON.stringify(mergeNotesHistoryGas(curVals[47], [normalizedChatMsg])));
        } else if (chatRole === "admin") {
          sheetChat.getRange(chatRowIdx, 33).setValue(chatTxt);
          sheetChat.getRange(chatRowIdx, 49).setValue(JSON.stringify(mergeNotesHistoryGas(curVals[48], [normalizedChatMsg])));
        } else if (chatRole === "contract") {
          sheetChat.getRange(chatRowIdx, 36).setValue(chatTxt);
        }
        cCust = (curVals[4] || cCust).toString();
        cProj = (curVals[5] || cProj).toString();
        cStat = (curVals[20] || cStat).toString();
      }
      appendOnlineHistory(
        ssChat,
        chatAuthor,
        actorKey,
        deviceInfo,
        "CHAT_PROYEK",
        chatQ || "-",
        cCust + " / " + cProj,
        cStat,
        "[" + chatRoleLabel + "] " + chatTxt
      );
      var gasChatNotif = appendRealtimeNotificationGas(
        ssChat,
        "project_chat",
        "Pesan Chat Proyek (" + chatRoleLabel + ")",
        chatAuthor + " (" + chatRoleLabel + ") membalas pada " + (chatQ || "-") + " - " + cProj + ": \"" + chatTxt + "\"",
        chatAuthor,
        chatQ || "-",
        cCust,
        cProj,
        cStat,
        (data.clientEventId || normalizedChatMsg.id).toString()
      );
      return createJsonResponse({
        status: "success",
        queueCode: chatQ,
        unifiedChatHistory: mergedChat,
        notification: gasChatNotif,
        message: "Chat terhubung berhasil disimpan!"
      });
    }

    // 4. Aksi Batch Save (Sinkronisasi Massal)
    if (action === "batch_save" && data.records && Array.isArray(data.records)) {
      return handleBatchSave(data.records, actorUsername, actorKey, deviceInfo);
    }

    // 5. Aksi Utama: Simpan / Perbarui Data Baris & Upload Berkas ke Folder Customer
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = getOrCreateSheet(ss);
    setupHeadersIfEmpty(sheet);

    var salesName = (data.salesName || data.namaSales || "Sales").toString().trim();
    var customerName = (data.customerName || data.namaCustomer || "Customer").toString().trim();
    var queueCode = normalizeQueueCodeTo2027Gas(data.queueCode || data.noAntrian || "", salesName);

    // Tentukan Folder Sales Target
    var salesFolderId = getSalesFolderId(salesName);
    var customerFolder = null;
    var customerFolderUrl = "";

    // Buat / Dapatkan Folder Customer Otomatis
    if (customerName) {
      try {
        customerFolder = getOrCreateCustomerFolder(salesFolderId, customerName);
        customerFolderUrl = customerFolder.getUrl();
      } catch (folderErr) {
        Logger.log("Gagal membuat folder customer: " + folderErr);
      }
    }

    // Simpan Berkas Unggahan (Slot 1 s/d 8) ke dalam Folder Customer
    var uploadedFiles = [];
    var uploadedLinks = [];
    var slotDocMap = {};

    if (customerFolder && data.files && Array.isArray(data.files)) {
      for (var fIdx = 0; fIdx < data.files.length; fIdx++) {
        var fileItem = data.files[fIdx];
        if (fileItem && fileItem.base64 && fileItem.name) {
          try {
            var cleanB64 = fileItem.base64;
            if (cleanB64.indexOf("base64,") !== -1) {
              cleanB64 = cleanB64.split("base64,")[1];
            }
            var fileBytes = Utilities.base64Decode(cleanB64);
            var fileBlob = Utilities.newBlob(fileBytes, fileItem.mimeType || "application/octet-stream", fileItem.name);
            var savedFile = customerFolder.createFile(fileBlob);
            try {
              savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (shareErr) {}

            var fileUrl = savedFile.getUrl();
            var slotNum = fileItem.slotIndex || (fIdx + 1);
            slotDocMap[slotNum] = fileUrl;
            uploadedFiles.push({
              name: fileItem.name,
              slot: slotNum,
              id: savedFile.getId(),
              url: fileUrl
            });
            uploadedLinks.push(fileUrl);
          } catch (fileErr) {
            Logger.log("Gagal menyimpan file " + fileItem.name + ": " + fileErr);
          }
        }
      }
    }

    for (var s = 1; s <= 8; s++) {
      if (!slotDocMap[s]) {
        var existingSlotVal = extractCleanUrl(data["extraImg" + s]);
        slotDocMap[s] = existingSlotVal;
      }
    }

    // Simpan Berkas Revisi Estimator (revGambar1 s/d 8)
    var revDocMap = {};
    var revFilesUploaded = [];
    if (customerFolder && data.revFiles && Array.isArray(data.revFiles)) {
      for (var rfIdx = 0; rfIdx < data.revFiles.length; rfIdx++) {
        var revItem = data.revFiles[rfIdx];
        if (revItem && revItem.base64 && revItem.name) {
          try {
            var revB64 = revItem.base64;
            if (revB64.indexOf("base64,") !== -1) {
              revB64 = revB64.split("base64,")[1];
            }
            var revBytes = Utilities.base64Decode(revB64);
            var revBlob = Utilities.newBlob(revBytes, revItem.mimeType || "application/octet-stream", revItem.name);
            var savedRev = customerFolder.createFile(revBlob);
            try {
              savedRev.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (revShareErr) {}
            var revUrl = savedRev.getUrl();
            var revNum = revItem.revIndex || revItem.slotIndex || (rfIdx + 1);
            revDocMap[revNum] = revUrl;
            revFilesUploaded.push({
              name: revItem.name,
              slot: revNum,
              fieldKey: "revGambar" + revNum,
              id: savedRev.getId(),
              url: revUrl
            });
          } catch (revFileErr) {
            Logger.log("Gagal menyimpan file revisi " + revItem.name + ": " + revFileErr);
          }
        }
      }
    }
    for (var rIdx = 1; rIdx <= 8; rIdx++) {
      if (!revDocMap[rIdx]) {
        revDocMap[rIdx] = (data["revGambar" + rIdx] || "").toString().trim();
      }
    }

    // Simpan Berkas Penawaran Admin Kontrak (quoteRev1..8 & quoteFinalDoc)
    var quoteDocMap = {};
    var quoteFilesUploaded = [];
    if (customerFolder && data.quoteFiles && Array.isArray(data.quoteFiles)) {
      for (var qfIdx = 0; qfIdx < data.quoteFiles.length; qfIdx++) {
        var qItem = data.quoteFiles[qfIdx];
        if (qItem && qItem.base64 && qItem.name && qItem.fieldKey) {
          try {
            var qB64 = qItem.base64;
            if (qB64.indexOf("base64,") !== -1) {
              qB64 = qB64.split("base64,")[1];
            }
            var qBytes = Utilities.base64Decode(qB64);
            var qBlob = Utilities.newBlob(qBytes, qItem.mimeType || "application/octet-stream", qItem.name);
            var savedQuote = customerFolder.createFile(qBlob);
            try {
              savedQuote.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            } catch (qShareErr) {}
            var qUrl = savedQuote.getUrl();
            quoteDocMap[qItem.fieldKey] = qUrl;
            quoteFilesUploaded.push({
              name: qItem.name,
              fieldKey: qItem.fieldKey,
              id: savedQuote.getId(),
              url: qUrl
            });
          } catch (qFileErr) {
            Logger.log("Gagal menyimpan file penawaran " + qItem.name + ": " + qFileErr);
          }
        }
      }
    }
    for (var qIdx = 1; qIdx <= 8; qIdx++) {
      var qKey = "quoteRev" + qIdx;
      if (!quoteDocMap[qKey]) {
        quoteDocMap[qKey] = (data[qKey] || "").toString().trim();
      }
    }
    if (!quoteDocMap["quoteFinalDoc"]) {
      quoteDocMap["quoteFinalDoc"] = (data.quoteFinalDoc || "").toString().trim();
    }

    var docsSummary = "";
    if (slotDocMap[1]) {
      docsSummary = slotDocMap[1];
    } else if (uploadedLinks.length > 0) {
      docsSummary = uploadedLinks[0];
    } else if (data.docsText && extractCleanUrl(data.docsText)) {
      docsSummary = extractCleanUrl(data.docsText);
    } else if (customerFolderUrl) {
      docsSummary = customerFolderUrl;
    } else {
      docsSummary = "-";
    }

    var nowTimestamp = formatGasDateTimeDMY(data.timestamp || data.uploadDateTime || new Date());
    var formattedUploadDateTime = formatGasDateTimeDMY(data.uploadDateTime || data.tanggalUpload || new Date()) || "-";
    var formattedTargetSelesai = formatGasDateDMY(data.requestDeadline || data.targetSelesai || "-") || "-";
    var formattedEstimateStart = formatGasDateDMY(data.estimateStartDate || "-") || "-";
    var formattedEstimateEnd = formatGasDateDMY(data.estimateEndDate || "-") || "-";
    var quoteNoVal = (data.quoteNumber || "-").toString().trim() || "-";

    var isSalesSide = (data.updatedBy === "sales" || data.updatedBy === "sales_new");
    var rowValues = [
      nowTimestamp,
      queueCode || "-",
      formattedUploadDateTime,
      salesName,
      customerName,
      data.projectName || data.namaProyek || "-",
      data.scopeOfWork || data.skopPengerjaan || "-",
      data.projectMaterial || data.projectMaterialValue || "-",
      formattedTargetSelesai,
      data.sourceDesc || data.sumberGambar || "-",
      customerFolderUrl || "-",
      docsSummary,
      slotDocMap[1] || "",
      slotDocMap[2] || "",
      slotDocMap[3] || "",
      slotDocMap[4] || "",
      slotDocMap[5] || "",
      slotDocMap[6] || "",
      slotDocMap[7] || "",
      slotDocMap[8] || "",
      data.status || "Masih Antrian Gambar",
      data.estimatorName || "(Belum dipilih)",
      formattedEstimateStart,
      formattedEstimateEnd,
      revDocMap[1] || "",
      revDocMap[2] || "",
      revDocMap[3] || "",
      revDocMap[4] || "",
      revDocMap[5] || "",
      revDocMap[6] || "",
      revDocMap[7] || "",
      revDocMap[8] || "",
      data.estimatorNotes || "-",
      quoteNoVal,
      data.quoteStatus || "Draft",
      data.quoteNotes || "-",
      quoteNoVal,
      quoteDocMap["quoteRev1"] || "",
      quoteDocMap["quoteRev2"] || "",
      quoteDocMap["quoteRev3"] || "",
      quoteDocMap["quoteRev4"] || "",
      quoteDocMap["quoteRev5"] || "",
      quoteDocMap["quoteRev6"] || "",
      quoteDocMap["quoteRev7"] || "",
      quoteDocMap["quoteRev8"] || "",
      quoteDocMap["quoteFinalDoc"] || "",
      data.salesNotes || data.catatanSales || "",
      JSON.stringify(mergeNotesHistoryGas([], data.salesNotesHistory)),
      JSON.stringify(mergeNotesHistoryGas([], data.estimatorNotesHistory)),
      JSON.stringify(mergeNotesHistoryGas([], data.unifiedChatHistory))
    ];

    // BALANCE UPDATE: Cari apakah nomor antrian sudah ada di sheet
    var existingRowIndex = findRowIndexByQueue(sheet, queueCode);
    var isNewInsertReq = (data.isNewInsert === true || data.isNewInsert === "true");
    if (existingRowIndex > 0 && isNewInsertReq) {
      queueCode = getNextFreeQueueCode(sheet, queueCode);
      rowValues[1] = queueCode || "-";
      existingRowIndex = -1;
    }
    var operationType = "inserted";

    if (existingRowIndex > 0) {
      var existingRowData = sheet.getRange(existingRowIndex, 1, 1, HEADERS.length).getValues()[0];
      if ((!customerFolderUrl || customerFolderUrl === "-") && existingRowData[10] && existingRowData[10] !== "-") {
        customerFolderUrl = existingRowData[10];
        rowValues[10] = customerFolderUrl;
      }
      if ((!docsSummary || docsSummary === "-") && existingRowData[11] && existingRowData[11] !== "-") {
        rowValues[11] = existingRowData[11];
      }
      for (var sIdx = 1; sIdx <= 8; sIdx++) {
        var colIndex = 11 + sIdx;
        if (!rowValues[colIndex] && existingRowData[colIndex]) {
          rowValues[colIndex] = existingRowData[colIndex];
        }
      }

      // Cegah editan dari 1 peran/perangkat menimpa progres terbaru milik peran/perangkat lain
      if (data.updatedBy === "estimator" || data.updatedBy === "contract") {
        for (var sc = 3; sc <= 9; sc++) {
          if (existingRowData[sc] && existingRowData[sc] !== "-") {
            rowValues[sc] = existingRowData[sc];
          }
        }
        if (existingRowData[46]) rowValues[46] = existingRowData[46];
        if (existingRowData[47]) rowValues[47] = existingRowData[47];
      } else {
        rowValues[47] = JSON.stringify(mergeNotesHistoryGas(existingRowData[47], data.salesNotesHistory));
      }
      if (isSalesSide) {
        if (existingRowData[20] && !isInitialQueueStatusGas(existingRowData[20])) {
          rowValues[20] = existingRowData[20];
        }
        if (existingRowData[21] && existingRowData[21] !== "(Belum dipilih)") {
          rowValues[21] = existingRowData[21];
        }
        if (existingRowData[22] && existingRowData[22] !== "-") {
          rowValues[22] = existingRowData[22];
        }
        if (existingRowData[23] && existingRowData[23] !== "-") {
          rowValues[23] = existingRowData[23];
        }
        if (existingRowData[48]) rowValues[48] = existingRowData[48];
      }
      if (data.updatedBy === "contract") {
        if (existingRowData[20] && !isInitialQueueStatusGas(existingRowData[20])) rowValues[20] = existingRowData[20];
        if (existingRowData[21] && existingRowData[21] !== "(Belum dipilih)") rowValues[21] = existingRowData[21];
        if (existingRowData[22] && existingRowData[22] !== "-") rowValues[22] = existingRowData[22];
        if (existingRowData[23] && existingRowData[23] !== "-") rowValues[23] = existingRowData[23];
        if (existingRowData[32] && existingRowData[32] !== "-") rowValues[32] = existingRowData[32];
        if (existingRowData[48]) rowValues[48] = existingRowData[48];
      }
      if (data.updatedBy === "estimator") {
        rowValues[48] = JSON.stringify(mergeNotesHistoryGas(existingRowData[48], data.estimatorNotesHistory));
      }
      rowValues[49] = JSON.stringify(mergeNotesHistoryGas(existingRowData[49], data.unifiedChatHistory));

      for (var r = 1; r <= 8; r++) {
        var rCol = 23 + r;
        if ((!rowValues[rCol] || isSalesSide || data.updatedBy === "contract") && existingRowData[rCol]) {
          rowValues[rCol] = existingRowData[rCol];
        }
      }
      if ((!rowValues[32] || rowValues[32] === "-" || isSalesSide) && existingRowData[32] && existingRowData[32] !== "-") {
        rowValues[32] = existingRowData[32];
      }
      var existingQuoteNo = (existingRowData[33] || existingRowData[36] || "").toString().trim();
      if ((!rowValues[33] || rowValues[33] === "-" || data.updatedBy !== "contract") && existingQuoteNo && existingQuoteNo !== "-") {
        rowValues[33] = existingQuoteNo;
        rowValues[36] = existingQuoteNo;
      }
      if ((!rowValues[34] || (rowValues[34] === "Draft" && data.updatedBy !== "contract") || (data.updatedBy !== "contract" && existingRowData[34])) && existingRowData[34] && existingRowData[34] !== "Draft") {
        rowValues[34] = existingRowData[34];
      }
      if ((!rowValues[35] || rowValues[35] === "-" || data.updatedBy !== "contract") && existingRowData[35] && existingRowData[35] !== "-") {
        rowValues[35] = existingRowData[35];
      }
      for (var qp = 1; qp <= 8; qp++) {
        var qpCol = 36 + qp;
        if ((!rowValues[qpCol] || data.updatedBy !== "contract") && existingRowData[qpCol]) {
          rowValues[qpCol] = existingRowData[qpCol];
        }
      }
      if ((!rowValues[45] || data.updatedBy !== "contract") && existingRowData[45]) {
        rowValues[45] = existingRowData[45];
      }

      applyPlainTextDateFormat(sheet, existingRowIndex);
      sheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      operationType = "updated";
    } else {
      existingRowIndex = sheet.getLastRow() + 1;
      applyPlainTextDateFormat(sheet, existingRowIndex);
      sheet.getRange(existingRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    }

    formatDataRow(sheet, existingRowIndex);

    // Catat snapshot transaksi online di History_Data
    appendOnlineHistory(
      ss,
      actorUsername,
      actorKey,
      deviceInfo,
      operationType === "updated" ? "UPDATE_DATA" : "SIMPAN_DATA_BARU",
      queueCode || "-",
      customerName + " / " + (data.projectName || data.namaProyek || "-"),
      rowValues[20] || "Masih Antrian Gambar",
      "Sales: " + rowValues[3] + " | Estimator: " + (rowValues[21] || "-") + " | SPH: " + (rowValues[33] || "-") + " (" + (rowValues[34] || "Draft") + ")"
    );

    var createdGasNotif = null;
    var gasNotifyType = (data.notifyEventType || "").toString().trim();
    var gasClientEventId = (data.clientEventId || "").toString().trim();
    if (gasNotifyType === "sales_form_new" || data.updatedBy === "sales_new" || (operationType === "inserted" && data.updatedBy !== "estimator" && data.updatedBy !== "contract")) {
      createdGasNotif = appendRealtimeNotificationGas(
        ss,
        "sales_form_new",
        "Form Gambar Proyek Baru Diinput Sales",
        rowValues[3] + " mengisi Form Gambar Proyek: " + queueCode + " - " + rowValues[4] + " (" + rowValues[5] + ")",
        rowValues[3] || actorUsername,
        queueCode || "-",
        rowValues[4] || "-",
        rowValues[5] || "-",
        rowValues[20] || "Masih Antrian Gambar",
        gasClientEventId
      );
    } else if (gasNotifyType === "sales_form_edit" || (data.updatedBy === "sales" && operationType === "updated")) {
      createdGasNotif = appendRealtimeNotificationGas(
        ss,
        "sales_form_edit",
        "Edit Perubahan Data Gambar Sales",
        rowValues[3] + " mengedit di Edit Perubahan: " + queueCode + " - " + rowValues[4] + " (" + rowValues[5] + ")",
        rowValues[3] || actorUsername,
        queueCode || "-",
        rowValues[4] || "-",
        rowValues[5] || "-",
        rowValues[20] || "Masih Antrian Gambar",
        gasClientEventId
      );
    } else if (gasNotifyType === "estimator_edit" || data.updatedBy === "estimator") {
      var gasEstActor = (rowValues[21] && rowValues[21] !== "(Belum dipilih)") ? rowValues[21] : actorUsername;
      createdGasNotif = appendRealtimeNotificationGas(
        ss,
        "estimator_edit",
        "Pembaruan Kelola Estimasi Estimator",
        gasEstActor + " mengedit Kelola Estimasi (" + rowValues[20] + "): " + queueCode + " - " + rowValues[4] + " (" + rowValues[5] + ")",
        gasEstActor,
        queueCode || "-",
        rowValues[4] || "-",
        rowValues[5] || "-",
        rowValues[20] || "Masih Antrian Gambar",
        gasClientEventId
      );
    } else if (gasNotifyType === "contract_edit" || data.updatedBy === "contract") {
      var gasContractActor = actorUsername || "Admin Kontrak";
      createdGasNotif = appendRealtimeNotificationGas(
        ss,
        "contract_edit",
        "Pembaruan Penawaran Admin Kontrak",
        gasContractActor + " memperbarui Admin Kontrak (" + rowValues[20] + "): " + queueCode + " - " + rowValues[4] + " (" + rowValues[5] + ")",
        gasContractActor,
        queueCode || "-",
        rowValues[4] || "-",
        rowValues[5] || "-",
        rowValues[20] || "Masih Antrian Gambar",
        gasClientEventId
      );
    }

    return createJsonResponse({
      status: "success",
      operation: operationType,
      queueCode: queueCode,
      rowNumber: existingRowIndex,
      customerFolderUrl: customerFolderUrl,
      filesUploaded: uploadedFiles,
      revFilesUploaded: revFilesUploaded,
      quoteFilesUploaded: quoteFilesUploaded,
      notification: createdGasNotif,
      message: "Data " + queueCode + " berhasil " + (operationType === "updated" ? "diperbarui" : "disimpan") + " di Spreadsheet & Google Drive!"
    });

  } catch (err) {
    Logger.log("Error doPost: " + err);
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Simpan / Perbarui Profil & Password Karyawan Online per Username
 */
function handleSaveUserProfile(data) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var usersSheet = getOrCreateUsersSheet(ss);

  var uKey = (data.userKey || data.username || "").toString().trim().toLowerCase();
  var uName = (data.username || uKey || "").toString().trim();
  var uRole = (data.role || "").toString().trim();
  var deviceName = (data.device || "-").toString().trim();
  var currentAuthHash = (data.currentAuthHash || data.oldPasswordHash || "").toString().trim().toLowerCase();
  var newPasswordHash = (data.newPasswordHash || "").toString().trim().toLowerCase();

  if (!uKey) {
    return createJsonResponse({ status: "error", message: "UserKey tidak valid." });
  }

  if (!verifyUserAuthHash(usersSheet, uKey, currentAuthHash)) {
    return createJsonResponse({ status: "error", message: "Verifikasi password akun tidak sesuai!" });
  }

  var rowIdx = findUserRowIndex(usersSheet, uKey);
  var existingProfile = (rowIdx > 0) ? readUserProfileObj(usersSheet, rowIdx) : null;

  var finalPassHash = newPasswordHash || (existingProfile && existingProfile.passwordHash) || computeAccountPasswordHash(uKey, "Agra123");
  var employeeId = (data.employeeId !== undefined) ? data.employeeId.toString().trim() : (existingProfile ? existingProfile.employeeId : "");
  var email = (data.email !== undefined) ? data.email.toString().trim() : (existingProfile ? existingProfile.email : "");
  var whatsapp = (data.whatsapp !== undefined) ? data.whatsapp.toString().trim() : (existingProfile ? existingProfile.whatsapp : "");
  var division = (data.division !== undefined) ? data.division.toString().trim() : (existingProfile ? existingProfile.division : "");

  var photoDriveUrl = existingProfile ? existingProfile.photoDriveUrl : "";
  var photoThumb = (data.photoThumbDataUrl && data.photoThumbDataUrl.toString().length <= 45000)
    ? data.photoThumbDataUrl.toString()
    : (existingProfile ? existingProfile.photoThumbDataUrl : "");
  var photoFileName = data.photoFileName ? data.photoFileName.toString() : (existingProfile ? existingProfile.photoFileName : "");
  var photoFileSize = (data.photoFileSize !== undefined && Number(data.photoFileSize) > 0)
    ? Number(data.photoFileSize)
    : (existingProfile ? existingProfile.photoFileSize : 0);

  if (data.photoBase64) {
    try {
      var cleanB64 = data.photoBase64.toString();
      if (cleanB64.indexOf("base64,") !== -1) cleanB64 = cleanB64.split("base64,")[1];
      var photoBytes = Utilities.base64Decode(cleanB64);
      var photoBlob = Utilities.newBlob(photoBytes, data.photoMimeType || "image/jpeg", (uKey + "_" + (photoFileName || "avatar.jpg")));
      var photoFolder = getOrCreateProfilePhotoFolder();
      var savedPhoto = photoFolder.createFile(photoBlob);
      try { savedPhoto.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (shErr) {}
      photoDriveUrl = savedPhoto.getUrl();
    } catch (pErr) {
      Logger.log("Gagal simpan foto profil ke Drive: " + pErr);
    }
  }

  var nowFormatted = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "dd/MM/yyyy HH:mm");
  var nowIso = new Date().toISOString();
  var rowVals = [
    uKey,
    uName || (existingProfile ? existingProfile.username : uKey),
    uRole || (existingProfile ? existingProfile.role : ""),
    finalPassHash,
    employeeId,
    email,
    whatsapp,
    division,
    photoDriveUrl,
    photoThumb,
    photoFileName,
    photoFileSize,
    (existingProfile && existingProfile.lastLoginAt) ? existingProfile.lastLoginAt : nowFormatted,
    deviceName || (existingProfile ? existingProfile.lastDevice : "-"),
    nowIso
  ];

  if (rowIdx <= 0) {
    rowIdx = usersSheet.getLastRow() + 1;
  }
  try {
    usersSheet.getRange(rowIdx, 5).setNumberFormat("@");
    usersSheet.getRange(rowIdx, 7).setNumberFormat("@");
    usersSheet.getRange(rowIdx, 13).setNumberFormat("@");
  } catch (fmtErr) {}
  usersSheet.getRange(rowIdx, 1, 1, USERS_HEADERS.length).setValues([rowVals]);

  appendOnlineHistory(
    ss,
    rowVals[1],
    uKey,
    deviceName,
    newPasswordHash ? "EDIT_PROFIL_&_PASSWORD" : "EDIT_PROFIL",
    "-",
    "Profil Karyawan: " + rowVals[1],
    "Tersimpan Online",
    "ID: " + (employeeId || "-") + " | Divisi: " + (division || "-") + " | Email: " + (email || "-") + " | WA: " + (whatsapp || "-")
  );

  var savedObj = readUserProfileObj(usersSheet, rowIdx);
  if (savedObj) delete savedObj.passwordHash;
  var historySheet = getOrCreateHistorySheet(ss);

  return createJsonResponse({
    status: "success",
    profile: savedObj,
    history: getRecentHistoryForUser(historySheet, uKey, rowVals[2], 80),
    message: "Profil & kredensial akun " + rowVals[1] + " berhasil disinkronkan secara online!"
  });
}

/**
 * Ekstraksi Link URL Murni Supaya Bisa Diklik di Spreadsheet
 */
function extractCleanUrl(val) {
  if (!val) return "";
  var str = val.toString().trim();
  if (str.indexOf("http://") === 0 || str.indexOf("https://") === 0) return str;
  if (str.indexOf("http") !== -1) {
    var match = str.match(/https?:\/\/[^\s\)\;]+/);
    if (match) return match[0];
  }
  return "";
}

/**
 * Mendapatkan folder fallback (parent folder spreadsheet atau Root Drive)
 */
function getFallbackRootFolder() {
  if (CONFIG.ROOT_FOLDER_ID) {
    try {
      return DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    } catch (e) {}
  }
  try {
    var parents = DriveApp.getFileById(CONFIG.SPREADSHEET_ID).getParents();
    if (parents.hasNext()) return parents.next();
  } catch (e2) {}
  return DriveApp.getRootFolder();
}

/**
 * Mendapatkan Folder ID Sales berdasarkan nama sales
 */
function getSalesFolderId(salesName) {
  var s = (salesName || "").toString().toLowerCase().trim();
  if (s.indexOf("rini") !== -1) {
    return CONFIG.SALES_FOLDERS["rini"];
  } else if (s.indexOf("priyo") !== -1) {
    return CONFIG.SALES_FOLDERS["priyo"];
  } else if (s.indexOf("samuel") !== -1) {
    return CONFIG.SALES_FOLDERS["samuel"];
  }
  return getFallbackRootFolder().getId();
}

/**
 * Otomatis mencari atau membuat folder customer di dalam folder sales terkait
 */
function getOrCreateCustomerFolder(salesFolderId, customerName) {
  var salesFolder = null;
  if (salesFolderId) {
    try {
      salesFolder = DriveApp.getFolderById(salesFolderId);
    } catch (err1) {
      Logger.log("Folder sales (ID: " + salesFolderId + ") tidak dapat dibuka: " + err1);
    }
  }
  if (!salesFolder) {
    salesFolder = getFallbackRootFolder();
  }

  var folderName = (customerName || "Customer Proyek").toString().replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  if (!folderName) folderName = "Customer Proyek";
  try {
    var subFolders = salesFolder.getFoldersByName(folderName);
    if (subFolders.hasNext()) {
      return subFolders.next();
    } else {
      var newFolder = salesFolder.createFolder(folderName);
      try {
        newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}
      return newFolder;
    }
  } catch (err3) {
    Logger.log("Gagal membuat subfolder customer: " + err3);
    return null;
  }
}

/**
 * Normalisasi kode antrian lama (APS-PU0001/SM0002/RN0003) ke format APS-XX2027xxxx
 */
function normalizeQueueCodeTo2027Gas(codeStr, salesName) {
  var s = (codeStr || "").toString().trim();
  if (!s || s === "-") return s;
  if (/^APS-(?:RN|PU|SM|SL|GN)20\d{2}\d{4,}$/i.test(s)) {
    return s.toUpperCase();
  }
  var m = s.match(/^(APS-(?:RN|PU|SM|SL|GN))(\d{1,6})$/i);
  if (m) {
    var seq = String(parseInt(m[2], 10) || 1);
    while (seq.length < 4) seq = "0" + seq;
    return m[1].toUpperCase() + "2027" + seq;
  }
  var md = s.match(/^(APS-(?:RN|PU|SM|SL|GN))-(\d{1,6})$/i);
  if (md) {
    var dSeq = String(parseInt(md[2], 10) || 1);
    while (dSeq.length < 4) dSeq = "0" + dSeq;
    return md[1].toUpperCase() + "2027" + dSeq;
  }
  if (salesName && /^APS-\d{1,6}$/i.test(s)) {
    var sn = (salesName || "").toString().toLowerCase();
    var pfx = sn.indexOf("rini") !== -1 ? "APS-RN2027" : (sn.indexOf("priyo") !== -1 ? "APS-PU2027" : (sn.indexOf("samuel") !== -1 ? "APS-SM2027" : "APS-SL2027"));
    var numPart = String(parseInt(s.replace(/\D+/g, ""), 10) || 1);
    while (numPart.length < 4) numPart = "0" + numPart;
    return pfx + numPart;
  }
  return s;
}

/**
 * Mencari indeks baris berdasarkan kode antrian
 */
function findRowIndexByQueue(sheet, queueCode) {
  if (!queueCode || queueCode === "-") return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var targetNorm = normalizeQueueCodeTo2027Gas(queueCode);
  var queueValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < queueValues.length; i++) {
    if (queueValues[i][0] && normalizeQueueCodeTo2027Gas(queueValues[i][0]) === targetNorm) {
      return i + 2;
    }
  }
  return -1;
}

/**
 * Menghasilkan kode antrian bebas tabrakan jika dua perangkat mengirim data baru bersamaan
 */
function getNextFreeQueueCode(sheet, baseQueueCode) {
  var raw = (baseQueueCode || "").toString().trim();
  var lastRow = sheet.getLastRow();
  var usedCodes = {};
  var maxNum = 0;

  if (lastRow >= 2) {
    var colVals = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < colVals.length; i++) {
      var codeStr = colVals[i][0] ? colVals[i][0].toString().trim() : "";
      if (!codeStr || codeStr === "-") continue;
      usedCodes[codeStr] = true;
      var numMatch = codeStr.match(/^[A-Za-z]+-[A-Za-z]+20\d{2}(\d+)$/) || codeStr.match(/(\d+)$/);
      if (numMatch) {
        var nVal = parseInt(numMatch[1], 10);
        if (!isNaN(nVal) && nVal > maxNum) maxNum = nVal;
      }
    }
  }

  var baseMatch = raw.match(/^([A-Za-z]+-[A-Za-z]+20\d{2})(\d+)$/) || raw.match(/^(.*?)(\d+)$/);
  if (baseMatch) {
    var prefix = baseMatch[1];
    var origNum = parseInt(baseMatch[2], 10) || 0;
    var padLen = Math.max(4, baseMatch[2].length);
    var nextNum = Math.max(maxNum + 1, origNum + 1);
    while (true) {
      var numStr = String(nextNum);
      while (numStr.length < padLen) numStr = "0" + numStr;
      var candidate = prefix + numStr;
      if (!usedCodes[candidate]) return candidate;
      nextNum++;
    }
  }

  var fallbackPrefix = raw || "APS-GN2027";
  var suffix = maxNum + 1;
  while (true) {
    var fbNum = String(suffix);
    while (fbNum.length < 4) fbNum = "0" + fbNum;
    var fbCandidate = fallbackPrefix + fbNum;
    if (!usedCodes[fbCandidate]) return fbCandidate;
    suffix++;
  }
}

/**
 * Dapatkan atau buat Sheet target
 */
function getOrCreateSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

/**
 * Inisialisasi header baris pertama jika sheet kosong atau tambahkan kolom baru jika belum lengkap
 */
function setupHeadersIfEmpty(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground("#20409a");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setFontSize(10);
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    headerRange.setWrap(true);
    sheet.setRowHeight(1, 40);
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(6);

    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 120);
    sheet.setColumnWidth(3, 130);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 200);
    sheet.setColumnWidth(6, 220);
    sheet.setColumnWidth(7, 240);
    sheet.setColumnWidth(8, 160);
    sheet.setColumnWidth(9, 120);
    sheet.setColumnWidth(10, 150);
    sheet.setColumnWidth(11, 220);
    sheet.setColumnWidth(12, 240);
    sheet.setColumnWidth(21, 160);
    sheet.setColumnWidth(22, 150);
    sheet.setColumnWidth(34, 180);
    sheet.setColumnWidth(35, 160);
    sheet.setColumnWidth(37, 180);
    sheet.setColumnWidth(46, 200);
  } else {
    var curCols = sheet.getLastColumn();
    if (curCols < HEADERS.length) {
      var missingCount = HEADERS.length - curCols;
      var missingHeaders = HEADERS.slice(curCols);
      var newHdrRange = sheet.getRange(1, curCols + 1, 1, missingCount);
      newHdrRange.setValues([missingHeaders]);
      newHdrRange.setBackground("#20409a");
      newHdrRange.setFontColor("#ffffff");
      newHdrRange.setFontWeight("bold");
      newHdrRange.setFontSize(10);
      newHdrRange.setHorizontalAlignment("center");
      newHdrRange.setVerticalAlignment("middle");
      newHdrRange.setWrap(true);
      for (var c = curCols + 1; c <= HEADERS.length; c++) {
        sheet.setColumnWidth(c, 180);
      }
    }
  }
}

/**
 * Format baris data
 */
function formatDataRow(sheet, rowIndex) {
  try {
    var range = sheet.getRange(rowIndex, 1, 1, HEADERS.length);
    range.setFontFamily("Plus Jakarta Sans, Arial, sans-serif");
    range.setFontSize(9);
    range.setVerticalAlignment("middle");

    applyPlainTextDateFormat(sheet, rowIndex);

    if (rowIndex % 2 === 0) {
      range.setBackground("#f8fafc");
    } else {
      range.setBackground("#ffffff");
    }

    sheet.getRange(rowIndex, 2).setFontFamily("JetBrains Mono, monospace").setFontWeight("bold").setFontColor("#1e3a8a");
  } catch (e) {}
}

/**
 * Handle Simpan File CSV Langsung ke Drive
 */
function handleSaveCsvToDrive(data) {
  var targetFolder = null;
  var targetFolderId = (data.folderId || CONFIG.ROOT_FOLDER_ID || "").toString().trim();
  if (targetFolderId) {
    try {
      targetFolder = DriveApp.getFolderById(targetFolderId);
    } catch (fErr) {}
  }
  if (!targetFolder) {
    targetFolder = getFallbackRootFolder();
    targetFolderId = targetFolder.getId();
  }
  var cleanB64 = data.fileData;
  if (cleanB64.indexOf("base64,") !== -1) {
    cleanB64 = cleanB64.split("base64,")[1];
  }
  var csvBytes = Utilities.base64Decode(cleanB64);
  var csvBlob = Utilities.newBlob(csvBytes, data.mimeType || "text/csv", data.fileName || "Antrian_Gambar_Estimator.csv");
  var createdCsv = targetFolder.createFile(csvBlob);
  try {
    createdCsv.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shErr) {}
  
  return createJsonResponse({
    status: "success",
    message: "File CSV berhasil disimpan ke Google Drive!",
    fileId: createdCsv.getId(),
    fileUrl: createdCsv.getUrl(),
    folderId: targetFolderId
  });
}

/**
 * Handle Simpan Massal (Batch Save)
 */
function handleBatchSave(records, actorUsername, actorKey, deviceInfo) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = getOrCreateSheet(ss);
  setupHeadersIfEmpty(sheet);

  var updatedCount = 0;
  var insertedCount = 0;

  for (var r = 0; r < records.length; r++) {
    var item = records[r];
    var qCode = normalizeQueueCodeTo2027Gas(item.queueCode || "", item.salesName || "");
    var existingIdx = findRowIndexByQueue(sheet, qCode);
    var isNewItem = (item.isNewInsert === true || item.isNewInsert === "true");
    if (existingIdx > 0 && isNewItem) {
      qCode = getNextFreeQueueCode(sheet, qCode);
      existingIdx = -1;
    }

    var qNoVal = (item.quoteNumber || "-").toString().trim() || "-";
    var rowVals = [
      formatGasDateTimeDMY(item.uploadDateTime || new Date()),
      qCode,
      formatGasDateTimeDMY(item.uploadDateTime || new Date()) || "-",
      item.salesName || "-",
      item.customerName || "-",
      item.projectName || "-",
      item.scopeOfWork || "-",
      item.projectMaterial || "-",
      formatGasDateDMY(item.requestDeadline || "-") || "-",
      item.sourceDesc || "-",
      item.customerFolderUrl || "-",
      extractCleanUrl(item.docsText) || extractCleanUrl(item.extraImg1) || item.customerFolderUrl || "-",
      extractCleanUrl(item.extraImg1),
      extractCleanUrl(item.extraImg2),
      extractCleanUrl(item.extraImg3),
      extractCleanUrl(item.extraImg4),
      extractCleanUrl(item.extraImg5),
      extractCleanUrl(item.extraImg6),
      extractCleanUrl(item.extraImg7),
      extractCleanUrl(item.extraImg8),
      item.status || "Masih Antrian Gambar",
      item.estimatorName || "(Belum dipilih)",
      formatGasDateDMY(item.estimateStartDate || "-") || "-",
      formatGasDateDMY(item.estimateEndDate || "-") || "-",
      item.revGambar1 || "",
      item.revGambar2 || "",
      item.revGambar3 || "",
      item.revGambar4 || "",
      item.revGambar5 || "",
      item.revGambar6 || "",
      item.revGambar7 || "",
      item.revGambar8 || "",
      item.estimatorNotes || "-",
      qNoVal,
      item.quoteStatus || "Draft",
      item.quoteNotes || "-",
      qNoVal,
      item.quoteRev1 || "",
      item.quoteRev2 || "",
      item.quoteRev3 || "",
      item.quoteRev4 || "",
      item.quoteRev5 || "",
      item.quoteRev6 || "",
      item.quoteRev7 || "",
      item.quoteRev8 || "",
      item.quoteFinalDoc || "",
      item.salesNotes || "",
      JSON.stringify(mergeNotesHistoryGas([], item.salesNotesHistory)),
      JSON.stringify(mergeNotesHistoryGas([], item.estimatorNotesHistory)),
      JSON.stringify(mergeNotesHistoryGas([], item.unifiedChatHistory))
    ];

    if (existingIdx > 0) {
      applyPlainTextDateFormat(sheet, existingIdx);
      sheet.getRange(existingIdx, 1, 1, rowVals.length).setValues([rowVals]);
      formatDataRow(sheet, existingIdx);
      updatedCount++;
    } else {
      var nextRowIdx = sheet.getLastRow() + 1;
      applyPlainTextDateFormat(sheet, nextRowIdx);
      sheet.getRange(nextRowIdx, 1, 1, rowVals.length).setValues([rowVals]);
      formatDataRow(sheet, nextRowIdx);
      insertedCount++;
    }
  }

  appendOnlineHistory(
    ss,
    actorUsername || "Sistem",
    actorKey || "-",
    deviceInfo || "-",
    "SINKRON_MASSAL",
    "-",
    records.length + " baris data proyek",
    "Berhasil",
    "Inserted: " + insertedCount + ", Updated: " + updatedCount
  );

  return createJsonResponse({
    status: "success",
    message: "Berhasil sinkronisasi massal (" + insertedCount + " baru, " + updatedCount + " diperbarui).",
    inserted: insertedCount,
    updated: updatedCount
  });
}

/**
 * Ambil seluruh data baris sheet sebagai JSON
 */
function getAllRowsAsJSON(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var lastCol = Math.min(sheet.getLastColumn(), HEADERS.length);
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var records = [];

  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    var qNoSheet = (v[33] && v[33].toString() !== "-") ? v[33].toString() : (v[36] ? v[36].toString() : (v[33] ? v[33].toString() : ""));
    var rawQueueVal = v[1] ? v[1].toString().trim() : "";
    var normQueueVal = normalizeQueueCodeTo2027Gas(rawQueueVal, v[3]);
    if (rawQueueVal && normQueueVal && normQueueVal !== rawQueueVal) {
      try { sheet.getRange(i + 2, 2).setValue(normQueueVal); } catch (eQ) {}
    }
    records.push({
      id: "REC-" + (i + 1),
      uploadDateTime: formatGasDateTimeDMY(v[0] || v[2] || ""),
      queueCode: normQueueVal,
      salesName: v[3] ? v[3].toString() : "",
      customerName: v[4] ? v[4].toString() : "",
      projectName: v[5] ? v[5].toString() : "",
      scopeOfWork: v[6] ? v[6].toString() : "",
      projectMaterial: v[7] ? v[7].toString() : "",
      requestDeadline: formatGasDateDMY(v[8]),
      sourceDesc: v[9] ? v[9].toString() : "",
      customerFolderUrl: v[10] ? v[10].toString() : "",
      docsText: v[11] ? v[11].toString() : "",
      extraImg1: v[12] ? v[12].toString() : "",
      extraImg2: v[13] ? v[13].toString() : "",
      extraImg3: v[14] ? v[14].toString() : "",
      extraImg4: v[15] ? v[15].toString() : "",
      extraImg5: v[16] ? v[16].toString() : "",
      extraImg6: v[17] ? v[17].toString() : "",
      extraImg7: v[18] ? v[18].toString() : "",
      extraImg8: v[19] ? v[19].toString() : "",
      status: v[20] ? v[20].toString() : "Masih Antrian Gambar",
      estimatorName: v[21] ? v[21].toString() : "",
      estimateStartDate: formatGasDateDMY(v[22]),
      estimateEndDate: formatGasDateDMY(v[23]),
      revGambar1: v[24] ? v[24].toString() : "",
      revGambar2: v[25] ? v[25].toString() : "",
      revGambar3: v[26] ? v[26].toString() : "",
      revGambar4: v[27] ? v[27].toString() : "",
      revGambar5: v[28] ? v[28].toString() : "",
      revGambar6: v[29] ? v[29].toString() : "",
      revGambar7: v[30] ? v[30].toString() : "",
      revGambar8: v[31] ? v[31].toString() : "",
      estimatorNotes: v[32] ? v[32].toString() : "",
      quoteNumber: qNoSheet,
      quoteStatus: v[34] ? v[34].toString() : "Draft",
      quoteNotes: v[35] ? v[35].toString() : "",
      quoteRev1: v[37] ? v[37].toString() : "",
      quoteRev2: v[38] ? v[38].toString() : "",
      quoteRev3: v[39] ? v[39].toString() : "",
      quoteRev4: v[40] ? v[40].toString() : "",
      quoteRev5: v[41] ? v[41].toString() : "",
      quoteRev6: v[42] ? v[42].toString() : "",
      quoteRev7: v[43] ? v[43].toString() : "",
      quoteRev8: v[44] ? v[44].toString() : "",
      quoteFinalDoc: v[45] ? v[45].toString() : "",
      salesNotes: v[46] ? v[46].toString() : "",
      salesNotesHistory: parseNotesHistoryJsonGas(v[47]),
      estimatorNotesHistory: parseNotesHistoryJsonGas(v[48]),
      unifiedChatHistory: parseNotesHistoryJsonGas(v[49])
    });
  }
  return records;
}

/**
 * Helper JSON Response
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
