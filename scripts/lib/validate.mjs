import { buildGraph, SCHEMA_VERSION } from '../../src/core/graph.mjs'

const CODE_PATTERN = /^[A-Z]{3}\d{3}$/
const MOJIBAKE = /(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|\uFFFD)/

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value)
}

function isPair(range) {
    return (
        range &&
        isFiniteNumber(range.min) &&
        isFiniteNumber(range.max) &&
        range.min >= 0 &&
        range.max >= range.min
    )
}

/** Detecta ciclos no grafo de pré-requisitos (retorna lista de caminhos). */
export function findCycles(course, percurso) {
    const prereqs = new Map()
    const codes = new Set(percurso.periods.flatMap((period) => period.codes))

    for (const code of codes) {
        const overrides = percurso.prereqOverrides?.[code]
        const list = overrides ?? course.disciplines[code]?.prereqs ?? []
        prereqs.set(
            code,
            list.filter((prereq) => codes.has(prereq))
        )
    }

    const state = new Map()
    const cycles = []
    const stack = []

    const visit = (code) => {
        state.set(code, 'visiting')
        stack.push(code)
        for (const prereq of prereqs.get(code) ?? []) {
            const status = state.get(prereq)
            if (status === 'visiting') {
                const start = stack.indexOf(prereq)
                cycles.push([...stack.slice(start), prereq])
            } else if (!status) {
                visit(prereq)
            }
        }
        stack.pop()
        state.set(code, 'done')
    }

    for (const code of codes) {
        if (!state.get(code)) visit(code)
    }
    return cycles
}

function periodIndex(percurso) {
    const index = new Map()
    for (const period of percurso.periods) {
        for (const code of period.codes) index.set(code, period.number)
    }
    return index
}

