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

import {
    buildEstruturaCourse,
    buildFisica2019Course,
    buildSigaCourse,
    convertLegacyCourse,
} from './lib/course-json.mjs'
import { parseEstruturaCurricular } from './lib/estrutura-curricular.mjs'
import { parseEmentas, parseMatriz2019 } from './lib/fisica-2019.mjs'
import { parseSigaReport } from './lib/siga-report.mjs'
import { validateCourse } from './lib/validate.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCES_DIR = join(ROOT, 'data/sources')
const OUT_DIR = join(ROOT, 'public/data')
const COURSES_DIR = join(OUT_DIR, 'courses')

/** Unidade/campus padrão por diretório de origem (pode ser sobrescrito no curso). */
const UNIT_DEFAULTS = {
    dcc: { unit: 'DCC — ICEx', campus: 'Pampulha' },
    farmacia: { unit: 'Faculdade de Farmácia', campus: 'Pampulha' },
    eci: { unit: 'ECI — Escola de Ciência da Informação', campus: 'Pampulha' },
    fae: { unit: 'FAE — Faculdade de Educação', campus: 'Pampulha' },
    fisica: { unit: 'ICEx — Departamento de Física', campus: 'Pampulha' },
    igc: { unit: 'IGC — Instituto de Geociências', campus: 'Pampulha' },
    medicina: { unit: 'Faculdade de Medicina', campus: 'Saúde' },
    ica: { unit: 'ICA — Instituto de Ciências Agrárias', campus: 'Montes Claros' },
}

function unitDefaults(file) {
    const directory = String(file).split('/')[0]
    return UNIT_DEFAULTS[directory] ?? {}
}

/**
 * Cursos publicados no site.
 * - kind "siga": texto do relatório do Siga (data/sources/<file>)
 * - kind "estrutura": estrutura curricular antiga (PDF em data/archives)
 * - kind "fisica-2019": matriz 2019 do Bacharelado em Física + Anexo A de ementas
 * - kind "legacy": JSON do projeto original (data/sources/legacy/<file>)
 */
