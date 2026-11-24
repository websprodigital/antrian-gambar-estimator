<?php
/**
 * ============================================================================
 * ANTRIAN GAMBAR ESTIMATOR & ADMIN KONTRAK - CLOUD DATABASE API (api.php)
 * ============================================================================
 * Menyimpan seluruh data proyek (Sheet1), akun & profil karyawan, foto profil,
 * berkas PDF/Gambar (uploads_estimator/), dan riwayat aktivitas (History_Data)
 * secara terpusat, atomic (flock LOCK_EX), dan permanen di server hosting.
 *
 * Menjamin 100% data tersinkronisasi otomatis di seluruh perangkat:
 * Handphone (Android/iOS), Laptop, Komputer Kantor, maupun komputer lain.
 */

date_default_timezone_set('Asia/Jakarta');

// Header CORS & Anti-Cache agar selalu sinkron real-time di semua perangkat
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

// Tangani Pre-flight CORS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(200);
    echo json_encode(['success' => true, 'status' => 'success']);
    exit;
}

// Konfigurasi File Database Terproteksi & Folder Upload di Hosting
$dbFile = __DIR__ . '/db_estimator_store.json.php';
$legacyMillagenFile = __DIR__ . '/db_millagen_store.json.php';
$uploadDir = __DIR__ . '/uploads_estimator';
$securityHeader = '<' . '?php exit; ?' . '>' . "\n";
define('AUTH_HASH_SALT', 'AGRA_ESTIMATOR_2026');

/**
 * Respon JSON seragam
 */
function sendJsonResponse($payload, $httpCode = 200) {
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Pastikan direktori upload aman tersedia
 */
function ensureUploadDirSafe($dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (is_dir($dir)) {
        $guardIndex = $dir . '/index.php';
        if (!file_exists($guardIndex)) {
            @file_put_contents($guardIndex, "<?php http_response_code(403); exit;\n");
        }
        $htaccess = $dir . '/.htaccess';
        if (!file_exists($htaccess)) {
            @file_put_contents($htaccess, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|php3|php4|php5|php7|php8|cgi|pl|py|sh|html|htm|js)$\">\n  Require all denied\n</FilesMatch>\n");
        }
    }
}

/**
 * Bangun URL lengkap api.php saat ini untuk akses file lintas perangkat
 */
function buildApiBaseUrl() {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
    $scheme = $isHttps ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '/api.php';
    if ($host) {
        return $scheme . '://' . $host . $scriptName;
    }
    return 'api.php';
}

/**
 * Struktur default store terpusat
 */
function createDefaultStore() {
    return [
        'schemaVersion' => 1,
        'updatedAt' => time(),
        'records' => [],
        'usersProfiles' => [],
        'history' => [],
        'notifications' => [],
        'vapidKeys' => [],
        'pushSubscriptions' => []
    ];
}

/**
 * Eksekusi transaksi read/write database secara atomic dengan file lock (flock)
 */
function withDatabaseStore(callable $callback, $writeMode = true) {
    global $dbFile, $securityHeader;

    $dir = dirname($dbFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $fp = @fopen($dbFile, $writeMode ? 'c+' : 'r');
    if (!$fp && !$writeMode && !file_exists($dbFile)) {
        $defaultStore = createDefaultStore();
        return $callback($defaultStore, false);
    }
    if (!$fp) {
        return ['error' => 'Gagal membuka file database hosting. Pastikan permission folder dapat ditulisi (chmod 755/775).'];
    }

    $lockType = $writeMode ? LOCK_EX : LOCK_SH;
    if (!flock($fp, $lockType)) {
        fclose($fp);
        return ['error' => 'Gagal mengunci file database untuk sinkronisasi.'];
    }

    $raw = stream_get_contents($fp);
    $store = null;
    if ($raw !== false && $raw !== '') {
        if (strpos($raw, $securityHeader) === 0) {
            $raw = substr($raw, strlen($securityHeader));
        }
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $store = $decoded;
        }
    }

    if (!is_array($store)) {
        $store = createDefaultStore();
    }
    if (!isset($store['records']) || !is_array($store['records'])) {
        $store['records'] = [];
    }
    if (!isset($store['usersProfiles']) || !is_array($store['usersProfiles'])) {
        $store['usersProfiles'] = [];
    }
    if (!isset($store['history']) || !is_array($store['history'])) {
        $store['history'] = [];
    }
    if (!isset($store['notifications']) || !is_array($store['notifications'])) {
        $store['notifications'] = [];
    }
    if (!isset($store['vapidKeys']) || !is_array($store['vapidKeys'])) {
        $store['vapidKeys'] = [];
    }
    if (!isset($store['pushSubscriptions']) || !is_array($store['pushSubscriptions'])) {
        $store['pushSubscriptions'] = [];
    }

    $migratedQueue = false;
    foreach ($store['records'] as &$rRef) {
        if (is_array($rRef) && !empty($rRef['queueCode'])) {
            $normQ = normalizeQueueCodeTo2027($rRef['queueCode'], $rRef['salesName'] ?? '');
            if ($normQ !== $rRef['queueCode']) {
                $rRef['queueCode'] = $normQ;
                $migratedQueue = true;
            }
        }
    }
    unset($rRef);
    foreach ($store['history'] as &$hRef) {
        if (is_array($hRef) && !empty($hRef['queueCode'])) {
            $normHQ = normalizeQueueCodeTo2027($hRef['queueCode']);
            if ($normHQ !== $hRef['queueCode']) {
                $hRef['queueCode'] = $normHQ;
                $migratedQueue = true;
            }
        }
    }
    unset($hRef);
    foreach ($store['notifications'] as &$nRef) {
        if (is_array($nRef) && !empty($nRef['queueCode'])) {
            $normNQ = normalizeQueueCodeTo2027($nRef['queueCode']);
            if ($normNQ !== $nRef['queueCode']) {
                $nRef['queueCode'] = $normNQ;
                $migratedQueue = true;
            }
        }
    }
    unset($nRef);

    $shouldSave = false;
    $result = $callback($store, $shouldSave);
    if ($migratedQueue) {
        $shouldSave = true;
    }

    if ($writeMode && $shouldSave) {
        $store['updatedAt'] = time();
        $storeToEncode = $store;
        if (empty($storeToEncode['usersProfiles'])) {
            $storeToEncode['usersProfiles'] = new stdClass();
        }
        $json = json_encode($storeToEncode, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json !== false) {
            rewind($fp);
            ftruncate($fp, 0);
            fwrite($fp, $securityHeader . $json);
            fflush($fp);
        }
    }

    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
}

/**
 * Format tanggal/waktu WIB dd/mm/yyyy HH:ii
 */
function formatDateTimeDMY($val = null) {
    if ($val === null || $val === '') {
        return date('d/m/Y H:i');
    }
    $s = trim((string)$val);
    if ($s === '' || $s === '-') {
        return '-';
    }
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/', $s)) {
        return substr($s, 0, 16);
    }
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/', $s, $m)) {
        return $m[3] . '/' . $m[2] . '/' . $m[1] . ' ' . $m[4] . ':' . $m[5];
    }
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $s)) {
        return $s . ' 00:00';
    }
    $ts = strtotime($s);
    return $ts ? date('d/m/Y H:i', $ts) : $s;
}

function formatDateDMY($val = null) {
    if ($val === null || $val === '') {
        return '-';
    }
    $s = trim((string)$val);
    if ($s === '' || $s === '-') {
        return '-';
    }
    if (preg_match('/^(\d{2}\/\d{2}\/\d{4})/', $s, $m)) {
        return $m[1];
    }
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $s, $m)) {
        return $m[3] . '/' . $m[2] . '/' . $m[1];
    }
    $ts = strtotime($s);
    return $ts ? date('d/m/Y', $ts) : $s;
}

/**
 * Hitung hash SHA-256 akun (identik dengan GoogleAppsScript_Code.js & index.html)
 */
function computeAccountPasswordHash($userKey, $plainPassword) {
    $normKey = strtolower(trim((string)$userKey));
    return hash('sha256', AUTH_HASH_SALT . ':' . $normKey . ':' . (string)$plainPassword);
}

/**
 * Verifikasi authHash user
 */
function verifyUserAuthHash($store, $userKey, $providedHash) {
    $normKey = strtolower(trim((string)$userKey));
    $cleanProvided = strtolower(trim((string)$providedHash));
    if (!$normKey || strlen($cleanProvided) !== 64) {
        return false;
    }
    $expected = computeAccountPasswordHash($normKey, 'Agra123');
    if (isset($store['usersProfiles'][$normKey]['passwordHash'])) {
        $storedHash = strtolower(trim((string)$store['usersProfiles'][$normKey]['passwordHash']));
        if (strlen($storedHash) === 64) {
            $expected = $storedHash;
        }
    }
    return hash_equals($expected, $cleanProvided);
}

/**
 * Tambahkan entri riwayat online ke store (terbaru di atas)
 */
function appendOnlineHistory(&$store, $username, $userKey, $device, $activity, $queueCode, $subject, $status, $detail) {
    $entry = [
        'timestamp' => date('d/m/Y H:i:s'),
        'username' => trim((string)$username) ?: '-',
        'userKey' => strtolower(trim((string)$userKey)),
        'device' => trim((string)$device) ?: '-',
        'activity' => trim((string)$activity) ?: 'AKTIVITAS',
        'queueCode' => trim((string)$queueCode) ?: '-',
        'subject' => trim((string)$subject) ?: '-',
        'status' => trim((string)$status) ?: '-',
        'detail' => trim((string)$detail) ?: ''
    ];
    array_unshift($store['history'], $entry);
    if (count($store['history']) > 500) {
        $store['history'] = array_slice($store['history'], 0, 500);
    }
}

/**
 * Cek apakah status masih tahap antrian awal
 */
function isInitialQueueStatus($status) {
    $s = strtolower(trim((string)$status));
    return ($s === '' || $s === '-' || $s === 'belum edit' || $s === 'masih antrian gambar' || $s === 'antrian gambar');
}

/**
 * Gabungkan array riwayat catatan tanpa duplikasi
 */
