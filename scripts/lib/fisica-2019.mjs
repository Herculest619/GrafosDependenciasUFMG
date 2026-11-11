/**
 * Parser das fontes do Bacharelado em Física — matriz 2019 (PPC).
 *
 * Dois documentos, extraídos com `pdftotext -layout`:
 *
 *  1. `fisica-bacharelado-2019.txt` — tabelas 3.1–3.5 (resumo da formação padrão
 *     e dos percursos 01-02..01-05) e 4.1–4.3 (disciplinas obrigatórias do
 *     Grupo 1 por período, optativas de Física do Grupo 5 e optativas gerais do
 *     Grupo 7).
 *  2. `ementas-fisica-2019.txt` — Anexo A: uma entrada por disciplina com a
 *     ementa, os créditos, a carga horária, a natureza (OB/OP) e os
 *     pré-requisitos/co-requisitos.
 *
 * O layout é bem diferente dos relatórios do Siga: as tabelas vêm em colunas
 * separadas por blocos de espaços (o `-layout` do pdftotext preserva isso), o
 * rótulo do período fica no meio do bloco (`1o`, `2o`, ...) e algumas células
 * quebram em duas linhas. Por isso o parser trabalha com tokens separados por
 * dois ou mais espaços e com heurísticas de continuação documentadas abaixo.
 */

const CODE = /^[A-Z]{3}\d{3}$/
const CODE_SOURCE = /\b[A-Z]{3}\d{3}\b/g

const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'a', 'o'])

/** Uniformiza quebras de linha/form feed e remove espaços no fim das linhas. */
function normalizeLines(text) {
    return String(text ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/\f/g, '\n')
        .split('\n')
        .map((line) => line.replace(/\s+$/, ''))
}

