import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
    buildGraph,
    computeAvailability,
    disciplineHours,
    getPercurso,
    missingPrereqs,
    searchDisciplines,
    suggestNextPeriod,
    summarizeProgress,
} from '../src/core/graph.mjs'

const course = {
    schemaVersion: 2,
    id: 'teste',
    meta: { name: 'Curso de Teste' },
    disciplines: {
        TST100: {
            code: 'TST100',
            name: 'Introdução',
            credits: 4,
            hours: { total: 60, theory: 60, practice: 0 },
            prereqs: [],
        },
        TST101: {
            code: 'TST101',
            name: 'Programação I',
            credits: 4,
            hours: { total: 60, theory: 30, practice: 30 },
            prereqs: ['TST100'],
        },
        TST102: {
            code: 'TST102',
            name: 'Estruturas de Dados',
            credits: 4,
            hours: { total: 60, theory: 45, practice: 15 },
            prereqs: ['TST101'],
        },
        TST200: {
            code: 'TST200',
            name: 'Optativa Qualquer',
            hours: { total: 60 },
            prereqs: [],
            scheduled: false,
        },
    },
    percursos: [
        {
            id: '01-01',
            name: 'Percurso 01-01',
            periods: [
                { number: 1, codes: ['TST100', 'TST101'], optional: [] },
                { number: 2, codes: ['TST102'], optional: [] },
            ],
            optionalSlots: [
                { id: 'OPT-01-01-01', label: 'Optativa 1', hours: 60, group: 'Optativas' },
                { id: 'OPT-01-01-02', label: 'Optativa 2', hours: 60, group: 'Optativas' },
            ],
            optionalPool: [
                {
                    code: 'TST200',
                    name: 'Optativa Qualquer',
                    hours: 60,
                    group: 'G1',
                    groupName: 'Optativas',
                    prereqs: ['TST101'],
                },
            ],
            summary: {
                obligatoryHours: { min: 180, max: 180 },
                optionalHours: { min: 120, max: 120 },
                totalHours: 300,
            },
        },
    ],
}

test('monta o grafo com disciplinas, arestas e slots de optativa', () => {
    const graph = buildGraph(course)
    assert.equal(graph.percursoId, '01-01')
    assert.equal(graph.stats.disciplines, 3)
    assert.equal(graph.stats.optionalSlots, 2)
    assert.deepEqual(graph.periods, [1, 2])

    const slots = graph.nodes.filter((node) => node.kind === 'slot')
    assert.deepEqual(
        slots.map((slot) => slot.id),
        ['OPT-01-01-01', 'OPT-01-01-02']
    )
    // slots distribuídos dentro dos períodos (sem coluna extra "Optativas")
    assert.deepEqual(
        slots.map((slot) => slot.level),
        [2, 2]
    )
    // numeração na ordem de leitura (esquerda → direita, cima → baixo)
    assert.deepEqual(
        slots.map((slot) => slot.label),
        ['Optativa 1', 'Optativa 2']
    )
    assert.ok(slots.every((slot) => graph.periods.includes(slot.level)))
    // ... e depois das disciplinas daquele período, para aparecerem embaixo na coluna
    for (const level of graph.periods) {
        const indexes = graph.nodes.map((node, index) => ({ node, index }))
        const disciplineIndexes = indexes
            .filter(({ node }) => node.kind === 'discipline' && node.level === level)
            .map(({ index }) => index)
        const slotIndexes = indexes
            .filter(({ node }) => node.kind === 'slot' && node.level === level)
            .map(({ index }) => index)
        if (disciplineIndexes.length && slotIndexes.length) {
            assert.ok(
                Math.max(...disciplineIndexes) < Math.min(...slotIndexes),
                `slots do período ${level} deveriam vir depois das disciplinas`
            )
        }
    }
    assert.deepEqual(
        graph.edges.map((edge) => `${edge.from}->${edge.to}`),
        ['TST100->TST101', 'TST101->TST102']
    )
})

test('distribui os slots de optativa nos períodos mais vazios', () => {
    const uneven = {
        ...course,
        percursos: [
            {
                ...course.percursos[0],
                periods: [
                    { number: 1, codes: ['TST100', 'TST101'], optional: [] },
                    { number: 2, codes: ['TST102'], optional: [] },
                    { number: 3, codes: ['TST100'], optional: [] },
                ],
                optionalSlots: [
                    { id: 'S1', label: 'Optativa 1', hours: 60 },
                    { id: 'S2', label: 'Optativa 2', hours: 60 },
                    { id: 'S3', label: 'Optativa 3', hours: 60 },
                ],
            },
        ],
    }
    const graph = buildGraph(uneven)
    const slots = graph.nodes.filter((node) => node.kind === 'slot')
    // os períodos 2 e 3 (1 disciplina cada) recebem os slots; o período 1 (2 disciplinas) fica por último
    assert.deepEqual(
        slots.map((slot) => slot.level),
        [2, 3, 3]
    )
    // ... e os rótulos são renumerados na ordem de leitura, não na ordem do JSON
    assert.deepEqual(
        slots.map((slot) => slot.label),
        ['Optativa 1', 'Optativa 2', 'Optativa 3']
    )
    assert.deepEqual(
        slots.map((slot) => slot.id),
        ['S2', 'S1', 'S3']
    )
})

