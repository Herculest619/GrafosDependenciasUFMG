import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filterCourses, formatHours, groupByUnit, percent, slugify } from '../src/core/format.mjs'

const courses = [
    {
        id: 'fisica-bacharelado',
        name: 'Física',
        variant: 'Bacharelado',
        unit: 'ICEx — Departamento de Física',
        degree: 'Bacharelado',
        shift: 'Diurno',
        campus: 'Pampulha',
    },
    {
        id: 'ciencia-da-computacao',
        name: 'Ciência da Computação',
        unit: 'DCC — ICEx',
        degree: 'Bacharelado',
        shift: 'Diurno',
        campus: 'Pampulha',
    },
    {
        id: 'engenharia-de-computacao',
        name: 'Engenharia de Computação',
        unit: 'DCC — ICEx / Escola de Engenharia',
        degree: 'Bacharelado',
        shift: 'Noturno',
        campus: 'Pampulha',
    },
]

test('slugify remove acentos e pontuação', () => {
    assert.equal(slugify('Ciência da Computação'), 'ciencia-da-computacao')
    assert.equal(slugify('Física — Licenciatura (Noturno)'), 'fisica-licenciatura-noturno')
    assert.equal(slugify('  --Teste--  '), 'teste')
})

test('filtra cursos por nome, unidade, grau e turno', () => {
    assert.equal(filterCourses(courses, '').length, 3)
    assert.deepEqual(
        filterCourses(courses, 'computacao').map((course) => course.id),
        ['ciencia-da-computacao', 'engenharia-de-computacao']
    )
    assert.deepEqual(
        filterCourses(courses, 'fisica').map((course) => course.id),
        ['fisica-bacharelado']
    )
    assert.deepEqual(
        filterCourses(courses, 'noturno').map((course) => course.id),
        ['engenharia-de-computacao']
    )
    assert.deepEqual(
        filterCourses(courses, 'engenharia computacao').map((course) => course.id),
        ['engenharia-de-computacao']
    )
    assert.deepEqual(filterCourses(courses, 'medicina'), [])
})

test('agrupa cursos por unidade', () => {
    const groups = groupByUnit(courses)
    assert.deepEqual(
        groups.map((group) => group.unit),
        ['DCC — ICEx', 'DCC — ICEx / Escola de Engenharia', 'ICEx — Departamento de Física']
    )
    const dcc = groups.find((group) => group.unit === 'DCC — ICEx')
    assert.deepEqual(
        dcc.items.map((course) => course.id),
        ['ciencia-da-computacao']
    )
})

test('formata horas e percentuais', () => {
    assert.equal(formatHours(60), '60 h')
    assert.equal(formatHours(3240), '3,2 mil h')
    assert.equal(formatHours(3000), '3 mil h')
    assert.equal(formatHours(null), '—')
    assert.equal(percent(50, 100), 50)
    assert.equal(percent(0, 100), 0)
    assert.equal(percent(150, 100), 100)
    assert.equal(percent(10, 0), 0)
    assert.equal(percent(null, 100), 0)
})