function collapse(text) {
    return String(text ?? '')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Códigos de disciplina citados num trecho ("nenhum", "---" e "-/-/-/-/" → []). */
export function parseCodes(raw) {
    const codes = String(raw ?? '').match(CODE_SOURCE) ?? []
    return [...new Set(codes)]
}

function isSectionHeader(line) {
    const text = line.trim()
    if (!text || text.length > 90) return false
    if (CODE.test(text.split(/\s+/)[0] ?? '')) return false
    const letters = text.match(/[A-Za-zÀ-ÿ]/g) ?? []
    if (letters.length < 3) return false
    const upper = letters.filter((letter) => letter === letter.toLocaleUpperCase('pt-BR')).length
    return upper / letters.length >= 0.8
}

function uppercaseRatio(text) {
    const letters = String(text).match(/[A-Za-zÀ-ÿ]/g) ?? []
    if (!letters.length) return 1
    const upper = letters.filter((letter) => letter === letter.toLocaleUpperCase('pt-BR')).length
    return upper / letters.length
}

/**
 * Nome vindo das ementas pode estar em caixa alta ("ESTATÍSTICA E
 * PROBABILIDADE"). Nesse caso converte preservando algarismos romanos.
 */
export function normalizeName(raw) {
    const name = collapse(raw).replace(/^[-–]\s*/, '')
    if (!name) return name
    if (/[a-zà-ú]/.test(name)) return name

    const words = name.toLocaleLowerCase('pt-BR').split(/\s+/)
    return words
        .map((word, index) => {
            if (/^(i{1,3}|iv|v|vi{1,3}|ix|x)$/.test(word)) return word.toLocaleUpperCase('pt-BR')
            if (index > 0 && CONNECTORS.has(word)) return word
            return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
        })
        .join(' ')
}

/** "Tópicos de Astrofísica A, B, C" + 3 códigos → um nome por código. */
export function expandNames(name, count) {
    if (count <= 1) return [name]

    const parts = String(name).split(/\s*,\s*/)
    if (parts.length === count) {
        const suffix = parts[0].match(/\s([A-Z])$/)
        const base = suffix ? parts[0].slice(0, -2) : parts[0]
        return parts.map((part, index) => (index === 0 ? parts[0] : `${base} ${part.trim()}`))
    }

    const range = String(name).match(/^(.*\S)\s+([A-Z])\s*-\s*([A-Z])$/)
    if (range) {
        const start = range[2].charCodeAt(0)
        return Array.from(
            { length: count },
            (_, index) => `${range[1]} ${String.fromCharCode(start + index)}`
        )
    }

    return Array.from({ length: count }, () => String(name))
}

/** "FIS634,639,640" → ["FIS634", "FIS639", "FIS640"]. */
function expandCodeList(raw) {
    const tokens = String(raw ?? '')
        .split(/\s*,\s*/)
        .filter(Boolean)
    if (!tokens.length) return []
    const first = tokens[0]
    const prefix = first.slice(0, 3)
    return tokens.map((token, index) => {
        if (index === 0) return first
        if (/^\d{3}$/.test(token)) return `${prefix}${token}`
        return token
    })
}

/**
 * Tabela 4.1 — disciplinas obrigatórias do Grupo 1.
 *
 * O rótulo do período aparece no meio do bloco (centralizado verticalmente na
 * célula), então cada período é delimitado por linha em branco e o número sai
 * do token `1o`..`8o` do próprio bloco. Se uma quebra de página partir um
 * período, o bloco sem rótulo é anexado ao anterior.
 */
function parseObligatoryTable(lines, warnings) {
    const rawBlocks = []
    let buffer = []
    const flush = () => {
        if (buffer.some((line) => line.trim())) rawBlocks.push(buffer)
        buffer = []
    }
    for (const line of lines) {
        if (!line.trim()) flush()
        else buffer.push(line)
    }
    flush()

    const blocks = []
    for (const block of rawBlocks) {
        const hasMarker = block.some((line) => /(?:^|\s)[1-8]o(?=\s|$)/.test(line))
        if (!hasMarker && blocks.length) blocks[blocks.length - 1].push(...block)
        else blocks.push(block)
    }

    const periods = []
    let nextNumber = 1

    for (const block of blocks) {
        let number = null
        let optionalCredits = null
        let declaredCredits = null
        const rows = []

        for (const rawLine of block) {
            let line = rawLine.trim()
            if (!line) continue

            const marker = line.match(/(?:^|\s)([1-8])o(?=\s|$)/)
            if (marker) {
                number = Number(marker[1])
                line = line.replace(/(?:^|\s)[1-8]o(?=\s|$)/, ' ').trim()
                if (!line) continue
            }

            if (/^OP\s*\/\s*AAC/i.test(line)) {
                const numbers = line.match(/\d+/g) ?? []
                optionalCredits = numbers.length ? Number(numbers[0]) : null
                if (numbers.length > 1) declaredCredits = Number(numbers[numbers.length - 1])
                continue
            }

            const tokens = line.split(/\s{2,}/)
            const codeIndex = tokens.findIndex((token) => CODE.test(token))
            if (codeIndex === -1) continue

            const code = tokens[codeIndex]
            const creditIndex = tokens.findIndex(
                (token, index) => index > codeIndex && /^\d{1,2}$/.test(token)
            )
            if (creditIndex === -1) continue

            const name = collapse(tokens.slice(codeIndex + 1, creditIndex).join(' '))
            const credits = Number(tokens[creditIndex])
            const rest = tokens.slice(creditIndex + 1)

            let declared = null
            if (rest.length >= 2 && /^\d{1,3}$/.test(rest[rest.length - 1])) {
                declared = Number(rest.pop())
            }
            const prereqRaw = rest.join(' ')
            rows.push({ code, name, credits, prereqs: parseCodes(prereqRaw), prereqRaw })
            if (declared !== null) declaredCredits = declared
        }

        if (!rows.length && optionalCredits === null) continue
        number = number ?? nextNumber
        nextNumber = number + 1

        if (declaredCredits !== null) {
            const sum = rows.reduce((total, row) => total + row.credits, 0) + (optionalCredits ?? 0)
            if (sum !== declaredCredits) {
                warnings.push(
                    `período ${number}: créditos declarados (${declaredCredits}) != soma (${sum})`
                )
            }
        }

        periods.push({ number, rows, optionalCredits: optionalCredits ?? 0, declaredCredits })
    }

    return periods
}

/**
 * Tabela 4.2/4.3 — optativas (Grupo 5/G1 e Grupo 7/G9).
 *
 * As células de pré-requisito às vezes quebram em duas linhas e o nome de uma
 * disciplina pode ficar na linha anterior (ICB001) ou a lista de códigos pode
 * vir como intervalo (ICE061-063). Os pré-requisitos oficiais de cada optativa
 * são os do Anexo A (ementas); aqui a tabela serve para a lista de códigos,
 * nomes e créditos.
 */
function parsePoolTable(lines, group, groupName, warnings) {
    const rows = []
    const seen = new Set()
    const skip = new Set()

    // Intervalos de código quebrados em duas linhas: ICE061- / ... / 063.
    const joined = lines.join('\n')
    const rangeRe = /([A-Z]{3})(\d{3})-\s*\n\s*([^\n]+?)\n\s*(\d{3})\b/g
    let rangeMatch
    while ((rangeMatch = rangeRe.exec(joined))) {
        const [, prefix, startRaw, detail, endRaw] = rangeMatch
        const start = Number(startRaw)
        const end = Number(endRaw)
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
        skip.add(prefix + startRaw)
        skip.add(prefix + endRaw)

        const tokens = detail
            .split(/\s{2,}/)
            .map((token) => token.trim())
            .filter(Boolean)
        const nameCell = tokens[0] ?? collapse(detail)
        const creditToken = tokens.find((token) => /^\d{1,2}(?:\s*-\s*\d{1,2})?$/.test(token))
        const creditsLabel = creditToken ? creditToken.replace(/\s*-\s*/, '–') : null
        const credits = creditsLabel
            ? Number(creditsLabel.split('–')[0])
            : creditToken
            ? Number(creditToken)
            : null

        const names = expandNames(nameCell, end - start + 1)
        for (let offset = 0; offset <= end - start; offset += 1) {
            const code = `${prefix}${String(start + offset).padStart(3, '0')}`
            if (rows.some((row) => row.code === code)) continue
            rows.push({
                code,
                name: normalizeName(names[offset] ?? nameCell),
                credits,
                creditsLabel,
                prereqs: [],
                prereqRaw: 'Depende da oferta',
                group,
                groupName,
            })
        }
    }

    let lastName = null
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index].trim()
        if (!line) continue

        const match = line.match(/^(?:\d{1,2}\s+)?([A-Z]{3}\d{3}(?:\s*,\s*\d{3})*)\s+(.+)$/)
        if (!match) {
            // Nome quebrado na linha anterior (ex.: ICB001)
            if (!/\d/.test(line) && !/[();]/.test(line)) lastName = line
            continue
        }

        const codeGroup = match[1]
        if (skip.has(codeGroup.split(',')[0].trim())) continue

        const tokens = match[2].split(/\s{2,}/)
        let creditIndex = tokens.findIndex((token) => /^\d{1,2}(?:\s*-\s*\d{1,2})?$/.test(token))
        let name = tokens[0] ?? ''
        if (creditIndex === 0) {
            // código sozinho na linha: o nome está na linha anterior/na próxima
            name = lastName ?? ''
            const next = (lines[index + 1] ?? '').trim()
            if (next && !CODE.test(next.split(/\s+/)[0] ?? '') && /^[A-Za-zÀ-ÿ]/.test(next)) {
                name = collapse(`${name} ${next}`)
                index += 1
            }
            creditIndex = 0
        } else if (creditIndex > 0) {
            name = collapse(tokens.slice(0, creditIndex).join(' '))
            lastName = name
        } else {
            continue
        }

        const creditToken = tokens[creditIndex]
        const creditsLabel = creditToken.includes('-') ? creditToken.replace(/\s*-\s*/, '–') : null
        const credits = creditsLabel ? Number(creditsLabel.split('–')[0]) : Number(creditToken)
        const rest = tokens.slice(creditIndex + 1).filter((token) => !/^[A-Z]$/.test(token))
        const prereqRaw = rest.join(' ')

        const codes = expandCodeList(codeGroup)
        const names = expandNames(name, codes.length)
        for (let offset = 0; offset < codes.length; offset += 1) {
            const code = codes[offset]
            if (seen.has(code)) continue
            seen.add(code)
            rows.push({
                code,
                name: normalizeName(names[offset] ?? name),
                credits: Number.isFinite(credits) ? credits : null,
                creditsLabel,
                prereqs: parseCodes(prereqRaw),
                prereqRaw,
                group,
                groupName,
            })
        }
    }

    if (!rows.length) warnings.push(`tabela ${group}: nenhuma optativa encontrada`)
    return rows
}

