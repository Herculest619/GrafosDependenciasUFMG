import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
    STORAGE_PREFIX,
    clearProgress,
    loadProgress,
    parseProgress,
    progressKey,
    saveProgress,
    serializeProgress,
} from '../src/core/progress.mjs'

function fakeStorage() {
    const store = new Map()
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        dump: () => store,
    }
}

test('chave de progresso é prefixada e isolada por curso', () => {
    assert.equal(progressKey('fisica'), `${STORAGE_PREFIX}fisica`)
    assert.notEqual(progressKey('fisica'), progressKey('computacao'))
})

test('salva, carrega e limpa o progresso de um curso', () => {
    const storage = fakeStorage()
    assert.equal(loadProgress(storage, 'curso-a'), null)

    assert.equal(saveProgress(storage, 'curso-a', new Set(['TST100', 'TST101'])), true)
    const loaded = loadProgress(storage, 'curso-a')
    assert.deepEqual(loaded.taken, ['TST100', 'TST101'])
    assert.ok(loaded.updatedAt)

    assert.equal(loadProgress(storage, 'curso-b'), null)
    assert.equal(saveProgress(storage, 'curso-b', new Set(['OUTRA'])), true)
    assert.deepEqual(loadProgress(storage, 'curso-b').taken, ['OUTRA'])
    assert.deepEqual(loadProgress(storage, 'curso-a').taken, ['TST100', 'TST101'])

    assert.equal(clearProgress(storage, 'curso-a'), true)
    assert.equal(loadProgress(storage, 'curso-a'), null)
})

test('serializa sem duplicatas e ordenado', () => {
    const serialized = serializeProgress(['B', 'A', 'B'])
    assert.deepEqual(serialized.taken, ['A', 'B'])
    assert.ok(Date.parse(serialized.updatedAt) > 0)
})

test('guarda as disciplinas escolhidas em cada espaço de optativa', () => {
    const storage = fakeStorage()
    saveProgress(storage, 'curso-a', new Set(['TST100', 'OPT-01-01-01']), {
        'OPT-01-01-01': 'TST200',
    })
    const loaded = loadProgress(storage, 'curso-a')
    assert.deepEqual(loaded.taken.sort(), ['OPT-01-01-01', 'TST100'])
    assert.deepEqual(loaded.choices, { 'OPT-01-01-01': 'TST200' })

    const serialized = serializeProgress(['A'], { S1: 'X', S2: '', invalid: 'Y' })
    assert.deepEqual(serialized.choices, { S1: 'X', invalid: 'Y' })
    assert.deepEqual(parseProgress('{"taken": [], "choices": null}').choices, {})
    assert.deepEqual(parseProgress('{"taken": [], "choices": {"S1": 42}}').choices, {})
})

test('rejeita JSON inválido sem quebrar', () => {
    assert.equal(parseProgress(''), null)
    assert.equal(parseProgress(null), null)
    assert.equal(parseProgress('not json'), null)
    assert.equal(parseProgress('{"taken": "nope"}'), null)
    assert.equal(parseProgress('{"taken": [1, 2]}'), null)
    assert.deepEqual(parseProgress('{"taken": ["A", "A"]}').taken, ['A'])
})

test('sobrevive a storage indisponível', () => {
    assert.equal(loadProgress(null, 'x'), null)
    assert.equal(saveProgress(null, 'x', new Set()), false)
    assert.equal(clearProgress(null, 'x'), false)

    const brokenStorage = {
        getItem() {
            throw new Error('quota')
        },
        setItem() {
            throw new Error('quota')
        },
        removeItem() {
            throw new Error('quota')
        },
    }
    assert.equal(loadProgress(brokenStorage, 'x'), null)
    assert.equal(saveProgress(brokenStorage, 'x', new Set()), false)
    assert.equal(clearProgress(brokenStorage, 'x'), false)
})

test('grava em chaves diferentes por curso (sem vazamento)', () => {
    const storage = fakeStorage()
    saveProgress(storage, 'a', new Set(['X']))
    saveProgress(storage, 'b', new Set(['Y']))
    assert.equal(storage.dump().size, 2)
    assert.deepEqual(loadProgress(storage, 'a').taken, ['X'])
    assert.deepEqual(loadProgress(storage, 'b').taken, ['Y'])
})
