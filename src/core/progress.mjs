export const STORAGE_PREFIX = 'grafos-ufmg:v3:'

export function progressKey(courseId) {
    return `${STORAGE_PREFIX}${courseId}`
}

export function emptyProgress() {
    return { taken: [], choices: {}, updatedAt: null }
}

function normalizeChoices(choices) {
    const result = {}
    for (const [slotId, code] of Object.entries(choices ?? {})) {
        if (typeof slotId !== 'string' || !slotId) continue
        if (typeof code !== 'string' || !code) continue
        result[slotId] = code
    }
    return result
}

/** Converte o estado em memória (Set + escolhas) para algo serializável. */
export function serializeProgress(taken, choices = {}) {
    const codes = taken instanceof Set ? [...taken] : [...(taken ?? [])]
    return {
        taken: [...new Set(codes)].sort(),
        choices: normalizeChoices(choices),
        updatedAt: new Date().toISOString(),
    }
}

/** Lê um JSON salvo e valida o formato; devolve null se inválido. */
export function parseProgress(raw) {
    if (!raw) return null
    try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (!data || !Array.isArray(data.taken)) return null
        const taken = data.taken.filter((code) => typeof code === 'string' && code.length > 0)
        if (taken.length !== data.taken.length) return null
        return {
            taken: [...new Set(taken)],
            choices: normalizeChoices(data.choices),
            updatedAt: data.updatedAt ?? null,
        }
    } catch {
        return null
    }
}

export function loadProgress(storage, courseId) {
    if (!storage) return null
    try {
        return parseProgress(storage.getItem(progressKey(courseId)))
    } catch {
        return null
    }
}

export function saveProgress(storage, courseId, taken, choices = {}) {
    if (!storage) return false
    try {
        storage.setItem(progressKey(courseId), JSON.stringify(serializeProgress(taken, choices)))
        return true
    } catch {
        return false
    }
}

export function clearProgress(storage, courseId) {
    if (!storage) return false
    try {
        storage.removeItem(progressKey(courseId))
        return true
    } catch {
        return false
    }
}

export function browserStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage
    } catch {
        return null
    }
}
