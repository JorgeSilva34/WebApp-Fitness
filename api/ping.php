<?php
// Diagnóstico mínimo: no carga configuración, ni base de datos, ni nada.
// Si esto responde y selftest.php no, el problema está en config.php o en MySQL.
// Si esto tampoco responde, el problema es del servidor: versión de PHP o .htaccess.
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => true,
    'php' => PHP_VERSION,
    'pdo_mysql' => extension_loaded('pdo_mysql'),
    'hay_config' => is_file(__DIR__ . '/config.php'),
    'archivos' => array_values(array_diff(scandir(__DIR__), ['.', '..', 'config.php'])),
    'https' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https',
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