/**
 * Valida um JSON de curso (schema v2).
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateCourse(course) {
    const errors = []
    const warnings = []

    if (!course || typeof course !== 'object') {
        return { errors: ['curso vazio ou inválido'], warnings }
    }
    if (course.schemaVersion !== SCHEMA_VERSION) {
        errors.push(`schemaVersion ${course.schemaVersion} diferente de ${SCHEMA_VERSION}`)
    }
    if (!course.id) errors.push('curso sem id')
    if (!course.meta?.name) errors.push('curso sem meta.name')
    if (!course.disciplines || typeof course.disciplines !== 'object') {
        errors.push('curso sem disciplinas')
        return { errors, warnings }
    }
    if (!Array.isArray(course.percursos) || !course.percursos.length) {
        errors.push('curso sem percursos')
        return { errors, warnings }
    }

    // ---- Disciplinas ----
    const disciplineCodes = Object.keys(course.disciplines)
    if (!disciplineCodes.length) errors.push('curso sem disciplinas')

    for (const [code, discipline] of Object.entries(course.disciplines)) {
        if (!CODE_PATTERN.test(code)) errors.push(`código de disciplina inválido: "${code}"`)
        if (!discipline.name || !String(discipline.name).trim()) {
            errors.push(`disciplina ${code} sem nome`)
        }
        if (MOJIBAKE.test(discipline.name ?? '')) {
            errors.push(`disciplina ${code} com texto corrompido (encoding): ${discipline.name}`)
        }
        if (discipline.hours) {
            const { total, theory, practice } = discipline.hours
            for (const [field, value] of Object.entries({ total, theory, practice })) {
                if (value !== null && !isFiniteNumber(value)) {
                    errors.push(`disciplina ${code}: hours.${field} inválido`)
                }
            }
            if (isFiniteNumber(total) && isFiniteNumber(theory) && isFiniteNumber(practice)) {
                if (total !== theory + practice) {
                    warnings.push(
                        `disciplina ${code}: CH total (${total}) != teórica+prática (${
                            theory + practice
                        })`
                    )
                }
            }
        }
        for (const prereq of discipline.prereqs ?? []) {
            if (prereq === code) errors.push(`disciplina ${code} é pré-requisito de si mesma`)
            else if (!course.disciplines[prereq]) {
                errors.push(`disciplina ${code} exige ${prereq}, que não existe no curso`)
            }
        }
    }

    const percursoIds = new Set()
    for (const percurso of course.percursos) {
        if (!percurso.id) {
            errors.push('percurso sem id')
            continue
        }
        if (percursoIds.has(percurso.id)) errors.push(`percurso duplicado: ${percurso.id}`)
        percursoIds.add(percurso.id)

        if (!Array.isArray(percurso.periods) || !percurso.periods.length) {
            errors.push(`percurso ${percurso.id} sem períodos`)
            continue
        }

        const seen = new Set()
        let previous = 0
        for (const period of percurso.periods) {
            if (!Number.isInteger(period.number) || period.number < 1) {
                errors.push(`percurso ${percurso.id}: período inválido ${period.number}`)
            }
            if (period.number <= previous && previous !== 0) {
                warnings.push(`percurso ${percurso.id}: períodos fora de ordem`)
            }
            previous = period.number

            for (const code of period.codes ?? []) {
                if (!course.disciplines[code]) {
                    errors.push(`percurso ${percurso.id}: disciplina ${code} não existe no curso`)
                }
                if (seen.has(code)) {
                    errors.push(`percurso ${percurso.id}: disciplina ${code} repetida em períodos`)
                }
                seen.add(code)
            }
            for (const code of period.optional ?? []) {
                if (!(period.codes ?? []).includes(code)) {
                    errors.push(
                        `percurso ${percurso.id}: optativa ${code} do período ${period.number} não está nas disciplinas`
                    )
                }
            }
        }

        if (!seen.size) errors.push(`percurso ${percurso.id} sem disciplinas`)

        // Períodos devem ser consecutivos (1..N): um período sem obrigatórias
        // (só optativas) continua existindo e não pode desaparecer do grafo.
        const periodNumbers = percurso.periods
            .map((period) => Number(period.number))
            .filter((number) => Number.isInteger(number) && number > 0)
        const lastPeriod = Math.max(...periodNumbers, 0)
        const periodSet = new Set(periodNumbers)
        for (let number = 1; number <= lastPeriod; number += 1) {
            if (!periodSet.has(number)) {
                errors.push(`percurso ${percurso.id}: falta o período ${number}`)
            }
        }

        // Slots de optativa
        const slotIds = new Set()
        for (const slot of percurso.optionalSlots ?? []) {
            if (!slot.id) errors.push(`percurso ${percurso.id}: slot sem id`)
            if (slotIds.has(slot.id))
                errors.push(`percurso ${percurso.id}: slot duplicado ${slot.id}`)
            slotIds.add(slot.id)
            if (!isFiniteNumber(slot.hours) || slot.hours <= 0) {
                errors.push(`percurso ${percurso.id}: slot ${slot.id} com horas inválidas`)
            }
        }

        // Cargas horárias
        const summary = percurso.summary
        if (summary) {
            for (const field of [
                'obligatoryHours',
                'optionalHours',
                'stageHours',
                'complementaryPresetHours',
                'complementaryOpenHours',
                'freeHours',
            ]) {
                if (summary[field] && !isPair(summary[field])) {
                    errors.push(`percurso ${percurso.id}: faixa inválida em ${field}`)
                }
            }
            if (!isFiniteNumber(summary.totalHours) || summary.totalHours <= 0) {
                errors.push(`percurso ${percurso.id}: totalHours inválido`)
            } else {
                const obligatory = summary.obligatoryHours?.min ?? 0
                const total = summary.totalHours
                if (obligatory > total) {
                    errors.push(
                        `percurso ${percurso.id}: obrigatórias (${obligatory}) > total (${total})`
                    )
                }
            }
        }

        // Pré-requisitos: ordem dos períodos e ciclos
        const index = periodIndex(percurso)
        for (const [code, prereqList] of Object.entries(percurso.prereqOverrides ?? {})) {
            if (!course.disciplines[code]) {
                errors.push(`percurso ${percurso.id}: override para disciplina inexistente ${code}`)
            }
            for (const prereq of prereqList) {
                if (!course.disciplines[prereq]) {
                    errors.push(
                        `percurso ${percurso.id}: ${code} exige ${prereq}, que não existe no curso`
                    )
                }
            }
        }

        for (const [code, prereqList] of Object.entries(getEffectivePrereqs(course, percurso))) {
            for (const prereq of prereqList) {
                const prereqPeriod = index.get(prereq)
                const codePeriod = index.get(code)
                if (prereqPeriod === undefined || codePeriod === undefined) continue
                if (prereqPeriod > codePeriod) {
                    errors.push(
                        `percurso ${percurso.id}: ${code} (período ${codePeriod}) exige ${prereq} (período ${prereqPeriod}) — pré-requisito em período posterior`
                    )
                } else if (prereqPeriod === codePeriod) {
                    warnings.push(
                        `percurso ${percurso.id}: ${code} e ${prereq} estão no mesmo período (período ${codePeriod})`
                    )
                }
            }
        }

        const cycles = findCycles(course, percurso)
        if (cycles.length) {
            errors.push(
                `percurso ${percurso.id}: ciclo de pré-requisitos: ${cycles
                    .slice(0, 3)
                    .map((cycle) => cycle.join(' -> '))
                    .join(' | ')}`
            )
        }

        // grafo gerado
        const graph = buildGraph(course, { percursoId: percurso.id })
        if (graph.stats.disciplines !== seen.size) {
            warnings.push(
                `percurso ${percurso.id}: ${seen.size} disciplinas nos períodos, ${graph.stats.disciplines} no grafo`
            )
        }
    }

    return { errors, warnings }
}

/** Pré-requisitos efetivos de cada disciplina no percurso (override quando existir). */
export function getEffectivePrereqs(course, percurso) {
    const result = {}
    for (const period of percurso.periods) {
        for (const code of period.codes) {
            const overrides = percurso.prereqOverrides?.[code]
            result[code] = overrides ?? course.disciplines[code]?.prereqs ?? []
        }
    }
    return result
}

