export const SCHEMA_VERSION = 2

export const DEFAULT_SLOT_HOURS = 60

/** Horas totais de uma disciplina, com fallback para créditos (1 crédito ≈ 15 h). */
export function disciplineHours(discipline) {
    const total = discipline?.hours?.total
    if (Number.isFinite(total) && total > 0) return total

    const credits = discipline?.credits
    if (Number.isFinite(credits) && credits > 0) return credits * 15

    return DEFAULT_SLOT_HOURS
}

/** Devolve o percurso pedido ou o primeiro disponível. */
export function getPercurso(course, percursoId) {
    const percursos = course?.percursos ?? []
    if (!percursos.length) return null
    return percursos.find((percurso) => percurso.id === percursoId) ?? percursos[0]
}

/** Códigos de disciplina que aparecem em algum período do percurso. */
export function percursoCodes(percurso) {
    const codes = new Set()
    for (const period of percurso?.periods ?? []) {
        for (const code of period.codes ?? []) codes.add(code)
    }
    return codes
}

function sortPeriods(periods) {
    return [...(periods ?? [])].sort((a, b) => Number(a.number) - Number(b.number))
}

function truncate(text, maxLength) {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function slotLabel(index) {
    return `Optativa ${index}`
}

function slotId(percursoId, index) {
    return `OPT:${percursoId}:${String(index).padStart(2, '0')}`
}

function findByCode(course, code) {
    return course?.disciplines?.[code] ?? null
}

function isTaken(taken, code) {
    return Boolean(taken?.has?.(code))
}

/**
 * Distribui os espaços de optativa entre as colunas dos períodos, para que
 * apareçam abaixo das disciplinas dos semestres mais vazios (em vez de uma
 * coluna extra no fim do grafo). A cada slot escolhe o período com menos
 * disciplinas; no empate, prefere o período mais avançado.
 *
 * @param {Array<{number: number, codes?: string[]}>} periods
 * @param {Array<object>} slots
 */
function distributeSlots(periods, slots) {
    if (!slots.length || !periods.length) return slots

    const counts = periods.map((period) => (period.codes ?? []).length)

    for (const slot of slots) {
        let target = 0
        for (let index = 1; index < periods.length; index += 1) {
            const current = counts[index]
            const best = counts[target]
            const isLater = Number(periods[index].number) > Number(periods[target].number)
            if (current < best || (current === best && isLater)) target = index
        }
        counts[target] += 1
        slot.level = Number(periods[target].number)
    }

    return slots
}

/**
 * Monta o grafo do percurso (nós + arestas + colunas).
 *
 * @param {object} course JSON do curso (schema v2)
 * @param {{percursoId?: string, includeOptionalSlots?: boolean}} options
 */
export function buildGraph(course, options = {}) {
    const percurso = getPercurso(course, options.percursoId)
    const includeOptionalSlots = options.includeOptionalSlots !== false
    if (!percurso) {
        return { percursoId: null, nodes: [], edges: [], periods: [], stats: emptyStats() }
    }

    const periods = sortPeriods(percurso.periods)
    const nodes = []
    const seen = new Set()

    for (const period of periods) {
        for (const code of period.codes ?? []) {
            if (seen.has(code)) continue
            const discipline = findByCode(course, code)
            if (!discipline) continue
            seen.add(code)
            nodes.push({
                id: code,
                code,
                kind: 'discipline',
                level: Number(period.number),
                label: truncate(discipline.name, 30),
                name: discipline.name,
                title: `${code} — ${discipline.name} (${disciplineHours(discipline)} h)`,
                hours: disciplineHours(discipline),
                optional: (period.optional ?? []).includes(code),
            })
        }
    }

    const edges = []
    for (const node of nodes) {
        const discipline = findByCode(course, node.id)
        const prereqs = percurso.prereqOverrides?.[node.id] ?? discipline?.prereqs ?? []
        for (const prereq of prereqs) {
            if (!seen.has(prereq)) continue
            edges.push({ from: prereq, to: node.id })
        }
    }

    let slots = []
    if (includeOptionalSlots) {
        slots = distributeSlots(
            periods,
            (percurso.optionalSlots ?? []).map((slot, index) => ({
                id: slot.id ?? slotId(percurso.id, index + 1),
                kind: 'slot',
                label: slot.label ?? slotLabel(index + 1),
                name: slot.label ?? slotLabel(index + 1),
                title: `Optativa ${index + 1} — escolha uma disciplina (${
                    slot.hours ?? DEFAULT_SLOT_HOURS
                } h)`,
                hours: slot.hours ?? DEFAULT_SLOT_HOURS,
                optional: true,
                group: slot.group ?? null,
            }))
        )
    }
    nodes.push(...slots)

    return {
        percursoId: percurso.id,
        percursoName: percurso.name ?? percurso.id,
        nodes,
        edges,
        periods: periods.map((period) => Number(period.number)),
        stats: {
            disciplines: nodes.filter((node) => node.kind === 'discipline').length,
            optionalSlots: slots.length,
            edges: edges.length,
        },
    }
}

function emptyStats() {
    return { disciplines: 0, optionalSlots: 0, edges: 0 }
}

/** Mapa código → "taken" | "available" | "blocked" (nós optativos são sempre "available" até serem marcados). */
export function computeAvailability(graph, taken) {
    const status = new Map()
    const prereqsByNode = new Map()
    for (const edge of graph.edges) {
        if (!prereqsByNode.has(edge.to)) prereqsByNode.set(edge.to, [])
        prereqsByNode.get(edge.to).push(edge.from)
    }

    for (const node of graph.nodes) {
        if (isTaken(taken, node.id)) {
            status.set(node.id, 'taken')
            continue
        }
        const prereqs = prereqsByNode.get(node.id) ?? []
        const met = prereqs.every((code) => isTaken(taken, code))
        status.set(node.id, met ? 'available' : 'blocked')
    }

    return status
}

/** Pré-requisitos que faltam para cada nó. */
export function missingPrereqs(graph, taken) {
    const missing = new Map()
    for (const edge of graph.edges) {
        if (isTaken(taken, edge.from)) continue
        if (isTaken(taken, edge.to)) continue
        if (!missing.has(edge.to)) missing.set(edge.to, [])
        missing.get(edge.to).push(edge.from)
    }
    return missing
}

/** Carga horária e contagem de disciplinas, separando obrigatórias e slots de optativa. */
export function summarizeProgress(graph, taken) {
    const status = computeAvailability(graph, taken)
    const obligatory = graph.nodes.filter((node) => node.kind === 'discipline' && !node.optional)
    const optionalDisciplines = graph.nodes.filter(
        (node) => node.kind === 'discipline' && node.optional
    )
    const slots = graph.nodes.filter((node) => node.kind === 'slot')

    const sumHours = (nodes) => nodes.reduce((total, node) => total + (node.hours ?? 0), 0)
    const takenNodes = (nodes) => nodes.filter((node) => status.get(node.id) === 'taken')

    const obligatoryTaken = takenNodes(obligatory)
    const optionalTaken = takenNodes([...optionalDisciplines, ...slots])
    const availableNow = graph.nodes.filter(
        (node) => node.kind === 'discipline' && status.get(node.id) === 'available'
    )

    return {
        obligatory: {
            total: obligatory.length,
            taken: obligatoryTaken.length,
            hoursTotal: sumHours(obligatory),
            hoursTaken: sumHours(obligatoryTaken),
            hoursRemaining: sumHours(obligatory) - sumHours(obligatoryTaken),
        },
        optional: {
            total: optionalDisciplines.length + slots.length,
            taken: optionalTaken.length,
            hoursTaken: sumHours(optionalTaken),
        },
        availableNow: availableNow.length,
        status,
    }
}

/** Próximo período sugerido: menor período com obrigatória ainda não cursada e liberada. */
export function suggestNextPeriod(graph, taken) {
    const status = computeAvailability(graph, taken)
    const candidates = graph.nodes
        .filter((node) => node.kind === 'discipline' && !node.optional)
        .filter((node) => status.get(node.id) === 'available')
        .map((node) => node.level)
        .filter((level) => Number.isFinite(level))
    if (!candidates.length) return null
    return Math.min(...candidates)
}

/** Busca por código/nome dentro de um curso (usada no localizador de disciplina). */
export function searchDisciplines(graph, query, limit = 8) {
    const term = String(query ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    if (!term) return []

    const normalized = (text) =>
        String(text ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()

    return graph.nodes
        .filter((node) => node.kind === 'discipline')
        .filter(
            (node) => normalized(node.code).includes(term) || normalized(node.name).includes(term)
        )
        .slice(0, limit)
}