/**
 * Interpreta a matriz curricular 2019.
 *
 * @param {string} text conteúdo de data/sources/fisica/fisica-bacharelado-2019.txt
 */
export function parseMatriz2019(text) {
    const lines = normalizeLines(text)
    const warnings = []

    // ---- Seções do documento ----
    const sections = { resumo: [], 4.1: [], 4.2: [], 4.3: [] }
    let current = 'resumo'
    for (const line of lines) {
        const trimmed = line.trim()
        if (/^Tabela\s+4\.1\b/i.test(trimmed)) current = '4.1'
        else if (/^Tabela\s+4\.2\b/i.test(trimmed)) current = '4.2'
        else if (/^Tabela\s+4\.3\b/i.test(trimmed)) current = '4.3'
        sections[current].push(line)
    }

    // ---- Totais do resumo (Tabela 3.1) ----
    const resumo = sections.resumo.join('\n')
    const totals = {
        obligatoryCredits: null,
        obligatoryHours: null,
        optionalCredits: null,
        optionalHours: null,
        freeCredits: null,
        freeHours: null,
        totalCredits: null,
        totalHours: null,
    }
    const obligatory = resumo.match(
        /TOTAL\s+DE\s+OBRIGAT[ÓO]RIAS[^\n]*?(\d+)\s*h\s*=\s*(\d+)\s*cr/i
    )
    if (obligatory) {
        totals.obligatoryHours = Number(obligatory[1])
        totals.obligatoryCredits = Number(obligatory[2])
    }
    const optional = resumo.match(/TOTAL\s+DE\s+OPTATIVAS[^\n]*?(\d+)\s*h\s*=\s*(\d+)\s*cr/i)
    if (optional) {
        totals.optionalHours = Number(optional[1])
        totals.optionalCredits = Number(optional[2])
    }
    const nucleoGeral = resumo.match(/N[ÚU]CLEO\s+GERAL[^\n]*?(\d+)\s*cr/i)
    if (nucleoGeral) {
        totals.freeCredits = Number(nucleoGeral[1])
        totals.freeHours = totals.freeCredits * 15
    }
    const total = resumo.match(/^\s*TOTAL\s+(\d+)\s*h\s*=\s*(\d+)\s*cr/m)
    if (total) {
        totals.totalHours = Number(total[1])
        totals.totalCredits = Number(total[2])
    }
    for (const [field, value] of Object.entries(totals)) {
        if (value === null) warnings.push(`resumo: não foi possível ler ${field}`)
    }

    // ---- Tabela 4.1: obrigatórias ----
    const periods = parseObligatoryTable(sections['4.1'], warnings)

    // ---- Tabelas 4.2 (G1) e 4.3 (G9) ----
    const groups = {
        G1: parsePoolTable(sections['4.2'], 'G1', 'G1 — Optativas de Física', warnings),
        G9: parsePoolTable(sections['4.3'], 'G9', 'G9 — Optativas Gerais', warnings),
    }

    // A tabela 4.3 menciona as disciplinas da pós-graduação aproveitadas no
    // Grupo 26 (Formação Avançada em Física, G8).
    const posMatch = sections['4.3']
        .join('\n')
        .match(/FIS638\s*-\s*(T[ÓO]PICOS\s+AVAN[ÇC]ADOS\s+DE\s+F[ÍI]SICA)\s+(\d+)\s*cr[eé]ditos/i)
    if (posMatch) {
        groups.G8 = [
            {
                code: 'FIS638',
                name: normalizeName(posMatch[1]),
                credits: Number(posMatch[2]),
                creditsLabel: null,
                prereqs: [],
                prereqRaw: 'disciplinas da pós-graduação (ementa variável)',
                group: 'G8',
                groupName: 'G8 — Formação Avançada em Física (pós-graduação)',
            },
        ]
    } else {
        groups.G8 = []
    }

    const scheduledCodes = new Set(periods.flatMap((period) => period.rows.map((row) => row.code)))
    if (!scheduledCodes.size) warnings.push('tabela 4.1: nenhuma disciplina obrigatória encontrada')

    return {
        layout: 'matriz-2019',
        title: 'Física — Bacharelado (matriz 2019)',
        kind: 'bacharelado',
        shift: 'Diurno',
        totals,
        periods,
        groups,
        groupNames: {
            G1: 'G1 — Optativas de Física',
            G8: 'G8 — Formação Avançada em Física (pós-graduação)',
            G9: 'G9 — Optativas Gerais',
        },
        warnings,
    }
}