function mergeNotesHistoryArrays($existingHist, $incomingHist) {
    $listA = is_array($existingHist) ? $existingHist : [];
    $listB = is_array($incomingHist) ? $incomingHist : [];
    $seenIds = [];
    $seenSigs = [];
    $merged = [];
    foreach (array_merge($listA, $listB) as $item) {
        if (!is_array($item)) continue;
        $txt = trim((string)($item['text'] ?? ''));
        if ($txt === '' || $txt === '-') continue;
        $msgId = trim((string)($item['id'] ?? ''));
        $ts = trim((string)($item['timestamp'] ?? ''));
        $author = trim((string)($item['author'] ?? ''));
        $role = trim((string)($item['role'] ?? ''));
        $roleLabel = trim((string)($item['roleLabel'] ?? ''));
        $sourceMenu = trim((string)($item['sourceMenu'] ?? ''));
        $createdAtMs = intval($item['createdAtMs'] ?? 0);
        $isEditNotif = !empty($item['isEditNotif']) || (preg_match('/Telah Melakukan Edit Data (Penawaran|Estimator|Sales)/i', $txt) === 1);
        $sig = $ts . '|' . $author . '|' . $txt;
        if (($msgId !== '' && isset($seenIds[$msgId])) || (($msgId === '' || !$isEditNotif) && isset($seenSigs[$sig]))) continue;
        if ($msgId !== '') $seenIds[$msgId] = true;
        $seenSigs[$sig] = true;
        $entry = [
            'timestamp' => $ts ?: date('d/m/Y H : i : s'),
            'author' => $author ?: '-',
            'text' => $txt
        ];
        if ($msgId !== '') $entry['id'] = $msgId;
        if ($isEditNotif) $entry['isEditNotif'] = true;
        if ($role !== '') $entry['role'] = $role;
        if ($roleLabel !== '') $entry['roleLabel'] = $roleLabel;
        if ($sourceMenu !== '') $entry['sourceMenu'] = $sourceMenu;
        if ($createdAtMs > 0) $entry['createdAtMs'] = $createdAtMs;
        if (isset($item['replyTo']) && is_array($item['replyTo'])) {
            $entry['replyTo'] = $item['replyTo'];
        }
        if (isset($item['media']) && is_array($item['media'])) {
            $entry['media'] = $item['media'];
        }
        $merged[] = $entry;
    }
    usort($merged, function ($a, $b) {
        $ta = intval($a['createdAtMs'] ?? 0);
        $tb = intval($b['createdAtMs'] ?? 0);
        if ($ta === $tb) return 0;
        return ($ta < $tb) ? -1 : 1;
    });
    if (count($merged) > 150) {
        return array_slice($merged, -150);
    }
    return $merged;
}

/**
 * Tambahkan notifikasi real-time lintas perangkat & lintas tab ke store
 */
function appendRealtimeNotification(&$store, $eventType, $title, $message, $actor, $queueCode, $customerName, $projectName, $status, $clientEventId = '') {
    if (!isset($store['notifications']) || !is_array($store['notifications'])) {
        $store['notifications'] = [];
    }
    $cleanId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$clientEventId);
    if ($cleanId === '') {
        try {
            $randPart = bin2hex(random_bytes(3));
        } catch (Exception $e) {
            $randPart = substr(md5(uniqid('', true)), 0, 6);
        }
        $cleanId = 'NTF-' . (int)round(microtime(true) * 1000) . '-' . $randPart;
    }
    foreach ($store['notifications'] as $ex) {
        if (($ex['id'] ?? '') === $cleanId) {
            return $ex;
        }
    }
    $entry = [
        'id' => $cleanId,
        'createdAtMs' => (int)round(microtime(true) * 1000),
        'timestamp' => date('d/m/Y H:i:s'),
        'eventType' => trim((string)$eventType) ?: 'activity',
        'title' => trim((string)$title) ?: 'Notifikasi Aktivitas Proyek',
        'message' => trim((string)$message) ?: '-',
        'actor' => trim((string)$actor) ?: 'Sistem',
        'queueCode' => trim((string)$queueCode) ?: '-',
        'customerName' => trim((string)$customerName) ?: '-',
        'projectName' => trim((string)$projectName) ?: '-',
        'status' => trim((string)$status) ?: '-'
    ];
    array_unshift($store['notifications'], $entry);
    if (count($store['notifications']) > 150) {
        $store['notifications'] = array_slice($store['notifications'], 0, 150);
    }
    return $entry;
}

/**
 * Base64URL encode tanpa padding (=) sesuai RFC 7515 / RFC 8291 / RFC 8292
 */
function pushBase64UrlEncode($data) {
    return rtrim(strtr(base64_encode((string)$data), '+/', '-_'), '=');
}

/**
 * Base64URL decode aman
 */
function pushBase64UrlDecode($data) {
    $b64 = strtr(trim((string)$data), '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad > 0) {
        $b64 .= str_repeat('=', 4 - $pad);
    }
    $decoded = base64_decode($b64, true);
    return $decoded === false ? '' : $decoded;
}

/**
 * Pastikan pasangan kunci VAPID P-256 (EC prime256v1) tersimpan dan valid di store
 */
function ensureVapidKeys(&$store, &$shouldSave) {
    $vk = is_array($store['vapidKeys'] ?? null) ? $store['vapidKeys'] : [];
    $pub = trim((string)($vk['publicKeyB64'] ?? ''));
    $privPem = (string)($vk['privatePem'] ?? '');
    if ($pub !== '' && $privPem !== '') {
        $privRes = @openssl_pkey_get_private($privPem);
        $rawPub = pushBase64UrlDecode($pub);
        if ($privRes !== false && strlen($rawPub) === 65 && ord($rawPub[0]) === 0x04) {
            return ['publicKeyB64' => $pub, 'privatePem' => $privPem];
        }
    }

    $ecKey = openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC
    ]);
    if ($ecKey === false) {
        return ['publicKeyB64' => '', 'privatePem' => ''];
    }
    $exportedPem = '';
    openssl_pkey_export($ecKey, $exportedPem);
    $details = openssl_pkey_get_details($ecKey);
    $x = str_pad((string)($details['ec']['x'] ?? ''), 32, "\x00", STR_PAD_LEFT);
    $y = str_pad((string)($details['ec']['y'] ?? ''), 32, "\x00", STR_PAD_LEFT);
    $uncompressed = "\x04" . substr($x, -32) . substr($y, -32);
    $pubB64 = pushBase64UrlEncode($uncompressed);

    $store['vapidKeys'] = [
        'publicKeyB64' => $pubB64,
        'privatePem' => $exportedPem,
        'createdAt' => time()
    ];
    $shouldSave = true;
    return ['publicKeyB64' => $pubB64, 'privatePem' => $exportedPem];
}

/**
 * Konversi tanda tangan ECDSA ASN.1 DER menjadi IEEE P1363 raw 64-byte (R || S)
 */
function derToRawEcdsa64($der) {
    $len = strlen($der);
    if ($len < 8 || ord($der[0]) !== 0x30) {
        return false;
    }
    $offset = 2;
    if ((ord($der[1]) & 0x80) !== 0) {
        $lenBytes = ord($der[1]) & 0x7f;
        $offset = 2 + $lenBytes;
    }
    if ($offset >= $len || ord($der[$offset]) !== 0x02) {
        return false;
    }
    $rLen = ord($der[$offset + 1]);
    $r = substr($der, $offset + 2, $rLen);
    $offset = $offset + 2 + $rLen;
    if ($offset >= $len || ord($der[$offset]) !== 0x02) {
        return false;
    }
    $sLen = ord($der[$offset + 1]);
    $s = substr($der, $offset + 2, $sLen);

    $rClean = ltrim($r, "\x00");
    $sClean = ltrim($s, "\x00");
    $r32 = str_pad(substr($rClean, -32), 32, "\x00", STR_PAD_LEFT);
    $s32 = str_pad(substr($sClean, -32), 32, "\x00", STR_PAD_LEFT);
    return $r32 . $s32;
}

/**
 * Buat VAPID JWT ES256 sesuai RFC 8292
 */
function createVapidJwt($endpoint, $privatePem, $subject = 'mailto:notifikasi@estimator-proyek.local') {
    $parts = @parse_url($endpoint);
    if (!is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
        return '';
    }
    $aud = $parts['scheme'] . '://' . $parts['host'] . (!empty($parts['port']) ? ':' . $parts['port'] : '');
    $headerB64 = pushBase64UrlEncode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payloadB64 = pushBase64UrlEncode(json_encode([
        'aud' => $aud,
        'exp' => time() + 43200,
        'sub' => $subject
    ], JSON_UNESCAPED_SLASHES));
    $signingInput = $headerB64 . '.' . $payloadB64;

    $privRes = @openssl_pkey_get_private($privatePem);
    if ($privRes === false) {
        return '';
    }
    $derSig = '';
    if (!@openssl_sign($signingInput, $derSig, $privRes, OPENSSL_ALGO_SHA256)) {
        return '';
    }
    $rawSig = derToRawEcdsa64($derSig);
    if ($rawSig === false || strlen($rawSig) !== 64) {
        return '';
    }
    return $signingInput . '.' . pushBase64UrlEncode($rawSig);
}

/**
 * Bungkus public key EC P-256 uncompressed 65-byte menjadi SubjectPublicKeyInfo PEM
 */
function rawEcPublicKeyToPem($raw65) {
    if (strlen($raw65) !== 65 || ord($raw65[0]) !== 0x04) {
        return '';
    }
    $spkiPrefix = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200');
    $der = $spkiPrefix . $raw65;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/**
 * Enkripsi payload Web Push sesuai RFC 8291 + RFC 8188 (Content-Encoding: aes128gcm)
 */
function encryptWebPushAes128Gcm($plaintext, $userPublicKeyB64, $userAuthB64) {
    if (!function_exists('openssl_pkey_derive')) {
        return false;
    }
    $uaPublic = pushBase64UrlDecode($userPublicKeyB64);
    $authSecret = pushBase64UrlDecode($userAuthB64);
    if (strlen($uaPublic) !== 65 || ord($uaPublic[0]) !== 0x04 || strlen($authSecret) !== 16) {
        return false;
    }

    $uaPem = rawEcPublicKeyToPem($uaPublic);
    $uaPubRes = @openssl_pkey_get_public($uaPem);
    if ($uaPubRes === false) {
        return false;
    }

    $asPriv = openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC
    ]);
    if ($asPriv === false) {
        return false;
    }
    $asDetails = openssl_pkey_get_details($asPriv);
    $asPublic = "\x04"
        . substr(str_pad((string)($asDetails['ec']['x'] ?? ''), 32, "\x00", STR_PAD_LEFT), -32)
        . substr(str_pad((string)($asDetails['ec']['y'] ?? ''), 32, "\x00", STR_PAD_LEFT), -32);

    $sharedSecret = @openssl_pkey_derive($uaPubRes, $asPriv, 32);
    if ($sharedSecret === false || $sharedSecret === '') {
        return false;
    }
    $sharedSecret = substr(str_pad($sharedSecret, 32, "\x00", STR_PAD_LEFT), -32);

    // RFC 8291 Section 3.3 Key Derivation
    $prkKey = hash_hmac('sha256', $sharedSecret, $authSecret, true);
    $keyInfo = "WebPush: info\x00" . $uaPublic . $asPublic;
    $ikm = hash_hmac('sha256', $keyInfo . "\x01", $prkKey, true);

    // RFC 8188 aes128gcm Content-Encoding
    $salt = random_bytes(16);
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    $cekInfo = "Content-Encoding: aes128gcm\x00";
    $cek = substr(hash_hmac('sha256', $cekInfo . "\x01", $prk, true), 0, 16);
    $nonceInfo = "Content-Encoding: nonce\x00";
    $nonce = substr(hash_hmac('sha256', $nonceInfo . "\x01", $prk, true), 0, 12);

    $paddedPlaintext = (string)$plaintext . "\x02";
    $tag = '';
    $ciphertext = openssl_encrypt($paddedPlaintext, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($ciphertext === false || strlen($tag) !== 16) {
        return false;
    }

    $header = $salt . pack('N', 4096) . chr(strlen($asPublic)) . $asPublic;
    return $header . $ciphertext . $tag;
}

/**
 * Kirim batch Web Push RFC 8291 secara paralel ke seluruh perangkat terdaftar
 */
