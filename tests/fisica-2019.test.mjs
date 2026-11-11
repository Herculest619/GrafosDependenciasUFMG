import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { buildFisica2019Course } from '../scripts/lib/course-json.mjs'
import { parseEmentas, parseMatriz2019 } from '../scripts/lib/fisica-2019.mjs'
import { validateCourse } from '../scripts/lib/validate.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCES = join(ROOT, 'data/sources/fisica')

const matriz = parseMatriz2019(readFileSync(join(SOURCES, 'fisica-bacharelado-2019.txt'), 'utf8'))
const ementas = parseEmentas(readFileSync(join(SOURCES, 'ementas-fisica-2019.txt'), 'utf8'))

const OPTIONS = {
    id: 'fisica-bacharelado',
    name: 'Física',
    variant: 'Bacharelado',
    curriculum: 'Matriz 2019',
    source: {
        kind: 'estrutura-curricular-pdf',
        url: 'data/archives/Física Bacharelado/BacD2019.pdf',
        retrievedAt: '2026-11-10T21:10:00-03:00',
        note: 'PDF do PPC 2019',
    },
    ementasSource: {
        url: 'data/archives/Física Bacharelado/ementas_curso_fisica_v2019.pdf',
        retrievedAt: '2026-11-10T21:10:00-03:00',
        note: 'Anexo A do PPC 2019',
    },
}

test('matriz 2019: totais da Tabela 3.1', () => {
    assert.deepEqual(matriz.totals, {
        obligatoryCredits: 112,
        obligatoryHours: 1680,
        optionalCredits: 44,
        optionalHours: 660,
        freeCredits: 4,
        freeHours: 60,
        totalCredits: 160,
        totalHours: 2400,
    })
    assert.deepEqual(matriz.warnings, [])
})

test('matriz 2019: oito períodos e 31 disciplinas obrigatórias', () => {
    assert.deepEqual(
        matriz.periods.map((period) => period.number),
        [1, 2, 3, 4, 5, 6, 7, 8]
    )
    assert.deepEqual(
        matriz.periods.map((period) => period.rows.length),
        [6, 5, 4, 5, 4, 4, 3, 0]
    )
    assert.equal(
        matriz.periods.reduce((total, period) => total + period.rows.length, 0),
        31
    )
    // Tabela 4.1: o 8º período só tem a linha OP/AAC
    assert.deepEqual(matriz.periods[7].rows, [])
    assert.deepEqual(
        matriz.periods.map((period) => period.optionalCredits),
        [0, 4, 4, 4, 4, 4, 8, 20]
    )
})

test('matriz 2019: coluna PRÉ da Tabela 4.1', () => {
    assert.deepEqual(matriz.periods[0].rows.map((row) => row.code).sort(), [
        'DCC208',
        'FIS065',
        'FIS151',
        'FIS615',
        'MAT001',
        'MAT038',
    ])
    const fis154 = matriz.periods[1].rows.find((row) => row.code === 'FIS154')
    assert.deepEqual(fis154.prereqs, ['FIS151', 'FIS065'])
    const fis069 = matriz.periods[2].rows.find((row) => row.code === 'FIS069')
    assert.deepEqual(fis069.prereqs, ['FIS065', 'MAT039'])
    // sem pré-requisito no PDF
    const fis615 = matriz.periods[0].rows.find((row) => row.code === 'FIS615')
    assert.deepEqual(fis615.prereqs, [])
})

test('matriz 2019: grupos de optativas G1, G9 e G8', () => {
    assert.equal(matriz.groups.G1.length, 25) // 13 disciplinas + 4 grupos de tópicos × 3
    assert.equal(matriz.groups.G9.length, 32) // 23 da Tabela 4.3 + ICE055..063
    assert.equal(matriz.groups.G8.length, 1) // FIS638 (pós-graduação)
    assert.equal(matriz.groups.G8[0].code, 'FIS638')

    // códigos de tópicos com créditos variáveis
    assert.deepEqual(
        matriz.groups.G1.filter((row) => row.creditsLabel)
            .map((row) => row.code)
            .sort(),
        [
            'FIS634',
            'FIS635',
            'FIS636',
            'FIS637',
            'FIS639',
            'FIS640',
            'FIS641',
            'FIS642',
            'FIS643',
            'FIS644',
            'FIS645',
            'FIS646',
        ]
    )
    assert.equal(matriz.groups.G1.find((row) => row.code === 'FIS634').creditsLabel, '2–4')

    // intervalos ICE055-060 / ICE061-063 quebrados em duas linhas no PDF
    assert.deepEqual(
        matriz.groups.G9.filter((row) => row.code.startsWith('ICE'))
            .map((row) => row.code)
            .sort(),
        ['ICE055', 'ICE056', 'ICE057', 'ICE058', 'ICE059', 'ICE060', 'ICE061', 'ICE062', 'ICE063']
    )
    assert.equal(
        matriz.groups.G9.find((row) => row.code === 'ICB001').name,
        'Bases Ecológicas para o Desenvolvimento Sustentável'
    )
})

