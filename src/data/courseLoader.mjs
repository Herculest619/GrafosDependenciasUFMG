const BASE_URL = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')

/** URL de um arquivo em public/ respeitando o `base` do Vite (GitHub Pages). */
export function dataUrl(path) {
    return `${BASE_URL}/${String(path ?? '').replace(/^\/+/, '')}`
}

async function fetchJson(path) {
    const url = dataUrl(path)
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Falha ao carregar ${url} (HTTP ${response.status})`)
    }
    return response.json()
}

let catalogPromise = null
const coursePromises = new Map()

/** Catálogo de cursos publicados (cacheado). */
export function loadCatalog() {
    if (!catalogPromise) {
        catalogPromise = fetchJson('data/courses.json').catch((error) => {
            catalogPromise = null
            throw error
        })
    }
    return catalogPromise
}

/** JSON completo de um curso (cacheado por arquivo). */
export function loadCourse(file) {
    if (!coursePromises.has(file)) {
        coursePromises.set(
            file,
            fetchJson(file).catch((error) => {
                coursePromises.delete(file)
                throw error
            })
        )
    }
    return coursePromises.get(file)
}

/** Encontra a entrada do catálogo pelo slug da rota. */
export async function findCatalogEntry(slug) {
    const catalog = await loadCatalog()
    return (catalog.courses ?? []).find((course) => course.id === slug) ?? null
}
