#!/usr/bin/env node
/**
 * Valida os dados publicados em public/data/ (manifesto + JSONs dos cursos).
 * Sai com código 1 se encontrar erros — usado no CI antes do build.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateCatalogEntry, validateCourse } from './lib/validate.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DATA_DIR = join(ROOT, 'public/data')
const COURSES_DIR = join(DATA_DIR, 'courses')
const MANIFEST = join(DATA_DIR, 'courses.json')

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'))
}

function main() {
    const errors = []
    const warnings = []

    if (!existsSync(MANIFEST)) {
        console.error('✖ public/data/courses.json não existe. Rode `npm run data:build`.')
        process.exit(1)
    }

    const manifest = readJson(MANIFEST)
    const courses = manifest.courses ?? []

    if (manifest.schemaVersion !== 2) errors.push('manifesto: schemaVersion != 2')
    if (!manifest.generatedAt) warnings.push('manifesto: sem generatedAt')
    if (!courses.length) errors.push('manifesto: nenhum curso publicado')

    const ids = new Set()

    for (const entry of courses) {
        const label = entry.id ?? entry.file ?? '???'
        if (!entry.id) errors.push('manifesto: curso sem id')
        if (entry.id && ids.has(entry.id)) errors.push(`manifesto: id duplicado ${entry.id}`)
        if (entry.id) ids.add(entry.id)

        if (!entry.file) {
            errors.push(`manifesto: ${label} sem "file"`)
            continue
        }

        const filePath = join(DATA_DIR, entry.file.replace(/^data\//, ''))
        if (!existsSync(filePath)) {
            errors.push(`manifesto: ${label} aponta para arquivo inexistente (${entry.file})`)
            continue
        }

        let course
        try {
            course = readJson(filePath)
        } catch (error) {
            errors.push(`${label}: JSON inválido (${error.message})`)
            continue
        }

        const result = validateCourse(course)
        errors.push(...result.errors.map((error) => `${label}: ${error}`))
        warnings.push(...result.warnings.map((warning) => `${label}: ${warning}`))
        errors.push(...validateCatalogEntry(entry, course).map((error) => `${label}: ${error}`))
    }

    // Arquivos gerados órfãos (sem entrada no manifesto)
    if (existsSync(COURSES_DIR)) {
        const files = readdirSync(COURSES_DIR).filter((file) => file.endsWith('.json'))
        const listed = new Set(courses.map((entry) => (entry.file ?? '').split('/').pop()))
        for (const file of files) {
            if (!listed.has(file)) {
                warnings.push(`arquivo gerado sem entrada no manifesto: data/courses/${file}`)
            }
        }
    }

    const label = relative(ROOT, MANIFEST)
    if (warnings.length) {
        console.warn(`\n${warnings.length} aviso(s):`)
        for (const warning of warnings) console.warn(`   ! ${warning}`)
    }

    if (errors.length) {
        console.error(`\n✖ ${errors.length} erro(s) em ${label}:`)
        for (const error of errors) console.error(`   ✖ ${error}`)
        process.exit(1)
    }

    const summary = courses
        .map(
            (entry) =>
                `   • ${entry.name}${entry.variant ? ` (${entry.variant})` : ''}: ` +
                `${entry.stats?.disciplines ?? '?'} disciplinas, ${
                    entry.stats?.periods ?? '?'
                } períodos, ` +
                `${entry.stats?.optionalSlots ?? 0} slots`
        )
        .join('\n')

    console.log(`✔ ${courses.length} curso(s) válido(s) em ${label}:\n${summary}`)
}

main()