/** Metadados entre parênteses do Anexo A. */
function parseEmentaMetadata(metadata) {
    const text = collapse(metadata)
        .replace(/^\(/, '')
        .replace(/\)\s*$/, '')

    const credits = Number((text.match(/(\d{1,2})\s*(?:créditos|cr)\b/i) ?? [])[1] ?? NaN)
    const hours = Number((text.match(/(\d{1,3})\s*horas/i) ?? [])[1] ?? NaN)
    const period = text.match(/(\d{1,2})\s*[ºo]\s*per/i)
    const bac = text.match(/\b(OB|OP\d*|OPAv)\s*[-–]\s*Bac\b/i)
    const licOnly = /\b(?:OB|OP\d*|OPAv)\s*[-–]\s*Lic\b/i.test(text) && !bac
    const prereqRaw = (text.match(/Pr[ée](?:-requisitos?)?\s*:\s*(.*)$/i) ?? [])[1] ?? ''
    const coreqText = (text.match(/C[óo]\s*:\s*(.*)$/i) ?? [])[1] ?? ''
    // "Pré: FIS065; Có: MAT002" — o co-requisito não é pré-requisito.
    const prereqText = prereqRaw.split(/\s*[;,]?\s*C[óo]\s*:/)[0]

    return {
        credits: Number.isFinite(credits) ? credits : null,
        hours: Number.isFinite(hours) ? hours : null,
        period: period ? Number(period[1]) : null,
        bacNature: bac ? bac[1].toLocaleUpperCase('pt-BR') : licOnly ? null : 'OB',
        licOnly,
        prereqs: parseCodes(prereqText),
        prereqText: collapse(prereqText),
        coreqs: parseCodes(coreqText),
        raw: text,
    }
}

