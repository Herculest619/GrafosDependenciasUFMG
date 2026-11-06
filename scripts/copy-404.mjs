// GitHub Pages não faz fallback de SPA: links diretos como
// /GrafosDependenciasUFMG/curso/ciencia-da-computacao retornam 404.
// Copiar o index.html para 404.html faz o app carregar e o vue-router resolve
// a rota pelo path, então links compartilhados continuam funcionando.
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const index = join(root, 'dist/index.html')
const fallback = join(root, 'dist/404.html')

if (!existsSync(index)) {
    console.error('dist/index.html não encontrado — rode o build do Vite antes')
    process.exit(1)
}

copyFileSync(index, fallback)
console.log('dist/404.html criado (fallback de rotas no GitHub Pages)')
