#!/usr/bin/env node
/**
 * Baixa um relatório em PDF e extrai o texto para data/sources/.
 * Requer `pdftotext` (poppler-utils / MiKTeX) no PATH e acesso à internet.
 *
 * Uso:
 *   node scripts/fetch-source.mjs --url https://.../relatorio.pdf --out dcc/bcc.txt
 *   node scripts/fetch-source.mjs --url ... --out ... --source-id dcc/bcc
 *
 * Em seguida registre/atualize a entrada em data/sources/sources.json e rode
 * `npm run data:build`.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCES_DIR = join(ROOT, 'data/sources')
const SOURCES_JSON = join(SOURCES_DIR, 'sources.json')

function parseArgs(argv) {
    const args = {}
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index]
        if (!token.startsWith('--')) continue
        const key = token.slice(2)
        const value = argv[index + 1]?.startsWith('--') ? 'true' : argv[index + 1] ?? 'true'
        args[key] = value
        if (value !== 'true') index += 1
    }
    return args
}

function which(command) {
    try {
        execFileSync(command, ['-v'], { stdio: 'ignore' })
        return true
    } catch {
        return false
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    if (!args.url || !args.out) {
        console.error(
            'uso: node scripts/fetch-source.mjs --url <pdf> --out <caminho relativo a data/sources>'
        )
        process.exit(1)
    }
    if (!which('pdftotext')) {
        console.error(
            '✖ pdftotext não encontrado. Instale poppler-utils (Linux) ou MiKTeX/poppler (Windows).'
        )
        process.exit(1)
    }

    const outPath = join(SOURCES_DIR, args.out)
    const outDir = dirname(outPath)
    mkdirSync(outDir, { recursive: true })

    const response = await fetch(args.url)
    if (!response.ok) {
        console.error(`✖ falha ao baixar ${args.url}: HTTP ${response.status}`)
        process.exit(1)
    }
    const buffer = Buffer.from(await response.arrayBuffer())

    const tmpDirectory = mkdtempSync(join(tmpdir(), 'siga-pdf-'))
    const pdfPath = join(tmpDirectory, 'report.pdf')
    writeFileSync(pdfPath, buffer)

    try {
        const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        })
        writeFileSync(outPath, text, 'utf8')

        const pages = (text.match(/Página \d+ de \d+/g) ?? []).length
        const sourceId =
            args['source-id'] ??
            relative(SOURCES_DIR, outPath)
                .replace(/\.txt$/, '')
                .replace(/\\/g, '/')
        const entry = {
            id: sourceId,
            url: args.url,
            retrievedAt: new Date().toISOString(),
            extractor: 'pdftotext -layout',
            pages,
            chars: text.length,
            sha256: createHash('sha256').update(text).digest('hex'),
        }

        let entries = []
        if (existsSync(SOURCES_JSON)) {
            entries = JSON.parse(readFileSync(SOURCES_JSON, 'utf8'))
            entries = entries.filter((item) => item.id !== sourceId)
        }
        entries.push(entry)
        entries.sort((a, b) => String(a.id).localeCompare(String(b.id)))
        writeFileSync(SOURCES_JSON, `${JSON.stringify(entries, null, 4)}\n`, 'utf8')

        console.log(`✔ ${relative(ROOT, outPath)}: ${text.length} caracteres, ${pages} página(s)`)
        console.log(`  origem: ${args.url}`)
        console.log(
            '  Próximo passo: inclua o curso em scripts/build-data.mjs e rode `npm run data:build`.'
        )
    } finally {
        rmSync(tmpDirectory, { recursive: true, force: true })
    }
}

main().catch((error) => {
    console.error(`✖ ${error.message}`)
    process.exit(1)
})
