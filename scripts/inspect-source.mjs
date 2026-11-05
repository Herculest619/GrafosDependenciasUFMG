#!/usr/bin/env node
/**
 * Diagnóstico de uma fonte de texto: mostra o que o parser entendeu.
 * Útil antes de publicar um curso novo.
 *
 * Uso: node scripts/inspect-source.mjs data/sources/dcc/bcc.txt
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { relative } from 'node:path'

import { parseSigaReport } from './lib/siga-report.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const target = process.argv[2]

if (!target) {
    console.error('uso: node scripts/inspect-source.mjs <arquivo.txt>')
    process.exit(1)
}

const text = readFileSync(target, 'utf8')
const parsed = parseSigaReport(text)

console.log(`arquivo: ${relative(ROOT, target)} (${text.length} caracteres)`)
console.log(`layout: ${parsed.layout}`)
console.log(
    `curso: ${parsed.header.courseName} | código: ${parsed.header.courseCode} | versão: ${parsed.header.curriculumVersionId}`
)
console.log(`turno: ${parsed.header.shift} | modalidade: ${parsed.header.modality}`)
console.log(`percursos: ${parsed.header.percursos.map((p) => `${p.id} (${p.name})`).join(' | ')}`)
console.log(
    `períodos: ${parsed.periods.length} (${parsed.periods
        .map((period) => `${period.number}:${period.activities.length}`)
        .join(' ')})`
)
console.log(`atividades sem período (optativas): ${parsed.unscheduled.length}`)
console.log(`estágio obrigatório: ${parsed.stage.length}`)
console.log(`quadro de integralização: ${parsed.integralizacao.length} linha(s)`)
for (const row of parsed.integralizacao) {
    console.log(
        `   ${row.percursoId}: obrigatórias ${row.obligatoryHours?.min}–${row.obligatoryHours?.max} h, ` +
            `optativas ${row.optionalHours?.min}–${row.optionalHours?.max} h, total ${row.totalHours} h`
    )
}
console.log(
    `regras gerais: ${
        parsed.regrasGerais ? JSON.stringify(parsed.regrasGerais) : 'não encontradas'
    }`
)
console.log(
    `grupos: ${
        [...parsed.groupNames.entries()].map(([id, name]) => `${id}=${name}`).join(', ') || 'nenhum'
    }`
)

const sample = parsed.periods[0]?.activities ?? []
console.log('\namostra do 1º período:')
for (const activity of sample.slice(0, 8)) {
    const entries = activity.entries
        .map(
            (entry) =>
                `${entry.percursoId}:${entry.naturePercurso ?? '?'}${
                    entry.prereqs.length ? `<-${entry.prereqs.join('+')}` : ''
                }`
        )
        .join(' ')
    console.log(`   ${activity.code} ${activity.name} (${activity.hours.total} h) ${entries}`)
}

if (parsed.warnings.length) {
    console.log(`\n${parsed.warnings.length} aviso(s):`)
    for (const warning of parsed.warnings.slice(0, 30)) console.log(`   ! ${warning}`)
} else {
    console.log('\nsem avisos')
}
