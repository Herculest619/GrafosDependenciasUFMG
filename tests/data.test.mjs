import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { validateCatalogEntry, validateCourse } from '../scripts/lib/validate.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DATA_DIR = join(ROOT, 'public/data')
const MANIFEST = join(DATA_DIR, 'courses.json')

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'))
}

test('o catálogo publicado é válido', () => {
    assert.ok(
        existsSync(MANIFEST),
        'public/data/courses.json não existe — rode `npm run data:build`'
    )

    const manifest = readJson(MANIFEST)
    assert.equal(manifest.schemaVersion, 2)
    assert.ok(Array.isArray(manifest.courses))
    assert.ok(manifest.courses.length >= 7, 'esperado ao menos 7 cursos publicados')

    const ids = new Set()
    for (const entry of manifest.courses) {
        assert.ok(entry.id, 'curso sem id no manifesto')
        assert.ok(!ids.has(entry.id), `id duplicado no manifesto: ${entry.id}`)
        ids.add(entry.id)

        const path = join(DATA_DIR, entry.file.replace(/^data\//, ''))
        assert.ok(existsSync(path), `arquivo do curso não existe: ${entry.file}`)

        const course = readJson(path)
        const { errors } = validateCourse(course)
        assert.deepEqual(errors, [], `erros de validação em ${entry.id}: ${errors.join('; ')}`)
        assert.deepEqual(validateCatalogEntry(entry, course), [])
    }
})

test('todo curso publicado tem disciplinas, períodos e fontes registradas', () => {
    const { courses } = readJson(MANIFEST)
    for (const entry of courses) {
        assert.ok(entry.stats?.disciplines > 0, `${entry.id}: sem disciplinas`)
        assert.ok(entry.stats?.periods > 0, `${entry.id}: sem períodos`)
        assert.ok(entry.unit, `${entry.id}: sem unidade`)
        assert.ok(entry.source?.kind, `${entry.id}: sem tipo de fonte`)
        assert.ok(entry.curriculum, `${entry.id}: sem versão curricular`)
    }
})

test('dados de Física mantêm a matriz original (regressão)', () => {
    const fisica = readJson(join(DATA_DIR, 'courses/fisica-bacharelado.json'))
    assert.equal(fisica.meta.name, 'Física')
    assert.equal(fisica.percursos[0].periods.at(-1).number, 7)
    assert.ok(fisica.disciplines.FIS065)
    assert.deepEqual(fisica.disciplines.FIS069.prereqs, ['FIS065', 'MAT039'])
    assert.ok(fisica.disciplines.DCC208)
})

test('dados do DCC têm códigos, períodos e pré-requisitos conhecidos', () => {
    const bcc = readJson(join(DATA_DIR, 'courses/ciencia-da-computacao.json'))
    assert.deepEqual(bcc.disciplines.DCC205.prereqs, ['DCC204'])
    assert.deepEqual(bcc.disciplines.DCC206.prereqs, ['DCC205'])
    assert.ok(bcc.disciplines.DCC212.prereqs.includes('MAT001'))
    assert.ok(bcc.percursos.some((percurso) => percurso.optionalSlots.length > 0))
    assert.ok(bcc.meta.source.url.includes('dcc.ufmg.br'))
})
