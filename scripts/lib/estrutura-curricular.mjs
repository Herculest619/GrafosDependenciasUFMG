/**
 * Parser das "Estruturas Curriculares" antigas do curso de Física (PDFs em
 * data/sources/fisica). Layout diferente dos relatórios do Siga:
 *
 *  - cabeçalho com as versões do curso e os totais de créditos;
 *  - "DISCIPLINAS OBRIGATÓRIAS" em blocos separados por
 *    "N. DE CRÉDITOS DE OBRIGATÓRIAS <créditos> (<horas>)";
 *  - grupos de optativas ("DISCIPLINAS OPTATIVAS DO GRUPO G1/G2/G9");
 *  - totais de optativas/obrigatórias no fim da tabela.
 *
 * As linhas de disciplina têm o formato:
 *      [semestre]  COD123  Nome da disciplina   4 (60 h)   PRE1 / PRE2
 */

const ROW =
    /^\s*(?:(\d{1,2})\s+)?([A-Z]{3}\d{3})\s+(.+?)\s+(\d{1,2})\s*\(\s*(\d{1,3})\s*h\s*\)\s*(.*)$/

const BLOCK_TOTAL =
    /N\.\s*DE\s*CR[EÉ]DITOS\s+DE\s+OBRIGAT[ÓO]RIAS\s+(\d+)\s*(?:\(\s*(\d+)\s*h\s*\))?/i

const TOTAL_OBLIGATORY =
    /N\.\s*TOTAL\s+DE\s+CR[EÉ]DITOS\s+DE\s+OBRIGAT[ÓO]RIAS\s+(\d+)\s*\(\s*(\d+)\s*h\s*\)/i

const TOTAL_OPTIONAL =
    /N\.\s*TOTAL\s+DE\s+(?:CR[EÉ]DITOS|CRED\.)\s+DE\s+OPTATIVAS(?:\s*\/\s*FORMA[ÇC][ÃA]O\s+LIVRE)?\s+(\d+)\s*\(\s*(\d+)\s*h\s*\)/i

const TOTAL_HEADER = /^\s*TOTAL\s+(\d+)\s+cr[ée]ditos\s*\(\s*~?\s*(\d+)\s*h\s*\)/i

const GROUP_HEADER = /^\s*DISCIPLINAS\s+OPTATIVAS\s+DO\s+GRUPO\s+(G\d+)\s*$/i
const ACTIVITIES_HEADER = /^\s*ATIVIDADES\s+ACAD[ÊE]MICAS\s+DO\s+GRUPO\s+(G\d+)\s*$/i
const OPTIONAL_HEADER = /^\s*DISCIPLINAS\s+OBRIGAT[ÓO]RIAS\s*$/i
const VERSION = /^\s*Vers[ãa]o\s+(.+?)\s*$/i

function normalizeLine(line) {
    return line.replace(/\s+$/, '')
}

function parsePrereqs(raw) {
    const codes = String(raw ?? '').match(/\b[A-Z]{3}\d{3}\b/g) ?? []
    return [...new Set(codes)]
}

/**
 * @param {string} text texto extraído do PDF (pdftotext -layout)
 */
