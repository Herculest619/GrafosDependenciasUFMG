export function slugify(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
}

export function formatHours(hours) {
    if (!Number.isFinite(hours)) return '—'
    if (hours >= 1000) {
        const value = (hours / 1000).toFixed(hours % 1000 === 0 ? 0 : 1).replace('.', ',')
        return `${value} mil h`
    }
    return `${hours} h`
}

export function percent(part, total) {
    if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((part / total) * 100)))
}

/** Normaliza texto para busca: sem acentos, minúsculo e sem espaços nas pontas. */
export function normalizeText(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

/**
 * Verifica se um texto contém todos os termos da busca, ignorando acentos e
 * caixa. "quimica geral" encontra "Química Geral B"; "geral quimica" também.
 */
export function matchesSearch(haystack, query) {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean)
    if (!terms.length) return true
    const text = normalizeText(haystack)
    return terms.every((term) => text.includes(term))
}

/** Filtra cursos do catálogo por nome, unidade, grau ou turno. */
export function filterCourses(courses, query) {
    const term = normalizeText(query)
    if (!term) return [...(courses ?? [])]
    const terms = term.split(/\s+/).filter(Boolean)

    return (courses ?? []).filter((course) => {
        const haystack = normalizeText(
            [
                course.name,
                course.variant,
                course.unit,
                course.degree,
                course.shift,
                course.campus,
                course.curriculum,
            ]
                .filter(Boolean)
                .join(' ')
        )
        return terms.every((part) => haystack.includes(part))
    })
}

/** Agrupa cursos por unidade mantendo a ordem alfabética. */
export function groupByUnit(courses) {
    const groups = new Map()
    for (const course of courses ?? []) {
        const unit = course.unit || 'Outras unidades'
        if (!groups.has(unit)) groups.set(unit, [])
        groups.get(unit).push(course)
    }
    return [...groups.entries()]
        .map(([unit, items]) => ({
            unit,
            items: [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        }))
        .sort((a, b) => a.unit.localeCompare(b.unit, 'pt-BR'))
}
