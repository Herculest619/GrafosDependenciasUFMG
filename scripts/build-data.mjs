#!/usr/bin/env node
/**
 * Gera os JSONs consumidos pelo app a partir dos textos oficiais em data/sources/.
 *
 * Uso:
 *   node scripts/build-data.mjs            # todos os cursos
 *   node scripts/build-data.mjs --only dcc # apenas ids que contenham "dcc"
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSigaCourse, convertLegacyCourse } from './lib/course-json.mjs'
import { parseSigaReport } from './lib/siga-report.mjs'
import { validateCourse } from './lib/validate.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCES_DIR = join(ROOT, 'data/sources')
const OUT_DIR = join(ROOT, 'public/data')
const COURSES_DIR = join(OUT_DIR, 'courses')

/**
 * Cursos publicados no site.
 * - kind "siga": texto do relatório do Siga (data/sources/<file>)
 * - kind "legacy": JSON do projeto original (data/sources/legacy/<file>)
 */
const COURSES = [
    {
        kind: 'legacy',
        file: 'legacy/fisica-bacharelado.json',
        options: {
            id: 'fisica-bacharelado',
            name: 'Física',
            variant: 'Bacharelado',
            unit: 'ICEx — Departamento de Física',
            campus: 'Pampulha',
            degree: 'Bacharelado',
            shift: 'Diurno',
            curriculum: 'Versão não registrada na fonte legada',
            percursoName: 'Matriz curricular (fonte legada)',
        },
    },
    {
        kind: 'legacy',
        file: 'legacy/fisica-licenciatura-diurno.json',
        options: {
            id: 'fisica-licenciatura-diurno',
            name: 'Física',
            variant: 'Licenciatura — Diurno',
            unit: 'ICEx — Departamento de Física',
            campus: 'Pampulha',
            degree: 'Licenciatura',
            shift: 'Diurno',
            curriculum: 'Versão não registrada na fonte legada',
            percursoName: 'Matriz curricular (fonte legada)',
        },
    },
    {
        kind: 'legacy',
        file: 'legacy/fisica-licenciatura-noturno.json',
        options: {
            id: 'fisica-licenciatura-noturno',
            name: 'Física',
            variant: 'Licenciatura — Noturno',
            unit: 'ICEx — Departamento de Física',
            campus: 'Pampulha',
            degree: 'Licenciatura',
            shift: 'Noturno',
            curriculum: 'Versão não registrada na fonte legada',
            percursoName: 'Matriz curricular (fonte legada)',
        },
    },
    {
        kind: 'siga',
        file: 'dcc/bcc.txt',
        sourceId: 'dcc/bcc',
        options: {
            id: 'ciencia-da-computacao',
            name: 'Ciência da Computação',
            unit: 'DCC — ICEx',
            campus: 'Pampulha',
            degree: 'Bacharelado',
            shift: 'Diurno',
        },
    },
    {
        kind: 'siga',
        file: 'dcc/bsi.txt',
        sourceId: 'dcc/bsi',
        options: {
            id: 'sistemas-de-informacao',
            name: 'Sistemas de Informação',
            unit: 'DCC — ICEx',
            campus: 'Pampulha',
            degree: 'Bacharelado',
            shift: 'Noturno',
        },
    },
    {
        kind: 'siga',
        file: 'dcc/bec.txt',
        sourceId: 'dcc/bec',
        options: {
            id: 'engenharia-de-computacao',
            name: 'Engenharia de Computação',
            unit: 'DCC — ICEx / Escola de Engenharia',
            campus: 'Pampulha',
            degree: 'Bacharelado',
            shift: 'Vespertino',
        },
    },
    {
        kind: 'siga',
        file: 'dcc/bcd.txt',
        sourceId: 'dcc/bcd',
        options: {
            id: 'ciencia-de-dados',
            name: 'Ciência de Dados',
            unit: 'DCC — ICEx',
            campus: 'Pampulha',
            degree: 'Bacharelado',
            shift: 'Vespertino',
        },
    },
]

function readJson(path, fallback = null) {
    if (!existsSync(path)) return fallback
    try {
        return JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
        throw new Error(`JSON inválido em ${relative(ROOT, path)}: ${error.message}`)
    }
}

function loadSourceMetadata() {
    const entries = readJson(join(SOURCES_DIR, 'sources.json'), []) ?? []
    const map = new Map()
    for (const entry of entries) {
        map.set(entry.id, entry)
    }
    return map
}

function ensureDirectory(path) {
    mkdirSync(path, { recursive: true })
}

function writeJson(path, data) {
    ensureDirectory(dirname(path))
    writeFileSync(path, `${JSON.stringify(data, null, 4)}\n`, 'utf8')
}

function buildOne(config, sources) {
    const sourcePath = join(SOURCES_DIR, config.file)
    if (!existsSync(sourcePath)) {
        throw new Error(`fonte ausente: ${relative(ROOT, sourcePath)} (veja o README)`)
    }

    if (config.kind === 'legacy') {
        const raw = readJson(sourcePath)
        return convertLegacyCourse(raw, config.options)
    }

    const text = readFileSync(sourcePath, 'utf8')
    const parsed = parseSigaReport(text)
    const sourceEntry = config.sourceId ? sources.get(config.sourceId) : null
    const options = {
        ...config.options,
        source: {
            kind: 'siga-versao-curricular',
            url: sourceEntry?.url ?? null,
            retrievedAt: sourceEntry?.retrievedAt ?? null,
            note: sourceEntry?.note ?? null,
        },
    }
    return buildSigaCourse(parsed, options)
}

function main() {
    const onlyIndex = process.argv.indexOf('--only')
    const only = onlyIndex !== -1 ? process.argv[onlyIndex + 1] : null

    const sources = loadSourceMetadata()
    ensureDirectory(COURSES_DIR)

    const catalog = []
    const failures = []

    for (const config of COURSES) {
        const label = config.options?.id ?? config.file
        if (only && !label.includes(only)) continue

        let result
        try {
            result = buildOne(config, sources)
        } catch (error) {
            failures.push(`${label}: ${error.message}`)
            console.error(`✖ ${label}: ${error.message}`)
            continue
        }

        const { course, catalog: entry, warnings } = result
        const { errors } = validateCourse(course)

        if (errors.length) {
            failures.push(`${label}: ${errors.length} erro(s) de validação`)
            for (const error of errors) console.error(`   ✖ ${error}`)
            continue
        }

        writeJson(join(COURSES_DIR, `${course.id}.json`), course)
        catalog.push(entry)

        const stats = entry.stats
        console.log(
            `✔ ${course.meta.name}${course.meta.variant ? ` (${course.meta.variant})` : ''} [${
                course.id
            }]` +
                ` — ${stats.periods} períodos, ${stats.disciplines} disciplinas, ${stats.edges} arestas, ${stats.optionalSlots} slots de optativa` +
                `, ${course.percursos.length} percurso(s)`
        )
        for (const warning of warnings) console.warn(`   ! ${warning}`)
    }

    if (failures.length) {
        console.error(`\n${failures.length} curso(s) com problema. Nada foi publicado para eles.`)
        process.exitCode = 1
        return
    }

    catalog.sort(
        (a, b) =>
            a.name.localeCompare(b.name, 'pt-BR') ||
            (a.variant ?? '').localeCompare(b.variant ?? '', 'pt-BR')
    )

    writeJson(join(OUT_DIR, 'courses.json'), {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        courses: catalog,
    })

    console.log(`\n✔ ${catalog.length} curso(s) gerado(s) em public/data/`)
}

main()
