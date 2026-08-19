<?php
declare(strict_types=1);

/**
 * Estado completo de la aplicación.
 *
 *   GET  /api/state.php            → { revision, updatedAt, empty, store }
 *   PUT  /api/state.php            → cuerpo { revision, store }
 *                                    409 si la revisión no es la actual
 *   PUT  /api/state.php?force=1    → sobrescribe sin comprobar la revisión
 *
 * El cliente manda el objeto entero y el servidor lo reescribe dentro de una
 * transacción: mismo modelo de escritura atómica que en el navegador, pero en
 * tablas de verdad.
 */

require __DIR__ . '/lib.php';
require __DIR__ . '/store.php';

cors();
require_token();

$pdo = db();
ensure_schema($pdo);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $meta = $pdo->query('SELECT revision, updated_at FROM meta WHERE id = 1')->fetch() ?: null;
    json_out(200, [
        'revision' => (int) ($meta['revision'] ?? 0),
        'updatedAt' => $meta['updated_at'] ?? null,
        'empty' => (int) ($meta['revision'] ?? 0) === 0,
        'store' => read_store($pdo),
    ]);
}

if ($method !== 'PUT' && $method !== 'POST') {
    fail(405, 'Método no permitido.');
}

$raw = file_get_contents('php://input');
$body = json_decode($raw === false ? '' : $raw, true);
if (!is_array($body) || !isset($body['store']) || !is_array($body['store'])) {
    fail(400, 'Cuerpo no válido: falta "store".');
}

$force = isset($_GET['force']) && $_GET['force'] !== '0';
$clientRevision = isset($body['revision']) ? (int) $body['revision'] : 0;

$pdo->beginTransaction();
try {
    $row = $pdo->query('SELECT revision FROM meta WHERE id = 1 FOR UPDATE')->fetch();
    $current = (int) ($row['revision'] ?? 0);

    if (!$force && $clientRevision !== $current) {
        $pdo->rollBack();
        json_out(409, [
            'error' => 'conflict',
            'revision' => $current,
            'store' => read_store($pdo),
        ]);
    }

    if ($current > 0) {
        keep_backup($pdo, $current);
    }

    write_store($pdo, $body['store']);

    $next = $current + 1;
    // REPLACE en vez de UPDATE: funciona igual si la fila de control no existe.
    $stmt = $pdo->prepare('REPLACE INTO meta (id, revision, updated_at) VALUES (1, ?, UTC_TIMESTAMP())');
    $stmt->execute([$next]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fail(500, 'No se pudo guardar: ' . $e->getMessage());
}

json_out(200, ['revision' => $next, 'saved' => true]);
