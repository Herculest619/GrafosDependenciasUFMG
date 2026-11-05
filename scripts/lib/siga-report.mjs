/**
 * Parser dos relatórios do SigaUFMG:
 *  - "Relatório de versão curricular"  (agrupado por período, com uma linha por percurso);
 *  - "Relatório de percurso curricular" (um percurso por documento, colunas fixas).
 *
 * Entrada: texto extraído do PDF preservando as quebras de linha (pdftotext -layout
 * ou equivalente). Saída: estrutura intermediária consumida por scripts/lib/course-json.mjs.
 */

const ACTIVITY_START = /^([A-Z0-9]{2,4})\s+-\s+([A-Z]{3}\d{3})\s+-\s+(.+)$/
const PERIODO_MARKER = /^(\d{1,2})\s*º\s*PER[ÍI]ODO$/

const IGNORABLE_LINES = [
    /^UNIVERSIDADE FEDERAL/i,
    /^Configura[çc][ãa]o Curricular/i,
    /^RELAT[ÓO]RIO DE (VERS[ÃA]O|PERCURSO) CURRICULAR/i,
    /^Pr[óo]-reitoria de Gradua[çc][ãa]o/i,
    /^\d{2}\/\d{2}\/\d{4}\s+[\d.:]+\s*P[áa]gina\s+\d+/i,
    /^P[áa]gina\s+\d+\s+de\s+\d+/i,
    /^P[áa]gina\s+\d+\s+de\s+\d+\s*\d{2}\/\d{2}\/\d{4}/i,
    /^\d{2}\/\d{2}\/\d{4}\s+[\d.:]+$/,
    /^Cr[ée]ditos\s+Carga Hor[áa]ria/i,
    /^Atividade Acad[êe]mica$/i,
    /^Atividades\s+Adicionais$/i,
    /^Atividades acad[êe]micas (obrigat[óo]rias|optativas) no percurso/i,
    /^Atividades acad[êe]micas e carga hor[áa]ria adicional por per[íi]odo/i,
    /^Atividades de est[áa]gio curricular obrigat[óo]rio/i,
    /^Atividades optativas no percurso$/i,
    /^M[íi]n\.\s*M[áa]x\.\s*Total/i,
    /^Total\s+Te[óo]rica\s+Pr[áa]tica/i,
    /^Te[óo]rica\s+Pr[áa]tica\s+Total$/i,
    /^Conte[úu]do$/i,
    /^vari[áa]vel$/i,
    /^Grupo Natureza$/i,
    /^do grupo Atividades Adicionais$/i,
    /^Carga Hor[áa]ria Grupo\(s\)/i,
    /^Pr[é]-requisitosAtividade Acad[êe]mica Cr[ée]ditos$/i,
    /^Percurso\s+(Sugest[ãa]o|Grupo|Natureza)/i,
    /^Carga Hor[áa]ria$/i,
    /^Semestres$/i,
    /^Grupo de Atividades:/i,
    /^M[íi]nimo\s+(Padr[ãa]o|M[áa]x)/i,
    /^Total\s*\(Carga hor[áa]ria/i,
    /^integraliza[çc][ãa]o\)$/i,
    /^Grupo$/i,
    /^Identificador Nome$/i,
    /^Nome: -N[ãa]o Possui$/i,
]

const TERMINATOR_LINES = [
    /^Carga hor[áa]ria adicional do per[íi]odo/i,
    /^Percurso\s+Grupo de atividades/i,
    /^Quadro de integraliza/i,
    /^Propriedades do grupo/i,
    /^Grupos de atividades/i,
    /^Tipos de atividades/i,
    /^Regras curriculares/i,
    /^Regras gerais:/i,
]

function isIgnorable(line) {
    return IGNORABLE_LINES.some((regex) => regex.test(line))
}

function isTerminator(line) {
    return TERMINATOR_LINES.some((regex) => regex.test(line))
}

function normalizeLine(line) {
    return line.replace(/\s+/g, ' ').trim()
}

/**
 * O extrator cola títulos de seção e rodapés em linhas de tabela, por exemplo:
 *   "Página 1 de 902/01/2025 11.17.361º PERÍODO"
 *   "Pró-reitoria de GraduaçãoATIVIDADES ACADÊMICAS..."
 * Esta função recoloca as quebras de linha nos marcadores conhecidos.
 */
