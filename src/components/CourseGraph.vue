<script setup>
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Network } from 'vis-network/esnext'
import { DataSet } from 'vis-data/esnext'
import 'vis-network/styles/vis-network.css'

const props = defineProps({
    graph: { type: Object, required: true },
    status: { type: Map, required: true },
})

const emit = defineEmits(['show-details', 'choose-slot'])

const theme = inject('theme', null)
const container = ref(null)

let network = null
let nodesSet = null
let edgesSet = null

// Um arrasto não deve ser confundido com um clique: ignoramos cliques que
// acontecerem durante o gesto ou logo depois que ele termina.
const CLICK_AFTER_DRAG_MS = 250
let dragging = false
let lastDragEnd = 0

const COLORS = {
    taken: { background: '#3b82f6', border: '#1d4ed8' },
    available: { background: '#34d399', border: '#047857' },
    blocked: { background: '#d1d5db', border: '#6b7280' },
    slot: { background: '#c4b5fd', border: '#7c3aed' },
    chosen: { background: '#a78bfa', border: '#6d28d9' },
}

/**
 * Repete a cor de estado em hover/highlight. Sem isso o vis-network aplica o
 * destaque padrão (fundo branco) ao passar o mouse ou ao arrastar o nó, e a cor
 * de "já cursada"/"pode cursar" parece sumir.
 */
function paint(color) {
    return {
        ...color,
        hover: { background: color.background, border: color.border },
        highlight: { background: color.background, border: color.border },
    }
}

function colorFor(node) {
    if (node.kind === 'slot') {
        // cursada (azul) > escolhida (roxo forte) > espaço vazio (roxo claro)
        if (props.status.get(node.id) === 'taken') return paint(COLORS.taken)
        return paint(node.chosen ? COLORS.chosen : COLORS.slot)
    }
    return paint(COLORS[props.status.get(node.id)] ?? COLORS.blocked)
}

function labelColor() {
    // Os nós usam fundos claros em ambos os temas, então o rótulo é sempre escuro.
    return '#111827'
}

function edgeColor() {
    return theme?.isDark?.value ? '#4b5563' : '#9ca3af'
}

function baseOptions() {
    return {
        autoResize: true,
        physics: false,
        layout: { improvedLayout: false, randomSeed: 7 },
        interaction: {
            hover: true,
            selectable: false,
            dragNodes: true,
            tooltipDelay: 150,
            zoomView: true,
            navigationButtons: false,
            keyboard: false,
        },
        nodes: {
            shape: 'box',
            margin: { top: 8, right: 10, bottom: 8, left: 10 },
            borderWidth: 1,
            shapeProperties: { borderRadius: 6 },
            widthConstraint: { maximum: 190 },
            font: {
                size: 14,
                face: 'ui-sans-serif, system-ui, sans-serif',
                color: labelColor(),
                multi: 'html',
            },
        },
        edges: {
            arrows: { to: { enabled: true, scaleFactor: 0.7 } },
            color: { color: edgeColor(), highlight: '#3b82f6', hover: '#3b82f6' },
            width: 1,
            smooth: { enabled: true, type: 'horizontal', roundness: 0.35 },
            hoverWidth: 0.3,
        },
    }
}

const LEVEL_SPACING = 260
const ROW_SPACING = 80
const HEADER_OFFSET = -110

function levelHeaders(nodes) {
    const levels = [...new Set(nodes.map((node) => Number(node.level) || 1))].sort((a, b) => a - b)
    const disciplineLevels = nodes
        .filter((node) => node.kind !== 'slot')
        .map((node) => Number(node.level) || 1)
    const lastPeriod = disciplineLevels.length ? Math.max(...disciplineLevels) : 0
    // slots fora dos períodos (fallback para dados antigos) ganham coluna própria
    const slotLevel = nodes.find(
        (node) => node.kind === 'slot' && Number(node.level) > lastPeriod
    )?.level
    return levels.map((level) => ({
        id: `__level_${level}`,
        label: level === slotLevel ? 'Optativas' : `Período ${level}`,
        x: level * LEVEL_SPACING,
        y: HEADER_OFFSET,
        fixed: { x: true, y: true },
        shape: 'text',
        font: { size: 14, color: '#9ca3af', face: 'ui-sans-serif, system-ui, sans-serif' },
        chosen: false,
    }))
}