const COURSES = [
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
    {
        kind: 'siga',
        file: 'farmacia/farmacia.txt',
        sourceId: 'farmacia/farmacia',
        options: { id: 'farmacia', name: 'Farmácia', variant: 'Diurno', shift: 'Diurno' },
    },
    {
        kind: 'siga',
        file: 'farmacia/farmacia-noturno.txt',
        sourceId: 'farmacia/farmacia-noturno',
        options: { id: 'farmacia-noturno', name: 'Farmácia', variant: 'Noturno', shift: 'Noturno' },
    },
    {
        kind: 'siga',
        file: 'farmacia/biomedicina.txt',
        sourceId: 'farmacia/biomedicina',
        options: { id: 'biomedicina', name: 'Biomedicina' },
    },
    {
        kind: 'siga',
        file: 'eci/biblioteconomia-diurno.txt',
        sourceId: 'eci/biblioteconomia-diurno',
        options: {
            id: 'biblioteconomia-diurno',
            name: 'Biblioteconomia',
            variant: 'Diurno',
            shift: 'Diurno',
        },
    },
    {
        kind: 'siga',
        file: 'eci/biblioteconomia-noturno.txt',
        sourceId: 'eci/biblioteconomia-noturno',
        options: {
            id: 'biblioteconomia-noturno',
            name: 'Biblioteconomia',
            variant: 'Noturno',
            shift: 'Noturno',
        },
    },
    {
        kind: 'siga',
        file: 'eci/arquivologia.txt',
        sourceId: 'eci/arquivologia',
        options: { id: 'arquivologia', name: 'Arquivologia' },
    },
    {
        kind: 'siga',
        file: 'eci/museologia.txt',
        sourceId: 'eci/museologia',
        options: { id: 'museologia', name: 'Museologia' },
    },
    {
        kind: 'siga',
        file: 'fae/pedagogia-diurno.txt',
        sourceId: 'fae/pedagogia-diurno',
        options: { id: 'pedagogia-diurno', name: 'Pedagogia', variant: 'Diurno', shift: 'Diurno' },
    },
    {
        kind: 'siga',
        file: 'fae/pedagogia-noturno.txt',
        sourceId: 'fae/pedagogia-noturno',
        options: {
            id: 'pedagogia-noturno',
            name: 'Pedagogia',
            variant: 'Noturno',
            shift: 'Noturno',
        },
    },
    {
        kind: 'fisica-2019',
        file: 'fisica/fisica-bacharelado-2019.txt',
        sourceId: 'fisica/fisica-bacharelado-2019',
        ementasFile: 'fisica/ementas-fisica-2019.txt',
        ementasSourceId: 'fisica/fisica-bacharelado-ementas-2019',
        options: {
            id: 'fisica-bacharelado',
            name: 'Física',
            variant: 'Bacharelado',
            unit: 'ICEx — Departamento de Física',
            campus: 'Pampulha',
            degree: 'Bacharelado',
            shift: 'Diurno',
            curriculum: 'Matriz 2019',
            percursoName: 'Bacharelado — formação padrão (01-01)',
        },
    },
    {
        kind: 'estrutura',
        file: 'fisica/fisica-licenciatura-noturno-matriz-2018.txt',
        sourceId: 'fisica/fisica-licenciatura-noturno-matriz-2018',
        options: {
            id: 'fisica-licenciatura-noturno-matriz-2018',
            name: 'Física',
            variant: 'Licenciatura · Noturno · matriz 2018',
            degree: 'Licenciatura',
            shift: 'Noturno',
            curriculum: 'Matriz 2018 (noturno)',
            // O PDF lista MAT016 como "Equações Diferenciais C" na tabela de
            // obrigatórias, mas o mesmo código aparece no G9 como "Equações
            // Diferenciais B" (nome correto do código no Anexo A de 2019).
            nameOverrides: { MAT016: 'Equações Diferenciais B' },
            note: 'Estrutura curricular 2018 (texto extraído; PDF removido de data/archives). Inconsistências do PDF documentadas em docs/RELATORIO_FONTES_UFMG.md: MAT016 repetido como obrigatória/optativa (mantida a obrigatória) e QUI003 repetido no G9 (mantida a primeira ocorrência).',
        },
    },
    {
        kind: 'siga',
        file: 'igc/geografia-licenciatura-matutino.txt',
        sourceId: 'igc/geografia-licenciatura-matutino',
        options: {
            id: 'geografia-licenciatura-matutino',
            name: 'Geografia',
            variant: 'Licenciatura · Matutino',
            degree: 'Licenciatura',
            shift: 'Matutino',
        },
    },
    {
        kind: 'siga',
        file: 'igc/geografia-licenciatura-noturno.txt',
        sourceId: 'igc/geografia-licenciatura-noturno',
        options: {
            id: 'geografia-licenciatura-noturno',
            name: 'Geografia',
            variant: 'Licenciatura · Noturno',
            degree: 'Licenciatura',
            shift: 'Noturno',
        },
    },
    {
        kind: 'siga',
        file: 'igc/turismo.txt',
        sourceId: 'igc/turismo',
        options: {
            id: 'turismo',
            name: 'Turismo',
            variant: 'Bacharelado · Diurno',
            degree: 'Bacharelado',
            shift: 'Diurno',
        },
    },
    {
        kind: 'siga',
        file: 'medicina/medicina.txt',
        sourceId: 'medicina/medicina',
        options: {
            id: 'medicina',
            name: 'Medicina',
            variant: 'Bacharelado · Integral',
            degree: 'Bacharelado',
            shift: 'Integral',
        },
    },
    {
        kind: 'siga',
        file: 'ica/engenharia-de-alimentos.txt',
        sourceId: 'ica/engenharia-de-alimentos',
        options: {
            id: 'engenharia-de-alimentos',
            name: 'Engenharia de Alimentos',
            variant: 'Bacharelado · Diurno',
            degree: 'Bacharelado',
            shift: 'Diurno',
        },
    },
    {
        kind: 'siga',
        file: 'ica/zootecnia.txt',
        sourceId: 'ica/zootecnia',
        options: {
            id: 'zootecnia',
            name: 'Zootecnia',
            variant: 'Bacharelado · Diurno',
            degree: 'Bacharelado',
            shift: 'Diurno',
        },
    },
    {
        kind: 'siga',
        file: 'ica/aquacultura.txt',
        sourceId: 'ica/aquacultura',
        options: {
            id: 'aquacultura',
            name: 'Aquacultura',
            variant: 'Bacharelado · Diurno',
            degree: 'Bacharelado',
            shift: 'Diurno',
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
    const map = new Map()

    const main = readJson(join(SOURCES_DIR, 'sources.json'), []) ?? []
    for (const entry of main) map.set(entry.id, entry)

    // Índices por unidade (Farmácia, ECI, FAE): ids prefixados com o diretório
    for (const unit of ['farmacia', 'eci', 'fae', 'fisica', 'igc', 'medicina', 'ica']) {
        const index = readJson(join(SOURCES_DIR, unit, 'index.json'), []) ?? []
        for (const entry of index) {
            if (!entry?.id) continue
            map.set(`${unit}/${entry.id}`, { ...entry, id: `${unit}/${entry.id}` })
        }
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

    const sourceEntry = config.sourceId ? sources.get(config.sourceId) : null
    const text = readFileSync(sourcePath, 'utf8')

    if (config.kind === 'fisica-2019') {
        if (!config.ementasFile) throw new Error(`curso ${config.file}: ementasFile ausente`)
        const ementasPath = join(SOURCES_DIR, config.ementasFile)
        if (!existsSync(ementasPath)) {
            throw new Error(`fonte ausente: ${relative(ROOT, ementasPath)} (veja o README)`)
        }
        const ementasEntry = config.ementasSourceId ? sources.get(config.ementasSourceId) : null
        const matriz = parseMatriz2019(text)
        const ementas = parseEmentas(readFileSync(ementasPath, 'utf8'))
        const options = {
            ...unitDefaults(config.file),
            ...config.options,
            source: {
                kind: 'estrutura-curricular-pdf',
                url: sourceEntry?.pdf ? `data/archives/${sourceEntry.pdf}` : null,
                retrievedAt: sourceEntry?.retrievedAt ?? null,
                note: sourceEntry?.source ?? null,
            },
            ementasSource: {
                url: ementasEntry?.pdf ? `data/archives/${ementasEntry.pdf}` : null,
                retrievedAt: ementasEntry?.retrievedAt ?? null,
                note: ementasEntry?.source ?? null,
            },
        }
        return buildFisica2019Course(matriz, ementas, options)
    }

    if (config.kind === 'estrutura') {
        const parsed = parseEstruturaCurricular(text)
        const options = {
            ...unitDefaults(config.file),
            ...config.options,
            source: {
                kind: 'estrutura-curricular-pdf',
                url: sourceEntry?.pdf ? `data/archives/${sourceEntry.pdf}` : null,
                retrievedAt: sourceEntry?.retrievedAt ?? null,
                note: sourceEntry?.source ?? null,
            },
        }
        return buildEstruturaCourse(parsed, options)
    }

    const parsed = parseSigaReport(text)
    const options = {
        ...unitDefaults(config.file),
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