function dispatchWebPushBatch($vapidKeys, $subscriptions, $notification) {
    $stats = ['total' => 0, 'sent' => 0, 'failed' => 0, 'expired' => 0];
    $expiredEndpoints = [];
    if (empty($vapidKeys['publicKeyB64']) || empty($vapidKeys['privatePem']) || empty($subscriptions) || !is_array($subscriptions)) {
        return ['stats' => $stats, 'expiredEndpoints' => $expiredEndpoints];
    }

    $payloadJson = json_encode([
        'type' => 'estimator_notification',
        'notification' => $notification,
        'title' => $notification['title'] ?? 'Notifikasi Estimator',
        'body' => $notification['message'] ?? '',
        'tag' => 'est-notif-' . ($notification['id'] ?? time()),
        'sentAtMs' => (int)round(microtime(true) * 1000)
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $requests = [];
    foreach ($subscriptions as $sub) {
        $endpoint = trim((string)($sub['endpoint'] ?? ''));
        $p256dh = trim((string)($sub['keys']['p256dh'] ?? ''));
        $auth = trim((string)($sub['keys']['auth'] ?? ''));
        if ($endpoint === '' || $p256dh === '' || $auth === '') {
            continue;
        }
        $stats['total']++;
        $encrypted = encryptWebPushAes128Gcm($payloadJson, $p256dh, $auth);
        $jwt = createVapidJwt($endpoint, $vapidKeys['privatePem']);
        if ($encrypted === false || $jwt === '') {
            $stats['failed']++;
            continue;
        }
        $requests[] = [
            'endpoint' => $endpoint,
            'body' => $encrypted,
            'jwt' => $jwt
        ];
    }

    if (empty($requests) || !function_exists('curl_init')) {
        return ['stats' => $stats, 'expiredEndpoints' => $expiredEndpoints];
    }

    $mh = curl_multi_init();
    $handles = [];
    foreach ($requests as $idx => $req) {
        $ch = curl_init($req['endpoint']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $req['body'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 4,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/octet-stream',
                'Content-Encoding: aes128gcm',
                'Content-Length: ' . strlen($req['body']),
                'TTL: 86400',
                'Urgency: high',
                'Authorization: vapid t=' . $req['jwt'] . ', k=' . $vapidKeys['publicKeyB64']
            ]
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$idx] = ['ch' => $ch, 'endpoint' => $req['endpoint']];
    }

    $running = null;
    do {
        $mrc = curl_multi_exec($mh, $running);
        if ($running > 0) {
            curl_multi_select($mh, 0.2);
        }
    } while ($running > 0 && $mrc === CURLM_OK);

    foreach ($handles as $h) {
        $httpCode = (int)curl_getinfo($h['ch'], CURLINFO_HTTP_CODE);
        if ($httpCode >= 200 && $httpCode < 300) {
            $stats['sent']++;
        } elseif ($httpCode === 404 || $httpCode === 410) {
            $stats['expired']++;
            $expiredEndpoints[] = $h['endpoint'];
        } else {
            $stats['failed']++;
        }
        curl_multi_remove_handle($mh, $h['ch']);
        curl_close($h['ch']);
    }
    curl_multi_close($mh);

    return ['stats' => $stats, 'expiredEndpoints' => $expiredEndpoints];
}

/**
 * Bersihkan endpoint Web Push yang sudah kedaluwarsa (HTTP 404/410)
 */
function pruneExpiredPushSubscriptions($expiredEndpoints) {
    if (empty($expiredEndpoints) || !is_array($expiredEndpoints)) {
        return;
    }
    $expiredSet = array_flip($expiredEndpoints);
    withDatabaseStore(function (&$store, &$shouldSave) use ($expiredSet) {
        $subs = is_array($store['pushSubscriptions'] ?? null) ? $store['pushSubscriptions'] : [];
        $filtered = array_values(array_filter($subs, function ($s) use ($expiredSet) {
            return !isset($expiredSet[$s['endpoint'] ?? '']);
        }));
        if (count($filtered) !== count($subs)) {
            $store['pushSubscriptions'] = $filtered;
            $shouldSave = true;
        }
        return true;
    }, true);
}

/**
 * Ambil history sesuai user/role
 */
function getRecentHistoryForUser($store, $userKey, $role, $limit = 80) {
    $normUser = strtolower(trim((string)$userKey));
    $normRole = strtolower(trim((string)$role));
    $out = [];
    foreach ($store['history'] as $item) {
        $rKey = strtolower(trim((string)($item['userKey'] ?? '')));
        $rName = strtolower(trim((string)($item['username'] ?? '')));
        $rDetail = (string)($item['detail'] ?? '');

        if ($normRole === 'sales' && $normUser !== '') {
            $belongs = ($rKey === $normUser || $rName === $normUser || stripos($rDetail, $normUser) !== false);
            if (!$belongs) {
                continue;
            }
        }
        $out[] = $item;
        if (count($out) >= $limit) {
            break;
        }
    }
    return $out;
}

/**
 * Simpan file Base64 ke folder uploads_estimator/ dengan ekstensi aman & kembalikan URL akses
 */
function saveUploadedBase64File($uploadDir, $prefix, $origName, $mimeType, $base64Str) {
    if (!$base64Str || !is_string($base64Str)) {
        return null;
    }
    ensureUploadDirSafe($uploadDir);

    $rawB64 = $base64Str;
    if (strpos($rawB64, 'base64,') !== false) {
        $parts = explode('base64,', $rawB64, 2);
        $rawB64 = $parts[1];
    }
    $binary = base64_decode($rawB64, true);
    if ($binary === false || $binary === '') {
        return null;
    }

    $allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'mp4', 'webm', 'mov', 'm4v', '3gp', 'ogg', 'dwg', 'dxf', 'xlsx', 'xls', 'csv', 'doc', 'docx'];
    $ext = strtolower(pathinfo((string)$origName, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        $m = strtolower((string)$mimeType);
        if (strpos($m, 'pdf') !== false) $ext = 'pdf';
        elseif (strpos($m, 'png') !== false) $ext = 'png';
        elseif (strpos($m, 'jpeg') !== false || strpos($m, 'jpg') !== false) $ext = 'jpg';
        elseif (strpos($m, 'webp') !== false) $ext = 'webp';
        elseif (strpos($m, 'gif') !== false) $ext = 'gif';
        elseif (strpos($m, 'webm') !== false) $ext = 'webm';
        elseif (strpos($m, 'quicktime') !== false || strpos($m, 'mov') !== false) $ext = 'mov';
        elseif (strpos($m, '3gpp') !== false) $ext = '3gp';
        elseif (strpos($m, 'mp4') !== false || strpos($m, 'video') !== false) $ext = 'mp4';
        else $ext = 'bin';
    }
    if (!in_array($ext, $allowedExts, true) && $ext !== 'bin') {
        $ext = 'bin';
    }

    $safePrefix = preg_replace('/[^a-zA-Z0-9_-]/', '_', (string)$prefix);
    $safePrefix = trim($safePrefix, '_') ?: 'doc';
    try {
        $randHex = bin2hex(random_bytes(4));
    } catch (Exception $e) {
        $randHex = substr(md5(uniqid('', true)), 0, 8);
    }
    $storedFilename = $safePrefix . '_' . date('Ymd_His') . '_' . $randHex . '.' . $ext;
    $targetPath = $uploadDir . '/' . $storedFilename;

    if (@file_put_contents($targetPath, $binary, LOCK_EX) === false) {
        return null;
    }

    return [
        'filename' => $storedFilename,
        'url' => buildApiBaseUrl() . '?action=file&f=' . rawurlencode($storedFilename),
        'name' => (string)$origName
    ];
}

/**
 * Normalisasi kode antrian lama (APS-PU0001/SM0002/RN0003) ke format APS-XX2027xxxx
 */
function normalizeQueueCodeTo2027($codeStr, $salesName = '') {
    $str = trim((string)$codeStr);
    if ($str === '' || $str === '-') {
        return $str;
    }
    if (preg_match('/^APS-(?:RN|PU|SM|SL|GN)20\d{2}\d{4,}$/i', $str)) {
        return strtoupper($str);
    }
    if (preg_match('/^(APS-(?:RN|PU|SM|SL|GN))(\d{1,6})$/i', $str, $m)) {
        return strtoupper($m[1]) . '2027' . str_pad((string)intval($m[2]), 4, '0', STR_PAD_LEFT);
    }
    if (preg_match('/^(APS-(?:RN|PU|SM|SL|GN))-(\d{1,6})$/i', $str, $md)) {
        return strtoupper($md[1]) . '2027' . str_pad((string)intval($md[2]), 4, '0', STR_PAD_LEFT);
    }
    if ($salesName !== '' && preg_match('/^APS-\d{1,6}$/i', $str)) {
        $sn = strtolower((string)$salesName);
        $pfx = (strpos($sn, 'rini') !== false) ? 'APS-RN2027' : ((strpos($sn, 'priyo') !== false) ? 'APS-PU2027' : ((strpos($sn, 'samuel') !== false) ? 'APS-SM2027' : 'APS-SL2027'));
        $seq = preg_replace('/\D+/', '', $str);
        return $pfx . str_pad((string)intval($seq ?: '1'), 4, '0', STR_PAD_LEFT);
    }
    return $str;
}

/**
 * Cari index baris pada $records berdasarkan queueCode
 */
function findRecordIndexByQueue($records, $queueCode) {
    $q = normalizeQueueCodeTo2027($queueCode);
    if ($q === '' || $q === '-') {
        return -1;
    }
    foreach ($records as $idx => $rec) {
        if (normalizeQueueCodeTo2027($rec['queueCode'] ?? '', $rec['salesName'] ?? '') === $q) {
            return $idx;
        }
    }
    return -1;
}

/**
 * Hasilkan nomor antrian unik bebas bentrok ketika 2+ perangkat input bersamaan
 */
function getNextFreeQueueCode($records, $baseQueueCode) {
    $raw = trim((string)$baseQueueCode);
    $used = [];
    $maxNum = 0;
    foreach ($records as $rec) {
        $codeStr = trim((string)($rec['queueCode'] ?? ''));
        if ($codeStr === '' || $codeStr === '-') continue;
        $used[$codeStr] = true;
        if (preg_match('/^[A-Za-z]+-[A-Za-z]+20\d{2}(\d+)$/', $codeStr, $m)) {
            $nVal = intval($m[1]);
            if ($nVal > $maxNum) $maxNum = $nVal;
        } elseif (preg_match('/(\d+)$/', $codeStr, $m)) {
            $nVal = intval($m[1]);
            if ($nVal > $maxNum) $maxNum = $nVal;
        }
    }

    $bm = null;
    if (preg_match('/^([A-Za-z]+-[A-Za-z]+20\d{2})(\d+)$/', $raw, $mTagged)) {
        $bm = $mTagged;
    } elseif (preg_match('/^(.*?)(\d+)$/', $raw, $mLegacy)) {
        $bm = $mLegacy;
    }
    if ($bm) {
        $prefix = $bm[1];
        $origNum = intval($bm[2]);
        $padLen = max(4, strlen($bm[2]));
        $nextNum = max($maxNum + 1, $origNum + 1);
        while (true) {
            $candidate = $prefix . str_pad((string)$nextNum, $padLen, '0', STR_PAD_LEFT);
            if (!isset($used[$candidate])) {
                return $candidate;
            }
            $nextNum++;
        }
    }

    $fbPrefix = $raw ?: 'APS-GN2027';
    $suffix = $maxNum + 1;
    while (true) {
        $candidate = $fbPrefix . str_pad((string)$suffix, 4, '0', STR_PAD_LEFT);
        if (!isset($used[$candidate])) {
            return $candidate;
        }
        $suffix++;
    }
}

/**
 * Tentukan action yang diminta
 */
$action = isset($_GET['action']) ? trim((string)$_GET['action']) : '';
if ($action === '' && isset($_POST['action'])) {
    $action = trim((string)$_POST['action']);
}

// ============================================================================
// GET ENDPOINT: STREAM FILE UPLOAD DENGAN AMAN (PDF / PNG / JPG / DWG)
// ============================================================================
if ($action === 'file') {
    $reqFile = isset($_GET['f']) ? basename((string)$_GET['f']) : '';
    if ($reqFile === '' || !preg_match('/^[a-zA-Z0-9_.-]+$/', $reqFile)) {
        http_response_code(400);
        exit('Nama file tidak valid.');
    }
    $realDir = realpath($uploadDir);
    $realTarget = $realDir ? realpath($realDir . '/' . $reqFile) : false;
    if (!$realDir || !$realTarget || strpos($realTarget, $realDir . DIRECTORY_SEPARATOR) !== 0 || !is_file($realTarget)) {
        http_response_code(404);
        exit('Berkas tidak ditemukan.');
    }

    $ext = strtolower(pathinfo($realTarget, PATHINFO_EXTENSION));
    $mimeMap = [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'bmp' => 'image/bmp',
        'mp4' => 'video/mp4',
        'm4v' => 'video/mp4',
        'webm' => 'video/webm',
        'mov' => 'video/quicktime',
        '3gp' => 'video/3gpp',
        'ogg' => 'video/ogg'
    ];
    $contentType = $mimeMap[$ext] ?? 'application/octet-stream';
    $isDownload = !empty($_GET['dl']);

    header('Content-Type: ' . $contentType);
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . filesize($realTarget));
    header('Content-Disposition: ' . ($isDownload ? 'attachment' : 'inline') . '; filename="' . $reqFile . '"');
    readfile($realTarget);
    exit;
}

// ============================================================================
// 1. GET STATUS / PING
// ============================================================================
if ($action === 'status' || $action === 'ping') {
    $res = withDatabaseStore(function ($store) {
        return [
            'success' => true,
            'status' => 'active',
            'server' => 'online',
            'mode' => 'php_cloud',
            'sheetName' => 'Hosting Cloud Database (PHP)',
            'hasDatabase' => file_exists($GLOBALS['dbFile']),
            'totalRows' => count($store['records']),
            'recordCount' => count($store['records']),
            'totalUsers' => count($store['usersProfiles']),
            'userCount' => count($store['usersProfiles']),
            'totalHistory' => count($store['history']),
            'historyCount' => count($store['history']),
            'updatedAt' => $store['updatedAt'] ?? 0,
            'time' => time(),
            'timestamp' => date('d/m/Y H:i'),
            'message' => 'Cloud Server Hosting aktif — 100% tersinkronisasi otomatis untuk HP & Komputer.'
        ];
    }, false);
    if (isset($res['error'])) {
        sendJsonResponse(['success' => false, 'status' => 'error', 'message' => $res['error']], 500);
    }
    sendJsonResponse($res);
}

// ============================================================================
// 2. GET LOGIN_SYNC (Verifikasi Password Online + Profil + Data + History)
// ============================================================================
if ($action === 'login_sync' || $action === 'verify_login') {
    $uKey = strtolower(trim((string)($_GET['userKey'] ?? '')));
    $uName = trim((string)($_GET['username'] ?? $uKey ?: 'User'));
    $uRole = trim((string)($_GET['role'] ?? ''));
    $authHash = strtolower(trim((string)($_GET['authHash'] ?? '')));
    $deviceName = trim((string)($_GET['device'] ?? 'Browser'));

    $res = withDatabaseStore(function (&$store, &$shouldSave) use ($uKey, $uName, $uRole, $authHash, $deviceName) {
        if (!verifyUserAuthHash($store, $uKey, $authHash)) {
            appendOnlineHistory($store, $uName, $uKey, $deviceName, 'LOGIN_GAGAL', '-', 'Akun: ' . $uName, 'Ditolak', 'Percobaan login password salah dari ' . $deviceName);
            $shouldSave = true;
            return [
                'success' => true,
                'status' => 'success',
                'authenticated' => false,
                'message' => 'Login Gagal! Pastikan Username dan Password sesuai.'
            ];
        }

        $nowFmt = date('d/m/Y H:i');
        $nowIso = date('c');
        $existingProf = $store['usersProfiles'][$uKey] ?? [
            'userKey' => $uKey,
            'username' => $uName,
            'role' => $uRole,
            'passwordHash' => computeAccountPasswordHash($uKey, 'Agra123'),
            'employeeId' => '',
            'email' => '',
            'whatsapp' => '',
            'division' => '',
            'photoDriveUrl' => '',
            'photoThumbDataUrl' => '',
            'photoFileName' => '',
            'photoFileSize' => 0
        ];
        if ($uRole && empty($existingProf['role'])) {
            $existingProf['role'] = $uRole;
        }
        $existingProf['username'] = $uName;
        $existingProf['lastLoginAt'] = $nowFmt;
        $existingProf['lastDevice'] = $deviceName;
        $existingProf['updatedAt'] = $nowIso;
        $store['usersProfiles'][$uKey] = $existingProf;

        appendOnlineHistory($store, $uName, $uKey, $deviceName, 'LOGIN', '-', 'Akun: ' . $uName, 'Berhasil', 'Login online berhasil dari perangkat ' . $deviceName);
        $shouldSave = true;

        $safeProf = $existingProf;
        unset($safeProf['passwordHash']);
        $historyList = getRecentHistoryForUser($store, $uKey, $uRole ?: ($safeProf['role'] ?? ''), 80);

        return [
            'success' => true,
            'status' => 'success',
            'authenticated' => true,
            'profile' => $safeProf,
            'records' => array_values($store['records']),
            'history' => $historyList,
            'notifications' => array_slice($store['notifications'] ?? [], 0, 30),
            'total' => count($store['records']),
            'serverTimestamp' => $nowFmt
        ];
    }, true);

    if (isset($res['error'])) {
        sendJsonResponse(['success' => false, 'status' => 'error', 'message' => $res['error']], 500);
    }
    sendJsonResponse($res);
}

// ============================================================================
// 2B. GET GET_NOTIFICATIONS (Feed Notifikasi Ringan Lintas Perangkat / Login / Tab Lain)
// ============================================================================
if ($action === 'get_notifications') {
    $sinceMs = isset($_GET['since']) ? intval($_GET['since']) : 0;
    $res = withDatabaseStore(function ($store) use ($sinceMs) {
        $allNotifs = $store['notifications'] ?? [];
        if ($sinceMs > 0) {
            $filtered = [];
            foreach ($allNotifs as $nt) {
                if (intval($nt['createdAtMs'] ?? 0) >= $sinceMs) {
                    $filtered[] = $nt;
                }
            }
            $list = array_slice($filtered, 0, 50);
        } else {
            $list = array_slice($allNotifs, 0, 40);
        }
        return [
            'success' => true,
            'status' => 'success',
            'notifications' => array_values($list),
            'total' => count($list),
            'updatedAt' => $store['updatedAt'] ?? time(),
            'serverTimeMs' => (int)round(microtime(true) * 1000)
        ];
    }, false);

    if (isset($res['error'])) {
        sendJsonResponse(['success' => false, 'status' => 'error', 'message' => $res['error']], 500);
    }
    sendJsonResponse($res);
}

// ============================================================================
// 3. GET GET_PROFILE_AND_HISTORY / GET_ONLINE_STATE
// ============================================================================
if ($action === 'get_profile_and_history' || $action === 'get_online_state') {
    $uKey = strtolower(trim((string)($_GET['userKey'] ?? '')));
    $authHash = strtolower(trim((string)($_GET['authHash'] ?? '')));
    $role = trim((string)($_GET['role'] ?? ''));

    $res = withDatabaseStore(function ($store) use ($uKey, $authHash, $role) {
        if (!$uKey || !verifyUserAuthHash($store, $uKey, $authHash)) {
            return [
                'success' => true,
                'status' => 'success',
                'authenticated' => false,
                'passwordChangedRemotely' => true,
                'records' => [],
                'history' => []
            ];
        }
        $prof = $store['usersProfiles'][$uKey] ?? null;
        if ($prof) {
            unset($prof['passwordHash']);
        }
        $hist = getRecentHistoryForUser($store, $uKey, $role ?: ($prof['role'] ?? ''), 80);
        return [
            'success' => true,
            'status' => 'success',
            'authenticated' => true,
            'profile' => $prof,
            'records' => array_values($store['records']),
            'history' => $hist,
            'notifications' => array_slice($store['notifications'] ?? [], 0, 30),
            'total' => count($store['records']),
            'serverTimestamp' => date('d/m/Y H:i')
        ];
    }, false);

    if (isset($res['error'])) {
        sendJsonResponse(['success' => false, 'status' => 'error', 'message' => $res['error']], 500);
    }
    sendJsonResponse($res);
}

// ============================================================================
// 4. GET GET_ROWS / SYNC / LOAD
// ============================================================================
if ($action === 'get_rows' || $action === 'sync' || $action === 'load') {
    $res = withDatabaseStore(function ($store) use ($action) {
        if ($action === 'load') {
            $safeProfiles = [];
            foreach ($store['usersProfiles'] as $k => $v) {
                $copy = $v;
                unset($copy['passwordHash']);
                $safeProfiles[$k] = $copy;
            }
            return [
                'success' => true,
                'status' => 'success',
                'data' => [
                    'records' => array_values($store['records']),
                    'usersProfiles' => empty($safeProfiles) ? new stdClass() : $safeProfiles,
                    'history' => $store['history'],
                    'notifications' => array_slice($store['notifications'] ?? [], 0, 30)
                ],
                'updatedAt' => $store['updatedAt'] ?? time(),
                'message' => 'Data berhasil diambil dari cloud server hosting.'
            ];
        }
        return [
            'success' => true,
            'status' => 'success',
            'total' => count($store['records']),
            'records' => array_values($store['records']),
            'notifications' => array_slice($store['notifications'] ?? [], 0, 30),
            'updatedAt' => $store['updatedAt'] ?? time(),
            'serverTimestamp' => date('d/m/Y H:i')
        ];
    }, false);

    if (isset($res['error'])) {
        sendJsonResponse(['success' => false, 'status' => 'error', 'message' => $res['error']], 500);
    }
    sendJsonResponse($res);
}

// ============================================================================
// 4B. GET VAPID PUBLIC KEY (Untuk Web Push saat tab ditutup di PC & HP)
// ============================================================================
if ($action === 'get_vapid_key') {
    $res = withDatabaseStore(function (&$store, &$shouldSave) {
        $keys = ensureVapidKeys($store, $shouldSave);
        return [
            'publicKey' => $keys['publicKeyB64'],
            'subscriberCount' => count($store['pushSubscriptions'] ?? [])
        ];
    }, true);
    if (isset($res['error'])) {
        sendJsonResponse(['success' => false, 'status' => 'error', 'message' => $res['error']], 500);
    }
    sendJsonResponse([
        'success' => true,
        'status' => 'success',
        'publicKey' => $res['publicKey'] ?? '',
        'subscriberCount' => $res['subscriberCount'] ?? 0
    ]);
}

// ============================================================================
// 5. GET BACKUP (Unduh cadangan JSON)
// ============================================================================
if ($action === 'backup') {
    $res = withDatabaseStore(function ($store) {
        return $store;
    }, false);
    if (isset($res['error'])) {
        sendJsonResponse(['success' => false, 'message' => $res['error']], 500);
    }
    header('Content-Disposition: attachment; filename="backup_estimator_' . date('Y-m-d_His') . '.json"');
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ============================================================================
// POST REQUESTS: SAVE_USER_PROFILE, SAVE_ROW, DELETE_ROW, CLEAR_ALL_ROWS, BATCH_SAVE, SAVE
// ============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = null;
    if (!empty($rawInput)) {
        $data = json_decode($rawInput, true);
    }
    if (!$data && isset($_POST['data'])) {
        $data = is_array($_POST['data']) ? $_POST['data'] : json_decode((string)$_POST['data'], true);
    }
    if (!$data && !empty($_POST)) {
        $data = $_POST;
    }
    if (!is_array($data)) {
        sendJsonResponse(['success' => false, 'status' => 'error', 'message' => 'Format payload tidak valid. Harus JSON.'], 400);
    }

    $postAction = $action ?: trim((string)($data['action'] ?? 'save_row'));
    $actorUsername = trim((string)($data['actorUsername'] ?? $data['username'] ?? $data['salesName'] ?? 'Sistem'));
    $actorKey = strtolower(trim((string)($data['actorUserKey'] ?? $data['userKey'] ?? $actorUsername)));
    $deviceInfo = trim((string)($data['device'] ?? '-'));

    // --- A. SAVE_USER_PROFILE ---
    if ($postAction === 'save_user_profile') {
        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($data, $uploadDir) {
            $uKey = strtolower(trim((string)($data['userKey'] ?? $data['username'] ?? '')));
            $uName = trim((string)($data['username'] ?? $uKey));
            $uRole = trim((string)($data['role'] ?? ''));
            $currentAuthHash = strtolower(trim((string)($data['currentAuthHash'] ?? '')));
            $newPasswordHash = strtolower(trim((string)($data['newPasswordHash'] ?? '')));
            $deviceInfo = trim((string)($data['device'] ?? '-'));

            if (!$uKey) {
                return ['success' => false, 'status' => 'error', 'message' => 'Parameter userKey wajib diisi.'];
            }
            if ($currentAuthHash && !verifyUserAuthHash($store, $uKey, $currentAuthHash)) {
                return ['success' => false, 'status' => 'error', 'message' => 'Verifikasi password saat ini tidak cocok dengan server.'];
            }

            $existing = $store['usersProfiles'][$uKey] ?? [
                'userKey' => $uKey,
                'username' => $uName,
                'role' => $uRole,
                'passwordHash' => computeAccountPasswordHash($uKey, 'Agra123'),
                'employeeId' => '',
                'email' => '',
                'whatsapp' => '',
                'division' => '',
                'photoDriveUrl' => '',
                'photoThumbDataUrl' => '',
                'photoFileName' => '',
                'photoFileSize' => 0,
                'lastLoginAt' => date('d/m/Y H:i'),
                'lastDevice' => $deviceInfo
            ];

            if (strlen($newPasswordHash) === 64) {
                $existing['passwordHash'] = $newPasswordHash;
            }
            if (array_key_exists('employeeId', $data)) $existing['employeeId'] = trim((string)$data['employeeId']);
            if (array_key_exists('email', $data)) $existing['email'] = trim((string)$data['email']);
            if (array_key_exists('whatsapp', $data)) $existing['whatsapp'] = trim((string)$data['whatsapp']);
            if (array_key_exists('division', $data)) $existing['division'] = trim((string)$data['division']);
            if (array_key_exists('photoThumbDataUrl', $data) && $data['photoThumbDataUrl'] !== '') {
                $existing['photoThumbDataUrl'] = (string)$data['photoThumbDataUrl'];
            }
            if (!empty($data['photoFileName'])) $existing['photoFileName'] = trim((string)$data['photoFileName']);
            if (isset($data['photoFileSize'])) $existing['photoFileSize'] = intval($data['photoFileSize']);

            if (!empty($data['photoBase64'])) {
                $savedPhoto = saveUploadedBase64File($uploadDir, 'avatar_' . $uKey, $data['photoFileName'] ?? ($uKey . '.png'), $data['photoMimeType'] ?? 'image/png', $data['photoBase64']);
                if ($savedPhoto) {
                    $existing['photoDriveUrl'] = $savedPhoto['url'];
                }
            }

            $existing['username'] = $uName ?: ($existing['username'] ?? $uKey);
            if ($uRole) $existing['role'] = $uRole;
            $existing['lastDevice'] = $deviceInfo;
            $existing['updatedAt'] = date('c');
            $store['usersProfiles'][$uKey] = $existing;

            $actType = (strlen($newPasswordHash) === 64) ? 'EDIT_PROFIL_&_PASSWORD' : 'EDIT_PROFIL';
            appendOnlineHistory(
                $store,
                $existing['username'],
                $uKey,
                $deviceInfo,
                $actType,
                '-',
                'Profil: ' . $existing['username'],
                'Tersimpan Online',
                'ID: ' . ($existing['employeeId'] ?: '-') . ' | Divisi: ' . ($existing['division'] ?: '-')
            );
            $shouldSave = true;

            $safeProf = $existing;
            unset($safeProf['passwordHash']);
            return [
                'success' => true,
                'status' => 'success',
                'profile' => $safeProf,
                'history' => getRecentHistoryForUser($store, $uKey, $existing['role'] ?? $uRole, 80),
                'message' => 'Profil & kredensial akun berhasil disimpan ke cloud server!'
            ];
        }, true);

        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- B. CLEAR_ALL_ROWS / RESET_ZERO ---
    if ($postAction === 'clear_all_rows' || $postAction === 'reset_zero') {
        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($actorUsername, $actorKey, $deviceInfo) {
            $count = count($store['records']);
            $snapshot = array_slice($store['records'], 0, 50);
            $store['records'] = [];
            appendOnlineHistory(
                $store,
                $actorUsername,
                $actorKey,
                $deviceInfo,
                'RESET_SEMUA_DATA',
                '-',
                'Reset ' . $count . ' baris data aktif',
                'Terarsip Online',
                json_encode(['clearedCount' => $count, 'archive' => $snapshot], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
            $shouldSave = true;
            return [
                'success' => true,
                'status' => 'success',
                'message' => 'Seluruh data aktif di cloud server telah direset & riwayat tetap terarsip.'
            ];
        }, true);
        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- C. DELETE_ROW ---
    if ($postAction === 'delete_row' && (!empty($data['queueCode']) || !empty($data['noAntrian']))) {
        $delCode = normalizeQueueCodeTo2027($data['queueCode'] ?? $data['noAntrian'] ?? '');
        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($delCode, $actorUsername, $actorKey, $deviceInfo) {
            $idx = findRecordIndexByQueue($store['records'], $delCode);
            if ($idx < 0) {
                return ['success' => true, 'status' => 'not_found', 'message' => 'Kode antrian ' . $delCode . ' tidak ditemukan.'];
            }
            $oldRec = $store['records'][$idx];
            array_splice($store['records'], $idx, 1);
            appendOnlineHistory(
                $store,
                $actorUsername,
                $actorKey,
                $deviceInfo,
                'HAPUS_DATA',
                $delCode,
                ($oldRec['customerName'] ?? '-') . ' / ' . ($oldRec['projectName'] ?? '-'),
                'Dihapus dari Aktif (Arsip History)',
                json_encode([
                    'queueCode' => $delCode,
                    'salesName' => $oldRec['salesName'] ?? '',
                    'customerName' => $oldRec['customerName'] ?? '',
                    'projectName' => $oldRec['projectName'] ?? '',
                    'status' => $oldRec['status'] ?? ''
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            );
            $delActor = ($actorUsername !== '' && $actorUsername !== 'Sistem') ? $actorUsername : ($oldRec['salesName'] ?: 'Sales');
            appendRealtimeNotification(
                $store,
                'sales_form_edit',
                'Edit Perubahan (Hapus Data) Sales',
                $delActor . ': Telah Melakukan Edit Data Sales — Hapus ' . $delCode . ' - ' . ($oldRec['customerName'] ?? '-') . ' (' . ($oldRec['projectName'] ?? '-') . ')',
                $delActor,
                $delCode,
                $oldRec['customerName'] ?? '-',
                $oldRec['projectName'] ?? '-',
                $oldRec['status'] ?? 'Dihapus',
                ''
            );
            $shouldSave = true;
            return ['success' => true, 'status' => 'success', 'message' => 'Data antrian ' . $delCode . ' berhasil dihapus & diarsipkan.'];
        }, true);
        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- D. BATCH_SAVE atau SAVE penuh ---
    if ($postAction === 'batch_save' || ($postAction === 'save' && isset($data['records']) && is_array($data['records']))) {
        $items = $data['records'] ?? [];
        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($items, $actorUsername, $actorKey, $deviceInfo) {
            $inserted = 0;
            $updated = 0;
            foreach ($items as $item) {
                if (!is_array($item)) continue;
                $qCode = normalizeQueueCodeTo2027($item['queueCode'] ?? '', $item['salesName'] ?? '');
                $idx = findRecordIndexByQueue($store['records'], $qCode);
                $isNew = !empty($item['isNewInsert']) && ($item['isNewInsert'] === true || $item['isNewInsert'] === 'true');
                if ($idx >= 0 && $isNew) {
                    $qCode = getNextFreeQueueCode($store['records'], $qCode);
                    $idx = -1;
                }
                $item['queueCode'] = $qCode;
                if ($idx >= 0) {
                    $store['records'][$idx] = array_merge($store['records'][$idx], $item);
                    $updated++;
                } else {
                    $store['records'][] = $item;
                    $inserted++;
                }
            }
            appendOnlineHistory(
                $store,
                $actorUsername,
                $actorKey,
                $deviceInfo,
                'SINKRON_MASSAL',
                '-',
                count($items) . ' baris data proyek',
                'Berhasil',
                'Inserted: ' . $inserted . ', Updated: ' . $updated
            );
            $shouldSave = true;
            return [
                'success' => true,
                'status' => 'success',
                'inserted' => $inserted,
                'updated' => $updated,
                'message' => "Berhasil sinkronisasi massal ($inserted baru, $updated diperbarui)."
            ];
        }, true);
        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- D2. SEND_PROJECT_CHAT (Balasan chat terhubung lintas Sales, Estimator & Admin Kontrak) ---
    if ($postAction === 'send_project_chat') {
        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($data, $actorUsername, $actorKey, $deviceInfo, $uploadDir) {
            $queueCode = normalizeQueueCodeTo2027($data['queueCode'] ?? $data['noAntrian'] ?? '', $data['salesName'] ?? '');
            $chatMsg = is_array($data['chatMessage'] ?? null) ? $data['chatMessage'] : [];
            $chatMediaIn = is_array($chatMsg['media'] ?? null) ? $chatMsg['media'] : null;
            $chatText = trim((string)($chatMsg['text'] ?? ($data['text'] ?? '')));
            if ($chatText === '' && $chatMediaIn) {
                $chatText = (($chatMediaIn['type'] ?? '') === 'video') ? '🎥 Video' : '📷 Foto';
            }
            if ($chatText === '') {
                return ['success' => false, 'status' => 'error', 'message' => 'Pesan chat kosong.'];
            }
            $existingIdx = findRecordIndexByQueue($store['records'], $queueCode);
            if ($existingIdx < 0) {
                $store['records'][] = [
                    'id' => (string)($data['recordId'] ?? ('REC-' . time())),
                    'queueCode' => $queueCode ?: '-',
                    'uploadDateTime' => date('d/m/Y H:i'),
                    'salesName' => trim((string)($data['salesName'] ?? 'Sales')),
                    'customerName' => trim((string)($data['customerName'] ?? 'Customer')),
                    'projectName' => trim((string)($data['projectName'] ?? 'Proyek')),
                    'scopeOfWork' => '-',
                    'projectMaterial' => '-',
                    'requestDeadline' => '-',
                    'sourceDesc' => '-',
                    'salesNotes' => '',
                    'salesNotesHistory' => [],
                    'customerFolderUrl' => '',
                    'docsText' => '-',
                    'status' => trim((string)($data['status'] ?? 'Masih Antrian Gambar')),
                    'estimatorName' => '(Belum dipilih)',
                    'estimateStartDate' => '-',
                    'estimateEndDate' => '-',
                    'estimatorNotes' => '-',
                    'estimatorNotesHistory' => [],
                    'quoteNumber' => '-',
                    'quoteStatus' => 'Draft',
                    'quoteNotes' => '-',
                    'quoteNotesHistory' => [],
                    'unifiedChatHistory' => []
                ];
                $existingIdx = count($store['records']) - 1;
            }
            $rec = &$store['records'][$existingIdx];
            $msgId = trim((string)($chatMsg['id'] ?? ('MSG-' . (int)round(microtime(true) * 1000))));
            $msgAuthor = trim((string)($chatMsg['author'] ?? $actorUsername ?: 'Tim Proyek'));
            $msgRole = trim((string)($chatMsg['role'] ?? ''));
            $msgRoleLabel = trim((string)($chatMsg['roleLabel'] ?? 'Tim Proyek'));
            $normalizedMsg = [
                'id' => $msgId,
                'createdAtMs' => intval($chatMsg['createdAtMs'] ?? (int)round(microtime(true) * 1000)),
                'timestamp' => trim((string)($chatMsg['timestamp'] ?? date('d/m/Y H : i : s'))),
                'author' => $msgAuthor,
                'role' => $msgRole,
                'roleLabel' => $msgRoleLabel,
                'sourceMenu' => trim((string)($chatMsg['sourceMenu'] ?? '')),
                'text' => $chatText
            ];
            if (isset($chatMsg['replyTo']) && is_array($chatMsg['replyTo'])) {
                $normalizedMsg['replyTo'] = $chatMsg['replyTo'];
            }
            if ($chatMediaIn) {
                $mediaName = trim((string)($chatMediaIn['name'] ?? 'chat_media'));
                $mediaMime = trim((string)($chatMediaIn['mimeType'] ?? 'application/octet-stream'));
                $mediaType = trim((string)($chatMediaIn['type'] ?? (strpos(strtolower($mediaMime), 'video') !== false ? 'video' : 'image')));
                $storedUrl = trim((string)($chatMediaIn['url'] ?? ''));
                $rawDataUrl = $chatMediaIn['dataUrl'] ?? ($chatMediaIn['base64'] ?? '');
                if ($rawDataUrl && is_string($rawDataUrl)) {
                    $savedMedia = saveUploadedBase64File($uploadDir, 'chatmed', $mediaName, $mediaMime, $rawDataUrl);
                    if ($savedMedia && !empty($savedMedia['url'])) {
                        $storedUrl = $savedMedia['url'];
                    }
                }
                $cleanMedia = [
                    'mediaId' => trim((string)($chatMediaIn['mediaId'] ?? '')),
                    'type' => $mediaType,
                    'name' => $mediaName,
                    'mimeType' => $mediaMime,
                    'size' => intval($chatMediaIn['size'] ?? 0)
                ];
                if ($storedUrl !== '') {
                    $cleanMedia['url'] = $storedUrl;
                } elseif (is_string($rawDataUrl) && strlen($rawDataUrl) > 0 && strlen($rawDataUrl) <= 350000) {
                    $cleanMedia['dataUrl'] = $rawDataUrl;
                }
                if (!empty($chatMediaIn['thumbUrl']) && is_string($chatMediaIn['thumbUrl']) && strlen($chatMediaIn['thumbUrl']) <= 60000) {
                    $cleanMedia['thumbUrl'] = $chatMediaIn['thumbUrl'];
                }
                $normalizedMsg['media'] = $cleanMedia;
            }
            $rec['unifiedChatHistory'] = mergeNotesHistoryArrays($rec['unifiedChatHistory'] ?? [], [$normalizedMsg]);
            if ($msgRole === 'sales') {
                $rec['salesNotes'] = $chatText;
                $rec['salesNotesHistory'] = mergeNotesHistoryArrays($rec['salesNotesHistory'] ?? [], [$normalizedMsg]);
            } elseif ($msgRole === 'admin') {
                $rec['estimatorNotes'] = $chatText;
                $rec['estimatorNotesHistory'] = mergeNotesHistoryArrays($rec['estimatorNotesHistory'] ?? [], [$normalizedMsg]);
            } elseif ($msgRole === 'contract') {
                $rec['quoteNotes'] = $chatText;
                $rec['quoteNotesHistory'] = mergeNotesHistoryArrays($rec['quoteNotesHistory'] ?? [], [$normalizedMsg]);
            }

            appendOnlineHistory(
                $store,
                $msgAuthor,
                $actorKey,
                $deviceInfo,
                'CHAT_PROYEK',
                $rec['queueCode'] ?? $queueCode,
                ($rec['customerName'] ?? '-') . ' / ' . ($rec['projectName'] ?? '-'),
                $rec['status'] ?? '-',
                '[' . $msgRoleLabel . '] ' . $chatText
            );

            $clientEventId = trim((string)($data['clientEventId'] ?? $msgId));
            $createdNotif = appendRealtimeNotification(
                $store,
                'project_chat',
                'Pesan Chat Proyek (' . $msgRoleLabel . ')',
                $msgAuthor . ' (' . $msgRoleLabel . ') membalas pada ' . ($rec['queueCode'] ?? $queueCode) . ' - ' . ($rec['projectName'] ?? '-') . ': "' . $chatText . '"',
                $msgAuthor,
                $rec['queueCode'] ?? $queueCode,
                $rec['customerName'] ?? '-',
                $rec['projectName'] ?? '-',
                $rec['status'] ?? '-',
                $clientEventId
            );
            $shouldSave = true;
            $pushDispatch = null;
            if (!empty($createdNotif) && !empty($store['pushSubscriptions'])) {
                $vapidKeys = ensureVapidKeys($store, $shouldSave);
                $pushDispatch = [
                    'vapidKeys' => $vapidKeys,
                    'subscriptions' => $store['pushSubscriptions'],
                    'notification' => $createdNotif
                ];
            }

            return [
                'success' => true,
                'status' => 'success',
                'queueCode' => $rec['queueCode'] ?? $queueCode,
                'unifiedChatHistory' => $rec['unifiedChatHistory'],
                'notification' => $createdNotif,
                '__pushDispatch' => $pushDispatch,
                'message' => 'Chat berhasil disimpan & diteruskan ke seluruh divisi!'
            ];
        }, true);

        $pushDispatch = $res['__pushDispatch'] ?? null;
        unset($res['__pushDispatch']);
        if (!empty($pushDispatch)) {
            $pushResult = dispatchWebPushBatch($pushDispatch['vapidKeys'], $pushDispatch['subscriptions'], $pushDispatch['notification']);
            $res['pushStats'] = $pushResult['stats'];
            if (!empty($pushResult['expiredEndpoints'])) {
                pruneExpiredPushSubscriptions($pushResult['expiredEndpoints']);
            }
        }

        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- E. SAVE_ROW (Simpan / Update 1 Proyek + File Upload ke uploads_estimator/) ---
    if ($postAction === 'save_row') {
        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($data, $uploadDir, $actorUsername, $actorKey, $deviceInfo) {
            $salesName = trim((string)($data['salesName'] ?? $data['namaSales'] ?? 'Sales'));
            $customerName = trim((string)($data['customerName'] ?? $data['namaCustomer'] ?? 'Customer'));
            $queueCode = normalizeQueueCodeTo2027($data['queueCode'] ?? $data['noAntrian'] ?? '', $salesName);
            $isNewInsert = !empty($data['isNewInsert']) && ($data['isNewInsert'] === true || $data['isNewInsert'] === 'true');
            $updatedBy = trim((string)($data['updatedBy'] ?? ''));

            $existingIdx = findRecordIndexByQueue($store['records'], $queueCode);
            if ($existingIdx >= 0 && $isNewInsert) {
                $queueCode = getNextFreeQueueCode($store['records'], $queueCode);
                $existingIdx = -1;
            }

            $filesUploaded = [];
            $slotDocMap = [];
            if (!empty($data['files']) && is_array($data['files'])) {
                foreach ($data['files'] as $fIdx => $fileItem) {
                    if (!empty($fileItem['base64']) && !empty($fileItem['name'])) {
                        $slotNum = intval($fileItem['slotIndex'] ?? $fileItem['slot'] ?? ($fIdx + 1));
                        $saved = saveUploadedBase64File($uploadDir, $queueCode . '_gbr' . $slotNum, $fileItem['name'], $fileItem['mimeType'] ?? '', $fileItem['base64']);
                        if ($saved) {
                            $slotDocMap[$slotNum] = $saved['url'];
                            $filesUploaded[] = ['name' => $fileItem['name'], 'slot' => $slotNum, 'url' => $saved['url']];
                        }
                    }
                }
            }

            $revFilesUploaded = [];
            $revDocMap = [];
            if (!empty($data['revFiles']) && is_array($data['revFiles'])) {
                foreach ($data['revFiles'] as $rfIdx => $revItem) {
                    if (!empty($revItem['base64']) && !empty($revItem['name'])) {
                        $revNum = intval($revItem['revIndex'] ?? $revItem['slotIndex'] ?? ($rfIdx + 1));
                        $saved = saveUploadedBase64File($uploadDir, $queueCode . '_rev' . $revNum, $revItem['name'], $revItem['mimeType'] ?? '', $revItem['base64']);
                        if ($saved) {
                            $revDocMap[$revNum] = $saved['url'];
                            $revFilesUploaded[] = ['name' => $revItem['name'], 'slot' => $revNum, 'fieldKey' => 'revGambar' . $revNum, 'url' => $saved['url']];
                        }
                    }
                }
            }

            $quoteFilesUploaded = [];
            $quoteDocMap = [];
            if (!empty($data['quoteFiles']) && is_array($data['quoteFiles'])) {
                foreach ($data['quoteFiles'] as $qItem) {
                    if (!empty($qItem['base64']) && !empty($qItem['name']) && !empty($qItem['fieldKey'])) {
                        $fk = (string)$qItem['fieldKey'];
                        $saved = saveUploadedBase64File($uploadDir, $queueCode . '_' . $fk, $qItem['name'], $qItem['mimeType'] ?? '', $qItem['base64']);
                        if ($saved) {
                            $quoteDocMap[$fk] = $saved['url'];
                            $quoteFilesUploaded[] = ['name' => $qItem['name'], 'fieldKey' => $fk, 'url' => $saved['url']];
                        }
                    }
                }
            }

            $existing = ($existingIdx >= 0) ? $store['records'][$existingIdx] : [];
            $isSalesSide = ($updatedBy === 'sales' || $updatedBy === 'sales_new');
            $incomingSalesNotesHist = is_array($data['salesNotesHistory'] ?? null) ? $data['salesNotesHistory'] : [];
            $incomingEstNotesHist = is_array($data['estimatorNotesHistory'] ?? null) ? $data['estimatorNotesHistory'] : [];
            $incomingQuoteNotesHist = is_array($data['quoteNotesHistory'] ?? null) ? $data['quoteNotesHistory'] : [];
            $incomingUnifiedChat = is_array($data['unifiedChatHistory'] ?? null) ? $data['unifiedChatHistory'] : [];

            $record = [
                'id' => (string)($existing['id'] ?? ('REC-' . time() . '-' . substr(md5($queueCode), 0, 5))),
                'queueCode' => $queueCode ?: '-',
                'uploadDateTime' => formatDateTimeDMY($data['uploadDateTime'] ?? $data['timestamp'] ?? ($existing['uploadDateTime'] ?? '')),
                'salesName' => $salesName,
                'customerName' => $customerName,
                'projectName' => trim((string)($data['projectName'] ?? $data['namaProyek'] ?? ($existing['projectName'] ?? '-'))),
                'scopeOfWork' => trim((string)($data['scopeOfWork'] ?? $data['skopPengerjaan'] ?? ($existing['scopeOfWork'] ?? '-'))),
                'projectMaterial' => trim((string)($data['projectMaterial'] ?? $data['projectMaterialValue'] ?? ($existing['projectMaterial'] ?? '-'))),
                'requestDeadline' => formatDateDMY($data['requestDeadline'] ?? $data['targetSelesai'] ?? ($existing['requestDeadline'] ?? '-')),
                'sourceDesc' => trim((string)($data['sourceDesc'] ?? $data['sumberGambar'] ?? ($existing['sourceDesc'] ?? '-'))),
                'salesNotes' => trim((string)($data['salesNotes'] ?? $data['catatanSales'] ?? ($existing['salesNotes'] ?? ''))),
                'salesNotesHistory' => mergeNotesHistoryArrays($existing['salesNotesHistory'] ?? [], $incomingSalesNotesHist),
                'customerFolderUrl' => trim((string)($data['customerFolderUrl'] ?? ($existing['customerFolderUrl'] ?? ''))),
                'docsText' => trim((string)($data['docsText'] ?? ($existing['docsText'] ?? '-'))),
                'status' => trim((string)($data['status'] ?? ($existing['status'] ?? 'Masih Antrian Gambar'))),
                'estimatorName' => trim((string)($data['estimatorName'] ?? ($existing['estimatorName'] ?? '(Belum dipilih)'))),
                'estimateStartDate' => formatDateDMY($data['estimateStartDate'] ?? ($existing['estimateStartDate'] ?? '-')),
                'estimateEndDate' => formatDateDMY($data['estimateEndDate'] ?? ($existing['estimateEndDate'] ?? '-')),
                'estimatorNotes' => trim((string)($data['estimatorNotes'] ?? ($existing['estimatorNotes'] ?? '-'))),
                'estimatorNotesHistory' => mergeNotesHistoryArrays($existing['estimatorNotesHistory'] ?? [], $incomingEstNotesHist),
                'quoteNumber' => trim((string)($data['quoteNumber'] ?? ($existing['quoteNumber'] ?? '-'))),
                'quoteStatus' => trim((string)($data['quoteStatus'] ?? ($existing['quoteStatus'] ?? 'Draft'))),
                'quoteNotes' => trim((string)($data['quoteNotes'] ?? ($existing['quoteNotes'] ?? '-'))),
                'quoteNotesHistory' => mergeNotesHistoryArrays($existing['quoteNotesHistory'] ?? [], $incomingQuoteNotesHist),
                'unifiedChatHistory' => mergeNotesHistoryArrays($existing['unifiedChatHistory'] ?? [], $incomingUnifiedChat)
            ];

            for ($s = 1; $s <= 8; $s++) {
                $val = $slotDocMap[$s] ?? trim((string)($data['extraImg' . $s] ?? ''));
                if ($val === '' && !empty($existing['extraImg' . $s])) {
                    $val = $existing['extraImg' . $s];
                }
                $record['extraImg' . $s] = $val;
            }
            if (!empty($slotDocMap[1])) {
                $record['docsText'] = $slotDocMap[1];
            }

            for ($r = 1; $r <= 8; $r++) {
                $val = $revDocMap[$r] ?? trim((string)($data['revGambar' . $r] ?? ''));
                if (($val === '' || $isSalesSide || $updatedBy === 'contract') && !empty($existing['revGambar' . $r])) {
                    $val = $existing['revGambar' . $r];
                }
                $record['revGambar' . $r] = $val;
            }

            for ($qp = 1; $qp <= 8; $qp++) {
                $k = 'quoteRev' . $qp;
                $val = $quoteDocMap[$k] ?? trim((string)($data[$k] ?? ''));
                if (($val === '' || $updatedBy !== 'contract') && !empty($existing[$k])) {
                    $val = $existing[$k];
                }
                $record[$k] = $val;
            }
            $finalDocVal = $quoteDocMap['quoteFinalDoc'] ?? trim((string)($data['quoteFinalDoc'] ?? ''));
            if (($finalDocVal === '' || $updatedBy !== 'contract') && !empty($existing['quoteFinalDoc'])) {
                $finalDocVal = $existing['quoteFinalDoc'];
            }
            $record['quoteFinalDoc'] = $finalDocVal;

            // Jaga kolom peran lain saat update parsial dari 1 perangkat
            if ($existingIdx >= 0) {
                if ($updatedBy === 'estimator' || $updatedBy === 'contract') {
                    foreach (['salesName', 'customerName', 'projectName', 'scopeOfWork', 'projectMaterial', 'requestDeadline', 'sourceDesc', 'uploadDateTime', 'salesNotes'] as $sf) {
                        if (!empty($existing[$sf]) && $existing[$sf] !== '-') {
                            $record[$sf] = $existing[$sf];
                        }
                    }
                    if (!empty($existing['salesNotesHistory']) && is_array($existing['salesNotesHistory'])) {
                        $record['salesNotesHistory'] = $existing['salesNotesHistory'];
                    }
                }
                if ($isSalesSide || $updatedBy === 'contract') {
                    if (!empty($existing['status']) && !isInitialQueueStatus($existing['status'])) $record['status'] = $existing['status'];
                    if (!empty($existing['estimatorName']) && $existing['estimatorName'] !== '(Belum dipilih)') $record['estimatorName'] = $existing['estimatorName'];
                    if (!empty($existing['estimateStartDate']) && $existing['estimateStartDate'] !== '-') $record['estimateStartDate'] = $existing['estimateStartDate'];
                    if (!empty($existing['estimateEndDate']) && $existing['estimateEndDate'] !== '-') $record['estimateEndDate'] = $existing['estimateEndDate'];
                    if (!empty($existing['estimatorNotes']) && $existing['estimatorNotes'] !== '-') $record['estimatorNotes'] = $existing['estimatorNotes'];
                    if (!empty($existing['estimatorNotesHistory']) && is_array($existing['estimatorNotesHistory'])) {
                        $record['estimatorNotesHistory'] = $existing['estimatorNotesHistory'];
                    }
                }
                if ($updatedBy !== 'contract') {
                    if (!empty($existing['quoteNumber']) && $existing['quoteNumber'] !== '-') $record['quoteNumber'] = $existing['quoteNumber'];
                    if (!empty($existing['quoteStatus']) && $existing['quoteStatus'] !== 'Draft') $record['quoteStatus'] = $existing['quoteStatus'];
                    if (!empty($existing['quoteNotes']) && $existing['quoteNotes'] !== '-') $record['quoteNotes'] = $existing['quoteNotes'];
                }
                $store['records'][$existingIdx] = $record;
                $operation = 'updated';
            } else {
                $store['records'][] = $record;
                $operation = 'inserted';
            }

            appendOnlineHistory(
                $store,
                $actorUsername,
                $actorKey,
                $deviceInfo,
                $operation === 'updated' ? 'UPDATE_DATA' : 'SIMPAN_DATA_BARU',
                $record['queueCode'],
                $record['customerName'] . ' / ' . $record['projectName'],
                $record['status'],
                'Sales: ' . $record['salesName'] . ' | Estimator: ' . $record['estimatorName'] . ' | SPH: ' . $record['quoteNumber'] . ' (' . $record['quoteStatus'] . ')'
            );

            $clientEventId = trim((string)($data['clientEventId'] ?? ''));
            $notifyEventType = trim((string)($data['notifyEventType'] ?? ''));
            $createdNotif = null;
            if ($notifyEventType === 'sales_form_new' || $updatedBy === 'sales_new' || ($operation === 'inserted' && $updatedBy !== 'estimator' && $updatedBy !== 'contract')) {
                $createdNotif = appendRealtimeNotification(
                    $store,
                    'sales_form_new',
                    'Form Gambar Proyek Baru Diinput Sales',
                    $record['salesName'] . ' mengisi Form Gambar Proyek: ' . $record['queueCode'] . ' - ' . $record['customerName'] . ' (' . $record['projectName'] . ')',
                    $record['salesName'] ?: $actorUsername,
                    $record['queueCode'],
                    $record['customerName'],
                    $record['projectName'],
                    $record['status'],
                    $clientEventId
                );
            } elseif ($notifyEventType === 'sales_form_edit' || ($updatedBy === 'sales' && $operation === 'updated')) {
                $salesActor = ($actorUsername !== '' && $actorUsername !== 'Sistem') ? $actorUsername : ($record['salesName'] ?: 'Sales');
                $createdNotif = appendRealtimeNotification(
                    $store,
                    'sales_form_edit',
                    'Edit Perubahan Data Gambar Sales',
                    $salesActor . ': Telah Melakukan Edit Data Sales — ' . $record['queueCode'] . ' - ' . $record['customerName'] . ' (' . $record['projectName'] . ')',
                    $salesActor,
                    $record['queueCode'],
                    $record['customerName'],
                    $record['projectName'],
                    $record['status'],
                    $clientEventId
                );
            } elseif ($notifyEventType === 'estimator_edit' || $updatedBy === 'estimator') {
                $estActor = ($actorUsername !== '' && $actorUsername !== 'Sistem') ? $actorUsername : (($record['estimatorName'] && $record['estimatorName'] !== '(Belum dipilih)') ? $record['estimatorName'] : 'Estimator');
                $createdNotif = appendRealtimeNotification(
                    $store,
                    'estimator_edit',
                    'Pembaruan Kelola Estimasi Estimator',
                    $estActor . ': Telah Melakukan Edit Data Estimator (' . $record['status'] . ') — ' . $record['queueCode'] . ' - ' . $record['customerName'] . ' (' . $record['projectName'] . ')',
                    $estActor,
                    $record['queueCode'],
                    $record['customerName'],
                    $record['projectName'],
                    $record['status'],
                    $clientEventId
                );
            } elseif ($notifyEventType === 'contract_edit' || $updatedBy === 'contract') {
                $contractActor = ($actorUsername !== '' && $actorUsername !== 'Sistem') ? $actorUsername : 'Admin Kontrak';
                $createdNotif = appendRealtimeNotification(
                    $store,
                    'contract_edit',
                    'Pembaruan Penawaran Admin Kontrak',
                    $contractActor . ': Telah Melakukan Edit Data Penawaran (' . $record['status'] . ') — ' . $record['queueCode'] . ' - ' . $record['customerName'] . ' (' . $record['projectName'] . ')',
                    $contractActor,
                    $record['queueCode'],
                    $record['customerName'],
                    $record['projectName'],
                    $record['status'],
                    $clientEventId
                );
            }

            $shouldSave = true;
            $pushDispatch = null;
            if (!empty($createdNotif) && !empty($store['pushSubscriptions'])) {
                $vapidKeys = ensureVapidKeys($store, $shouldSave);
                $pushDispatch = [
                    'vapidKeys' => $vapidKeys,
                    'subscriptions' => $store['pushSubscriptions'],
                    'notification' => $createdNotif
                ];
            }

            return [
                'success' => true,
                'status' => 'success',
                'operation' => $operation,
                'queueCode' => $record['queueCode'],
                'customerFolderUrl' => $record['customerFolderUrl'],
                'filesUploaded' => $filesUploaded,
                'revFilesUploaded' => $revFilesUploaded,
                'quoteFilesUploaded' => $quoteFilesUploaded,
                'notification' => $createdNotif,
                '__pushDispatch' => $pushDispatch,
                'message' => 'Data ' . $record['queueCode'] . ' berhasil tersimpan ke Cloud Server Hosting!'
            ];
        }, true);

        $pushDispatch = $res['__pushDispatch'] ?? null;
        unset($res['__pushDispatch']);
        if (!empty($pushDispatch)) {
            $pushResult = dispatchWebPushBatch($pushDispatch['vapidKeys'], $pushDispatch['subscriptions'], $pushDispatch['notification']);
            $res['pushStats'] = $pushResult['stats'];
            if (!empty($pushResult['expiredEndpoints'])) {
                pruneExpiredPushSubscriptions($pushResult['expiredEndpoints']);
            }
        }

        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- F. Simpan Push Subscription perangkat (Browser / PWA HP & Desktop) ---
    if ($postAction === 'save_push_subscription') {
        $sub = is_array($data['subscription'] ?? null) ? $data['subscription'] : $data;
        $endpoint = trim((string)($sub['endpoint'] ?? ''));
        $keysObj = is_array($sub['keys'] ?? null) ? $sub['keys'] : [];
        $p256dh = trim((string)($keysObj['p256dh'] ?? $data['p256dh'] ?? ''));
        $auth = trim((string)($keysObj['auth'] ?? $data['auth'] ?? ''));
        $rawPub = pushBase64UrlDecode($p256dh);
        $rawAuth = pushBase64UrlDecode($auth);

        if ($endpoint === '' || strlen($rawPub) !== 65 || ord($rawPub[0]) !== 0x04 || strlen($rawAuth) !== 16) {
            sendJsonResponse(['success' => false, 'status' => 'error', 'message' => 'Subscription Web Push tidak valid.'], 400);
        }

        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($endpoint, $p256dh, $auth, $data) {
            $vapidKeys = ensureVapidKeys($store, $shouldSave);
            $subs = is_array($store['pushSubscriptions'] ?? null) ? $store['pushSubscriptions'] : [];
            $nowMs = (int)round(microtime(true) * 1000);
            $entry = [
                'endpoint' => $endpoint,
                'keys' => [
                    'p256dh' => $p256dh,
                    'auth' => $auth
                ],
                'username' => trim((string)($data['username'] ?? '')) ?: 'Anonymous',
                'role' => trim((string)($data['role'] ?? '')) ?: 'guest',
                'deviceLabel' => trim((string)($data['deviceLabel'] ?? '')) ?: 'Browser',
                'updatedAtMs' => $nowMs
            ];
            $updated = false;
            foreach ($subs as &$existing) {
                if (($existing['endpoint'] ?? '') === $endpoint) {
                    $existing = array_merge($existing, $entry);
                    $updated = true;
                    break;
                }
            }
            unset($existing);
            if (!$updated) {
                array_unshift($subs, $entry);
            }
            if (count($subs) > 200) {
                $subs = array_slice($subs, 0, 200);
            }
            $store['pushSubscriptions'] = $subs;
            $shouldSave = true;
            return [
                'success' => true,
                'status' => 'success',
                'publicKey' => $vapidKeys['publicKeyB64'],
                'subscriberCount' => count($subs)
            ];
        }, true);

        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- G. Hapus Push Subscription perangkat ---
    if ($postAction === 'remove_push_subscription') {
        $endpoint = trim((string)($data['endpoint'] ?? ($data['subscription']['endpoint'] ?? '')));
        $res = withDatabaseStore(function (&$store, &$shouldSave) use ($endpoint) {
            $subs = is_array($store['pushSubscriptions'] ?? null) ? $store['pushSubscriptions'] : [];
            $before = count($subs);
            if ($endpoint !== '') {
                $subs = array_values(array_filter($subs, function ($s) use ($endpoint) {
                    return ($s['endpoint'] ?? '') !== $endpoint;
                }));
            }
            if (count($subs) !== $before) {
                $store['pushSubscriptions'] = $subs;
                $shouldSave = true;
            }
            return [
                'success' => true,
                'status' => 'success',
                'subscriberCount' => count($subs)
            ];
        }, true);
        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- H. Relay Web Push untuk mode Google Apps Script / Test Push ---
    if ($postAction === 'relay_push' || $postAction === 'test_push') {
        $n = is_array($data['notification'] ?? null) ? $data['notification'] : $data;
        $eventType = trim((string)($n['eventType'] ?? ($postAction === 'test_push' ? 'test_push' : 'activity')));
        $title = trim((string)($n['title'] ?? ($postAction === 'test_push' ? 'Tes Push Notifikasi Latar Belakang' : 'Notifikasi Aktivitas Proyek')));
        $message = trim((string)($n['message'] ?? ($postAction === 'test_push' ? 'Notifikasi latar belakang & suara aktif meskipun tab ditutup.' : '-')));
        $actor = trim((string)($n['actor'] ?? ($data['actorUsername'] ?? 'Sistem')));
        $queueCode = trim((string)($n['queueCode'] ?? '-'));
        $customerName = trim((string)($n['customerName'] ?? '-'));
        $projectName = trim((string)($n['projectName'] ?? '-'));
        $status = trim((string)($n['status'] ?? '-'));
        $clientEventId = trim((string)($n['id'] ?? $n['clientEventId'] ?? $data['clientEventId'] ?? ''));
        $targetEndpoint = trim((string)($data['targetEndpoint'] ?? ''));

        $res = withDatabaseStore(function (&$store, &$shouldSave) use (
            $eventType, $title, $message, $actor, $queueCode, $customerName, $projectName, $status, $clientEventId, $targetEndpoint
        ) {
            $vapidKeys = ensureVapidKeys($store, $shouldSave);
            $createdNotif = appendRealtimeNotification(
                $store,
                $eventType,
                $title,
                $message,
                $actor,
                $queueCode,
                $customerName,
                $projectName,
                $status,
                $clientEventId
            );
            $shouldSave = true;
            $subs = is_array($store['pushSubscriptions'] ?? null) ? $store['pushSubscriptions'] : [];
            if ($targetEndpoint !== '') {
                $subs = array_values(array_filter($subs, function ($s) use ($targetEndpoint) {
                    return ($s['endpoint'] ?? '') === $targetEndpoint;
                }));
            }
            return [
                'success' => true,
                'status' => 'success',
                'notification' => $createdNotif,
                '__pushDispatch' => !empty($subs) ? [
                    'vapidKeys' => $vapidKeys,
                    'subscriptions' => $subs,
                    'notification' => $createdNotif
                ] : null
            ];
        }, true);

        $pushDispatch = $res['__pushDispatch'] ?? null;
        unset($res['__pushDispatch']);
        $res['pushStats'] = ['total' => 0, 'sent' => 0, 'failed' => 0, 'expired' => 0];
        if (!empty($pushDispatch)) {
            $pushResult = dispatchWebPushBatch($pushDispatch['vapidKeys'], $pushDispatch['subscriptions'], $pushDispatch['notification']);
            $res['pushStats'] = $pushResult['stats'];
            if (!empty($pushResult['expiredEndpoints'])) {
                pruneExpiredPushSubscriptions($pushResult['expiredEndpoints']);
            }
        }
        sendJsonResponse($res, isset($res['error']) ? 500 : 200);
    }

    // --- I. Fallback kompatibel bila format payload Millagen lama dikirim ---
    if (isset($data['members']) || isset($data['pins'])) {
        $legacyPayload = $securityHeader . json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $ok = @file_put_contents($legacyMillagenFile, $legacyPayload, LOCK_EX);
        sendJsonResponse(['success' => ($ok !== false), 'status' => ($ok !== false ? 'success' : 'error')]);
    }

    sendJsonResponse(['success' => false, 'status' => 'error', 'message' => 'Action POST tidak dikenal.'], 400);
}

// Respon default informasi layanan API
sendJsonResponse([
    'success' => true,
    'status' => 'active',
    'mode' => 'php_cloud',
    'message' => 'Cloud API Service Antrian Gambar Estimator siap digunakan.',
    'endpoints' => [
        'status' => 'GET api.php?action=status',
        'login_sync' => 'GET api.php?action=login_sync&userKey=...&authHash=...',
        'get_profile_and_history' => 'GET api.php?action=get_profile_and_history&userKey=...&authHash=...',
        'get_rows' => 'GET api.php?action=get_rows',
        'get_notifications' => 'GET api.php?action=get_notifications',
        'get_vapid_key' => 'GET api.php?action=get_vapid_key',
        'save_row' => 'POST api.php (JSON action=save_row)',
        'send_project_chat' => 'POST api.php (JSON action=send_project_chat)',
        'save_push_subscription' => 'POST api.php (JSON action=save_push_subscription)',
        'relay_push' => 'POST api.php (JSON action=relay_push)',
        'save_user_profile' => 'POST api.php (JSON action=save_user_profile)',
        'backup' => 'GET api.php?action=backup'
    ]
]);