function nodePositions(nodes) {
    const counts = new Map()
    const items = nodes.map((node) => {
        const level = Number(node.level) || 1
        const index = counts.get(level) ?? 0
        counts.set(level, index + 1)
        return {
            id: node.id,
            label: node.label,
            title: node.title,
            x: level * LEVEL_SPACING,
            y: index * ROW_SPACING,
            fixed: { x: true },
        }
    })
    return [...levelHeaders(nodes), ...items]
}

function buildDataset() {
    const nodes = nodePositions(props.graph.nodes).map((node) => {
        if (node.shape === 'text') return node
        const source = props.graph.nodes.find((candidate) => candidate.id === node.id)
        return { ...node, color: colorFor(source) }
    })
    const edges = props.graph.edges.map((edge, index) => ({
        id: `edge-${index}`,
        from: edge.from,
        to: edge.to,
    }))
    return { nodes: new DataSet(nodes), edges: new DataSet(edges) }
}

function destroyNetwork() {
    dragging = false
    if (network) {
        network.destroy()
        network = null
        nodesSet = null
        edgesSet = null
    }
}

function mountNetwork(options = {}) {
    const previousView =
        options.keepView && network
            ? {
                  position: network.getViewPosition(),
                  scale: network.getScale(),
              }
            : null

    destroyNetwork()
    if (!container.value || !props.graph.nodes.length) return

    const datasets = buildDataset()
    nodesSet = datasets.nodes
    edgesSet = datasets.edges

    network = new Network(container.value, { nodes: nodesSet, edges: edgesSet }, baseOptions())

    const kindById = new Map(props.graph.nodes.map((node) => [node.id, node.kind]))

    network.on('click', (params) => {
        // O evento "click" do vis-network traz params.nodes apenas quando há seleção;
        // como os nós não são selecionáveis, fazemos o hit-test pelo ponteiro.
        // Um arrasto (mover o nó) não deve abrir o painel de detalhes.
        if (dragging || Date.now() - lastDragEnd < CLICK_AFTER_DRAG_MS) return
        const nodeId = network.getNodeAt(params.pointer.DOM)
        if (nodeId === undefined || nodeId === null) return
        network.unselectAll()
        if (String(nodeId).startsWith('__level_')) return
        if (kindById.get(nodeId) === 'slot') {
            emit('choose-slot', nodeId)
            return
        }
        emit('show-details', nodeId)
    })

    network.on('dragStart', () => {
        dragging = true
    })

    // O arrasto vertical é permitido (para reorganizar dentro do período), mas o
    // vis-network seleciona o nó durante o gesto e guarda a posição só no modelo
    // interno. Gravamos a posição no DataSet e limpamos a seleção para a cor de
    // estado continuar valendo.
    network.on('dragEnd', () => {
        const positions = network.getPositions()
        const changed = Object.entries(positions)
            .filter(([id]) => !String(id).startsWith('__level_'))
            .map(([id, point]) => ({ id, x: point.x, y: point.y }))
        if (changed.length) nodesSet.update(changed)
        network.unselectAll()
        refreshColors()
        dragging = false
        lastDragEnd = Date.now()
    })

    // expõe a instância para depuração/ testes e2e: abra a página com ?debug=1
    if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
        window.__graphNetwork = network
    }

    if (previousView) {
        network.moveTo({ ...previousView, animation: false })
    } else {
        scheduleInitialView(0)
    }
}

/** Espera o container ganhar dimensões antes de posicionar a câmera. */
function scheduleInitialView(attempt) {
    requestAnimationFrame(() => {
        if (!network) return
        if (
            !container.value ||
            container.value.clientWidth < 50 ||
            container.value.clientHeight < 50
        ) {
            if (attempt < 6) setTimeout(() => scheduleInitialView(attempt + 1), 60)
            return
        }
        goToStart()
        // segunda passada: o canvas pode terminar de dimensionar depois do 1º frame
        setTimeout(() => {
            if (network) goToStart()
        }, 300)
    })
}

/** Bounding box do conteúdo, com folga para os nós e os cabeçalhos de período. */
function contentBounds(positions) {
    const points = Object.values(positions).filter(Boolean)
    if (!points.length) return null
    return {
        minX: Math.min(...points.map((point) => point.x)) - 120,
        maxX: Math.max(...points.map((point) => point.x)) + 120,
        minY: Math.min(...points.map((point) => point.y)) - 30,
        maxY: Math.max(...points.map((point) => point.y)) + 34,
    }
}

