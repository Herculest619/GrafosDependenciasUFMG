import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { parseSigaReport } from '../scripts/lib/siga-report.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCES = join(ROOT, 'data/sources')

/**
 * Regressão com os relatórios oficiais versionados em data/sources.
 * Se o parser mudar de comportamento, estes números quebram.
 */
const EXPECTATIONS = [
    {
        file: 'dcc/bcc',
        layout: 'versao',
        periods: 10,
        percursos: 2,
        firstId: '01-02',
        scheduled: 35,
        unscheduled: 53,
    },
    {
        file: 'dcc/bsi',
        layout: 'percurso',
        periods: 9,
        percursos: 1,
        firstId: '01-01',
        scheduled: 35,
        unscheduled: 42,
    },
    {
        file: 'dcc/bec',
        layout: 'versao',
        periods: 10,
        percursos: 2,
        firstId: '01-02',
        scheduled: 52,
        unscheduled: 150,
    },
    {
        file: 'dcc/bcd',
        layout: 'percurso',
        periods: 9,
        percursos: 1,
        firstId: '01-01',
        scheduled: 39,
        unscheduled: 108,
    },
    {
        file: 'farmacia/farmacia',
        layout: 'versao',
        periods: 10,
        percursos: 3,
        firstId: '01-01',
        scheduled: 66,
        unscheduled: 126,
    },
    {
        file: 'farmacia/farmacia-noturno',
        layout: 'versao',
        periods: 12,
        percursos: 3,
        firstId: '01-01',
        scheduled: 66,
        unscheduled: 126,
    },
    {
        file: 'farmacia/biomedicina',
        layout: 'versao',
        periods: 10,
        percursos: 2,
        firstId: '01-01',
        scheduled: 40,
        unscheduled: 138,
    },
    {
        file: 'eci/biblioteconomia-diurno',
        layout: 'versao',
        periods: 8,
        percursos: 5,
        firstId: '01-03',
        scheduled: 30,
        unscheduled: 109,
    },
    {
        file: 'eci/biblioteconomia-noturno',
        layout: 'versao',
        periods: 8,
        percursos: 5,
        firstId: '01-02',
        scheduled: 30,
        unscheduled: 110,
    },
    {
        file: 'eci/arquivologia',
        layout: 'versao',
        periods: 8,
        percursos: 2,
        firstId: '01-01',
        scheduled: 31,
        unscheduled: 69,
    },
    {
        file: 'eci/museologia',
        layout: 'versao',
        periods: 8,
        percursos: 2,
        firstId: 'R-02',
        scheduled: 32,
        unscheduled: 116,
    },
    {
        file: 'fae/pedagogia-diurno',
        layout: 'versao',
        periods: 9,
        percursos: 6,
        firstId: '02-01',
        scheduled: 41,
        unscheduled: 79,
    },
    {
        file: 'fae/pedagogia-noturno',
        layout: 'versao',
        periods: 10,
        percursos: 6,
        firstId: '02-01',
        scheduled: 41,
        unscheduled: 79,
    },
]

function scheduledCodes(parsed, percursoId) {
    const codes = new Set()
    for (const period of parsed.periods) {
        for (const activity of period.activities) {
            if (activity.entries.some((entry) => entry.percursoId === percursoId)) {
                codes.add(activity.code)
            }
        }
    }
    return codes
}

for (const expectation of EXPECTATIONS) {
    test(`parser: ${expectation.file}`, () => {
        const text = readFileSync(join(SOURCES, `${expectation.file}.txt`), 'utf8')
        const parsed = parseSigaReport(text)

        assert.equal(parsed.layout, expectation.layout)
        assert.equal(parsed.periods.length, expectation.periods)
        assert.equal(parsed.header.percursos.length, expectation.percursos)
        assert.equal(parsed.header.percursos[0].id, expectation.firstId)
        assert.equal(
            scheduledCodes(parsed, expectation.firstId).size,
            expectation.scheduled,
            'disciplinas agendadas no primeiro percurso'
        )
        assert.equal(parsed.unscheduled.length, expectation.unscheduled)
        assert.deepEqual(parsed.warnings, [], 'o parser não deve gerar avisos')
        assert.ok(parsed.integralizacao.length > 0, 'quadro de integralização ausente')
    })
}

test('parser: identificadores de percurso não numéricos (R-01/R-02)', () => {
    const text = readFileSync(join(SOURCES, 'eci/museologia.txt'), 'utf8')
    const parsed = parseSigaReport(text)
    assert.deepEqual(
        parsed.header.percursos.map((percurso) => percurso.id),
        ['R-02', 'R-01']
    )
    const entries = parsed.periods[0].activities[0].entries.map((entry) => entry.percursoId)
    assert.deepEqual(entries, ['R-01', 'R-02'])
})

test('parser: coluna de grupo com identificador completo (Biblioteconomia)', () => {
    const text = readFileSync(join(SOURCES, 'eci/biblioteconomia-diurno.txt'), 'utf8')
    const parsed = parseSigaReport(text)
    const activity = parsed.periods[0].activities[0]
    const firstEntry = activity.entries[0]
    assert.equal(firstEntry.percursoId, '01-03')
    assert.equal(firstEntry.natureGroup, 'OB')
    assert.equal(firstEntry.naturePercurso, 'OB')
    assert.ok(firstEntry.group, 'grupo deve ser identificado mesmo com id completo')
})

test('parser: Pedagogia não tem pré-requisitos na matriz oficial', () => {
    const parsed = parseSigaReport(readFileSync(join(SOURCES, 'fae/pedagogia-diurno.txt'), 'utf8'))
    const prereqs = parsed.periods.flatMap((period) =>
        period.activities.flatMap((activity) => activity.entries.flatMap((entry) => entry.prereqs))
    )
    assert.deepEqual(prereqs, [])
})
