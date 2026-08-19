// Genera los iconos PNG de la PWA sin dependencias externas.
// Ejecutar: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'public')
mkdirSync(OUT, { recursive: true })

const INK = [11, 15, 20]
const BARS = [
  [147, 164, 181], // muted
  [78, 167, 103], // floor
  [90, 162, 240], // target
]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels(x, y)
      raw[p++] = r
      raw[p++] = g
      raw[p++] = b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Tres barras crecientes: registro, suelo, objetivo. */
function icon(size, inset) {
  const m = size * inset
  const inner = size - m * 2
  const gap = inner * 0.1
  const barW = (inner - gap * 2) / 3
  const heights = [0.42, 0.66, 0.9]
  return (x, y) => {
    for (let i = 0; i < 3; i++) {
      const x0 = m + i * (barW + gap)
      const h = inner * heights[i]
      const y0 = m + inner - h
      const r = barW * 0.28
      if (x >= x0 && x < x0 + barW && y >= y0 && y < m + inner) {
        // esquinas superiores redondeadas
        const dx = Math.min(x - x0, x0 + barW - 1 - x)
        const dy = y - y0
        if (dy < r && dx < r) {
          const d = Math.hypot(r - dx, r - dy)
          if (d > r) return INK
        }
        return BARS[i]
      }
    }
    return INK
  }
}

writeFileSync(join(OUT, 'icon-192.png'), png(192, icon(192, 0.18)))
writeFileSync(join(OUT, 'icon-512.png'), png(512, icon(512, 0.18)))
writeFileSync(join(OUT, 'icon-maskable-512.png'), png(512, icon(512, 0.28)))

writeFileSync(
  join(OUT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0b0f14"/>
  <rect x="12" y="34" width="10" height="18" rx="3" fill="#93a4b5"/>
  <rect x="27" y="26" width="10" height="26" rx="3" fill="#4ea767"/>
  <rect x="42" y="16" width="10" height="36" rx="3" fill="#5aa2f0"/>
</svg>
`,
)

console.log('Iconos generados en public/')
