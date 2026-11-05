import { SCHEMA_VERSION, buildGraph, disciplineHours } from '../../src/core/graph.mjs'
import { slugify } from '../../src/core/format.mjs'

const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'a', 'o'])

/** "CIÊNCIA DA COMPUTAÇÃO" -> "Ciência da Computação" */
export function titleCasePt(text) {
    return String(text ?? '')
        .toLocaleLowerCase('pt-BR')
        .split(/\s+/)
        .filter(Boolean)
        .map((word, index) => {
            if (index > 0 && CONNECTORS.has(word)) return word
            return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
        })
        .join(' ')
}

function uniqueBy(items, keyFn) {
    const seen = new Set()
    const result = []
    for (const item of items) {
        const key = keyFn(item)
        if (seen.has(key)) continue
        seen.add(key)
        result.push(item)
    }
    return result
}

function prereqKey(list) {
    return [...new Set(list)].sort().join(',')
}

function countOptionalSlots(summary) {
    const minutes = summary?.optionalHours?.min
    if (!Number.isFinite(minutes) || minutes <= 0) return []
    const hoursPerSlot = 60
    const count = Math.min(Math.ceil(minutes / hoursPerSlot), 24)
    return Array.from({ length: count }, (_, index) => index + 1)
}

/**
 * Converte a saída de `parseSigaReport` no JSON v2 consumido pelo app.
 *
 * @param {object} parsed resultado de parseSigaReport
 * @param {object} options metadados manuais do curso
 * @returns {{course: object, catalog: object, warnings: string[]}}
 */
