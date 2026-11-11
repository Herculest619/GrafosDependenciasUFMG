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
    const groupNames = parsed.groupNames ?? new Map()
    // último período com atividade no relatório: limite para não inventar
    // períodos além dos que o documento evidencia
    const reportLastPeriod = Math.max(
        ...(parsed.periods ?? []).map((period) => Number(period.number) || 0),
        0
    )

    const percursos = [...percursoIds].sort().map((percursoId) => {
        const periodMap = new Map()
        const optionalByPeriod = new Map()
        const prereqOverrides = {}
        const optionalPool = []
        const poolCodes = new Set()

        // Guarda nome/carga horária/grupo de cada optativa: usado pela seleção de
        // disciplina de cada espaço de optativa na interface.
        const addToPool = (activity, entries) => {
            if (poolCodes.has(activity.code)) return
            poolCodes.add(activity.code)
            const group = entries[0]?.group ?? null
            optionalPool.push({
                code: activity.code,
                name: activity.name ?? null,
                hours: activity.hours?.total ?? null,
                credits: activity.credits?.max ?? activity.credits ?? null,
                group,
                groupName: groupNames.get(group) ?? null,
                prereqs: uniqueBy(
                    entries.flatMap((entry) => entry.prereqs ?? []),
                    (code) => code
                ),
            })
        }

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
                    addToPool(activity, entries)
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
            addToPool(activity, entries)
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
        // Garante os períodos previstos na integralização mesmo sem disciplina
        // obrigatória (ex.: último período com só optativas), mas sem passar do
        // último período que o relatório evidencia.
        const standard = Number(summary?.semesters?.standard) || 0
        const existingLast = Math.max(...[...byNumber.keys()], 0)
        const targetLast = Math.max(
            existingLast,
            Math.min(standard || reportLastPeriod, reportLastPeriod || standard)
        )
        for (let number = 1; number <= targetLast; number += 1) {
            if (!byNumber.has(number)) byNumber.set(number, { number, codes: [], optional: [] })
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

/**
 * Converte a saída de `parseEstruturaCurricular` (PDFs antigos de estrutura
 * curricular, com carga horária e pré-requisitos) no JSON v2.
 */
export function buildEstruturaCourse(parsed, options) {
    const warnings = [...(parsed.warnings ?? [])]
    const nameOverrides = options.nameOverrides ?? {}
    const disciplines = {}

    const addDiscipline = (row, scheduled, group) => {
        const existing = disciplines[row.code]
        const hours = { total: row.hours, theory: null, practice: null }
        const name = nameOverrides[row.code] ?? row.name
        if (!existing) {
            disciplines[row.code] = {
                code: row.code,
                name,
                type: null,
                credits: row.credits,
                hours,
                prereqs: [...row.prereqs],
                scheduled,
                group: group ?? null,
            }
            return
        }
        // disciplina que aparece como obrigatória e também no grupo de optativas
        if (scheduled) existing.scheduled = true
        existing.prereqs = uniqueBy([...existing.prereqs, ...row.prereqs], (code) => code)
        if (!existing.hours.total && row.hours) existing.hours = hours
    }

    for (const block of parsed.blocks ?? []) {
        for (const row of block.rows) addDiscipline(row, true, null)
    }

    // Optativas: mesma disciplina não pode aparecer duas vezes na pool nem ser
    // oferecida como optativa se já é obrigatória na matriz (acontece na matriz
    // 2018 da licenciatura noturna: MAT016 e QUI003 repetidos no PDF).
    const poolRows = []
    const poolSeen = new Map()
    for (const [group, rows] of Object.entries(parsed.groups ?? {})) {
        for (const row of rows) {
            if (disciplines[row.code]?.scheduled) {
                warnings.push(
                    `${row.code} aparece como obrigatória e como optativa (${group}); mantida a obrigatória`
                )
                continue
            }
            const previous = poolSeen.get(row.code)
            if (previous) {
                if (previous.row.name !== row.name) {
                    warnings.push(
                        `${row.code} aparece duas vezes nas optativas (${previous.group}/${group}) com nomes diferentes ("${previous.row.name}" e "${row.name}"); mantida a primeira`
                    )
                }
                continue
            }
            poolSeen.set(row.code, { row, group })
            poolRows.push({ row, group })
            addDiscipline(row, false, group)
        }
    }

    // pré-requisitos que caem fora da matriz do curso
    const dropped = []
    for (const discipline of Object.values(disciplines)) {
        const kept = discipline.prereqs.filter(
            (prereq) => prereq !== discipline.code && disciplines[prereq]
        )
        dropped.push(
            ...discipline.prereqs
                .filter((prereq) => prereq === discipline.code || !disciplines[prereq])
                .map((prereq) => `${discipline.code}->${prereq}`)
        )
        discipline.prereqs = kept
    }
    if (dropped.length) {
        warnings.push(
            `${dropped.length} pré-requisito(s) fora da matriz ignorado(s): ${dropped
                .slice(0, 8)
                .join(', ')}`
        )
    }

    const periods = (parsed.blocks ?? []).map((block) => ({
        number: block.number,
        codes: block.rows.map((row) => row.code).sort(),
        optional: [],
    }))

    const optionalHours = parsed.totals?.optionalHours ?? 0
    const slotCount = Math.min(Math.ceil(optionalHours / 60), 24)
    const optionalSlots = Array.from({ length: slotCount }, (_, index) => ({
        id: `OPT-padrao-${String(index + 1).padStart(2, '0')}`,
        label: `Optativa ${index + 1}`,
        hours: 60,
        group: Object.keys(parsed.groups ?? {}).find((group) => group === 'G1') ?? 'Optativas',
    }))

    const optionalPool = poolRows.map(({ row, group }) => ({
        code: row.code,
        group,
        prereqs: row.prereqs,
    }))

    const degree = parsed.kind === 'licenciatura' ? 'Licenciatura' : 'Bacharelado'
    const name = options.name ?? 'Física'
    const id = options.id ?? slugify(`${name} ${degree} ${options.curriculum ?? ''}`)

    const meta = {
        id,
        name,
        variant: options.variant ?? null,
        unit: options.unit ?? 'ICEx — Departamento de Física',
        campus: options.campus ?? 'Pampulha',
        shift: options.shift ?? parsed.shift ?? null,
        degree,
        layout: 'estrutura-curricular',
        curriculum: options.curriculum ?? null,
        source: {
            kind: 'estrutura-curricular-pdf',
            url: options.source?.url ?? null,
            retrievedAt: options.source?.retrievedAt ?? null,
            note: options.source?.note ?? null,
        },
        note:
            options.note ??
            'PDF de estrutura curricular fornecido em data/archives; versões de Formação Complementar Aberta não modeladas.',
    }

    const percurso = {
        id: 'padrao',
        name: parsed.versions?.[0] ?? 'Matriz curricular',
        periods,
        optionalSlots,
        optionalPool,
        prereqOverrides: {},
        summary: {
            obligatoryHours: {
                min: parsed.totals?.obligatoryHours ?? 0,
                max: parsed.totals?.obligatoryHours ?? 0,
            },
            optionalHours: { min: optionalHours, max: optionalHours },
            freeHours: null,
            totalHours: parsed.headerTotal?.hours ?? 0,
        },
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
        optionalSlots: optionalSlots.length,
        totalHours: parsed.headerTotal?.hours ?? null,
    }

    const catalog = {
        ...meta,
        percursos: [{ id: percurso.id, name: percurso.name }],
        stats,
        file: `data/courses/${id}.json`,
    }

    return { course, catalog, warnings }
}

/**
 * Converte a matriz 2019 do Bacharelado em Física (saída de `parseMatriz2019`)
 * e o Anexo A de ementas (saída de `parseEmentas`) no JSON v2.
 *
 * Diferente das estruturas antigas, aqui há três novidades no schema:
 *  - `disciplines[code].ementa` (texto do Anexo A) e `period` sugerido;
 *  - `optionalPool[].ementa` para a escolha de cada espaço de optativa;
 *  - `percurso.optionalCreditsByPeriod` com a sugestão de créditos de
 *    optativa/AAC por período (linhas "OP/AAC" da Tabela 4.1).
 */
export function buildFisica2019Course(matriz, ementas, options = {}) {
    const warnings = [...(matriz?.warnings ?? []), ...(ementas?.warnings ?? [])]
    const ementaByCode =
        ementas?.byCode instanceof Map
            ? ementas.byCode
            : new Map(Object.entries(ementas?.byCode ?? {}))
    const disciplines = {}

    const addDiscipline = (row, { scheduled, group, type, period }) => {
        const ementa = ementaByCode.get(row.code) ?? null
        const credits = Number.isFinite(row.credits)
            ? row.credits
            : Number.isFinite(ementa?.credits)
            ? ementa.credits
            : null
        const hoursTotal = Number.isFinite(ementa?.hours)
            ? ementa.hours
            : Number.isFinite(credits)
            ? credits * 15
            : null
        const name = ementa?.name ?? row.name ?? row.code

        const existing = disciplines[row.code]
        if (existing) {
            if (scheduled) {
                existing.scheduled = true
                existing.type = type ?? existing.type
                existing.period = period ?? existing.period
            }
            if (group) existing.group = group
            if (!existing.ementa && ementa?.ementa) existing.ementa = ementa.ementa
            if (!Number.isFinite(existing.hours.total) && Number.isFinite(hoursTotal)) {
                existing.hours = { total: hoursTotal, theory: null, practice: null }
            }
            existing.prereqs = uniqueBy(
                [...existing.prereqs, ...(row.prereqs ?? [])],
                (code) => code
            )
            return
        }

        disciplines[row.code] = {
            code: row.code,
            name,
            type: type ?? null,
            credits,
            creditsLabel: row.creditsLabel ?? null,
            hours: { total: hoursTotal, theory: null, practice: null },
            prereqs: [...(row.prereqs ?? [])],
            scheduled: Boolean(scheduled),
            group: group ?? null,
            period: period ?? ementa?.period ?? null,
            ementa: ementa?.ementa ?? null,
        }
    }

    // ---- Obrigatórias (Tabela 4.1) ----
    for (const period of matriz?.periods ?? []) {
        for (const row of period.rows ?? []) {
            addDiscipline(row, {
                scheduled: true,
                group: null,
                type: 'OB',
                period: period.number,
            })
        }
    }

    // ---- Optativas (Tabelas 4.2 e 4.3 + FIS638/G8) ----
    const poolGroups = {}
    for (const [group, rows] of Object.entries(matriz?.groups ?? {})) {
        poolGroups[group] = [...(rows ?? [])]
    }

    // Optativas que constam do Anexo A como OP1/OP9 do bacharelado mas não
    // aparecem nas tabelas 4.2/4.3 (ex.: DIT121) entram na pool do grupo
    // correspondente, para não perder disciplina optativa documentada.
    const poolCodes = new Set(
        Object.values(poolGroups).flatMap((rows) => rows.map((row) => row.code))
    )
    for (const entry of ementas?.entries ?? [...ementaByCode.values()]) {
        if (!['OP1', 'OP9'].includes(entry.bacNature)) continue
        if (poolCodes.has(entry.code) || disciplines[entry.code]) continue
        const group = entry.bacNature === 'OP1' ? 'G1' : 'G9'
        poolGroups[group] = poolGroups[group] ?? []
        poolGroups[group].push({
            code: entry.code,
            name: entry.name,
            credits: entry.credits,
            creditsLabel: null,
            prereqs: entry.prereqs ?? [],
            prereqRaw: entry.prereqText ?? '',
            group,
            extra: true,
        })
        poolCodes.add(entry.code)
    }

    for (const [group, rows] of Object.entries(poolGroups)) {
        for (const row of rows ?? []) {
            const ementa = ementaByCode.get(row.code) ?? null
            const prereqs = ementa?.prereqs?.length ? ementa.prereqs : row.prereqs ?? []
            addDiscipline(
                { ...row, prereqs },
                {
                    scheduled: false,
                    group,
                    type: 'OP',
                    period: ementa?.period ?? null,
                }
            )
        }
    }

    // Pré-requisitos que não fazem parte da matriz do bacharelado (código de
    // outro curso, optativa de percurso não modelado etc.) são descartados.
    const dropped = []
    for (const discipline of Object.values(disciplines)) {
        const kept = []
        for (const prereq of discipline.prereqs) {
            if (prereq === discipline.code || !disciplines[prereq]) {
                dropped.push(`${discipline.code}->${prereq}`)
            } else {
                kept.push(prereq)
            }
        }
        discipline.prereqs = [...new Set(kept)]
    }
    if (dropped.length) {
        warnings.push(
            `${dropped.length} pré-requisito(s) fora da matriz ignorado(s): ${dropped
                .slice(0, 8)
                .join(', ')}`
        )
    }

    // ---- Períodos do percurso padrão ----
    const periods = (matriz?.periods ?? []).map((period) => ({
        number: period.number,
        codes: (period.rows ?? []).map((row) => row.code).sort(),
        optional: [],
    }))

    const optionalHours = matriz?.totals?.optionalHours ?? 0
    const obligatoryHours = matriz?.totals?.obligatoryHours ?? 0
    const freeHours = matriz?.totals?.freeHours ?? null
    const totalHours = matriz?.totals?.totalHours ?? 0
    const slotCount = Math.min(Math.ceil(optionalHours / 60), 24)
    const percursoId = options.percursoId ?? '01-01'

    const optionalSlots = Array.from({ length: slotCount }, (_, index) => ({
        id: `OPT-${percursoId}-${String(index + 1).padStart(2, '0')}`,
        label: `Optativa ${index + 1}`,
        hours: 60,
        group: 'Optativas',
    }))

    const optionalCreditsByPeriod = {}
    for (const period of matriz?.periods ?? []) {
        if (period.optionalCredits > 0) {
            optionalCreditsByPeriod[period.number] = period.optionalCredits
        }
    }

    const optionalPool = Object.entries(poolGroups)
        .flatMap(([group, rows]) =>
            (rows ?? []).map((row) => {
                const discipline = disciplines[row.code]
                return {
                    code: row.code,
                    name: discipline?.name ?? row.name,
                    hours: discipline?.hours?.total ?? null,
                    credits: discipline?.credits ?? row.credits ?? null,
                    creditsLabel: discipline?.creditsLabel ?? row.creditsLabel ?? null,
                    group,
                    groupName: matriz?.groupNames?.[group] ?? group,
                    prereqs: [...(discipline?.prereqs ?? [])],
                    period: discipline?.period ?? null,
                    ementa: discipline?.ementa ?? null,
                    ...(row.extra ? { extra: true } : {}),
                }
            })
        )
        .sort(
            (left, right) =>
                String(left.group).localeCompare(String(right.group)) ||
                left.code.localeCompare(right.code)
        )

    const summary = {
        obligatoryHours: { min: obligatoryHours, max: obligatoryHours },
        optionalHours: { min: optionalHours, max: optionalHours },
        stageHours: null,
        complementaryPresetHours: null,
        complementaryOpenHours: null,
        freeHours: Number.isFinite(freeHours) ? { min: freeHours, max: freeHours } : null,
        totalHours,
    }

    const percurso = {
        id: percursoId,
        name: options.percursoName ?? 'Bacharelado — formação padrão (01-01)',
        periods,
        optionalSlots,
        optionalPool,
        prereqOverrides: {},
        summary,
        optionalCreditsByPeriod,
    }

    const name = options.name ?? 'Física'
    const id = options.id ?? 'fisica-bacharelado'
    const meta = {
        id,
        name,
        variant: options.variant ?? 'Bacharelado',
        unit: options.unit ?? 'ICEx — Departamento de Física',
        campus: options.campus ?? 'Pampulha',
        shift: options.shift ?? 'Diurno',
        degree: options.degree ?? 'Bacharelado',
        layout: 'matriz-2019',
        curriculum: options.curriculum ?? 'Matriz 2019',
        source: {
            kind: options.source?.kind ?? 'estrutura-curricular-pdf',
            url: options.source?.url ?? null,
            retrievedAt: options.source?.retrievedAt ?? null,
            note: options.source?.note ?? null,
        },
        ementas: {
            url: options.ementasSource?.url ?? null,
            retrievedAt: options.ementasSource?.retrievedAt ?? null,
            note: options.ementasSource?.note ?? null,
        },
        note:
            options.note ??
            'Matriz 2019 (PPC): 8 períodos, 31 obrigatórias e 11 espaços de optativa (660 h). Os percursos 01-02 a 01-05, as AAC (G3) e as disciplinas obrigatórias de percurso não são modelados porque o PDF fornecido não as lista; as optativas de pós-graduação do G8 aparecem como FIS638.',
    }

    const course = {
        schemaVersion: SCHEMA_VERSION,
        id,
        meta,
        generatedAt: new Date().toISOString(),
        disciplines,
        percursos: [percurso],
    }

    const graph = buildGraph(course, { percursoId })
    const stats = {
        disciplines: graph.stats.disciplines,
        edges: graph.stats.edges,
        periods: periods.at(-1)?.number ?? 0,
        optionalSlots: optionalSlots.length,
        totalHours: totalHours || null,
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
