<?php
declare(strict_types=1);

/**
 * Comprobación de la instalación. Abre esta URL con el token para ver de un
 * vistazo si la API está bien montada:
 *
 *   https://tudominio.com/api/selftest.php?token=EL_TOKEN
 *
 * Sin token responde sólo que la API está viva, sin dar detalles.
 */

require __DIR__ . '/lib.php';

cors();

$given = (string) ($_GET['token'] ?? '');
if ($given === '') {
    json_out(200, ['ok' => true, 'message' => 'API viva. Añade ?token=… para la comprobación completa.']);
}

if (!hash_equals((string) (config()['token'] ?? ''), $given)) {
    fail(401, 'Token no válido.');
}

$checks = [];
$ok = true;

$checks['php'] = PHP_VERSION;
$checks['pdo_mysql'] = extension_loaded('pdo_mysql');
$ok = $ok && $checks['pdo_mysql'];

try {
    $pdo = db();
    $checks['conexion'] = true;

    ensure_schema($pdo);
    $tables = [];
    foreach ($pdo->query('SHOW TABLES') as $row) {
        $tables[] = (string) array_values($row)[0];
    }
    $expected = ['adjustments', 'intake', 'intake_meals', 'meals', 'meta', 'profile', 'reminders', 'session_sets', 'sessions', 'weights'];
    $missing = array_values(array_diff($expected, $tables));
    $checks['tablas'] = count($expected) - count($missing) . ' de ' . count($expected);
    $checks['faltan'] = $missing;
    $ok = $ok && $missing === [];

    $meta = $pdo->query('SELECT revision, updated_at FROM meta WHERE id = 1')->fetch() ?: [];
    $checks['revision'] = (int) ($meta['revision'] ?? 0);
    $checks['ultima_escritura'] = $meta['updated_at'] ?? null;

    $counts = [];
    foreach (['weights', 'intake', 'sessions', 'meals', 'reminders'] as $t) {
        $counts[$t] = (int) $pdo->query("SELECT COUNT(*) AS n FROM {$t}")->fetch()['n'];
    }
    $checks['filas'] = $counts;
} catch (Throwable $e) {
    $ok = false;
    $checks['error'] = $e->getMessage();
}

$checks['https'] = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
if (!$checks['https']) {
    $checks['aviso'] = 'La API no va por HTTPS: el token viaja en claro. Activa SSL en hPanel.';
}

json_out($ok ? 200 : 500, ['ok' => $ok, 'checks' => $checks]);
