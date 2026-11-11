import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { buildEstruturaCourse } from '../scripts/lib/course-json.mjs'
import { parseEstruturaCurricular } from '../scripts/lib/estrutura-curricular.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCES = join(ROOT, 'data/sources/fisica')

function parse(file) {
    return parseEstruturaCurricular(readFileSync(join(SOURCES, `${file}.txt`), 'utf8'))
}

test('estrutura curricular: Física Licenciatura Noturno matriz 2018', () => {
    const parsed = parse('fisica-licenciatura-noturno-matriz-2018')
    assert.equal(parsed.kind, 'licenciatura')
    assert.equal(parsed.shift, 'Noturno')
    assert.equal(parsed.versions.length, 2)
    assert.equal(parsed.blocks.length, 9)
    assert.equal(
        parsed.blocks.reduce((total, block) => total + block.rows.length, 0),
        35
    )
    assert.deepEqual(parsed.totals, {
        obligatoryCredits: 141,
        obligatoryHours: 2115,
        optionalCredits: 46,
        optionalHours: 690,
    })
    assert.deepEqual(parsed.headerTotal, { credits: 187, hours: 2805 })
    assert.equal(parsed.groups.G1.length, 20)
    assert.equal(parsed.groups.G2.length, 0) // grupo só com tópicos de ementa variável
    assert.equal(parsed.groups.G9.length, 11)
    assert.deepEqual(parsed.warnings, [])
})

test('converte a estrutura curricular no JSON v2', () => {
    const parsed = parse('fisica-licenciatura-noturno-matriz-2018')
    const { course, catalog } = buildEstruturaCourse(parsed, {
        id: 'fisica-licenciatura-noturno-matriz-2018',
        name: 'Física',
        variant: 'Licenciatura · Noturno · matriz 2018',
        degree: 'Licenciatura',
        curriculum: 'Matriz 2018 (noturno)',
    })

    assert.equal(course.id, 'fisica-licenciatura-noturno-matriz-2018')
    assert.equal(course.meta.degree, 'Licenciatura')
    assert.equal(course.percursos.length, 1)

    const percurso = course.percursos[0]
    assert.deepEqual(
        percurso.periods.map((period) => period.number),
        [1, 2, 3, 4, 5, 6, 7, 8, 9]
    )
    assert.equal(percurso.optionalSlots.length, 12) // 690 h / 60 h
    assert.equal(percurso.summary.optionalHours.min, 690)
    assert.equal(percurso.summary.totalHours, 2805)

    assert.equal(catalog.stats.disciplines, 35)
    assert.equal(catalog.stats.periods, 9)
    assert.ok(catalog.stats.edges > 0)
})

test('descarta pré-requisito de si mesma (typo do PDF)', () => {
    const parsed = parse('fisica-licenciatura-noturno-matriz-2018')
    const { course, warnings } = buildEstruturaCourse(parsed, {
        id: 'fisica-licenciatura-noturno-matriz-2018',
        name: 'Física',
        degree: 'Licenciatura',
    })
    assert.equal(
        course.disciplines.QUI003.prereqs.includes('QUI003'),
        false,
        'QUI003 não pode ser pré-requisito de si mesma'
    )
    assert.ok(warnings.some((warning) => warning.includes('QUI003->QUI003')))
    assert.equal(course.percursos[0].optionalSlots.length, 12)
})
