import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildGraph } from '../src/core/graph.mjs'
import { findCycles, validateCatalogEntry, validateCourse } from '../scripts/lib/validate.mjs'

function baseCourse() {
    return {
        schemaVersion: 2,
        id: 'teste',
        meta: { name: 'Curso de Teste' },
        disciplines: {
            TST100: {
                code: 'TST100',
                name: 'Introdução',
                type: 'DIG',
                credits: 4,
                hours: { total: 60, theory: 30, practice: 30 },
                prereqs: [],
            },
            TST101: {
                code: 'TST101',
                name: 'Programação',
                type: 'DIG',
                credits: 4,
                hours: { total: 60, theory: 30, practice: 30 },
                prereqs: ['TST100'],
            },
        },
        percursos: [
            {
                id: '01-01',
                name: 'Percurso',
                periods: [
                    { number: 1, codes: ['TST100'], optional: [] },
                    { number: 2, codes: ['TST101'], optional: [] },
                ],
                optionalSlots: [{ id: 'OPT-1', label: 'Optativa 1', hours: 60 }],
                summary: {
                    obligatoryHours: { min: 120, max: 120 },
                    optionalHours: { min: 60, max: 60 },
                    totalHours: 180,
                },
            },
        ],
    }
}

test('curso consistente não gera erros', () => {
    const course = baseCourse()
    const { errors } = validateCourse(course)
    assert.deepEqual(errors, [])
})

test('detecta ciclo de pré-requisitos', () => {
    const course = baseCourse()
    course.disciplines.TST100.prereqs = ['TST101']
    const cycles = findCycles(course, course.percursos[0])
    assert.equal(cycles.length, 1)
    const { errors } = validateCourse(course)
    assert.ok(errors.some((error) => error.includes('ciclo')))
})

test('detecta pré-requisito inexistente e disciplina sem nome', () => {
    const course = baseCourse()
    course.disciplines.TST101.prereqs = ['XXX999']
    course.disciplines.TST100.name = ''
    const { errors } = validateCourse(course)
    assert.ok(errors.some((error) => error.includes('não existe no curso')))
    assert.ok(errors.some((error) => error.includes('sem nome')))
})

test('detecta texto corrompido (encoding)', () => {
    const course = baseCourse()
    course.disciplines.TST100.name = 'IntroduÃ§Ã£o'
    const { errors } = validateCourse(course)
    assert.ok(errors.some((error) => error.includes('corrompido')))
})

test('detecta pré-requisito em período posterior', () => {
    const course = baseCourse()
    course.percursos[0].periods = [
        { number: 1, codes: ['TST101'], optional: [] },
        { number: 2, codes: ['TST100'], optional: [] },
    ]
    const { errors } = validateCourse(course)
    assert.ok(errors.some((error) => error.includes('período posterior')))
})

test('detecta slot de optativa duplicado', () => {
    const course = baseCourse()
    course.percursos[0].optionalSlots.push({ id: 'OPT-1', label: 'Optativa 1', hours: 60 })
    const { errors } = validateCourse(course)
    assert.ok(errors.some((error) => error.includes('slot duplicado')))
})

test('detecta faixa de carga horária inválida', () => {
    const course = baseCourse()
    course.percursos[0].summary.optionalHours = { min: 120, max: 60 }
    const { errors } = validateCourse(course)
    assert.ok(errors.some((error) => error.includes('faixa inválida')))
})

test('confere o manifesto do catálogo contra o curso', () => {
    const course = baseCourse()
    const graph = buildGraph(course, { percursoId: course.percursos[0].id })
    const entry = {
        id: course.id,
        name: course.meta.name,
        file: 'data/courses/teste.json',
        stats: {
            disciplines: graph.stats.disciplines,
            edges: graph.stats.edges,
            optionalSlots: course.percursos[0].optionalSlots.length,
            periods: 2,
        },
    }
    assert.deepEqual(validateCatalogEntry(entry, course), [])

    entry.stats.edges = 99
    assert.ok(validateCatalogEntry(entry, course).some((error) => error.includes('edges')))
})

test('curso vazio/estruturalmente inválido é rejeitado', () => {
    assert.ok(validateCourse(null).errors.length > 0)
    assert.ok(validateCourse({ schemaVersion: 1 }).errors.length > 0)
    assert.ok(
        validateCourse({ schemaVersion: 2, id: 'x', meta: {}, disciplines: {}, percursos: [] })
            .errors.length > 0
    )
})