test('ementas: Anexo A interpretado por disciplina', () => {
    assert.ok(ementas.entries.length >= 80)
    assert.deepEqual(ementas.warnings, [])

    const fis069 = ementas.byCode.get('FIS069')
    assert.equal(fis069.credits, 4)
    assert.equal(fis069.hours, 60)
    assert.equal(fis069.period, 3)
    assert.deepEqual(fis069.prereqs, ['FIS065'])
    assert.deepEqual(fis069.coreqs, ['MAT002'])
    assert.match(fis069.ementa, /lei de Gauss/)

    // ementa quebrada em duas linhas no PDF
    const fis086 = ementas.byCode.get('FIS086')
    assert.deepEqual(fis086.prereqs, ['FIS069', 'MAT015'])
    assert.match(fis086.ementa, /Oscilações mecânicas/)

    // disciplina sem texto de ementa no Anexo A
    assert.equal(ementas.byCode.get('MAT243').ementa, null)
    assert.equal(ementas.byCode.get('QUI604').credits, null) // Anexo A termina no cabeçalho
})

test('converte a matriz 2019 no JSON v2 (com ementas)', () => {
    const { course, catalog, warnings } = buildFisica2019Course(matriz, ementas, OPTIONS)

    assert.deepEqual(validateCourse(course).errors, [])
    assert.equal(course.id, 'fisica-bacharelado')
    assert.equal(course.meta.layout, 'matriz-2019')
    assert.equal(course.meta.curriculum, 'Matriz 2019')
    assert.equal(course.meta.source.url, 'data/archives/Física Bacharelado/BacD2019.pdf')
    assert.equal(
        course.meta.ementas.url,
        'data/archives/Física Bacharelado/ementas_curso_fisica_v2019.pdf'
    )

    const percurso = course.percursos[0]
    assert.deepEqual(
        percurso.periods.map((period) => period.number),
        [1, 2, 3, 4, 5, 6, 7, 8]
    )
    assert.deepEqual(percurso.periods[7].codes, [])
    assert.equal(percurso.optionalSlots.length, 11) // 660 h / 60 h
    assert.deepEqual(percurso.optionalCreditsByPeriod, {
        2: 4,
        3: 4,
        4: 4,
        5: 4,
        6: 4,
        7: 8,
        8: 20,
    })
    assert.deepEqual(percurso.summary, {
        obligatoryHours: { min: 1680, max: 1680 },
        optionalHours: { min: 660, max: 660 },
        stageHours: null,
        complementaryPresetHours: null,
        complementaryOpenHours: null,
        freeHours: { min: 60, max: 60 },
        totalHours: 2400,
    })

    // 31 obrigatórias + pool (G1 + G9 + G8)
    const scheduled = Object.values(course.disciplines).filter((item) => item.scheduled)
    assert.equal(scheduled.length, 31)
    assert.equal(percurso.optionalPool.length, 59)

    // horas vindas das ementas e pré-requisitos vindos da Tabela 4.1
    assert.equal(course.disciplines.FIS065.hours.total, 60)
    assert.match(course.disciplines.FIS065.ementa, /leis de Newton/)
    assert.deepEqual(course.disciplines.FIS069.prereqs, ['FIS065', 'MAT039'])
    assert.equal(course.disciplines.FIS617.hours.total, 60)
    assert.equal(course.disciplines.FIS152.hours.total, 30)

    // optativas: tópicos, pós-graduação e optativa geral só do Anexo A
    assert.equal(course.disciplines.FIS634.name, 'Tópicos de Astrofísica A')
    assert.equal(course.disciplines.FIS634.creditsLabel, '2–4')
    assert.equal(course.disciplines.FIS634.group, 'G1')
    assert.equal(course.disciplines.FIS638.group, 'G8')
    assert.equal(course.disciplines.QUI604.credits, 6)
    assert.equal(course.disciplines.QUI604.hours.total, 90)
    assert.deepEqual(course.disciplines.QUI604.prereqs, ['FIS152', 'QUI003'])

    const pool = percurso.optionalPool
    assert.ok(pool.find((entry) => entry.code === 'FIS630').ementa)
    assert.equal(pool.find((entry) => entry.code === 'DIT121').extra, true)
    assert.equal(pool.find((entry) => entry.code === 'DIT121').group, 'G9')

    // a matriz 2013 não é publicada nem misturada
    assert.equal(course.disciplines.FIS054, undefined)
    assert.equal(course.disciplines.DCC001, undefined)

    assert.ok(warnings.some((warning) => warning.includes('DCC033->DCC003')))
    assert.equal(catalog.stats.disciplines, 31)
    assert.equal(catalog.stats.edges, 38)
    assert.equal(catalog.stats.periods, 8)
    assert.equal(catalog.stats.optionalSlots, 11)
    assert.equal(catalog.stats.totalHours, 2400)
    assert.equal(catalog.file, 'data/courses/fisica-bacharelado.json')
})