export function buildSigaCourse(parsed, options) {
    const warnings = [...(parsed.warnings ?? [])]
    const header = parsed.header ?? {}

    const allActivities = [
        ...(parsed.periods ?? []).flatMap((period) => period.activities ?? []),
        ...(parsed.unscheduled ?? []),
        ...(parsed.stage ?? []),
    ]

    // ---- Disciplinas (união de todos os percursos) ----
    const disciplines = {}
    for (const activity of allActivities) {
        if (!activity?.code) continue
        const existing = disciplines[activity.code]
        const hours = activity.hours ?? { total: null, theory: null, practice: null }
        const credits = activity.credits?.max ?? activity.credits?.min ?? null
        const prereqUnion = uniqueBy(
            (activity.entries ?? []).flatMap((entry) => entry.prereqs ?? []),
            (code) => code
        )

        if (!existing) {
            disciplines[activity.code] = {
                code: activity.code,
                name: activity.name,
                type: activity.type,
                credits,
                hours,
                prereqs: prereqUnion,
                scheduled: activity.scheduled !== false && !activity.stage,
            }
            continue
        }

        if (activity.name && activity.name.length > (existing.name?.length ?? 0)) {
            existing.name = activity.name
        }
        if (Number.isFinite(hours.total) && hours.total > 0) {
            existing.hours = hours
            existing.credits = credits ?? existing.credits
        }
        existing.prereqs = uniqueBy([...existing.prereqs, ...prereqUnion], (code) => code)
    }

    // Pré-requisitos que não pertencem à matriz do curso (código antigo, optativa
    // de outro curso etc.) são descartados — senão o grafo apontaria para o vazio.
    const droppedPrereqs = new Set()
    for (const discipline of Object.values(disciplines)) {
        const kept = []
        for (const prereq of discipline.prereqs) {
            if (disciplines[prereq]) kept.push(prereq)
            else droppedPrereqs.add(`${discipline.code}->${prereq}`)
        }
        discipline.prereqs = kept
    }
    if (droppedPrereqs.size) {
        warnings.push(
            `${droppedPrereqs.size} pré-requisito(s) fora da matriz ignorado(s): ${[
                ...droppedPrereqs,
            ]
                .slice(0, 10)
                .join(', ')}`
        )
    }

    // ---- Percursos ----
    const percursoIds = new Set((header.percursos ?? []).map((percurso) => percurso.id))
    for (const activity of allActivities) {
        for (const entry of activity.entries ?? []) {
            if (entry.percursoId) percursoIds.add(entry.percursoId)
        }
    }
    if (!percursoIds.size) {
        warnings.push('nenhum percurso identificado no relatório')
        percursoIds.add('padrao')
    }

    const percursoNames = new Map(
        (header.percursos ?? []).map((percurso) => [percurso.id, percurso.name])
    )
    const summaries = new Map((parsed.integralizacao ?? []).map((row) => [row.percursoId, row]))
    const optativaGroupName =
        [...(parsed.groupNames ?? new Map()).values()].find((name) => /optativa/i.test(name)) ??
        'Optativas'

    const percursos = [...percursoIds].sort().map((percursoId) => {
        const periodMap = new Map()
        const optionalByPeriod = new Map()
        const prereqOverrides = {}
        const optionalPool = []

        for (const period of parsed.periods ?? []) {
            for (const activity of period.activities ?? []) {
                const entries = (activity.entries ?? []).filter(
                    (entry) => entry.percursoId === percursoId
                )
                if (!entries.length) continue

                if (!periodMap.has(activity.code)) {
                    periodMap.set(activity.code, Number(period.number))
                }
                const optional = entries.some((entry) => entry.naturePercurso === 'OP')
                if (optional) {
                    if (!optionalByPeriod.has(Number(period.number))) {
                        optionalByPeriod.set(Number(period.number), [])
                    }
                    optionalByPeriod.get(Number(period.number)).push(activity.code)
                }

                const entryPrereqs = uniqueBy(
                    entries.flatMap((entry) => entry.prereqs ?? []),
                    (code) => code
                ).filter((code) => disciplines[code])
                const discipline = disciplines[activity.code]
                if (discipline && prereqKey(entryPrereqs) !== prereqKey(discipline.prereqs)) {
                    prereqOverrides[activity.code] = entryPrereqs
                }
            }
        }

        for (const activity of parsed.unscheduled ?? []) {
            const entries = (activity.entries ?? []).filter(
                (entry) => entry.percursoId === percursoId
            )
            if (!entries.length) continue
            optionalPool.push({
                code: activity.code,
                group: entries[0].group ?? null,
                prereqs: uniqueBy(
                    entries.flatMap((entry) => entry.prereqs ?? []),
                    (code) => code
                ),
            })
        }

        const summary = summaries.get(percursoId) ?? regrasGeraisSummary(parsed.regrasGerais)
        const slotNumbers = countOptionalSlots(summary)
        if (!slotNumbers.length) {
            warnings.push(
                `percurso ${percursoId}: sem carga horária de optativas no relatório — nenhum slot de optativa será exibido`
            )
        }

        const byNumber = new Map()
        for (const [code, number] of periodMap) {
            if (!byNumber.has(number)) byNumber.set(number, { number, codes: [], optional: [] })
            byNumber.get(number).codes.push(code)
        }
        for (const period of byNumber.values()) {
            period.codes.sort()
            period.optional = [...new Set(optionalByPeriod.get(period.number) ?? [])].sort()
        }

        return {
            id: percursoId,
            name: percursoNames.get(percursoId) ?? percursoId,
            periods: [...byNumber.values()].sort((a, b) => a.number - b.number),
            optionalSlots: slotNumbers.map((index) => ({
                id: `OPT-${percursoId}-${String(index).padStart(2, '0')}`,
                label: `Optativa ${index}`,
                hours: 60,
                group: optativaGroupName,
            })),
            optionalPool,
            prereqOverrides,
            summary,
        }
    })

    const name = titleCasePt(options.name ?? header.courseName ?? 'Curso sem nome')
    const degree = options.degree ?? guessDegree(percursos, header)
    const shift = options.shift ?? (header.shift ? titleCasePt(header.shift) : null)
    const id = options.id ?? slugify(`${name} ${degree ?? ''}`)

    const meta = {
        id,
        name,
        variant: options.variant ?? null,
        unit: options.unit ?? null,
        campus: options.campus ?? null,
        shift,
        degree,
        layout: parsed.layout ?? 'versao',
        curriculum: [header.courseCode, header.curriculumVersionId].filter(Boolean).join(' · '),
        source: {
            kind: options.source?.kind ?? 'siga-versao-curricular',
            url: options.source?.url ?? null,
            retrievedAt: options.source?.retrievedAt ?? null,
            note: options.source?.note ?? null,
        },
        note: options.note ?? null,
    }

    const course = {
        schemaVersion: SCHEMA_VERSION,
        id,
        meta,
        generatedAt: new Date().toISOString(),
        disciplines,
        percursos,
    }

    const defaultPercurso = course.percursos[0]?.id
    const graph = buildGraph(course, { percursoId: defaultPercurso })
    const totalHours = course.percursos.reduce((total, percurso) => {
        const hours = percurso.summary?.totalHours
        return Number.isFinite(hours) ? Math.max(total, hours) : total
    }, 0)

    const stats = {
        // números do percurso padrão (primeiro) — é o que a página abre por padrão
        disciplines: graph.stats.disciplines,
        edges: graph.stats.edges,
        periods: Math.max(
            ...course.percursos.map((percurso) => percurso.periods.at(-1)?.number ?? 0),
            0
        ),
        optionalSlots: Math.max(
            ...course.percursos.map((percurso) => percurso.optionalSlots.length),
            0
        ),
        totalHours: totalHours || null,
    }

    const catalog = {
        ...meta,
        percursos: course.percursos.map((percurso) => ({ id: percurso.id, name: percurso.name })),
        stats,
        file: `data/courses/${id}.json`,
    }

    if (!Object.keys(disciplines).length) warnings.push('nenhuma disciplina encontrada')
    return { course, catalog, warnings }
}

