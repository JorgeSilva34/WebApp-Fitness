// Servidor de pruebas que imita el contrato de api/state.php, para poder probar
// la sincronización en local sin PHP ni MySQL. No forma parte del despliegue.
//
//   node scripts/mock-api.mjs [puerto]        (MOCK_DELAY=3000 para red lenta)
//
// Token: el valor de MOCK_TOKEN, o "test" por defecto.

import { createServer } from 'node:http'

const PORT = Number(process.argv[2] || 8787)
const TOKEN = process.env.MOCK_TOKEN || 'test'
// MOCK_DELAY simula una red lenta: sirve para comprobar que dos subidas
// seguidas no se pisan entre ellas.
const DELAY = Number(process.env.MOCK_DELAY || 0)
const ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173']

let revision = 0
let store = null

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const origin = req.headers.origin

  if (origin && ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  const send = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  if (!url.pathname.endsWith('/state.php')) {
    send(404, { error: 'No existe.' })
    return
  }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    send(401, { error: 'Token no válido.' })
    return
  }

  if (req.method === 'GET') {
    send(200, { revision, empty: revision === 0, updatedAt: new Date().toISOString(), store: store ?? {} })
    console.log(`GET  → revisión ${revision}${revision === 0 ? ' (vacío)' : ''}`)
    return
  }

  if (req.method !== 'PUT' && req.method !== 'POST') {
    send(405, { error: 'Método no permitido.' })
    return
  }

  const chunks = []
  for await (const c of req) chunks.push(c)
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    send(400, { error: 'JSON no válido.' })
    return
  }

  if (DELAY) await new Promise((r) => setTimeout(r, DELAY))

  const force = url.searchParams.get('force') === '1'
  if (!force && Number(body?.revision ?? 0) !== revision) {
    console.log(`PUT  → 409 conflicto (cliente ${body?.revision}, servidor ${revision})`)
    send(409, { error: 'conflict', revision, store: store ?? {} })
    return
  }

  store = body.store
  revision += 1
  console.log(`PUT  → guardado, revisión ${revision}`)
  send(200, { revision, saved: true })
})

// Utilidades para las pruebas: fuerza un cambio hecho «desde otro dispositivo».
server.on('request', () => {})
process.on('SIGINT', () => process.exit(0))

server.listen(PORT, () => {
  console.log(`API de pruebas en http://localhost:${PORT}/api/state.php (token: ${TOKEN})`)
})
