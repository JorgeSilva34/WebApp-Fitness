# WebFit

Aplicación personal de seguimiento de fuerza e ingesta. Un solo usuario, sin
cuentas ni registro. Los datos viven en el navegador y, opcionalmente, se
sincronizan con una base de datos MySQL propia para verlos desde cualquier
dispositivo.

No es un registro de entrenamiento con un módulo de dieta añadido: es una
herramienta de adherencia para alguien a quien comer le cuesta y tiene un
horario tardío. El resto está subordinado a eso.

## Cómo se usa

```bash
npm install
npm run dev
```

| Comando         | Qué hace                                                       |
| --------------- | -------------------------------------------------------------- |
| `npm run dev`   | Servidor de desarrollo en http://localhost:5173                 |
| `npm run build` | Genera `dist/` (incluye el service worker de la PWA)            |
| `npm run preview` | Sirve `dist/` para comprobar la PWA y el modo sin conexión    |
| `npm test`      | Comprueba la lógica pura (progresión, umbrales, ajuste semanal, import/export) y la sintaxis de la API en PHP |
| `npm run mock-api` | API de pruebas en local para probar la sincronización sin PHP ni MySQL |
| `npm run icons` | Regenera los iconos PNG de `public/`                            |

## Decisiones que conviene no deshacer

- **Suelo y objetivo, dos marcas.** Alcanzar el suelo ya es un día cumplido. Un
  día por debajo se muestra en estado neutro, nunca como fracaso.
- **Sin rachas.** No hay contadores que se reinicien a cero. Es el mecanismo que
  provoca el abandono en este perfil.
- **Las tomas se anclan a eventos**, no a horas: «al levantarme», «al volver de
  entrenar». Registrar una toma es un toque.
- **El día cambia a las 05:00**, no a medianoche (`DAY_ROLLOVER_HOUR` en
  `src/lib/date.ts`): una cena a las 03:00 cuenta en la jornada correcta.
- **El ajuste calórico se propone, nunca se aplica solo**, y requiere 4 pesajes
  en cada una de las dos semanas comparadas.
- **El bloque torácico es fijo**, aparece siempre y no es opcional.
- **La progresión nunca sugiere fallo ni series de una repetición máxima.**

## Estructura

```
src/lib/        modelo, persistencia y toda la lógica (sin React salvo store.tsx)
  types.ts        el tipo Store y el resto del modelo
  storage.ts      única clave de localStorage, escritura atómica, normalización
  plan.ts         rutina A/B y bloque torácico (datos semilla)
  progression.ts  propuesta de hoy a partir de la última sesión
  nutrition.ts    totales del día, media móvil y revisión semanal
  sync.ts         cliente de la API: subir, traer y detectar conflictos
src/screens/    Hoy, Sesión, Progreso, Plan, Ajustes
api/            API en PHP: endpoint (state.php), mapeo a tablas (store.php),
                comprobación de la instalación (selftest.php)
notify/         automatización de avisos al móvil
scripts/        iconos, comprobaciones y API de pruebas
```

Todo el estado es un único objeto guardado en la clave `webfit.store.v1` y, si
hay servidor, replicado en MySQL. Se escribe entero en cada cambio. Cualquier JSON que entre —importación o lectura
de `localStorage`— pasa por `normalize()`, que rellena lo que falte y descarta lo
que no encaje: un archivo corrupto nunca deja la aplicación en blanco.

## Avisos al móvil (comidas, batidos, pastillas)

Las notificaciones programadas de una PWA no son fiables en móvil: el sistema
suspende el service worker y los avisos se pierden. Así que los envía una
automatización externa, y llegan aunque la aplicación esté cerrada.

