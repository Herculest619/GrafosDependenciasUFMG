import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { parseSigaReport } from '../scripts/lib/siga-report.mjs'

const FIXTURE = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/siga-mini.txt')

function parseFixture() {
    return parseSigaReport(readFileSync(FIXTURE, 'utf8'))
}

test('extrai cabeçalho, curso e percursos', () => {
    const parsed = parseFixture()
    assert.equal(parsed.header.courseCode, '02001')
    assert.equal(parsed.header.courseName, 'CURSO DE TESTE')
    assert.equal(parsed.header.curriculumVersionId, 'D-20192')
    assert.equal(parsed.header.shift, 'DIURNO')
    assert.deepEqual(
        parsed.header.percursos.map((percurso) => percurso.id),
        ['01-01', '01-02']
    )
})

test('extrai os períodos e as atividades obrigatórias', () => {
    const parsed = parseFixture()
    assert.deepEqual(
        parsed.periods.map((period) => period.number),
        [1, 2, 3]
    )

    const period1 = parsed.periods[0].activities
    assert.deepEqual(
        period1.map((activity) => activity.code),
        ['TST100', 'TST101']
    )
    assert.deepEqual(period1[0].hours, { total: 60, theory: 60, practice: 0 })
    assert.equal(period1[0].credits.max, 4)
    assert.deepEqual(
        period1[0].entries.map((entry) => entry.percursoId),
        ['01-01', '01-02']
    )
})

test('junta nome quebrado em duas linhas e pré-requisitos quebrados', () => {
    const parsed = parseFixture()
    const period3 = parsed.periods[2].activities
    assert.equal(period3.length, 1)
    assert.equal(period3[0].code, 'TST103')
    assert.equal(period3[0].name, 'PROJETOS E CONCEITOS DE SISTEMAS PARALELOS E DISTRIBUÍDOS')
    assert.deepEqual(period3[0].entries[0].prereqs, ['TST102', 'TST100'])
})

test('extrai atividades sem período sugerido (optativas)', () => {
    const parsed = parseFixture()
    assert.deepEqual(
        parsed.unscheduled.map((activity) => activity.code),
        ['TST200', 'TST201']
    )
    const tst200 = parsed.unscheduled[0]
    assert.deepEqual(tst200.hours, { total: 60, theory: 60, practice: 0 })
    assert.equal(tst200.entries[0].naturePercurso, 'OP')
    assert.deepEqual(tst200.entries[0].prereqs, ['TST102'])
})

test('não confunde a carga horária adicional do período com disciplina', () => {
    const parsed = parseFixture()
    const allCodes = parsed.periods.flatMap((period) =>
        period.activities.map((activity) => activity.code)
    )
    assert.deepEqual(allCodes, ['TST100', 'TST101', 'TST102', 'TST103'])
    assert.equal(parsed.periods[2].activities.length, 1)
})

test('extrai o quadro de integralização', () => {
    const parsed = parseFixture()
    assert.equal(parsed.integralizacao.length, 2)
    const [percurso1, percurso2] = parsed.integralizacao
    assert.equal(percurso1.percursoId, '01-01')
    assert.deepEqual(percurso1.optionalHours, { min: 660, max: 780 })
    assert.equal(percurso1.totalHours, 3240)
    assert.deepEqual(percurso2.optionalHours, { min: 1020, max: 1140 })
})

test('extrai nomes de grupos', () => {
    const parsed = parseFixture()
    assert.equal(parsed.groupNames.get('3'), 'Optativas')
    assert.equal(parsed.groupNames.get('8'), 'Núcleo Avançado')
})

test('não gera avisos no relatório de exemplo', () => {
    const parsed = parseFixture()
    assert.deepEqual(parsed.warnings, [])
})

test('não quebra com texto vazio', () => {
    const parsed = parseSigaReport('')
    assert.deepEqual(parsed.periods, [])
    assert.deepEqual(parsed.unscheduled, [])
    assert.deepEqual(parsed.percursos ?? [], [])
})