/** Fallback de resumo quando o relatório não traz o "Quadro de integralização". */
function regrasGeraisSummary(regrasGerais) {
    if (!regrasGerais) return null
    return {
        semesters: regrasGerais.semesters,
        enrollmentHours: regrasGerais.enrollmentHours,
        obligatoryHours: null,
        optionalHours: null,
        stageHours: null,
        complementaryPresetHours: null,
        complementaryOpenHours: null,
        freeHours: null,
        totalHours: regrasGerais.totalHours,
    }
}

function guessDegree(percursos, header) {
    const text = [
        ...(percursos ?? []).map((percurso) => percurso.name),
        header?.identificador ?? '',
        header?.headerText ?? '',
    ]
        .join(' ')
        .toLocaleUpperCase('pt-BR')

    if (/BACHARELADO|\bBACH\./.test(text)) return 'Bacharelado'
    if (/LICENCIATURA|\bLIC\./.test(text)) return 'Licenciatura'
    return null
}

/**
 * Converte o JSON legado (schema v1: {nodes:[{level,id,label,title}], edges:[{from,to}]})
 * no schema v2. Usado nos cursos de Física importados do projeto original.
 */
export function convertLegacyCourse(raw, options) {
    const warnings = []
    const seen = new Set()
    const disciplines = {}
    const periodCodes = new Map()

    for (const node of raw.nodes ?? []) {
        if (!node?.id || seen.has(node.id)) continue
        seen.add(node.id)

        const title = String(node.title ?? '')
        const name = title.startsWith(`${node.id} - `) ? title.slice(node.id.length + 3) : title
        const level = Number(node.level)

        disciplines[node.id] = {
            code: node.id,
            name: name || node.id,
            type: null,
            credits: null,
            hours: { total: null, theory: null, practice: null },
            prereqs: [],
            scheduled: true,
        }

        if (Number.isFinite(level)) {
            const number = Math.max(1, level)
            if (!periodCodes.has(number)) periodCodes.set(number, [])
            periodCodes.get(number).push(node.id)
        } else {
            warnings.push(`disciplina ${node.id} sem período`)
        }
    }

    for (const edge of raw.edges ?? []) {
        if (!disciplines[edge.to] || !disciplines[edge.from]) {
            warnings.push(`aresta ignorada: ${edge.from} -> ${edge.to}`)
            continue
        }
        disciplines[edge.to].prereqs.push(edge.from)
    }

    for (const discipline of Object.values(disciplines)) {
        discipline.prereqs = [...new Set(discipline.prereqs)]
    }

    const name = options.name
    const id = options.id ?? slugify(`${name} ${options.degree ?? ''}`)

    const periods = [...periodCodes.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([number, codes]) => ({ number, codes: [...new Set(codes)].sort(), optional: [] }))

    const percurso = {
        id: 'padrao',
        name: options.percursoName ?? 'Matriz curricular (fonte legada)',
        periods,
        optionalSlots: [],
        optionalPool: [],
        prereqOverrides: {},
        summary: null,
    }

    const meta = {
        id,
        name,
        variant: options.variant ?? null,
        unit: options.unit ?? null,
        campus: options.campus ?? null,
        shift: options.shift ?? null,
        degree: options.degree ?? null,
        curriculum: options.curriculum ?? null,
        source: {
            kind: 'legacy-json',
            url: null,
            retrievedAt: null,
            note:
                options.sourceNote ??
                'Convertido do JSON do projeto original (importado de PDF do Siga em 2025); carga horária e optativas não estão disponíveis nesta fonte.',
        },
        note: options.note ?? null,
    }

    const course = {
        schemaVersion: SCHEMA_VERSION,
        id,
        meta,
        generatedAt: new Date().toISOString(),
        disciplines,
        percursos: [percurso],
    }

    const graph = buildGraph(course, { percursoId: percurso.id })
    const stats = {
        disciplines: graph.stats.disciplines,
        edges: graph.stats.edges,
        periods: periods.at(-1)?.number ?? 0,
        optionalSlots: 0,
        totalHours: null,
    }

    const catalog = {
        ...meta,
        percursos: [{ id: percurso.id, name: percurso.name }],
        stats,
        file: `data/courses/${id}.json`,
    }

    return { course, catalog, warnings }
}

export const __testables = { countOptionalSlots, prereqKey, uniqueBy, disciplineHours }
