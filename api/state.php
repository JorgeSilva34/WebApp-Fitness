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

// ---------------------------------------------------------------- lectura ---

function read_store(PDO $pdo): array
{
    $profile = $pdo->query('SELECT * FROM profile WHERE id = 1')->fetch() ?: null;

    $meals = [];
    foreach ($pdo->query('SELECT * FROM meals ORDER BY sort_order, id') as $r) {
        $meals[] = [
            'id' => (string) $r['id'],
            'label' => (string) $r['label'],
            'anchor' => (string) $r['anchor'],
            'kcal' => (int) $r['kcal'],
            'protein' => (int) $r['protein'],
        ];
    }

    $weights = [];
    foreach ($pdo->query('SELECT * FROM weights ORDER BY `date`') as $r) {
        $weights[] = ['date' => (string) $r['date'], 'kg' => (float) $r['kg']];
    }

    $intake = [];
    foreach ($pdo->query('SELECT * FROM intake') as $r) {
        $intake[(string) $r['date']] = [
            'logged' => [],
            'extraKcal' => (int) $r['extra_kcal'],
            'extraProtein' => (int) $r['extra_protein'],
        ];
    }
    foreach ($pdo->query('SELECT * FROM intake_meals ORDER BY `date`, meal_id') as $r) {
        $date = (string) $r['date'];
        if (!isset($intake[$date])) {
            $intake[$date] = ['logged' => [], 'extraKcal' => 0, 'extraProtein' => 0];
        }
        $intake[$date]['logged'][] = (string) $r['meal_id'];
    }

    $sessions = [];
    $index = [];
    foreach ($pdo->query('SELECT * FROM sessions ORDER BY `date`') as $r) {
        $date = (string) $r['date'];
        $session = [
            'date' => $date,
            'day' => (string) $r['day'],
            'entries' => (object) [],
            'entriesMap' => [],
        ];
        if ($r['notes'] !== null && $r['notes'] !== '') {
            $session['notes'] = (string) $r['notes'];
        }
        if ($r['created_at'] !== null) {
            $session['createdAt'] = (int) $r['created_at'];
        }
        $index[$date] = count($sessions);
        $sessions[] = $session;
    }
    foreach ($pdo->query('SELECT * FROM session_sets ORDER BY session_date, exercise_id, set_index') as $r) {
        $date = (string) $r['session_date'];
        if (!isset($index[$date])) {
            continue;
        }
        $sessions[$index[$date]]['entriesMap'][(string) $r['exercise_id']][] = [
            'weight' => (float) $r['weight'],
            'reps' => (int) $r['reps'],
        ];
    }
    foreach ($sessions as $i => $s) {
        $sessions[$i]['entries'] = $s['entriesMap'] === [] ? (object) [] : $s['entriesMap'];
        unset($sessions[$i]['entriesMap']);
    }

    $adjustments = [];
    foreach ($pdo->query('SELECT * FROM adjustments ORDER BY week_key') as $r) {
        $adjustments[] = [
            'weekKey' => (string) $r['week_key'],
            'deltaKg' => (float) $r['delta_kg'],
            'proposedKcal' => (int) $r['proposed_kcal'],
            'previousKcal' => (int) $r['previous_kcal'],
            'decision' => (string) $r['decision'],
            'decidedAt' => (int) $r['decided_at'],
        ];
    }

    $reminders = [];
    foreach ($pdo->query('SELECT * FROM reminders ORDER BY sort_order, `time`') as $r) {
        $reminder = [
            'id' => (string) $r['id'],
            'label' => (string) $r['label'],
            'time' => substr((string) $r['time'], 0, 5),
            'days' => parse_days((string) $r['days']),
            'enabled' => (bool) $r['enabled'],
            'kind' => (string) $r['kind'],
        ];
        if ($r['detail'] !== null && $r['detail'] !== '') {
            $reminder['detail'] = (string) $r['detail'];
        }
        $reminders[] = $reminder;
    }

    return [
        'version' => 1,
        'profile' => [
            'heightCm' => (float) ($profile['height_cm'] ?? 187),
            'startWeightKg' => (float) ($profile['start_weight_kg'] ?? 59),
            'kcalFloor' => (int) ($profile['kcal_floor'] ?? 2200),
            'kcalTarget' => (int) ($profile['kcal_target'] ?? 3200),
            'proteinTarget' => (int) ($profile['protein_target'] ?? 120),
        ],
        'meals' => $meals,
        'weights' => $weights,
        'intake' => $intake === [] ? (object) [] : $intake,
        'sessions' => $sessions,
        'adjustments' => $adjustments,
        'reminders' => $reminders,
    ];
}

/** "0,3,5" → [0, 3, 5]. Una cadena vacía son cero días, no el domingo. */
function parse_days(string $raw): array
{
    if (trim($raw) === '') {
        return [];
    }
    return array_values(array_filter(
        array_map('intval', explode(',', $raw)),
        fn($d) => $d >= 0 && $d <= 6
    ));
}

// --------------------------------------------------------------- escritura ---

function num($value, float $fallback = 0): float
{
    return is_numeric($value) ? (float) $value : $fallback;
}

function text($value, string $fallback = ''): string
{
    return is_string($value) ? $value : $fallback;
}

