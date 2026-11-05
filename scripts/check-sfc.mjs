#!/usr/bin/env node
/**
 * Valida a sintaxe dos componentes Vue (.vue) e a existência dos imports
 * relativos. Não depende do esbuild — funciona em ambientes onde `vite build`
 * não pode ser executado.
 *
 * Uso: node scripts/check-sfc.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const EXTENSIONS = new Set(['.vue', '.js', '.mjs', '.css'])

function walk(directory) {
    const files = []
    for (const entry of readdirSync(directory)) {
        const full = join(directory, entry)
        if (statSync(full).isDirectory()) files.push(...walk(full))
        else files.push(full)
    }
    return files
}

function checkImports(filename, source, errors) {
    const importRegex = /(?:from\s+|import\s*\(\s*)['"](\.[^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(source))) {
        const specifier = match[1]
        const base = resolve(dirname(filename), specifier)
        const candidates = [
            base,
            ...(extname(base) ? [] : [...EXTENSIONS].map((extension) => `${base}${extension}`)),
            ...(extname(base)
                ? []
                : [...EXTENSIONS].map((extension) => join(base, `index${extension}`))),
        ]
        if (!candidates.some((candidate) => existsSync(candidate))) {
            errors.push(`${relative(ROOT, filename)}: import não encontrado "${specifier}"`)
        }
    }
}

function main() {
    const errors = []
    const vueFiles = walk(SRC).filter((file) => file.endsWith('.vue'))
    const jsFiles = walk(SRC).filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))

    for (const file of vueFiles) {
        const source = readFileSync(file, 'utf8')
        const { descriptor, errors: parseErrors } = parse(source, { filename: file })

        for (const error of parseErrors) {
            errors.push(`${relative(ROOT, file)}: ${error.message ?? error}`)
        }
        if (!descriptor.template && !descriptor.script && !descriptor.scriptSetup) {
            errors.push(`${relative(ROOT, file)}: componente vazio`)
            continue
        }

        if (descriptor.script || descriptor.scriptSetup) {
            try {
                compileScript(descriptor, { id: relative(ROOT, file) })
            } catch (error) {
                errors.push(`${relative(ROOT, file)}: <script> ${error.message}`)
            }
        }

        if (descriptor.template) {
            const result = compileTemplate({
                source: descriptor.template.content,
                filename: file,
                id: relative(ROOT, file),
            })
            for (const error of result.errors ?? []) {
                errors.push(`${relative(ROOT, file)}: <template> ${error.message ?? error}`)
            }
        }

        checkImports(file, source, errors)
    }

    for (const file of jsFiles) {
        checkImports(file, readFileSync(file, 'utf8'), errors)
    }

    if (errors.length) {
        console.error(`✖ ${errors.length} problema(s) em componentes/imports:`)
        for (const error of errors) console.error(`   ✖ ${error}`)
        process.exit(1)
    }

    console.log(`✔ ${vueFiles.length} componente(s) e ${jsFiles.length} módulo(s) verificados.`)
}

main()