function cleanEntryName(raw) {
    let name = collapse(raw).replace(/^[-–]\s*/, '')
    name = name.replace(/\s*[-–]\s*\d+\s*h\s*[-–]\s*\(.*\)\s*$/, '')
    name = name.replace(/\s*[-–]\s*\(.*\)\s*$/, '')
    return normalizeName(name)
}

/**
 * Interpreta o Anexo A (ementas).
 *
 * @param {string} text conteúdo de data/sources/fisica/ementas-fisica-2019.txt
 * @returns {{byCode: Map<string, object>, entries: object[], sections: string[], warnings: string[]}}
 */
export function parseEmentas(text) {
    const lines = normalizeLines(text).filter((line) => !/^\s*\d{1,3}\s*$/.test(line))
    const byCode = new Map()
    const sections = []
    const warnings = []
    let section = null
    let current = null

    const addEntry = (entry) => {
        const existing = byCode.get(entry.code)
        if (!existing) {
            byCode.set(entry.code, entry)
            return
        }
        // FIS638 aparece duas vezes (Mecânica Analítica e Mecânica Estatística da
        // pós-graduação): a ementa é variável e os pré-requisitos dependem da
        // disciplina efetivamente cursada.
        existing.variants = [...(existing.variants ?? []), entry]
        existing.ementa = null
        existing.prereqs = []
        existing.note = 'Ementa variável (disciplinas da pós-graduação)'
    }

    const flush = () => {
        if (!current) return
        const { code, name, rawLines } = current
        current = null

        let metadata = null
        let body = []
        const metadataIndex = rawLines.findIndex((line) => /^\s*\(\s*\d/.test(line))
        if (metadataIndex !== -1) {
            body = rawLines.slice(0, metadataIndex)
            const metaLines = [rawLines[metadataIndex]]
            let index = metadataIndex + 1
            while (
                index < rawLines.length &&
                !metaLines[metaLines.length - 1].trim().endsWith(')')
            ) {
                metaLines.push(rawLines[index])
                index += 1
            }
            metadata = metaLines.join(' ')
        } else {
            body = rawLines
        }

        const ementa = collapse(
            body
                .map((line) => line.trim())
                .filter(Boolean)
                .join(' ')
                .replace(/\s+/g, ' ')
        )

        const parsedMeta = metadata ? parseEmentaMetadata(metadata) : null
        addEntry({
            code,
            name,
            section,
            ementa: ementa || null,
            metadata: parsedMeta,
            credits: parsedMeta?.credits ?? null,
            hours: parsedMeta?.hours ?? null,
            period: parsedMeta?.period ?? null,
            bacNature: parsedMeta?.bacNature ?? null,
            prereqs: parsedMeta?.prereqs ?? [],
            prereqText: parsedMeta?.prereqText ?? '',
            coreqs: parsedMeta?.coreqs ?? [],
            rawMetadata: parsedMeta?.raw ?? null,
        })
    }

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        if (isSectionHeader(rawLine)) {
            flush()
            section = line
            sections.push(line)
            continue
        }

        // Entrada especial da pós-graduação: "FIS Mecânica Analítica (Pós) :
        // entrará como - FIS638 - TÓPICOS AVANÇADOS DE FÍSICA".
        const pos = line.match(
            /^FIS\s+.+?\(Pós\)\s*:\s*entrará\s+como\s*[-–]\s*([A-Z]{3}\d{3})\s*[-–]\s*(.+)$/i
        )
        if (pos) {
            flush()
            current = { code: pos[1], name: cleanEntryName(pos[2]), rawLines: [] }
            continue
        }

        // Cabeçalho de disciplina: código no início da linha.
        const header = line.match(/^([A-Z]{3}\d{3})\s*[-–]?\s+(.+)$/)
        if (header) {
            flush()
            current = { code: header[1], name: cleanEntryName(header[2]), rawLines: [] }
            continue
        }

        if (!current) continue

        // Rodapé de página eventual ("40", "41", ...) já removido; nomes de
        // seção que escapam da heurística são descartados.
        if (uppercaseRatio(line) >= 0.95 && line.length < 60 && !/[.;:]$/.test(line)) {
            continue
        }

        current.rawLines.push(line)
    }
    flush()

    const entries = [...byCode.values()]
    if (!entries.length) warnings.push('ementas: nenhuma disciplina encontrada')

    return { byCode, entries, sections, warnings }
}

export const __testables = {
    CODE,
    parseCodes,
    parseObligatoryTable,
    parsePoolTable,
    parseEmentaMetadata,
    expandNames,
    expandCodeList,
    isSectionHeader,
}