test('permite esconder os slots de optativa', () => {
    const graph = buildGraph(course, { includeOptionalSlots: false })
    assert.equal(graph.stats.optionalSlots, 0)
    assert.equal(graph.nodes.length, 3)
})

test('permite escolher a disciplina de cada espaço de optativa', () => {
    const slotId = 'OPT-01-01-01'
    const graph = buildGraph(course, { choices: { [slotId]: 'TST200' } })
    const slot = graph.nodes.find((node) => node.id === slotId)

    assert.equal(slot.label, 'Optativa Qualquer')
    assert.deepEqual(slot.chosen, { code: 'TST200', name: 'Optativa Qualquer', hours: 60 })
    // pré-requisito da disciplina escolhida vira aresta para o espaço
    assert.deepEqual(
        graph.edges.filter((edge) => edge.to === slotId),
        [{ from: 'TST101', to: slotId }]
    )

    const status = computeAvailability(graph, new Set([slotId]))
    assert.equal(status.get(slotId), 'taken')

    // sem escolha, o slot continua "Optativa N"
    const plain = buildGraph(course)
    assert.equal(plain.nodes.find((node) => node.id === slotId).label, 'Optativa 1')
})

test('calcula disponibilidade a partir dos pré-requisitos cursados', () => {
    const graph = buildGraph(course)
    let taken = new Set()
    let status = computeAvailability(graph, taken)
    assert.equal(status.get('TST100'), 'available')
    assert.equal(status.get('TST101'), 'blocked')
    assert.equal(status.get('TST102'), 'blocked')
    assert.equal(status.get('OPT-01-01-01'), 'available')

    taken = new Set(['TST100'])
    status = computeAvailability(graph, taken)
    assert.equal(status.get('TST101'), 'available')
    assert.equal(status.get('TST102'), 'blocked')
    assert.equal(status.get('TST100'), 'taken')

    taken = new Set(['TST100', 'TST101'])
    status = computeAvailability(graph, taken)
    assert.equal(status.get('TST102'), 'available')
})

test('lista os pré-requisitos que faltam', () => {
    const graph = buildGraph(course)
    const missing = missingPrereqs(graph, new Set())
    assert.deepEqual(missing.get('TST101'), ['TST100'])
    assert.deepEqual(missing.get('TST102'), ['TST101'])
    assert.equal(missing.get('TST100'), undefined)
})

test('resume carga horária e disciplinas liberadas', () => {
    const graph = buildGraph(course)
    const partial = summarizeProgress(graph, new Set(['TST100']))
    assert.equal(partial.obligatory.total, 3)
    assert.equal(partial.obligatory.taken, 1)
    assert.equal(partial.obligatory.hoursTotal, 180)
    assert.equal(partial.obligatory.hoursTaken, 60)
    assert.equal(partial.optional.total, 2)
    assert.equal(partial.availableNow, 1) // só TST101 (slots de optativa não contam)

    const complete = summarizeProgress(
        graph,
        new Set(['TST100', 'TST101', 'TST102', 'OPT-01-01-01'])
    )
    assert.equal(complete.obligatory.taken, 3)
    assert.equal(complete.obligatory.hoursRemaining, 0)
    assert.equal(complete.optional.taken, 1)
    assert.equal(complete.optional.hoursTaken, 60)
})

test('sugere o próximo período a cursar', () => {
    const graph = buildGraph(course)
    assert.equal(suggestNextPeriod(graph, new Set()), 1)
    assert.equal(suggestNextPeriod(graph, new Set(['TST100'])), 1) // TST101 ainda está no 1º
    assert.equal(suggestNextPeriod(graph, new Set(['TST100', 'TST101'])), 2)
    assert.equal(suggestNextPeriod(graph, new Set(['TST100', 'TST101', 'TST102'])), null)
})

test('busca disciplinas por código ou nome, ignorando acentos', () => {
    const graph = buildGraph(course)
    assert.deepEqual(
        searchDisciplines(graph, 'estruturas').map((node) => node.code),
        ['TST102']
    )
    assert.deepEqual(
        searchDisciplines(graph, 'programacao').map((node) => node.code),
        ['TST101']
    )
    assert.deepEqual(
        searchDisciplines(graph, 'tst100').map((node) => node.code),
        ['TST100']
    )
    assert.deepEqual(searchDisciplines(graph, 'naoexiste'), [])
})

test('resolve percurso pedido com fallback para o primeiro', () => {
    assert.equal(getPercurso(course, '01-01').id, '01-01')
    assert.equal(getPercurso(course, 'inexistente').id, '01-01')
    assert.equal(getPercurso({ percursos: [] }, '01-01'), null)
})

test('usa créditos como fallback de carga horária', () => {
    assert.equal(disciplineHours({ hours: { total: 90 } }), 90)
    assert.equal(disciplineHours({ credits: 4 }), 60)
    assert.equal(disciplineHours({}), 60)
    assert.equal(disciplineHours(null), 60)
})

test('curso sem percurso devolve grafo vazio', () => {
    const graph = buildGraph({ disciplines: {}, percursos: [] })
    assert.deepEqual(graph.nodes, [])
    assert.deepEqual(graph.edges, [])
    assert.equal(graph.stats.disciplines, 0)
})