/** Confere se o manifesto do catálogo está coerente com o JSON do curso. */
export function validateCatalogEntry(entry, course) {
    const errors = []
    if (entry.id !== course.id) errors.push(`manifesto: id ${entry.id} != arquivo ${course.id}`)
    if (entry.name !== course.meta?.name) {
        errors.push(`manifesto: nome divergente para ${entry.id}`)
    }
    if (!entry.file) errors.push(`manifesto: ${entry.id} sem arquivo`)
    if (entry.stats) {
        const graph = buildGraph(course, { percursoId: course.percursos[0]?.id })
        const maxSlots = Math.max(
            ...course.percursos.map((percurso) => (percurso.optionalSlots ?? []).length),
            0
        )
        const maxPeriods = Math.max(
            ...course.percursos.map((percurso) => percurso.periods.at(-1)?.number ?? 0),
            0
        )
        if (entry.stats.disciplines !== graph.stats.disciplines) {
            errors.push(
                `manifesto: ${entry.id} stats.disciplines ${entry.stats.disciplines} != ${graph.stats.disciplines}`
            )
        }
        if (entry.stats.edges !== graph.stats.edges) {
            errors.push(
                `manifesto: ${entry.id} stats.edges ${entry.stats.edges} != ${graph.stats.edges}`
            )
        }
        if (entry.stats.optionalSlots !== maxSlots) {
            errors.push(
                `manifesto: ${entry.id} stats.optionalSlots ${entry.stats.optionalSlots} != ${maxSlots}`
            )
        }
        if (entry.stats.periods !== maxPeriods) {
            errors.push(
                `manifesto: ${entry.id} stats.periods ${entry.stats.periods} != ${maxPeriods}`
            )
        }
    }
    return errors
}