/**
 * Enquadra a grade inteira (disciplinas + coluna de optativas + cabeçalhos de
 * período) centralizada nos dois eixos. O `network.fit()` nativo nem sempre
 * centraliza bem e o ajuste de escala posterior jogava o conteúdo para o canto.
 */
function fitAll() {
    if (!network || !container.value) return

    const bounds = contentBounds(network.getPositions())
    if (!bounds) return

    const width = container.value.clientWidth
    const height = container.value.clientHeight
    const margin = 16
    const scale = Math.max(
        0.2,
        Math.min(
            1.15,
            Math.min(
                (width - margin * 2) / Math.max(1, bounds.maxX - bounds.minX),
                (height - margin * 2) / Math.max(1, bounds.maxY - bounds.minY)
            )
        )
    )

    network.moveTo({
        scale,
        position: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
        animation: { duration: 350, easingFunction: 'easeInOutQuad' },
    })
}

/**
 * Desenha a marca do projeto (grafo de 3 nós) no canto da imagem exportada.
 * É desenhada direto no canvas para não depender do carregamento do SVG.
 */
function drawBrandMark(context, x, y, size) {
    const radius = size * 0.22
    context.save()
    context.beginPath()
    context.moveTo(x + radius, y)
    context.arcTo(x + size, y, x + size, y + size, radius)
    context.arcTo(x + size, y + size, x, y + size, radius)
    context.arcTo(x, y + size, x, y, radius)
    context.arcTo(x, y, x + size, y, radius)
    context.closePath()
    context.fillStyle = '#2563eb'
    context.fill()

    const nodes = [
        [0.5, 0.297],
        [0.289, 0.695],
        [0.711, 0.695],
    ]
    context.strokeStyle = '#ffffff'
    context.lineWidth = size * 0.0625
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(x + nodes[0][0] * size, y + nodes[0][1] * size)
    context.lineTo(x + nodes[1][0] * size, y + nodes[1][1] * size)
    context.lineTo(x + nodes[2][0] * size, y + nodes[2][1] * size)
    context.lineTo(x + nodes[0][0] * size, y + nodes[0][1] * size)
    context.stroke()

    context.fillStyle = '#ffffff'
    for (const [nodeX, nodeY] of nodes) {
        context.beginPath()
        context.arc(x + nodeX * size, y + nodeY * size, size * 0.109, 0, Math.PI * 2)
        context.fill()
    }
    context.restore()
}

/**
 * Renderiza a grade inteira num canvas fora da tela, em resolução natural
 * (escala 1), para gerar uma imagem que aguenta zoom. Retorna o data URL.
 */
async function renderGraphImage() {
    if (!network || !nodesSet || !edgesSet) return null

    const bounds = contentBounds(network.getPositions())
    if (!bounds) return null

    const dpr = window.devicePixelRatio || 1
    const contentWidth = bounds.maxX - bounds.minX
    const contentHeight = bounds.maxY - bounds.minY
    // 2x a escala natural deixa o texto grande o suficiente para dar zoom na
    // imagem; limita o lado do canvas para não estourar memória em cursos largos
    const maxCssSide = 14000 / dpr
    const scale = Math.min(2, maxCssSide / Math.max(contentWidth, contentHeight))
    const width = Math.max(1, Math.ceil(contentWidth * scale))
    const height = Math.max(1, Math.ceil(contentHeight * scale))

    const wrapper = document.createElement('div')
    wrapper.style.cssText = `position: fixed; left: -100000px; top: 0; width: ${width}px; height: ${height}px;`
    document.body.appendChild(wrapper)

    const cloneNode = (item) => ({ ...item })
    const exportNodes = new DataSet(nodesSet.get().map(cloneNode))
    const exportEdges = new DataSet(edgesSet.get().map(cloneNode))

    const exportNetwork = new Network(
        wrapper,
        { nodes: exportNodes, edges: exportEdges },
        {
            ...baseOptions(),
            autoResize: false,
            interaction: {
                ...baseOptions().interaction,
                hover: false,
                dragNodes: false,
                zoomView: false,
            },
        }
    )

    try {
        const drawn = new Promise((resolve) => {
            const timer = setTimeout(resolve, 1500)
            exportNetwork.once('afterDrawing', () => {
                clearTimeout(timer)
                setTimeout(resolve, 150)
            })
        })

        exportNetwork.moveTo({
            scale,
            position: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
            animation: false,
        })
        await drawn

        const source = exportNetwork.canvas.frame.canvas
        const padding = Math.round(20 * dpr * scale)
        const output = document.createElement('canvas')
        output.width = source.width + padding * 2
        output.height = source.height + padding * 2
        const context = output.getContext('2d')
        context.fillStyle = theme?.isDark?.value ? '#111827' : '#ffffff'
        context.fillRect(0, 0, output.width, output.height)
        context.drawImage(source, padding, padding)

        // marca do projeto no canto inferior direito, proporcional ao tamanho
        const markSize = Math.min(
            180,
            Math.max(48 * dpr, Math.round(Math.min(output.width, output.height) * 0.035))
        )
        const markMargin = Math.round(18 * dpr)
        drawBrandMark(
            context,
            output.width - markSize - markMargin,
            output.height - markSize - markMargin,
            Math.round(markSize)
        )

        return output.toDataURL('image/png')
    } finally {
        exportNetwork.destroy()
        wrapper.remove()
    }
}