export function normalizeReportText(text) {
    let result = String(text ?? '').replace(/\r\n?/g, '\n')

    // Rodapé colado no marcador de período: "... 11.17.361º PERÍODO"
    result = result.replace(/(\d{2}\.\d{2}\.\d{2})(?=\d{1,2}\s*º\s*PER[ÍI]ODO)/g, '$1\n')

    const markers = [
        /(?<![\d\n])(?=\d{1,2}\s*º\s*PER[ÍI]ODO)/g,
        /(?<!\n)(?=ATIVIDADES [A-ZÁÉÍÓÚÇ]+)/g,
        /(?<!\n)(?=RELAT[ÓO]RIO DE (?:VERS[ÃA]O|PERCURSO) CURRICULAR)/g,
        /(?<!\n)(?=Pr[óo]-reitoria de Gradua)/g,
        /(?<!\n)(?=P[áa]gina\s+\d+\s+de\s+\d+)/g,
        /(?<!\n)(?=Atividades acad[êe]micas (?:obrigat[óo]rias|optativas) no percurso)/g,
        /(?<!\n)(?=Atividades de est[áa]gio curricular obrigat[óo]rio)/g,
        /(?<!\n)(?=Quadro de integraliza)/g,
        /(?<!\n)(?=Propriedades do grupo)/g,
        /(?<!\n)(?=Grupos de atividades)/g,
        /(?<!\n)(?=Tipos de atividades)/g,
        /(?<!\n)(?=Regras curriculares)/g,
        /(?<!\n)(?=Regras gerais:)/g,
    ]
    for (const marker of markers) result = result.replace(marker, '\n')
    return result
}

export function detectLayout(text) {
    const sample = String(text ?? '').slice(0, 4000)
    if (/RELAT[ÓO]RIO DE PERCURSO CURRICULAR/i.test(sample)) return 'percurso'
    if (/RELAT[ÓO]RIO DE VERS[ÃA]O CURRICULAR/i.test(sample)) return 'versao'
    if (
        /VigenteIdentificador:|Atividades acad[êe]micas obrigat[óo]rias no percurso/i.test(sample)
    ) {
        return 'percurso'
    }
    return 'versao'
}

// Identificador de percurso: "01-01" (numérico) ou "R-01" (alguns cursos, ex. Museologia)
const PERCURSO_ID_SOURCE = '(?:\\d{2}-\\d{2}|[A-Z]{1,2}-\\d{2})'

function splitSegments(rest) {
    const marker = '\u0001'
    const withMarkers = String(rest).replace(
        new RegExp(`(^|\\s)(${PERCURSO_ID_SOURCE})(?=\\s)`, 'g'),
        `$1${marker}$2`
    )
    return withMarkers
        .split(marker)
        .map((segment) => segment.trim())
        .filter(Boolean)
}

export function parsePrereqs(raw) {
    if (!raw) return []
    // Os códigos vêm separados por vírgula, mas a coluna "adicionais" pode estar
    // colada ("DCC203 -") ou a lista pode ter sido quebrada em duas linhas.
    const codes = String(raw).match(/\b[A-Z]{3}\d{3}\b/g) ?? []
    return [...new Set(codes)]
}

function toNumber(token) {
    return token === '-' ? null : Number(token)
}

/** Interpreta um segmento de percurso (layout "versão curricular"). */
export function parsePercursoSegment(segment) {
    const match = segment.match(new RegExp(`^(${PERCURSO_ID_SOURCE})\\s+(.*)$`))
    if (!match) return null
    const percursoId = match[1]
    let rest = match[2].trim()

    let suggestion = null
    if (rest.startsWith('-')) {
        rest = rest.replace(/^-\s*/, '')
        suggestion = '-'
    }

    const tokens = rest.split(/\s+/)

    // Colunas fixas: [grupo] [natureza no grupo] [natureza no percurso] pré-requisitos.
    // O "grupo" pode ser um número ("4"), um identificador completo
    // ("13002-D-20141-1") ou "-".
    const isNature = (token) => /^(OB|OP)$/i.test(token)
    let group = null
    if (tokens.length && !isNature(tokens[0])) {
        const token = tokens.shift()
        group = token === '-' ? null : token
    }
    let natureGroup = null
    let naturePercurso = null
    if (tokens.length && (isNature(tokens[0]) || tokens[0] === '-')) {
        const token = tokens.shift()
        natureGroup = token === '-' ? null : token.toUpperCase()
    }
    if (tokens.length && (isNature(tokens[0]) || tokens[0] === '-')) {
        const token = tokens.shift()
        naturePercurso = token === '-' ? null : token.toUpperCase()
    }

    return {
        percursoId,
        suggestion,
        group,
        natureGroup,
        naturePercurso,
        prereqs: parsePrereqs(tokens.join(' ')),
    }
}