export function parseEstruturaCurricular(text) {
    const warnings = []
    const lines = String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(normalizeLine)

    const title = lines.find((line) => /CURSO\s+DE\s+F[ÍI]SICA/i.test(line))?.trim() ?? null
    const kindLine = lines.find((line) => /ESTRUTURA\s+CURRICULAR\s+D[OA]/i.test(line)) ?? ''
    const isLicenciatura = /LICENCIATURA/i.test(kindLine)
    const isNoturno = /noturno/i.test(kindLine)
    const kind = isLicenciatura ? 'licenciatura' : 'bacharelado'

    // Versões (percursos) e total geral aparecem antes das tabelas
    const versions = []
    let headerTotal = null
    let section = 'header'
    for (const line of lines) {
        const versionMatch = line.match(VERSION)
        if (versionMatch && section === 'header') {
            versions.push(versionMatch[1].trim())
            continue
        }
        if (section === 'header' && !headerTotal) {
            const totalMatch = line.match(TOTAL_HEADER)
            if (totalMatch)
                headerTotal = { credits: Number(totalMatch[1]), hours: Number(totalMatch[2]) }
        }
        if (OPTIONAL_HEADER.test(line)) {
            section = 'obligatory'
            continue
        }
        if (GROUP_HEADER.test(line)) {
            section = `group:${line.match(GROUP_HEADER)[1]}`
            continue
        }
        if (ACTIVITIES_HEADER.test(line)) {
            section = 'activities'
        }
    }

    // ------------------- Disciplinas obrigatórias -------------------
    const blocks = []
    let current = { number: 1, rows: [], declared: null }
    let inObligatory = false
    let groupName = null
    const groups = new Map()

    for (const line of lines) {
        if (OPTIONAL_HEADER.test(line)) {
            inObligatory = true
            groupName = null
            continue
        }
        const groupMatch = line.match(GROUP_HEADER)
        if (groupMatch) {
            inObligatory = false
            groupName = groupMatch[1]
            if (!groups.has(groupName)) groups.set(groupName, [])
            continue
        }
        if (ACTIVITIES_HEADER.test(line)) {
            inObligatory = false
            groupName = null
            continue
        }
        if (!inObligatory && !groupName) continue

        const rowMatch = line.match(ROW)
        if (rowMatch) {
            const [, , code, name, credits, hours, prereqRaw] = rowMatch
            const row = {
                code,
                name: name.replace(/\s+/g, ' ').trim(),
                credits: Number(credits),
                hours: Number(hours),
                prereqs: parsePrereqs(prereqRaw),
            }
            if (inObligatory) current.rows.push(row)
            else groups.get(groupName).push(row)
            continue
        }

        if (inObligatory) {
            const blockMatch = line.match(BLOCK_TOTAL)
            if (blockMatch) {
                current.declared = {
                    credits: Number(blockMatch[1]),
                    hours: blockMatch[2] ? Number(blockMatch[2]) : null,
                }
                if (current.rows.length) {
                    const sumCredits = current.rows.reduce((total, row) => total + row.credits, 0)
                    const sumHours = current.rows.reduce((total, row) => total + row.hours, 0)
                    if (current.declared.credits !== sumCredits) {
                        warnings.push(
                            `período ${current.number}: créditos declarados (${current.declared.credits}) != soma (${sumCredits})`
                        )
                    }
                    if (current.declared.hours && current.declared.hours !== sumHours) {
                        warnings.push(
                            `período ${current.number}: horas declaradas (${current.declared.hours}) != soma (${sumHours})`
                        )
                    }
                }
                // mantém também períodos sem disciplinas obrigatórias (ex.: último
                // período da Física 2013, que tem só optativas sugeridas)
                blocks.push(current)
                current = { number: current.number + 1, rows: [], declared: null }
            }
        }
    }

    // ------------------- Totais -------------------
    const totals = {
        obligatoryCredits: null,
        obligatoryHours: null,
        optionalCredits: null,
        optionalHours: null,
    }
    for (const line of lines) {
        const obligatory = line.match(TOTAL_OBLIGATORY)
        if (obligatory) {
            totals.obligatoryCredits = Number(obligatory[1])
            totals.obligatoryHours = Number(obligatory[2])
            continue
        }
        const optional = line.match(TOTAL_OPTIONAL)
        if (optional) {
            totals.optionalCredits = Number(optional[1])
            totals.optionalHours = Number(optional[2])
        }
    }

    const obligatoryCredits = blocks.reduce(
        (total, block) => total + block.rows.reduce((sum, row) => sum + row.credits, 0),
        0
    )
    if (totals.obligatoryCredits !== null && totals.obligatoryCredits !== obligatoryCredits) {
        warnings.push(
            `total de obrigatórias declarado (${totals.obligatoryCredits}) != soma dos blocos (${obligatoryCredits})`
        )
    }

    return {
        layout: 'estrutura-curricular',
        title,
        kind,
        shift: isNoturno ? 'Noturno' : 'Diurno',
        versions,
        headerTotal,
        blocks,
        groups: Object.fromEntries(groups),
        totals,
        warnings,
    }
}

export const __testables = { ROW, parsePrereqs, BLOCK_TOTAL, TOTAL_OPTIONAL }