function write_store(PDO $pdo, array $store): void
{
    foreach (['intake_meals', 'intake', 'session_sets', 'sessions', 'weights', 'adjustments', 'meals', 'reminders'] as $table) {
        $pdo->exec("DELETE FROM {$table}");
    }

    $p = is_array($store['profile'] ?? null) ? $store['profile'] : [];
    $pdo->prepare(
        'REPLACE INTO profile (id, height_cm, start_weight_kg, kcal_floor, kcal_target, protein_target)
         VALUES (1, ?, ?, ?, ?, ?)'
    )->execute([
        (int) num($p['heightCm'] ?? null, 187),
        num($p['startWeightKg'] ?? null, 59),
        (int) num($p['kcalFloor'] ?? null, 2200),
        (int) num($p['kcalTarget'] ?? null, 3200),
        (int) num($p['proteinTarget'] ?? null, 120),
    ]);

    $stmt = $pdo->prepare('INSERT INTO meals (id, label, anchor, kcal, protein, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    foreach (array_values((array) ($store['meals'] ?? [])) as $i => $m) {
        if (!is_array($m) || !isset($m['id'])) {
            continue;
        }
        $stmt->execute([
            text($m['id']),
            text($m['label'] ?? '', 'Toma'),
            text($m['anchor'] ?? ''),
            (int) num($m['kcal'] ?? null),
            (int) num($m['protein'] ?? null),
            $i,
        ]);
    }

    $stmt = $pdo->prepare('INSERT INTO weights (`date`, kg) VALUES (?, ?)');
    foreach ((array) ($store['weights'] ?? []) as $w) {
        if (!is_array($w) || !is_string($w['date'] ?? null)) {
            continue;
        }
        $stmt->execute([$w['date'], num($w['kg'] ?? null)]);
    }

    $intakeStmt = $pdo->prepare('INSERT INTO intake (`date`, extra_kcal, extra_protein) VALUES (?, ?, ?)');
    $loggedStmt = $pdo->prepare('INSERT IGNORE INTO intake_meals (`date`, meal_id) VALUES (?, ?)');
    foreach ((array) ($store['intake'] ?? []) as $date => $d) {
        if (!is_string($date) || !is_array($d)) {
            continue;
        }
        $intakeStmt->execute([$date, (int) num($d['extraKcal'] ?? null), (int) num($d['extraProtein'] ?? null)]);
        foreach ((array) ($d['logged'] ?? []) as $mealId) {
            if (is_string($mealId)) {
                $loggedStmt->execute([$date, $mealId]);
            }
        }
    }

    $sessionStmt = $pdo->prepare('INSERT INTO sessions (`date`, `day`, notes, created_at) VALUES (?, ?, ?, ?)');
    $setStmt = $pdo->prepare(
        'INSERT INTO session_sets (session_date, exercise_id, set_index, weight, reps) VALUES (?, ?, ?, ?, ?)'
    );
    foreach ((array) ($store['sessions'] ?? []) as $s) {
        if (!is_array($s) || !is_string($s['date'] ?? null)) {
            continue;
        }
        $day = ($s['day'] ?? 'A') === 'B' ? 'B' : 'A';
        $sessionStmt->execute([
            $s['date'],
            $day,
            isset($s['notes']) && is_string($s['notes']) ? $s['notes'] : null,
            isset($s['createdAt']) ? (int) num($s['createdAt']) : null,
        ]);
        foreach ((array) ($s['entries'] ?? []) as $exerciseId => $sets) {
            if (!is_string($exerciseId) || !is_array($sets)) {
                continue;
            }
            foreach (array_values($sets) as $i => $set) {
                if (!is_array($set)) {
                    continue;
                }
                $setStmt->execute([$s['date'], $exerciseId, $i, num($set['weight'] ?? null), (int) num($set['reps'] ?? null)]);
            }
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO adjustments (week_key, delta_kg, proposed_kcal, previous_kcal, decision, decided_at)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ((array) ($store['adjustments'] ?? []) as $a) {
        if (!is_array($a) || !is_string($a['weekKey'] ?? null)) {
            continue;
        }
        $stmt->execute([
            $a['weekKey'],
            num($a['deltaKg'] ?? null),
            (int) num($a['proposedKcal'] ?? null),
            (int) num($a['previousKcal'] ?? null),
            ($a['decision'] ?? '') === 'accepted' ? 'accepted' : 'dismissed',
            (int) num($a['decidedAt'] ?? null),
        ]);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO reminders (id, label, `time`, days, enabled, kind, detail, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach (array_values((array) ($store['reminders'] ?? [])) as $i => $r) {
        if (!is_array($r) || !isset($r['id'])) {
            continue;
        }
        $time = text($r['time'] ?? '', '12:00');
        $days = array_values(array_filter(
            array_map('intval', (array) ($r['days'] ?? [])),
            fn($d) => $d >= 0 && $d <= 6
        ));
        $stmt->execute([
            text($r['id']),
            text($r['label'] ?? '', 'Recordatorio'),
            preg_match('/^\d{2}:\d{2}$/', $time) ? $time . ':00' : '12:00:00',
            $days === [] ? '' : implode(',', $days),
            !empty($r['enabled']) ? 1 : 0,
            in_array($r['kind'] ?? '', ['meal', 'supplement', 'training', 'other'], true) ? $r['kind'] : 'other',
            isset($r['detail']) && is_string($r['detail']) && $r['detail'] !== '' ? $r['detail'] : null,
            $i,
        ]);
    }
}
