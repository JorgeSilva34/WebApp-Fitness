<?php
declare(strict_types=1);

/**
 * Comprobación de la instalación. Abre esta URL con el token para ver de un
 * vistazo si la API está bien montada:
 *
 *   https://tudominio.com/api/selftest.php?token=EL_TOKEN
 *
 * Añadiendo &roundtrip=1 escribe un estado de ejemplo, lo relee y compara, todo
 * dentro de una transacción que se deshace: comprueba el mapeo a las tablas sin
 * tocar tus datos.
 *
 * Sin token responde sólo que la API está viva, sin dar detalles.
 */

require __DIR__ . '/lib.php';
require __DIR__ . '/store.php';

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
    $expected = ['adjustments', 'backups', 'intake', 'intake_meals', 'meals', 'meta', 'profile', 'reminders', 'session_sets', 'sessions', 'weights'];
    $missing = array_values(array_diff($expected, $tables));
    $checks['tablas'] = (count($expected) - count($missing)) . ' de ' . count($expected);
    $checks['faltan'] = $missing;
    $ok = $ok && $missing === [];

    $meta = $pdo->query('SELECT revision, updated_at FROM meta WHERE id = 1')->fetch() ?: [];
    $checks['revision'] = (int) ($meta['revision'] ?? 0);
    $checks['ultima_escritura'] = $meta['updated_at'] ?? null;

    $counts = [];
    foreach (['weights', 'intake', 'sessions', 'meals', 'reminders', 'backups'] as $t) {
        $counts[$t] = (int) $pdo->query("SELECT COUNT(*) AS n FROM {$t}")->fetch()['n'];
    }
    $checks['filas'] = $counts;
} catch (Throwable $e) {
    $ok = false;
    $checks['error'] = $e->getMessage();
}

// Viaje de ida y vuelta contra MySQL de verdad: escribe un estado de ejemplo,
// lo vuelve a leer y compara. Todo dentro de una transacción que se deshace al
// final, así que no toca los datos reales. Es la comprobación que no se puede
// hacer sin base de datos delante.
if (isset($_GET['roundtrip']) && $_GET['roundtrip'] !== '0' && empty($checks['error'])) {
    $sample = [
        'version' => 1,
        'profile' => [
            'heightCm' => 187.5,
            'startWeightKg' => 59.4,
            'kcalFloor' => 2200,
            'kcalTarget' => 3200,
            'proteinTarget' => 120,
        ],
        'meals' => [
            ['id' => 'm1', 'label' => 'Batido al levantarme', 'anchor' => 'Al levantarme', 'kcal' => 800, 'protein' => 35],
            ['id' => 'm2', 'label' => 'Cena', 'anchor' => 'Antes de acostarme', 'kcal' => 700, 'protein' => 30],
        ],
        'weights' => [
            ['date' => '2026-01-02', 'kg' => 59.4],
            ['date' => '2026-01-03', 'kg' => 59.65],
        ],
        'intake' => [
            '2026-01-02' => ['logged' => ['m1', 'm2'], 'extraKcal' => 120, 'extraProtein' => 8],
        ],
        'sessions' => [
            [
                'date' => '2026-01-02',
                'day' => 'A',
                'entries' => ['squat' => [['weight' => 42.5, 'reps' => 6], ['weight' => 42.5, 'reps' => 5]]],
                'notes' => 'prueba de ida y vuelta',
                'createdAt' => 1767312000000,
            ],
        ],
        'adjustments' => [
            [
                'weekKey' => '2026-01-04',
                'deltaKg' => 0.35,
                'proposedKcal' => 3450,
                'previousKcal' => 3200,
                'decision' => 'accepted',
                'decidedAt' => 1767312000000,
            ],
        ],
        'reminders' => [
            ['id' => 'r1', 'label' => 'Cena', 'time' => '00:30', 'days' => [0, 3], 'enabled' => true, 'kind' => 'meal', 'detail' => '~700 kcal'],
        ],
    ];

    $pdo = db();
    $pdo->beginTransaction();
    try {
        write_store($pdo, $sample);
        $back = read_store($pdo);
        $esperado = json_encode($sample, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $obtenido = json_encode($back, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $checks['roundtrip'] = $esperado === $obtenido;
        if ($esperado !== $obtenido) {
            $ok = false;
            $checks['roundtrip_esperado'] = $esperado;
            $checks['roundtrip_obtenido'] = $obtenido;
        }
    } catch (Throwable $e) {
        $ok = false;
        $checks['roundtrip'] = false;
        $checks['roundtrip_error'] = $e->getMessage();
    } finally {
        if ($pdo->inTransaction()) {
            $pdo->rollBack(); // nada de esto se queda guardado
        }
    }
}

$checks['https'] = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
if (!$checks['https']) {
    $checks['aviso'] = 'La API no va por HTTPS: el token viaja en claro. Activa SSL en hPanel.';
}

json_out($ok ? 200 : 500, ['ok' => $ok, 'checks' => $checks]);
