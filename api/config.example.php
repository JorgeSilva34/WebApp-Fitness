<?php
// Copia este archivo como api/config.php DIRECTAMENTE EN EL SERVIDOR
// (hPanel → Administrador de archivos) y rellena los valores.
//
// config.php no está en el repositorio ni se sube por FTP: así las credenciales
// no viajan a GitHub y un despliegue nunca las pisa.

return [
    'db' => [
        'host' => 'localhost',       // en Hostinger casi siempre localhost
        'name' => 'u123456789_webfit',
        'user' => 'u123456789_jorge',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],

    // Cadena larga y aleatoria. Es la única credencial de la API: quien la tenga
    // puede leer y escribir tus datos. Genera una con:
    //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    'token' => '',

    // Orígenes permitidos por CORS. La app publicada va en el mismo dominio que
    // la API, así que sólo hace falta para desarrollo local.
    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
];
