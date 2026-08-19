<?php
declare(strict_types=1);

/**
 * Utilidades comunes de la API: configuración, conexión, autenticación,
 * CORS y creación del esquema.
 */

function config(): array
{
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/config.php';
        if (!is_file($path)) {
            fail(500, 'Falta api/config.php en el servidor. Copia api/config.example.php y rellénalo.');
        }
        $config = require $path;
    }
    return $config;
}

function json_out(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $message): void
{
    json_out($status, ['error' => $message]);
}

/** Cabeceras CORS: sólo para desarrollo local; en producción es mismo origen. */
function cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && in_array($origin, config()['allowed_origins'] ?? [], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
        header('Access-Control-Max-Age: 86400');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function require_token(): void
{
    $expected = (string) (config()['token'] ?? '');
    if ($expected === '') {
        fail(500, 'No hay token configurado en api/config.php.');
    }

    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    }

    $given = '';
    if (preg_match('/^Bearer\s+(.+)$/i', trim($header), $m)) {
        $given = trim($m[1]);
    }

    if ($given === '' || !hash_equals($expected, $given)) {
        fail(401, 'Token no válido.');
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = config()['db'];
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $c['host'], $c['name'], $c['charset'] ?? 'utf8mb4');
        try {
            $pdo = new PDO($dsn, $c['user'], $c['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            fail(500, 'No se pudo conectar con la base de datos: ' . $e->getMessage());
        }
    }
    return $pdo;
}

/** Sentencias de creación del esquema, en orden. */
function schema_statements(): array
{
    return [
        "CREATE TABLE IF NOT EXISTS meta (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS profile (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            height_cm DECIMAL(5,1) NOT NULL,
            start_weight_kg DECIMAL(5,2) NOT NULL,
            kcal_floor SMALLINT UNSIGNED NOT NULL,
            kcal_target SMALLINT UNSIGNED NOT NULL,
            protein_target SMALLINT UNSIGNED NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS meals (
            id VARCHAR(32) NOT NULL PRIMARY KEY,
            label VARCHAR(80) NOT NULL,
            anchor VARCHAR(80) NOT NULL DEFAULT '',
            kcal SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            protein SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS weights (
            `date` DATE NOT NULL PRIMARY KEY,
            kg DECIMAL(5,2) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS intake (
            `date` DATE NOT NULL PRIMARY KEY,
            extra_kcal MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
            extra_protein MEDIUMINT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS intake_meals (
            `date` DATE NOT NULL,
            meal_id VARCHAR(32) NOT NULL,
            PRIMARY KEY (`date`, meal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS sessions (
            `date` DATE NOT NULL PRIMARY KEY,
            `day` CHAR(1) NOT NULL,
            notes TEXT NULL,
            created_at BIGINT UNSIGNED NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS session_sets (
            session_date DATE NOT NULL,
            exercise_id VARCHAR(40) NOT NULL,
            set_index TINYINT UNSIGNED NOT NULL,
            weight DECIMAL(6,2) NOT NULL DEFAULT 0,
            reps SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY (session_date, exercise_id, set_index)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS adjustments (
            week_key DATE NOT NULL PRIMARY KEY,
            delta_kg DECIMAL(5,2) NOT NULL DEFAULT 0,
            proposed_kcal MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
            previous_kcal MEDIUMINT UNSIGNED NOT NULL DEFAULT 0,
            decision VARCHAR(10) NOT NULL DEFAULT 'dismissed',
            decided_at BIGINT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS backups (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            revision BIGINT UNSIGNED NOT NULL,
            created_at DATETIME NOT NULL,
            payload MEDIUMTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS reminders (
            id VARCHAR(32) NOT NULL PRIMARY KEY,
            label VARCHAR(80) NOT NULL,
            `time` TIME NOT NULL,
            days VARCHAR(20) NOT NULL DEFAULT '0,1,2,3,4,5,6',
            enabled TINYINT(1) NOT NULL DEFAULT 1,
            kind VARCHAR(16) NOT NULL DEFAULT 'other',
            detail VARCHAR(160) NULL,
            sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];
}

/** Crea las tablas si no existen. Sólo hace trabajo la primera vez. */
function ensure_schema(PDO $pdo): void
{
    try {
        $row = $pdo->query('SELECT revision FROM meta WHERE id = 1')->fetch();
        if ($row !== false) {
            return;
        }
    } catch (PDOException $e) {
        // la tabla no existe todavía: seguimos y creamos el esquema
        foreach (schema_statements() as $sql) {
            $pdo->exec($sql);
        }
    }

    // Las tablas existen pero falta la fila de control.
    $pdo->exec("INSERT IGNORE INTO meta (id, revision, updated_at) VALUES (1, 0, UTC_TIMESTAMP())");
}