/** Layout "versão curricular": TIPO - CÓD - NOME cMin cMax CHTotal CHTeo CHPra + segmentos por percurso. */
function parseActivityVersaoPeriod(line, context, warnings) {
    const lineMatch = line.match(ACTIVITY_START)
    if (!lineMatch) return null
    const [, type, code, rest] = lineMatch

    const parsed = rest.match(/^(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/)
    if (!parsed) {
        warnings.push(`atividade sem carga horária reconhecível: ${code}`)
        return null
    }

    const numbers = parsed.slice(2, 7).map(Number)
    const entries = splitSegments(parsed[7]).map(parsePercursoSegment).filter(Boolean)

    if (!entries.length) warnings.push(`atividade sem percurso: ${code}`)

    return {
        type,
        code,
        name: parsed[1].trim(),
        credits: { min: numbers[0], max: numbers[1] },
        hours: { total: numbers[2], theory: numbers[3], practice: numbers[4] },
        entries,
        scheduled: true,
        stage: false,
    }
}

/** Layout "versão curricular" / "sem período sugerido": 5 campos numéricos no período, 3 no bloco de optativas. */
function parseActivityVersaoUnscheduled(line, context, warnings) {
    const lineMatch = line.match(ACTIVITY_START)
    if (!lineMatch) return null
    const [, type, code, rest] = lineMatch

    const parsed = rest.match(/^(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/)
    if (!parsed) {
        warnings.push(`atividade sem carga horária reconhecível: ${code}`)
        return null
    }

    const numbers = parsed.slice(2, 5).map(Number)
    const entries = splitSegments(parsed[5]).map(parsePercursoSegment).filter(Boolean)

    return {
        type,
        code,
        name: parsed[1].trim(),
        credits: null,
        hours: { total: numbers[0], theory: numbers[1], practice: numbers[2] },
        entries,
        scheduled: false,
        stage: false,
    }
}

/**
 * Layout "percurso curricular": TIPO - CÓD - NOME créditos CHTeo CHPra CHTotal
 * conteúdoVariável grupo natureza pré-requisitos(atividades e adicionais).
 */
function parseActivityPercurso(line, context, warnings) {
    const lineMatch = line.match(ACTIVITY_START)
    if (!lineMatch) return null
    const [, type, code, rest] = lineMatch

    const parsed = rest.match(
        /^(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([NS])\s+(\d+|-)\s+(OB|OP)\s*(.*)$/
    )
    if (!parsed) {
        warnings.push(`atividade sem carga horária reconhecível: ${code}`)
        return null
    }

    const [, name, credits, theory, practice, total, , group, nature, tail] = parsed

    return {
        type,
        code,
        name: name.trim(),
        credits: { min: Number(credits), max: Number(credits) },
        hours: { total: Number(total), theory: Number(theory), practice: Number(practice) },
        entries: [
            {
                percursoId: context.percursoId,
                suggestion: context.scheduled ? '-' : null,
                group: group === '-' ? null : group,
                natureGroup: nature,
                naturePercurso: context.scheduled ? nature : 'OP',
                prereqs: parsePrereqs(tail),
            },
        ],
        scheduled: context.scheduled,
        stage: false,
    }
}

/**
 * Coleta registros de um bloco, juntando linhas quebradas e descartando
 * cabeçalhos/rodapés. Deduplica códigos repetidos (artefato de quebra de página).
 */
function collectActivities(lines, parseRecord, context, warnings) {
    const activities = []
    const seen = new Set()
    let buffer = []
    let suppressed = false

    const flush = () => {
        if (!buffer.length) return
        const activity = parseRecord(buffer.join(' '), context, warnings)
        buffer = []
        if (!activity) return
        if (seen.has(activity.code)) {
            // artefato de quebra de página: o mesmo bloco aparece antes e depois do rodapé
            return
        }
        seen.add(activity.code)
        activities.push(activity)
    }

    for (const rawLine of lines) {
        const line = normalizeLine(rawLine)
        if (!line) continue

        if (ACTIVITY_START.test(line)) {
            flush()
            suppressed = false
            buffer.push(line)
            continue
        }
        if (suppressed) continue

        if (isTerminator(line)) {
            flush()
            suppressed = true
            continue
        }
        if (isIgnorable(line)) continue

        if (buffer.length) buffer.push(line)
    }
    flush()
    return activities
}

function parseHeader(headerLines, layout) {
    const header = headerLines.join('\n')
    const flat = headerLines.map(normalizeLine).join(' | ')

    let courseCode = null
    let courseName = null
    let curriculumVersionId = null

    if (layout === 'percurso') {
        for (const line of headerLines.map(normalizeLine)) {
            const versionMatch = line.match(
                /Vers[ãa]o curricular\s*:?\s*(.+?)\s+([A-Z]-\d{4,6}(?:\/\d+)?)\s*$/
            )
            if (!versionMatch) continue
            courseName = versionMatch[1].replace(/\s+/g, ' ').trim()
            curriculumVersionId = versionMatch[2]
            break
        }
        const codeMatch = header.match(/\b(\d{5})(?:PD|PV|PI)\d{3}\b/)
        courseCode = codeMatch ? codeMatch[1] : null
    } else {
        const versionMatch = header.match(
            /Vers[ãa]o curricular\s*:?\s*(\d+)\s*-\s*([^\n|]+?)\s*(?:Curso:|$)/
        )
        courseCode = versionMatch ? versionMatch[1] : null
        courseName = versionMatch ? versionMatch[2].replace(/\s+/g, ' ').trim() : null
        const versionIdMatch = header.match(/\b([A-Z]-?\d{4,6}(?:[-/]\d+)?)\b/)
        curriculumVersionId = versionIdMatch ? versionIdMatch[1] : null
    }

    if (!courseName) {
        // Alguns relatórios de versão vêm com "Curso: <código> - <nome>" antes da
        // coluna "Versão curricular" (e não depois, como no formato original).
        const courseMatch = header.match(/Curso:\s*(\d{4,6})\s*-\s*([^\n|]+)/m)
        if (courseMatch) {
            courseCode = courseCode ?? courseMatch[1]
            courseName = courseMatch[2]
                .replace(/\s*Vers[ãa]o curricular.*$/i, '')
                .replace(/\s+/g, ' ')
                .trim()
        }
    }
    if (!curriculumVersionId) {
        const versionIdMatch = header.match(/Vers[ãa]o curricular:?\s*([A-Z]-?\d{4,6}(?:[-/]\d+)?)/)
        if (versionIdMatch) curriculumVersionId = versionIdMatch[1]
    }

    const identifierMatch = header.match(
        /(\d{5}[A-Z]{2,3}\d{3})\/(Presencial|A dist[âa]ncia)\/([A-ZÇÃÁÉÍÓÚ]+)/
    )
    const shiftRaw = identifierMatch ? identifierMatch[3] : null

    const percursos = []
    if (layout === 'percurso') {
        const idMatch = header.match(new RegExp(`Identificador:\\s*(${PERCURSO_ID_SOURCE})`))
        const nameMatch = header.match(/Nome:\s*([^\n]+)/)
        if (idMatch) {
            percursos.push({
                id: idMatch[1],
                name: nameMatch ? nameMatch[1].replace(/\s+/g, ' ').trim() : idMatch[1],
            })
        }
    } else {
        for (const line of headerLines.map(normalizeLine)) {
            const match = line.match(new RegExp(`^(${PERCURSO_ID_SOURCE})\\s+-{0,4}(.+)$`))
            if (!match) continue
            const name = match[2].replace(/^\s*-+\s*/, '').trim()
            if (!name || /^\(M\)$/.test(name)) continue
            if (!percursos.some((percurso) => percurso.id === match[1])) {
                percursos.push({ id: match[1], name })
            }
        }
    }

    return {
        courseCode,
        courseName,
        curriculumVersionId,
        shift: shiftRaw,
        modality: identifierMatch ? identifierMatch[2] : null,
        identificador: identifierMatch ? identifierMatch[0] : null,
        percursos,
        headerText: flat,
    }
}

function parseIntegralizacao(lines, header) {
    const rows = []

    const numbered = /^((?:\d+\s+|-\s+){17}(?:\d+|-))$/
    const withPercurso = new RegExp(`^(${PERCURSO_ID_SOURCE})\\s+((?:[\\d-]+\\s+){17}[\\d-]+)$`)

    for (const rawLine of lines) {
        const line = normalizeLine(rawLine)

        const prefixed = line.match(withPercurso)
        if (prefixed) {
            const numbers = prefixed[2].split(/\s+/).map(toNumber)
            rows.push({ percursoId: prefixed[1], numbers })
            continue
        }

        const plain = line.match(numbered)
        if (plain) {
            const tokens = plain[1].split(/\s+/)
            if (tokens.length === 18) {
                rows.push({ percursoId: null, numbers: tokens.map(toNumber) })
            }
        }
    }

    // Layout "percurso curricular": o percurso é o do cabeçalho (ou os percursos na ordem)
    const percursoIds = (header.percursos ?? []).map((percurso) => percurso.id)
    return rows.map((row, index) => {
        const numbers = row.numbers
        const percursoId = row.percursoId ?? percursoIds[index] ?? percursoIds[0] ?? 'padrao'
        return {
            percursoId,
            semesters: { min: numbers[0], standard: numbers[1], max: numbers[2] },
            enrollmentHours: { min: numbers[3], max: numbers[4] },
            obligatoryHours: { min: numbers[5], max: numbers[6] },
            optionalHours: { min: numbers[7], max: numbers[8] },
            stageHours: { min: numbers[9], max: numbers[10] },
            complementaryPresetHours: { min: numbers[11], max: numbers[12] },
            complementaryOpenHours: { min: numbers[13], max: numbers[14] },
            freeHours: { min: numbers[15], max: numbers[16] },
            totalHours: numbers[17],
        }
    })
}

function parseRegrasGerais(lines) {
    // Ex.: "9 8 15 210 - 1 - - 3000" (padrão, mínimo, máximo, CH mín., CH máx., ..., total)
    for (const rawLine of lines) {
        const line = normalizeLine(rawLine)
        const match = line.match(/^((?:[\d-]+\s+){8}[\d-]+)$/)
        if (!match) continue
        const tokens = match[1].split(/\s+/)
        if (tokens.length !== 9) continue
        return {
            semesters: {
                standard: toNumber(tokens[0]),
                min: toNumber(tokens[1]),
                max: toNumber(tokens[2]),
            },
            enrollmentHours: { min: toNumber(tokens[3]), max: toNumber(tokens[4]) },
            totalHours: toNumber(tokens[8]),
        }
    }
    return null
}

function parseGroupNames(lines, layout) {
    const names = new Map()

    const versaoAdditionalHours = new RegExp(
        `^(${PERCURSO_ID_SOURCE})\\s+(\\S+)-(\\d{1,2})\\s+-\\s+(.+)$`
    )
    const versaoProperties = new RegExp(
        `^(\\d{1,2})\\s+([A-Za-zÀ-Úà-ú][A-Za-zÀ-Úà-ú .]+?)\\s+${PERCURSO_ID_SOURCE}\\s+(?:OB|OP)\\b`
    )
    const percursoProperties = /^(.+?)(\d{1,2})\s+(?:OB|OP)\s+(?:OB|OP)\s+(?:Sim|N[ãa]o)?\s*/

    for (const rawLine of lines) {
        const line = normalizeLine(rawLine)

        const additional = line.match(versaoAdditionalHours)
        if (additional) {
            names.set(additional[3], additional[4].trim())
            continue
        }

        if (layout === 'versao') {
            const properties = line.match(versaoProperties)
            if (properties) names.set(properties[1], properties[2].trim())
            continue
        }

        const percursoPropertiesMatch = line.match(percursoProperties)
        if (percursoPropertiesMatch && /(?:OB|OP)\s+(?:OB|OP)/.test(line)) {
            const name = percursoPropertiesMatch[1].trim()
            const id = percursoPropertiesMatch[2]
            if (name && !/^\d+$/.test(name)) names.set(id, name)
        }
    }
    return names
}

function splitSections(lines) {
    const sections = {
        header: [],
        periods: [],
        stage: [],
        optativas: [],
        unscheduled: [],
        integralizacao: [],
        groups: [],
    }

    let state = 'header'
    let currentPeriod = null

    for (const line of lines) {
        const normalized = normalizeLine(line)
        const periodMatch = normalized.match(PERIODO_MARKER)

        if (periodMatch) {
            state = 'period'
            currentPeriod = { number: Number(periodMatch[1]), lines: [] }
            sections.periods.push(currentPeriod)
            continue
        }
        if (/^Atividades de est[áa]gio curricular obrigat[óo]rio/i.test(normalized)) {
            state = 'stage'
            currentPeriod = null
            continue
        }
        if (
            /^Atividades acad[êe]micas optativas no percurso/i.test(normalized) ||
            /^Atividades optativas no percurso$/i.test(normalized)
        ) {
            state = 'optativas'
            currentPeriod = null
            continue
        }
        if (/^ATIVIDADES SEM PER[ÍI]ODO/i.test(normalized)) {
            state = 'unscheduled'
            currentPeriod = null
            continue
        }
        if (/^Quadro de integraliza/i.test(normalized)) {
            state = 'integralizacao'
            currentPeriod = null
            continue
        }
        if (
            /^(Propriedades do grupo|Grupos de atividades|Tipos de atividades|Regras curriculares)/i.test(
                normalized
            )
        ) {
            state = 'groups'
            currentPeriod = null
            continue
        }
        if (/^Regras gerais:/i.test(normalized)) {
            state = 'rules'
            currentPeriod = null
            continue
        }

        if (state === 'period') currentPeriod.lines.push(line)
        else if (state === 'unscheduled') sections.unscheduled.push(line)
        else if (state === 'optativas') sections.optativas.push(line)
        else if (state === 'stage') sections.stage.push(line)
        else if (state === 'integralizacao') sections.integralizacao.push(line)
        else if (state === 'groups') sections.groups.push(line)
        else if (state === 'rules') sections.header.push(line)
        else sections.header.push(line)
    }

    return sections
}

/**
 * Parseia o relatório do Siga.
 * @param {string} text conteúdo textual do PDF
 */
export function parseSigaReport(text) {
    const warnings = []
    const normalized = normalizeReportText(text)
    const layout = detectLayout(normalized)
    const lines = normalized.split('\n')
    const sections = splitSections(lines)
    const header = parseHeader(sections.header, layout)

    if (!header.percursos.length) {
        warnings.push('nenhum percurso identificado no cabeçalho')
        header.percursos.push({ id: 'padrao', name: 'Percurso padrão' })
    }

    const percursoId = header.percursos[0].id
    const percursoContext = { percursoId, scheduled: true }
    const poolContext = { percursoId, scheduled: false }

    const periods = sections.periods.map((period) => ({
        number: period.number,
        activities:
            layout === 'versao'
                ? collectActivities(
                      period.lines,
                      parseActivityVersaoPeriod,
                      percursoContext,
                      warnings
                  )
                : collectActivities(period.lines, parseActivityPercurso, percursoContext, warnings),
    }))

    const unscheduled =
        layout === 'versao'
            ? collectActivities(
                  sections.unscheduled,
                  parseActivityVersaoUnscheduled,
                  poolContext,
                  warnings
              )
            : collectActivities(sections.optativas, parseActivityPercurso, poolContext, warnings)

    const stageLines = layout === 'versao' ? [] : sections.stage
    const stage =
        layout === 'versao'
            ? collectActivities(
                  sections.stage,
                  parseActivityVersaoUnscheduled,
                  poolContext,
                  warnings
              )
            : collectActivities(stageLines, parseActivityPercurso, poolContext, warnings)

    for (const activity of stage) activity.stage = true

    const integralizacao = parseIntegralizacao(sections.integralizacao, header)
    const groupNames = parseGroupNames([...sections.groups, ...sections.integralizacao], layout)
    const regrasGerais = parseRegrasGerais(sections.header)

    return {
        layout,
        header,
        periods,
        unscheduled,
        stage,
        integralizacao,
        regrasGerais,
        groupNames,
        warnings,
    }
}

export const __testables = {
    collectActivities,
    parseActivityVersaoPeriod,
    parseActivityVersaoUnscheduled,
    parseActivityPercurso,
    parsePercursoSegment,
    parseHeader,
    parseIntegralizacao,
    parseGroupNames,
    splitSections,
    normalizeReportText,
    detectLayout,
}
