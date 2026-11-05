import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { parseSigaReport } from '../scripts/lib/siga-report.mjs'
import { buildSigaCourse, convertLegacyCourse, titleCasePt } from '../scripts/lib/course-json.mjs'

const FIXTURE = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/siga-mini.txt')

function buildFixtureCourse() {
    const parsed = parseSigaReport(readFileSync(FIXTURE, 'utf8'))
    return buildSigaCourse(parsed, {
        id: 'curso-de-teste',
        name: 'Curso de Teste',
        unit: 'Unidade de Teste',
        campus: 'Pampulha',
        degree: 'Bacharelado',
        shift: 'Diurno',
        source: { kind: 'siga-versao-curricular', url: 'https://exemplo/relatorio.pdf' },
    })
}

test('converte o relatório no JSON v2 do curso', () => {
    const { course, catalog, warnings } = buildFixtureCourse()
    assert.deepEqual(warnings, [])
    assert.equal(course.id, 'curso-de-teste')
    assert.equal(course.meta.name, 'Curso de Teste')
    assert.equal(course.meta.curriculum, '02001 · D-20192')
    assert.equal(course.meta.source.url, 'https://exemplo/relatorio.pdf')
    assert.equal(course.percursos.length, 2)

    const percursoComum = course.percursos.find((percurso) => percurso.id === '01-01')
    const percursoAvancado = course.percursos.find((percurso) => percurso.id === '01-02')
    assert.ok(percursoComum)
    assert.ok(percursoAvancado)
    assert.deepEqual(
        percursoComum.periods.map((period) => period.number),
        [1, 2, 3]
    )
    assert.deepEqual(percursoComum.periods[0].codes, ['TST100', 'TST101'])

    // 660 h de optativas / 60 h = 11 slots
    assert.equal(percursoComum.optionalSlots.length, 11)
    // 1020 h de optativas / 60 h = 17 slots
    assert.equal(percursoAvancado.optionalSlots.length, 17)
    assert.equal(percursoComum.optionalSlots[0].label, 'Optativa 1')

    assert.deepEqual(course.disciplines.TST102.prereqs, ['TST101'])
    assert.deepEqual(course.disciplines.TST103.prereqs, ['TST102', 'TST100'])
    assert.equal(course.disciplines.TST200.scheduled, false)
    assert.equal(percursoComum.optionalPool.length, 2)

    assert.equal(catalog.stats.disciplines, 4)
    assert.equal(catalog.stats.periods, 3)
    assert.equal(catalog.stats.optionalSlots, 17)
    assert.equal(catalog.file, 'data/courses/curso-de-teste.json')
})

test('converte o JSON legado (schema v1) para v2', () => {
    const legacy = {
        nodes: [
            {
                level: 1,
                id: 'FIS065',
                label: 'Fundamentos de Mecânica',
                title: 'FIS065 - Fundamentos de Mecânica',
            },
            {
                level: 2,
                id: 'FIS069',
                label: 'Fundamentos de Eletromagnetismo',
                title: 'FIS069 - Fundamentos de Eletromagnetismo',
            },
        ],
        edges: [{ from: 'FIS065', to: 'FIS069' }],
    }
    const { course, catalog, warnings } = convertLegacyCourse(legacy, {
        id: 'fisica-teste',
        name: 'Física',
        degree: 'Bacharelado',
    })

    assert.deepEqual(warnings, [])
    assert.equal(course.id, 'fisica-teste')
    assert.equal(course.percursos.length, 1)
    assert.deepEqual(
        course.percursos[0].periods.map((period) => period.number),
        [1, 2]
    )
    assert.equal(course.disciplines.FIS065.name, 'Fundamentos de Mecânica')
    assert.deepEqual(course.disciplines.FIS069.prereqs, ['FIS065'])
    assert.equal(course.meta.source.kind, 'legacy-json')
    assert.equal(catalog.stats.edges, 1)
    assert.equal(catalog.stats.disciplines, 2)
})

test('descarta arestas órfãs no JSON legado', () => {
    const legacy = {
        nodes: [{ level: 1, id: 'FIS065', title: 'FIS065 - Mecânica' }],
        edges: [{ from: 'FIS065', to: 'MAT001' }],
    }
    const { warnings } = convertLegacyCourse(legacy, { id: 'x', name: 'X' })
    assert.ok(warnings.some((warning) => warning.includes('aresta ignorada')))
})

test('titleCasePt respeita conectores', () => {
    assert.equal(titleCasePt('CIÊNCIA DA COMPUTAÇÃO'), 'Ciência da Computação')
    assert.equal(titleCasePt('ENGENHARIA DE COMPUTAÇÃO'), 'Engenharia de Computação')
    assert.equal(titleCasePt('SISTEMAS DE INFORMAÇÃO'), 'Sistemas de Informação')
})
