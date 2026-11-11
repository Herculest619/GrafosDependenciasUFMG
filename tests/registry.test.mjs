import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCES = join(ROOT, 'data/sources')
const ARCHIVES = join(ROOT, 'data/archives')
const BUILD_SCRIPT = join(ROOT, 'scripts/build-data.mjs')

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'))
}

function walk(directory) {
    if (!existsSync(directory)) return []
    const files = []
    for (const entry of readdirSync(directory)) {
        const full = join(directory, entry)
        if (statSync(full).isDirectory()) files.push(...walk(full))
        else files.push(full)
    }
    return files
}

function relativePosix(from, to) {
    return relative(from, to).replace(/\\/g, '/')
}

function unitIndexes() {
    return readdirSync(SOURCES)
        .map((unit) => join(SOURCES, unit, 'index.json'))
        .filter((file) => existsSync(file))
}

test('registro de fontes: arquivos e PDFs existem e têm metadados', () => {
    for (const indexFile of unitIndexes()) {
        const unit = relativePosix(SOURCES, indexFile).split('/')[0]
        const entries = readJson(indexFile)
        assert.ok(Array.isArray(entries), `${unit}/index.json deve ser uma lista`)

        const ids = new Set()
        for (const entry of entries) {
            assert.ok(entry.id, `${unit}/index.json: entrada sem id`)
            assert.ok(!ids.has(entry.id), `${unit}/index.json: id duplicado ${entry.id}`)
            ids.add(entry.id)
            assert.ok(entry.title, `${unit}/${entry.id}: sem título`)
            assert.ok(entry.format, `${unit}/${entry.id}: sem formato`)

            if (entry.file) {
                const path = join(SOURCES, unit, entry.file)
                assert.ok(
                    existsSync(path),
                    `${unit}/${entry.id}: texto extraído ausente (${entry.file})`
                )
            }
            if (entry.pdf) {
                const path = join(ARCHIVES, entry.pdf)
                assert.ok(
                    existsSync(path),
                    `${unit}/${entry.id}: PDF ausente em data/archives (${entry.pdf})`
                )
            }
            if (entry.pages != null) {
                assert.ok(
                    Number.isInteger(entry.pages) && entry.pages > 0,
                    `${unit}/${entry.id}: pages inválido (${entry.pages})`
                )
            }
        }
    }
})

test('registro de fontes: sha256/chars batem com os textos extraídos', () => {
    const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

    for (const indexFile of unitIndexes()) {
        const unit = relativePosix(SOURCES, indexFile).split('/')[0]
        for (const entry of readJson(indexFile)) {
            if (!entry.file || !entry.sha256) continue

            const text = readFileSync(join(SOURCES, unit, entry.file), 'utf8').replace(
                /\r\n?/g,
                '\n'
            )
            assert.equal(entry.chars, text.length, `${unit}/${entry.id}: chars divergente do texto`)
            assert.equal(
                entry.sha256,
                sha256(text),
                `${unit}/${entry.id}: sha256 divergente do texto extraído`
            )

            if (entry.pdfSha256) {
                assert.ok(entry.pdf, `${unit}/${entry.id}: pdfSha256 sem pdf registrado`)
                assert.equal(
                    entry.pdfSha256,
                    sha256(readFileSync(join(ARCHIVES, entry.pdf))),
                    `${unit}/${entry.id}: pdfSha256 divergente do PDF`
                )
            }
        }
    }
})

test('registro de fontes: todo PDF em data/archives está documentado', () => {
    const pdfs = walk(ARCHIVES).filter((file) => file.toLocaleLowerCase('pt-BR').endsWith('.pdf'))
    assert.ok(pdfs.length > 0, 'data/archives deveria ter ao menos um PDF')

    const referenced = new Set()
    for (const indexFile of unitIndexes()) {
        for (const entry of readJson(indexFile)) {
            if (!entry.pdf) continue
            referenced.add(entry.pdf.replace(/\\/g, '/'))
        }
    }

    for (const pdf of pdfs) {
        const rel = relativePosix(ARCHIVES, pdf)
        assert.ok(referenced.has(rel), `PDF sem registro em index.json: ${rel}`)
    }
})

test('registro de fontes: todo texto extraído tem origem registrada', () => {
    const buildSource = readFileSync(BUILD_SCRIPT, 'utf8')
    const registered = new Set()
    for (const indexFile of unitIndexes()) {
        for (const entry of readJson(indexFile)) {
            if (entry.file) registered.add(entry.file)
        }
    }

    for (const textFile of walk(SOURCES).filter((file) => file.endsWith('.txt'))) {
        const rel = relativePosix(SOURCES, textFile)
        const base = rel.split('/').pop()
        assert.ok(
            buildSource.includes(rel) || buildSource.includes(base) || registered.has(base),
            `texto extraído sem origem registrada: ${rel}`
        )
    }

    // JSONs legados também precisam estar em uso (evita arquivo órfão ao remover curso)
    const legacyFiles = walk(SOURCES).filter((file) =>
        relativePosix(SOURCES, file).startsWith('legacy/')
    )
    for (const legacyFile of legacyFiles) {
        const base = relativePosix(SOURCES, legacyFile).split('/').pop()
        assert.ok(
            buildSource.includes(base),
            `JSON legado sem uso no build (arquivo órfão): ${relativePosix(SOURCES, legacyFile)}`
        )
    }
    const legacyReferences = buildSource.match(/legacy\/[\w.-]+\.json/g) ?? []
    for (const reference of new Set(legacyReferences)) {
        assert.ok(
            existsSync(join(SOURCES, reference)),
            `build-data.mjs referencia JSON legado inexistente: ${reference}`
        )
    }
})

test('registro de fontes: sources.json principal continua válido', () => {
    const entries = readJson(join(SOURCES, 'sources.json'))
    assert.ok(Array.isArray(entries))
    for (const entry of entries) {
        assert.ok(entry.id, 'sources.json: entrada sem id')
        assert.ok(entry.url, `sources.json: ${entry.id} sem URL`)
    }
})