/** Nome de arquivo seguro (sem acentos/espaços) para o download do grafo. */
function safeFileName(value) {
    const base = String(value ?? 'grafo')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
    return base || 'grafo'
}

/** Baixa a imagem do grafo (PNG em alta resolução, enquadrado como o Ajustar). */
async function exportImage(fileBase = 'grafo') {
    try {
        const dataUrl = await renderGraphImage()
        if (!dataUrl) return

        // Blob é mais confiável que data URL para arquivos grandes e preserva o
        // nome definido em `download` em todos os navegadores.
        const blob = await (await fetch(dataUrl)).blob()
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = `${safeFileName(fileBase)}-grafo.png`
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
    } catch (error) {
        console.error('não foi possível exportar a imagem do grafo', error)
    }
}

/**
 * Câmera inicial: começa nos primeiros períodos com zoom 100% (texto nítido).
 * O grafo inteiro pode ser visto pelo botão "Ajustar".
 */
function goToStart() {
    if (!network || !container.value) return

    const nodes = props.graph.nodes
    const levels = nodes.map((node) => Number(node.level) || 1)
    // O centro vertical considera só as disciplinas: uma coluna de optativas
    // grande (ex.: 13 slots) não deve empurrar os períodos para fora da tela.
    const disciplineLevels = nodes
        .filter((node) => node.kind !== 'slot')
        .map((node) => Number(node.level) || 1)
    const rowsByLevel = new Map()
    for (const level of disciplineLevels.length ? disciplineLevels : levels) {
        rowsByLevel.set(level, (rowsByLevel.get(level) ?? 0) + 1)
    }

    const minX = Math.min(...levels) * LEVEL_SPACING
    const minY = HEADER_OFFSET
    const maxY = (Math.max(...rowsByLevel.values()) - 1) * ROW_SPACING
    const width = container.value.clientWidth
    const scale = 1

    network.moveTo({
        scale,
        position: {
            x: minX - 140 + width / 2 / scale,
            y: (minY + maxY) / 2,
        },
        animation: false,
    })
}

function refreshColors() {
    if (!nodesSet) return
    for (const node of props.graph.nodes) {
        const current = nodesSet.get(node.id)
        if (!current) continue
        nodesSet.update({ id: node.id, color: colorFor(node) })
    }
}

function focusNode(code) {
    if (!network || !code) return
    network.selectNodes([code])
    network.focus(code, {
        scale: 1.1,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' },
    })
}

defineExpose({ focusNode, fitAll, exportImage, renderGraphImage })

// hook de depuração/testes e2e: abra a página com ?debug=1
if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
    window.__renderGraphImage = renderGraphImage
}

watch(
    () => props.graph,
    () => mountNetwork({ keepView: true })
)

watch(
    () => props.status,
    () => refreshColors()
)

watch(
    () => theme?.isDark?.value,
    () => {
        if (!network) return
        network.setOptions({
            nodes: { font: { color: labelColor() } },
            edges: { color: { color: edgeColor() } },
        })
    }
)

onMounted(mountNetwork)

onBeforeUnmount(destroyNetwork)
</script>

<template>
    <div ref="container" class="h-full w-full"></div>
</template>