**Cómo funciona:** un workflow de GitHub Actions se ejecuta una vez al día y deja
los avisos de las siguientes 24 horas *programados en el servidor de
[ntfy.sh](https://ntfy.sh)* con la cabecera `X-At`. ntfy los entrega a la hora
exacta. El cron de GitHub se retrasa con frecuencia, pero aquí da igual: sólo
tiene que llegar a tiempo de programar la ventana del día, que empieza a las
06:00 hora canaria.

**Puesta en marcha:**

1. Instala la app **ntfy** en el móvil (Android e iOS, gratuita).
2. Elige un nombre de topic largo y difícil de adivinar —cualquiera que lo sepa
   puede escribirte, y leerte— por ejemplo `webfit-jorge-7f3a91c2`. Suscríbete a
   él desde la app.
3. En el repositorio: *Settings → Secrets and variables → Actions*.
   - Secreto `NTFY_TOPIC` con ese nombre.
   - Opcionales: variable `NTFY_SERVER` si usas un servidor propio, secreto
     `NTFY_TOKEN` si el topic está protegido.
4. Lanza el workflow **Avisos al móvil** a mano con el modo `prueba`: debería
   llegarte una notificación en segundos. Con el modo `simulacro` sólo verás en
   el registro lo que enviaría.

**Las horas se editan en `notify/reminders.json`.** En la pantalla de Ajustes de
la aplicación hay un botón *Copiar para la automatización* que copia la
configuración con el formato exacto de ese archivo; pégala y haz commit. Los dos
sitios están separados a propósito: la aplicación no puede escribir en el
repositorio, y el móvil tiene que recibir avisos aunque no abras la aplicación.

Cada aviso admite `detail` (texto secundario), `days` (0 = domingo) y `kind`
(`meal`, `supplement`, `training`, `other`, que decide el icono y la prioridad).
Una hora como `00:30` se programa de madrugada del día siguiente, que es cuando
corresponde en este horario.

**Dos avisos sobre la automatización:** GitHub desactiva los workflows
programados si el repositorio pasa 60 días sin actividad —un commit de vez en
cuando basta—, y ntfy.sh es un servicio gratuito sin garantías. Para algo que no
puede fallar, un servidor ntfy propio o un recordatorio nativo del móvil es más
seguro.

Prueba local, sin enviar nada:

```bash
NTFY_TOPIC=lo-que-sea node notify/send.mjs --dry-run
```

## Publicar en Hostinger

**Qué hace falta del hosting: servir archivos estáticos, PHP 8 y MySQL.** Nada
más. React se compila aquí, en tu máquina o en GitHub Actions, y lo que se sube
son HTML, CSS y JavaScript: para el servidor es una página web corriente. Los
planes que anuncian «Node.js» hacen falta para frameworks que renderizan en el
servidor —Next.js con SSR, Nuxt—, y esto no es uno de ellos. La API sí necesita
PHP y MySQL, incluidos en cualquier plan de alojamiento compartido con hPanel.
Lo único que no sirve es un plan de *Creador de páginas web* (Website Builder):
ahí no hay administrador de archivos, ni FTP, ni bases de datos.

El workflow `.github/workflows/deploy.yml` compila y sube por FTP en cada push a
`main`: la app en la raíz y la API en `/api`. Hace falta configurar en el
repositorio:

- Secretos `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` — el usuario FTP se crea
  en hPanel, *Archivos → Cuentas FTP*.
- Variable `FTP_DIR` con la carpeta de destino, normalmente `/public_html/`.

La compilación usa rutas relativas (`base: './'`), así que funciona igual en la
raíz del dominio que en un subdirectorio. La PWA necesita HTTPS: actívalo en
hPanel antes de instalarla en el móvil.

Instalación en el móvil: abre la URL en Chrome o Safari y elige *Añadir a la
pantalla de inicio*. A partir de ahí funciona sin conexión.

## Base de datos

Sin base de datos la app funciona igual, pero los datos viven sólo en el
navegador de cada dispositivo. Con ella, el móvil y el ordenador ven lo mismo y
nada se pierde si borras los datos del navegador.

El diseño es deliberadamente simple: **`localStorage` sigue siendo la copia de
trabajo** —así la app responde al instante y funciona sin cobertura en el
gimnasio— y por detrás se sincroniza con MySQL. Cada cambio se sube 1,5 s después
del último toque; si no hay red, se queda marcado como pendiente y sube solo al
recuperarla. El servidor guarda un número de revisión: si otro dispositivo
escribió mientras tanto, la app avisa y tú eliges con qué versión te quedas, en
vez de perder datos en silencio.

Puesta en marcha, una sola vez:

1. **hPanel → Bases de datos → MySQL**: crea base de datos y usuario. Apunta
   nombre, usuario y contraseña.
2. **Genera un token** largo y aleatorio:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **hPanel → Administrador de archivos**: en `public_html/api/`, copia
   `config.example.php` como `config.php` y rellena credenciales y token. Ese
   archivo no está en el repositorio ni se sube por FTP, así que ningún
   despliegue lo pisa.
4. Abre `https://tudominio.com/api/selftest.php?token=EL_TOKEN`. Debe responder
   `"ok": true` y listar las once tablas —se crean solas la primera vez; si
   prefieres crearlas a mano, `api/schema.sql` tiene el esquema. Añadiendo
   `&roundtrip=1` escribe un estado de ejemplo, lo relee y comprueba que las
   tablas devuelven exactamente lo que se guardó; lo hace dentro de una
   transacción que se deshace, así que no toca tus datos. Merece la pena
   lanzarlo una vez tras el primer despliegue.
5. En la app, **Ajustes → Sincronización**: dirección (`https://tudominio.com`) y
   token. Si la base de datos está vacía se sube lo que haya en el dispositivo;
   si ya tiene datos, se traen.

El token es la única credencial: quien lo tenga puede leer y escribir tus datos.
Úsalo siempre sobre HTTPS y no lo pegues en sitios públicos.

Tablas: `profile`, `meals`, `weights`, `intake` + `intake_meals`, `sessions` +
`session_sets`, `adjustments`, `reminders`, `meta` (revisión) y `backups`. Se
pueden consultar desde phpMyAdmin sin tocar la app.

**Red de seguridad.** Cada guardado reemplaza el contenido entero de las tablas,
así que antes de sobrescribir el servidor guarda una foto del estado anterior en
`backups`: como mucho una cada media hora, conservando las diez últimas. Si algo
se borra por error, en phpMyAdmin abres la fila más reciente de `backups`, copias
el campo `payload`, lo guardas como `.json` y lo cargas con *Ajustes → Importar
copia*.

**Límite conocido.** La app sube el estado completo en cada guardado, no sólo lo
que cambió. Hoy son unos pocos KB; con años de historial serán algunos cientos
de KB por subida, y entonces convendrá pasar a envíos incrementales. Está
concentrado en `pushState` (cliente) y `write_store` (servidor).

## Copias de seguridad

Aunque uses la base de datos, exporta de vez en cuando: *Ajustes → Exportar
copia* baja un JSON con todo e *Importar* lo restaura tal cual en otro
dispositivo. Es la red de seguridad si el hosting se cae o caduca.

## Salud

El índice de Haller previo estaba en el límite quirúrgico y no se ha reevaluado.
Pedir una valoración actual sigue siendo pendiente. Detener el entrenamiento y
consultar ante dolor torácico, palpitaciones, mareo o falta de aire
desproporcionada al esfuerzo. Ningún ejercicio modifica el índice de Haller ni la
estructura ósea del tórax: el bloque torácico trabaja mecánica respiratoria,
postura y musculatura circundante. Esta aplicación registra y calcula; no
diagnostica ni sustituye a un médico, un dietista-nutricionista o un
fisioterapeuta.
