// Comprueba que los archivos de api/ son PHP sintácticamente válido, sin
// necesidad de tener PHP instalado. No sustituye a probar la API desplegada
// (para eso está api/selftest.php), pero evita subir un error de sintaxis.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pkg from 'php-parser'

const { Engine } = pkg
const parser = new Engine({ parser: { extractDoc: false, suppressErrors: false } })

const dir = join(process.cwd(), 'api')
let failures = 0

for (const file of readdirSync(dir).filter((f) => f.endsWith('.php'))) {
  try {
    const ast = parser.parseCode(readFileSync(join(dir, file), 'utf8'), file)
    const errors = ast.errors ?? []
    if (errors.length) {
      failures++
      console.log(`FAIL  api/${file}: ${errors.map((e) => `${e.message} (línea ${e.line})`).join('; ')}`)
    } else {
      console.log(`  ok  api/${file}`)
    }
  } catch (e) {
    failures++
    console.log(`FAIL  api/${file}: ${e.message}`)
  }
}

console.log(failures === 0 ? '\nPHP sin errores de sintaxis.' : `\n${failures} archivos con errores.`)
process.exit(failures === 0 ? 0 : 1)
